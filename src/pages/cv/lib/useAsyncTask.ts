import { useCallback, useEffect, useRef, useState } from 'react';
import { classifyTaskEvent } from '@/entities/resume';
import { errorMessageFrom, subscribeEvents, type AsyncTaskTicket, type SseSubscription } from '@/shared/api';

export type TaskStatus = 'idle' | 'starting' | 'waiting' | 'done' | 'error';

export interface TaskState {
  status: TaskStatus;
  /** last progress message from the stream */
  message: string | null;
  result: unknown;
  error: string | null;
  /** true when the stream dropped/unsupported: offer "refresh manually" */
  streamLost: boolean;
  startedAt: number | null;
}

const IDLE: TaskState = { status: 'idle', message: null, result: null, error: null, streamLost: false, startedAt: null };

/** How long we wait on the SSE channel before offering the manual fallback. */
const SOFT_TIMEOUT_MS = 4 * 60 * 1000;

export type TaskStart = () => Promise<AsyncTaskTicket | { immediate: unknown }>;

/**
 * Drives one async AI flow (spec §0.2): call the endpoint, subscribe to its
 * `event_url`, surface progress/result/error. Cleans up on cancel and unmount.
 */
export function useAsyncTask() {
  const [state, setState] = useState<TaskState>(IDLE);
  const subRef = useRef<SseSubscription | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runIdRef = useRef(0);

  const teardown = useCallback(() => {
    subRef.current?.close();
    subRef.current = null;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  useEffect(() => teardown, [teardown]);

  const cancel = useCallback(() => {
    runIdRef.current += 1;
    teardown();
    setState(IDLE);
  }, [teardown]);

  const run = useCallback(
    async (start: TaskStart) => {
      runIdRef.current += 1;
      const myRun = runIdRef.current;
      teardown();
      setState({ ...IDLE, status: 'starting', startedAt: Date.now() });
      let ticket: AsyncTaskTicket | { immediate: unknown };
      try {
        ticket = await start();
      } catch (err) {
        if (myRun !== runIdRef.current) return;
        const e = err as { payload?: unknown; message?: string };
        setState({ ...IDLE, status: 'error', error: e.payload ? errorMessageFrom(e.payload, e.message) : (e.message ?? 'something went wrong') });
        return;
      }
      if (myRun !== runIdRef.current) return;
      if ('immediate' in ticket) {
        setState({ ...IDLE, status: 'done', result: ticket.immediate });
        return;
      }
      if (!ticket.event_url) {
        setState({ ...IDLE, status: 'error', error: 'the server accepted the task but gave no result channel', streamLost: true });
        return;
      }
      setState({ ...IDLE, status: 'waiting', startedAt: Date.now() });
      const sub = subscribeEvents(ticket.event_url, {
        onMessage: (msg) => {
          if (myRun !== runIdRef.current) return;
          const ev = classifyTaskEvent(msg.data, msg.event);
          if (ev.kind === 'progress') {
            setState((s) => ({ ...s, message: ev.message ?? s.message }));
            return;
          }
          teardown();
          if (ev.kind === 'error') setState({ ...IDLE, status: 'error', error: ev.message });
          else setState({ ...IDLE, status: 'done', result: ev.result });
        },
        onError: () => {
          if (myRun !== runIdRef.current) return;
          setState((s) => {
            if (s.status !== 'waiting') return s;
            teardown();
            return { ...s, status: 'error', error: 'the live connection dropped before the result arrived', streamLost: true };
          });
        },
      });
      subRef.current = sub;
      if (sub.unsupported) {
        teardown();
        setState({ ...IDLE, status: 'error', error: 'live updates are not supported on this device', streamLost: true });
        return;
      }
      timerRef.current = setTimeout(() => {
        if (myRun !== runIdRef.current) return;
        teardown();
        setState((s) => (s.status === 'waiting' ? { ...s, status: 'error', error: 'still no result after a few minutes', streamLost: true } : s));
      }, SOFT_TIMEOUT_MS);
    },
    [teardown],
  );

  return { state, run, cancel, reset: cancel };
}
