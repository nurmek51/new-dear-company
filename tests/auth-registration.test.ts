import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { login, register } from '@/entities/user/api/authApi';
import { normalizePhone, PHONE_ERROR } from '@/entities/user/model/phone';
import { clearTokens } from '@/shared/api/tokens';

describe('seeker registration', () => {
  beforeEach(async () => { await clearTokens(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it.each(['+77001234567', '77001234567', '+7 (700) 123-45-67'])('normalizes %s in the registration request', async (phone) => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, text: async () => '{"detail":"Verification sent."}' });
    vi.stubGlobal('fetch', fetchMock);
    await register({ email: 'seeker@example.com', phone_number: phone, name: 'Seeker', user_type: 'b2c', password1: 'password123', password2: 'password123' });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ user_type: 'b2c', phone_number: '+77001234567' });
  });

  it('blocks an invalid phone before calling the backend', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(register({ email: 'seeker@example.com', phone_number: '123abc456789', name: 'Seeker', user_type: 'b2c', password1: 'password123', password2: 'password123' })).rejects.toThrow(PHONE_ERROR);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([undefined, '', '   '])('omits an empty optional phone (%s)', async (phone) => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, text: async () => '{}' });
    vi.stubGlobal('fetch', fetchMock);
    await register({ email: 'seeker@example.com', phone_number: phone, name: 'Seeker', user_type: 'b2b', password1: 'password123', password2: 'password123' });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).not.toHaveProperty('phone_number');
  });

  it.each([
    ['81321323243', '+81321323243'],
    ['+7 (700) 123-45-67', '+77001234567'],
    ['seeker@example.com', 'seeker@example.com'],
  ])('normalizes the login identifier %s', async (identifier, expected) => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '{"access":"a","refresh":"r","user":{}}' });
    vi.stubGlobal('fetch', fetchMock);
    await login(identifier, 'password123');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).email).toBe(expected);
  });
});

describe('phone format', () => {
  it('adds a plus without changing the supplied country code', () => {
    expect(normalizePhone('81321323243')).toBe('+81321323243');
  });

  it.each(['12345678', '1234567890123456', '++77001234567', '7+7001234567', '7700abc1234567', '0077001234567', '---', '+'])('rejects %s', (value) => {
    expect(normalizePhone(value)).toBeNull();
  });

  it.each(['123456789', '123456789012345'])('accepts the length boundary %s', (value) => {
    expect(normalizePhone(value)).toBe(`+${value}`);
  });
});
