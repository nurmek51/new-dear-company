import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { register } from '@/entities/user/api/authApi';
import { clearTokens } from '@/shared/api/tokens';

describe('seeker registration', () => {
  beforeEach(async () => { await clearTokens(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('includes the seeker phone in the registration request', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, text: async () => '{"detail":"Verification sent."}' });
    vi.stubGlobal('fetch', fetchMock);
    await register({ email: 'seeker@example.com', phone_number: '+77001234567', name: 'Seeker', user_type: 'b2c', password1: 'password123', password2: 'password123' });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ user_type: 'b2c', phone_number: '+77001234567' });
  });
});
