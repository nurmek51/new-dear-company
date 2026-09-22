import { create } from 'zustand';
import { ApiError, clearTokens, isApiConfigured, loadTokens, setUnauthorizedHandler } from '@/shared/api';
import * as authApi from '../api/authApi';
import type { ApiUser } from './types';

export type AuthStatus = 'initializing' | 'signedOut' | 'signedIn' | 'error';

interface AuthState {
  status: AuthStatus;
  user: ApiUser | null;
  submitting: boolean;
  /** Set for sign-in/registration failures shown next to the form. */
  error: string | null;
  /** Set when the session could not be restored because the API was unreachable. */
  initError: string | null;

  init: () => () => void;
  retryInit: () => Promise<void>;
  signIn: (identifier: string, password: string) => Promise<boolean>;
  register: (input: authApi.RegisterInput) => Promise<boolean>;
  signInGoogle: (idToken: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  setUser: (user: ApiUser) => void;
  reloadUser: () => Promise<void>;
  clearError: () => void;
}

function messageOf(e: unknown, fallback: string): string {
  return e instanceof ApiError ? e.message : fallback;
}

/**
 * Session state. The only source of truth is `GET /api/v1/auth/user/`
 * (spec §1.5): on web the httpOnly cookies alone can carry the session, on
 * native the stored JWT pair does.
 */
async function restoreSession(): Promise<{ user: ApiUser | null; unreachable: boolean }> {
  const tokens = await loadTokens();
  try {
    const user = await authApi.fetchMe();
    return { user, unreachable: false };
  } catch (e) {
    if (e instanceof ApiError && e.isNetworkError) {
      // Only report a connectivity problem to someone who had a session.
      return { user: null, unreachable: !!tokens };
    }
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
      await clearTokens();
      return { user: null, unreachable: false };
    }
    return { user: null, unreachable: !!tokens };
  }
}

export const useAuth = create<AuthState>((set, get) => ({
  status: 'initializing',
  user: null,
  submitting: false,
  error: null,
  initError: null,

  init: () => {
    let cancelled = false;

    // A failed refresh anywhere in the app ends the session exactly once.
    setUnauthorizedHandler(() => {
      if (get().status === 'signedIn') set({ status: 'signedOut', user: null });
    });

    if (!isApiConfigured) {
      set({ status: 'signedOut', user: null });
      return () => setUnauthorizedHandler(null);
    }

    void (async () => {
      const { user, unreachable } = await restoreSession();
      if (cancelled) return;
      if (user) set({ status: 'signedIn', user, initError: null });
      else if (unreachable) {
        set({ status: 'error', user: null, initError: 'could not reach the server. check your connection and retry.' });
      } else set({ status: 'signedOut', user: null, initError: null });
    })();

    return () => {
      cancelled = true;
      setUnauthorizedHandler(null);
    };
  },

  retryInit: async () => {
    set({ status: 'initializing', initError: null });
    const { user, unreachable } = await restoreSession();
    if (user) set({ status: 'signedIn', user, initError: null });
    else if (unreachable) {
      set({ status: 'error', user: null, initError: 'could not reach the server. check your connection and retry.' });
    } else set({ status: 'signedOut', user: null, initError: null });
  },

  signIn: async (identifier, password) => {
    if (get().submitting) return false;
    set({ submitting: true, error: null });
    try {
      const user = await authApi.login(identifier, password);
      set({ status: 'signedIn', user, initError: null });
      return true;
    } catch (e) {
      set({ error: messageOf(e, 'sign-in failed. please try again.') });
      return false;
    } finally {
      set({ submitting: false });
    }
  },

  register: async (input) => {
    if (get().submitting) return false;
    set({ submitting: true, error: null });
    try {
      await authApi.register(input);
      return true;
    } catch (e) {
      set({ error: messageOf(e, 'registration failed. please try again.') });
      return false;
    } finally {
      set({ submitting: false });
    }
  },

  signInGoogle: async (idToken) => {
    if (get().submitting) return false;
    set({ submitting: true, error: null });
    try {
      const user = await authApi.loginWithGoogle(idToken);
      set({ status: 'signedIn', user, initError: null });
      return true;
    } catch (e) {
      set({ error: messageOf(e, 'google sign-in failed. please try again.') });
      return false;
    } finally {
      set({ submitting: false });
    }
  },

  signOut: async () => {
    set({ submitting: true });
    try {
      // Blacklist server-side when possible, but always drop the local session.
      await authApi.logout().catch(() => undefined);
      await clearTokens();
      set({ status: 'signedOut', user: null, error: null, initError: null });
    } finally {
      set({ submitting: false });
    }
  },

  setUser: (user) => set({ user }),

  reloadUser: async () => {
    try {
      const user = await authApi.fetchMe();
      set({ user });
    } catch {
      /* keep the current user; callers surface their own error */
    }
  },

  clearError: () => set({ error: null }),
}));

export function useIsRecruiter(): boolean {
  return useAuth((s) => s.user?.user_type === 'b2b');
}

export function useIsSeeker(): boolean {
  return useAuth((s) => s.user?.user_type === 'b2c');
}
