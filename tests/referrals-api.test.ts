import { beforeEach, describe, expect, it, vi } from 'vitest';
import { referralsApi } from '@/entities/referral';
import { ApiError, clearTokens, saveTokens } from '@/shared/api';

function reply(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, text: async () => body == null ? '' : JSON.stringify(body) } as Response;
}

describe('referrals API contract', () => {
  beforeEach(async () => { await clearTokens(); });

  it('searches the public paginated list by company without exposing auth', async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(200, { count: 0, next: null, previous: null, results: [] }));
    globalThis.fetch = fetchMock;
    const page = await referralsApi.list('A & B', 2);
    expect(page.results).toEqual([]);
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.test/api/v1/referrals/referrers/?company=A%20%26%20B&page=2');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it('reads a missing own profile as empty and sends authenticated upsert', async () => {
    await saveTokens({ access: 'access-token', refresh: 'refresh-token' });
    const fetchMock = vi.fn().mockResolvedValueOnce(reply(404, { code: 'profile_not_found' })).mockResolvedValueOnce(reply(200, { id: 'profile-1', display_name: 'Aida' }));
    globalThis.fetch = fetchMock;
    expect(await referralsApi.myProfile()).toBeNull();
    const data = { display_name: 'Aida', company: 'Acme', roles: '', quote: '', telegram: 'aida_dev', linkedin: '' };
    await referralsApi.saveProfile(data);
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.test/api/v1/referrals/my-profile/');
    expect(fetchMock.mock.calls[1][1].method).toBe('PUT');
    expect(fetchMock.mock.calls[1][1].body).toBe(JSON.stringify(data));
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer access-token');
  });

  it('preserves the subscription_required code from protected contact response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(403, { code: 'subscription_required', detail: 'Plus subscription required.' }));
    globalThis.fetch = fetchMock;
    await expect(referralsApi.contact('referrer-1')).rejects.toMatchObject({ status: 403, payload: { code: 'subscription_required' } } satisfies Partial<ApiError>);
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.test/api/v1/referrals/referrers/referrer-1/contact/');
  });
});
