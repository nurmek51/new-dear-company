import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  buildQuery,
  errorMessageFrom,
  pageFromUrl,
  request,
  setUnauthorizedHandler,
  toPage,
} from '@/shared/api/http';
import { clearTokens, saveTokens } from '@/shared/api/tokens';
import { humanize } from '@/shared/api/enums';

type FetchMock = ReturnType<typeof vi.fn>;

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
    json: async () => body,
  } as unknown as Response;
}

/** Await a rejection and return it as an ApiError (fails the test otherwise). */
async function expectApiError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (e) {
    if (e instanceof ApiError) return e;
    throw e;
  }
  throw new Error('expected the request to reject');
}

let fetchMock: FetchMock;

beforeEach(async () => {
  await clearTokens();
  setUnauthorizedHandler(null);
  fetchMock = vi.fn();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('request()', () => {
  it('builds the URL from the configured base + query and sends no auth header when signed out', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ count: 0, next: null, previous: null, results: [] }));
    await request('/api/v1/jobs/search/', { query: { q: 'go', grade: ['senior', 'lead'] }, anonymous: true });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.test/api/v1/jobs/search/?q=go&grade=senior%2Clead');
    expect(init.method).toBe('GET');
    expect(init.headers.Accept).toBe('application/json');
    expect(init.headers.Authorization).toBeUndefined();
  });

  it('sends the stored access token as a Bearer header', async () => {
    await saveTokens({ access: 'acc-1', refresh: 'ref-1' });
    fetchMock.mockResolvedValue(jsonResponse({ pk: 'u1' }));
    await request('/api/v1/auth/user/');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer acc-1');
  });

  it('serializes a JSON body and sets Content-Type', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ detail: 'ok' }));
    await request('/api/v1/ats/apply-job/', { method: 'POST', body: { job: 'j1' } });
    const init = fetchMock.mock.calls[0][1];
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.body).toBe('{"job":"j1"}');
  });

  it('never sets Content-Type for multipart so the platform can add the boundary', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    const form = new FormData();
    await request('/api/v1/resumes/', { method: 'POST', form });
    const init = fetchMock.mock.calls[0][1];
    expect(init.headers['Content-Type']).toBeUndefined();
    expect(init.body).toBe(form);
  });

  it('refreshes once on 401 and retries the original request (spec §1.6)', async () => {
    await saveTokens({ access: 'stale', refresh: 'ref-1' });
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ detail: 'Token is invalid or expired' }, 401))
      .mockResolvedValueOnce(jsonResponse({ access: 'fresh', refresh: 'ref-2' }))
      .mockResolvedValueOnce(jsonResponse({ pk: 'u1' }));

    const out = await request<{ pk: string }>('/api/v1/auth/user/');

    expect(out.pk).toBe('u1');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.test/api/v1/auth/token/refresh/');
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe('Bearer fresh');
  });

  it('reports an unrecoverable session once when the refresh fails', async () => {
    await saveTokens({ access: 'stale', refresh: 'dead' });
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ detail: 'expired' }, 401))
      .mockResolvedValueOnce(jsonResponse({ detail: 'invalid' }, 401));

    await expect(request('/api/v1/auth/user/')).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('throws ApiError carrying the status and the parsed DRF body', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ non_field_errors: ['Unable to log in with provided credentials.'] }, 400));
    const err = await expectApiError(request('/api/v1/auth/login/', { method: 'POST', body: {}, anonymous: true }));
    expect(err.status).toBe(400);
    expect(err.message).toBe('Unable to log in with provided credentials.');
    expect(err.payload).toEqual({ non_field_errors: ['Unable to log in with provided credentials.'] });
    expect(err.isNetworkError).toBe(false);
  });

  it('turns a transport failure into a network ApiError instead of leaking the raw error', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const err = await expectApiError(request('/api/v1/jobs/search/', { anonymous: true }));
    expect(err.status).toBe(0);
    expect(err.isNetworkError).toBe(true);
    expect(err.message).toMatch(/could not reach the server/i);
  });

  it('aborts a request that exceeds its timeout', async () => {
    fetchMock.mockImplementation((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));
    const err = await expectApiError(request('/api/v1/jobs/search/', { anonymous: true, timeoutMs: 10 }));
    expect(err.status).toBe(0);
    expect(err.message).toMatch(/too long/i);
  });
});

describe('buildQuery (spec §2.3 comma-separated params)', () => {
  it('joins arrays with commas and skips empty values', () => {
    expect(buildQuery({ q: 'backend', grade: ['senior', 'lead'], work_format: [], page: 2, x: undefined, y: null, z: '' }))
      .toBe('?q=backend&grade=senior%2Clead&page=2');
  });
  it('returns an empty string when there is nothing to send', () => {
    expect(buildQuery()).toBe('');
    expect(buildQuery({})).toBe('');
  });
});

describe('errorMessageFrom (spec §0.2 non-uniform error shapes)', () => {
  it('reads detail / error / message / non_field_errors / field errors', () => {
    expect(errorMessageFrom({ detail: 'Not found.' })).toBe('Not found.');
    expect(errorMessageFrom({ error: 'No active subscription found' })).toBe('No active subscription found');
    expect(errorMessageFrom({ success: false, message: 'bad' })).toBe('bad');
    expect(errorMessageFrom({ non_field_errors: ['Unable to log in.'] })).toBe('Unable to log in.');
    expect(errorMessageFrom({ email: ['This field is required.'] })).toBe('email: This field is required.');
  });
  it('falls back for unknown payloads', () => {
    expect(errorMessageFrom(null, 'fallback')).toBe('fallback');
    expect(errorMessageFrom('text', 'fallback')).toBe('fallback');
  });
});

describe('pagination helpers', () => {
  it('extracts page numbers from DRF next/previous urls', () => {
    expect(pageFromUrl('https://api/x/?page=3&q=a')).toBe(3);
    expect(pageFromUrl(null)).toBeNull();
    expect(pageFromUrl('https://api/x/')).toBeNull();
  });
  it('normalizes bare arrays, envelopes and empty responses', () => {
    expect(toPage([1, 2])).toEqual({ count: 2, next: null, previous: null, results: [1, 2] });
    const env = { count: 9, next: '?page=2', previous: null, results: [1] };
    expect(toPage(env)).toBe(env);
    expect(toPage(null)).toEqual({ count: 0, next: null, previous: null, results: [] });
  });
});

describe('humanize', () => {
  it('lowercases and de-hyphenates enum values', () => {
    expect(humanize('interview-scheduled')).toBe('interview scheduled');
    expect(humanize('full_time')).toBe('full time');
  });
});
