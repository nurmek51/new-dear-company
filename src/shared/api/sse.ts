import { Platform } from 'react-native';
import { API_BASE_URL } from './config';
import { loadTokens } from './tokens';

/**
 * Server-Sent-Events subscriber for the async/AI flows (spec §0.2): every AI
 * endpoint returns `{task_id, event_id, event_url}` and the result arrives on
 * that channel, never in the initial HTTP response.
 *
 * The backend does NOT use a single event name: resume parsing and AI job
 * creation finish on `success`, while assessment / recommendations / resume /
 * cover-letter generation finish on `message`, and parsing also emits
 * `warning`. Failures arrive as `error`. We therefore listen to every named
 * event we know about plus the default one, and hand the payload to the caller
 * with its event name so it can tell progress from a terminal result.
 */
export const SSE_EVENT_NAMES = ['message', 'success', 'warning', 'error'] as const;
export type SseEventName = (typeof SSE_EVENT_NAMES)[number] | string;

export interface SseMessage {
  /** The SSE event name (`message` when the stream did not set one). */
  event: SseEventName;
  /** Parsed JSON payload, or the raw string when the frame was not JSON. */
  data: unknown;
  raw: string;
}

export interface SseHandlers {
  onMessage: (message: SseMessage) => void;
  onError?: (err: unknown) => void;
  onOpen?: () => void;
}

export interface SseSubscription {
  close: () => void;
  /** True when this platform cannot stream and the caller must poll/refresh. */
  unsupported?: boolean;
}

export function resolveEventUrl(eventUrl: string): string {
  if (/^https?:\/\//.test(eventUrl)) return eventUrl;
  return `${API_BASE_URL}${eventUrl.startsWith('/') ? eventUrl : `/${eventUrl}`}`;
}

function parseData(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/** `{"status": "error", ...}` and the `error` event both mean failure. */
export function isTerminalError(msg: SseMessage): boolean {
  if (msg.event === 'error') return true;
  const status = (msg.data as { status?: unknown } | null)?.status;
  return status === 'error' || status === 'failed';
}

/** Terminal success frames carry a completed/success/ready status. */
export function isTerminalSuccess(msg: SseMessage): boolean {
  const status = (msg.data as { status?: unknown } | null)?.status;
  return status === 'success' || status === 'completed' || status === 'ready';
}

export function subscribeEvents(eventUrl: string, handlers: SseHandlers): SseSubscription {
  const url = resolveEventUrl(eventUrl);

  if (Platform.OS === 'web' && typeof EventSource !== 'undefined') {
    const es = new EventSource(url, { withCredentials: true });
    es.onopen = () => handlers.onOpen?.();
    // The default handler covers unnamed frames only.
    es.onmessage = (ev) => handlers.onMessage({ event: 'message', data: parseData(ev.data), raw: ev.data });
    for (const name of SSE_EVENT_NAMES) {
      if (name === 'message') continue;
      es.addEventListener(name, (ev) => {
        const raw = (ev as MessageEvent).data as string;
        handlers.onMessage({ event: name, data: parseData(raw), raw });
      });
    }
    es.onerror = (err) => handlers.onError?.(err);
    return { close: () => es.close() };
  }

  const controller = new AbortController();
  let closed = false;
  (async () => {
    try {
      const tokens = await loadTokens();
      const res = await fetch(url, {
        headers: {
          Accept: 'text/event-stream',
          ...(tokens?.access ? { Authorization: `Bearer ${tokens.access}` } : {}),
        },
        signal: controller.signal,
      });
      const body = res.body as ReadableStream<Uint8Array> | null;
      if (!res.ok || !body) {
        handlers.onError?.(new Error(`SSE unavailable (${res.status})`));
        return;
      }
      handlers.onOpen?.();
      const reader = body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (!closed) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf('\n\n')) >= 0) {
          const frame = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          // A frame may carry `event:` plus one or more `data:` lines.
          let event: SseEventName = 'message';
          const dataLines: string[] = [];
          for (const line of frame.split('\n')) {
            if (line.startsWith('event:')) event = line.slice(6).trim() || 'message';
            else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
          }
          const raw = dataLines.join('\n');
          if (raw) handlers.onMessage({ event, data: parseData(raw), raw });
        }
      }
    } catch (err) {
      if (!closed) handlers.onError?.(err);
    }
  })();
  return {
    close: () => {
      closed = true;
      controller.abort();
    },
    unsupported: typeof ReadableStream === 'undefined',
  };
}

/** Shape every async AI endpoint returns before the SSE result (spec §0.2). */
export interface AsyncTaskTicket {
  task_id: string;
  event_id: string;
  event_url: string;
}
