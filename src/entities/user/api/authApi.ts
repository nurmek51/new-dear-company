import { loadTokens, request, saveTokens, type TokenPair } from '@/shared/api';
import type { ApiUser } from '../model/types';

interface AuthResponse extends TokenPair {
  user: ApiUser;
  is_new_user?: boolean;
}

/** POST /api/v1/auth/login/ (spec §1.4) — email or phone in `email`. */
export async function login(identifier: string, password: string): Promise<ApiUser> {
  const res = await request<AuthResponse>('/api/v1/auth/login/', {
    method: 'POST',
    anonymous: true,
    body: { email: identifier.trim(), password },
  });
  await saveTokens({ access: res.access, refresh: res.refresh });
  return res.user;
}

export interface RegisterInput {
  email: string;
  password1: string;
  password2: string;
  name: string;
  user_type: 'b2c' | 'b2b';
  organization_name?: string;
  designation?: string;
  organization_email?: string;
}

/** POST /api/v1/auth/registration/ (spec §1.1) → verification e-mail sent. */
export async function register(input: RegisterInput): Promise<{ detail: string }> {
  return request<{ detail: string }>('/api/v1/auth/registration/', {
    method: 'POST',
    anonymous: true,
    body: input,
  });
}

/** POST /api/v1/auth/registration/verify-email/ (spec §1.2). */
export async function verifyEmail(key: string): Promise<void> {
  await request('/api/v1/auth/registration/verify-email/', { method: 'POST', anonymous: true, body: { key } });
}

/** POST /api/v1/auth/registration/resend-email/ (spec §1.3). */
export async function resendVerification(email: string): Promise<void> {
  await request('/api/v1/auth/registration/resend-email/', { method: 'POST', anonymous: true, body: { email } });
}

/** GET /api/v1/auth/user/ (spec §1.5). */
export async function fetchMe(): Promise<ApiUser> {
  return request<ApiUser>('/api/v1/auth/user/');
}

/** PATCH /api/v1/auth/user/ — only `name` and `profile_picture` are writable (spec §1.5). */
export async function updateMe(patch: { name?: string }): Promise<ApiUser> {
  return request<ApiUser>('/api/v1/auth/user/', { method: 'PATCH', body: patch });
}

/** POST /api/v1/accounts/profile-picture/upload/ (spec §1.13) — max 10MB jpeg/png/webp. */
export async function uploadProfilePicture(form: FormData): Promise<unknown> {
  return request('/api/v1/accounts/profile-picture/upload/', { method: 'POST', form });
}

/**
 * POST /api/v1/auth/logout/ (spec §1.8). On web the refresh cookie is enough;
 * native has no cookie jar, so the stored refresh token goes in the body.
 */
export async function logout(): Promise<void> {
  const tokens = await loadTokens();
  await request('/api/v1/auth/logout/', {
    method: 'POST',
    body: tokens?.refresh ? { refresh: tokens.refresh } : {},
  });
}

/** POST /api/v1/auth/password/change/ (spec §1.10). */
export async function changePassword(old_password: string, new_password1: string, new_password2: string): Promise<void> {
  await request('/api/v1/auth/password/change/', {
    method: 'POST',
    body: { old_password, new_password1, new_password2 },
  });
}

/** POST /api/v1/auth/password/reset/ (spec §1.10) — always 200. */
export async function requestPasswordReset(email: string): Promise<void> {
  await request('/api/v1/auth/password/reset/', { method: 'POST', anonymous: true, body: { email } });
}

/** POST /api/v1/accounts/check-email/ (spec §1.13). */
export async function checkEmailExists(email: string): Promise<boolean> {
  const r = await request<{ exists: boolean }>('/api/v1/accounts/check-email/', {
    method: 'POST',
    anonymous: true,
    body: { email },
  });
  return r.exists;
}

/** POST /api/v1/auth/social/google/ (spec §1.12) with an id_token. */
export async function loginWithGoogle(id_token: string): Promise<ApiUser> {
  const res = await request<AuthResponse>('/api/v1/auth/social/google/', {
    method: 'POST',
    anonymous: true,
    body: { id_token },
  });
  await saveTokens({ access: res.access, refresh: res.refresh });
  return res.user;
}
