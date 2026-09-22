import { Platform } from 'react-native';
import { API_BASE_URL, isApiConfigured, REQUEST_TIMEOUT_MS } from './config';
import { clearTokens, loadTokens, saveTokens } from './tokens';

/**
 * Normalized API failure. `status` is the HTTP status, or 0 for a transport
 * failure (offline, DNS, CORS, timeout) — see `isNetworkError`.
 */
export class ApiError extends Error {
  status: number;
  payload: unknown;
  constructor(status: number, message: string, payload: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }

  /** True when the request never reached the API. */
  get isNetworkError(): boolean {
    return this.status === 0;
  }

  /** True when the session is missing or expired. */
  get isUnauthorized(): boolean {
    return this.status === 401;
  }
}

export type QueryValue = string | number | boolean | undefined | null | (string | number)[];

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** JSON body (ignored when `form` is set). */
  body?: unknown;
  /** multipart/form-data body. */
  form?: FormData;
  query?: Record<string, QueryValue>;
  /** Skip the Authorization header and the refresh retry (public endpoints). */
  anonymous?: boolean;
  /** Per-request timeout; defaults to REQUEST_TIMEOUT_MS. */
  timeoutMs?: number;
  signal?: AbortSignal;
}

/**
 * Error shapes are not uniform across apps (spec §0.2): DRF `{field: [..]}`,
 * `{detail}`, `{error}`, `{success:false,message}`. Reduce them to one line.
 */
export function errorMessageFrom(payload: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!payload || typeof payload !== 'object') return fallback;
  const p = payload as Record<string, unknown>;
  for (const key of ['detail', 'error', 'message']) {
    const v = p[key];
    if (typeof v === 'string' && v.trim()) return v;
  }
  const nfe = p.non_field_errors;
  if (Array.isArray(nfe) && typeof nfe[0] === 'string') return nfe[0];
  for (const [key, v] of Object.entries(p)) {
    if (Array.isArray(v) && typeof v[0] === 'string') return `${key}: ${v[0]}`;
    if (typeof v === 'string' && v.trim()) return `${key}: ${v}`;
  }
  return fallback;
}

export function buildQuery(query?: Record<string, QueryValue>): string {
  if (!query) return '';
  const parts: string[] = [];
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) {
      if (v.length === 0) continue;
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v.join(','))}`);
    } else {
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
    }
  }
  return parts.length ? `?${parts.join('&')}` : '';
}

/** Called when a refresh attempt fails — the session is unrecoverable. */
type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  onUnauthorized = handler;
}

let refreshInFlight: Promise<boolean> | null = null;

/** POST /api/v1/auth/token/refresh/ (spec §1.6) — single-flight. */
async function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const tokens = await loadTokens();
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/token/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: Platform.OS === 'web' ? 'include' : 'omit',
        body: JSON.stringify(tokens?.refresh ? { refresh: tokens.refresh } : {}),
      });
      if (!res.ok) {
        await clearTokens();
        return false;
      }
      const data = (await res.json()) as { access?: string; refresh?: string };
      if (data.access) {
        await saveTokens({ access: data.access, refresh: data.refresh ?? tokens?.refresh ?? '' });
      }
      return true;
    } catch {
      // Transport failure: keep the tokens, the session may still be valid.
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

function linkSignals(timeoutMs: number, external?: AbortSignal): { signal: AbortSignal; done: () => void; timedOut: () => boolean } {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onAbort = () => controller.abort();
  external?.addEventListener('abort', onAbort);
  return {
    signal: controller.signal,
    done: () => {
      clearTimeout(timer);
      external?.removeEventListener('abort', onAbort);
    },
    timedOut: () => timedOut,
  };
}

/**
 * Typed fetch wrapper for the Django API: Bearer auth from stored tokens,
 * cookies on web (spec §0.1), one retry after a token refresh on 401, and an
 * `ApiError` with the parsed body for everything else.
 */
export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  if (!isApiConfigured) {
    throw new ApiError(0, 'The API address is not configured (EXPO_PUBLIC_API_BASE_URL).', null);
  }
  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}${buildQuery(opts.query)}`;
  const timeoutMs = opts.timeoutMs ?? REQUEST_TIMEOUT_MS;

  const doFetch = async (): Promise<Response> => {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (!opts.anonymous) {
      const tokens = await loadTokens();
      if (tokens?.access) headers.Authorization = `Bearer ${tokens.access}`;
    }
    let body: BodyInit | undefined;
    if (opts.form) {
      // Let the platform set the multipart boundary.
      body = opts.form;
    } else if (opts.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(opts.body);
    }
    const link = linkSignals(timeoutMs, opts.signal);
    try {
      return await fetch(url, {
        method: opts.method ?? 'GET',
        headers,
        body,
        credentials: Platform.OS === 'web' ? 'include' : 'omit',
        signal: link.signal,
      });
    } catch (e) {
      if (link.timedOut()) throw new ApiError(0, 'The server took too long to answer. Please try again.', null);
      if (opts.signal?.aborted) throw e;
      throw new ApiError(0, 'Could not reach the server. Check your connection and try again.', null);
    } finally {
      link.done();
    }
  };

  let res = await doFetch();
  if (res.status === 401 && !opts.anonymous) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      res = await doFetch();
    }
    if (res.status === 401) onUnauthorized?.();
  }

  const text = await res.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }
  if (!res.ok) {
    throw new ApiError(res.status, errorMessageFrom(payload, `Request failed (${res.status})`), payload);
  }
  return payload as T;
}

/** DRF PageNumberPagination envelope (spec §0.2). */
export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/** Extract the `page` number from a DRF `next`/`previous` URL, if any. */
export function pageFromUrl(url: string | null): number | null {
  if (!url) return null;
  const m = /[?&]page=(\d+)/.exec(url);
  return m ? Number(m[1]) : null;
}

export function emptyPage<T>(): Paginated<T> {
  return { count: 0, next: null, previous: null, results: [] };
}

/** Some list endpoints return a bare array instead of the DRF envelope. */
export function toPage<T>(res: Paginated<T> | T[] | null | undefined): Paginated<T> {
  if (Array.isArray(res)) return { count: res.length, next: null, previous: null, results: res };
  if (res && Array.isArray(res.results)) return res;
  return emptyPage<T>();
}
