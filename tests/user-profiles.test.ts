import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRecruiterProfile } from '@/entities/user/api/authApi';
import { isRecruiter, isSeeker, type ApiUser } from '@/entities/user/model/types';
import { ApiError } from '@/shared/api/http';
import { clearTokens, loadTokens, saveTokens } from '@/shared/api/tokens';

const user = (fields: Partial<ApiUser>): ApiUser => ({ pk: 'user-1', user_type: 'b2c', ...fields } as ApiUser);

describe('available account profiles', () => {
  it('allows both modes without changing the legacy registration type', () => {
    const dual = user({ roles: ['b2c', 'b2b'] });
    expect(isSeeker(dual)).toBe(true);
    expect(isRecruiter(dual)).toBe(true);
  });

  it('uses explicit roles as the source of truth', () => {
    expect(isRecruiter(user({ user_type: 'b2b', roles: ['b2c'] }))).toBe(false);
    expect(isSeeker(user({ roles: [] }))).toBe(false);
    expect(isRecruiter(null)).toBe(false);
    expect(isSeeker(null)).toBe(false);
  });

  it('keeps legacy permissions until the backend supplies roles', () => {
    expect(isSeeker(user({}))).toBe(true);
    expect(isRecruiter(user({}))).toBe(false);
    expect(isRecruiter(user({ user_type: 'b2b' }))).toBe(true);
    expect(isSeeker(user({ user_type: 'b2b' }))).toBe(false);
  });
});

describe('profile API contract', () => {
  beforeEach(async () => { await clearTokens(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('attaches a recruiter profile to the authenticated account and preserves its session', async () => {
    const tokens = { access: 'access-1', refresh: 'refresh-1' };
    await saveTokens(tokens);
    const updated = user({ roles: ['b2c', 'b2b'] });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, text: async () => JSON.stringify(updated) });
    vi.stubGlobal('fetch', fetchMock);
    const input = { organization_name: 'Acme', designation: 'HR Manager', organization_email: 'hr@acme.com' };

    await expect(createRecruiterProfile(input)).resolves.toEqual(updated);
    expect(fetchMock).toHaveBeenCalledWith('https://api.test/api/v1/accounts/recruiter-profile/', expect.objectContaining({
      method: 'POST', body: JSON.stringify(input), headers: expect.objectContaining({ Authorization: 'Bearer access-1' }),
    }));
    expect(await loadTokens()).toEqual(tokens);
  });

  it('keeps the current session when the backend has not implemented profile setup', async () => {
    const tokens = { access: 'access-1', refresh: 'refresh-1' };
    await saveTokens(tokens);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, text: async () => '{"detail":"Not found."}' }));
    await expect(createRecruiterProfile({ organization_name: 'Acme', designation: 'HR', organization_email: 'hr@acme.com' }))
      .rejects.toBeInstanceOf(ApiError);
    expect(await loadTokens()).toEqual(tokens);
  });
});
