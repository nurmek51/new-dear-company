import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { GOOGLE_WEB_CLIENT_ID } from '@/shared/api';
import { useT } from '@/shared/lib/useT';
import { OutlineBtn } from './AuthBits';

/** Minimal typing for Google Identity Services (https://accounts.google.com/gsi/client). */
interface GsiPromptNotification {
  isNotDisplayed?: () => boolean;
  isSkippedMoment?: () => boolean;
  isDismissedMoment?: () => boolean;
}
interface GsiId {
  initialize: (cfg: { client_id: string; callback: (r: { credential?: string }) => void; cancel_on_tap_outside?: boolean }) => void;
  prompt: (cb?: (n: GsiPromptNotification) => void) => void;
}
interface GsiWindow {
  google?: { accounts?: { id?: GsiId } };
  document?: Document;
}

const GSI_SRC = 'https://accounts.google.com/gsi/client';

function loadGsi(): Promise<GsiId | null> {
  const w = globalThis as unknown as GsiWindow;
  const existing = w.google?.accounts?.id;
  if (existing) return Promise.resolve(existing);
  const doc = typeof document === 'undefined' ? undefined : document;
  if (!doc) return Promise.resolve(null);
  return new Promise((resolve) => {
    const done = () => resolve((globalThis as unknown as GsiWindow).google?.accounts?.id ?? null);
    const prev = doc.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`);
    if (prev) {
      prev.addEventListener('load', done);
      prev.addEventListener('error', () => resolve(null));
      return;
    }
    const s = doc.createElement('script');
    s.src = GSI_SRC;
    s.async = true;
    s.defer = true;
    s.onload = done;
    s.onerror = () => resolve(null);
    doc.head.appendChild(s);
  });
}

/** Whether the Google button can be shown at all (web + configured client id). */
export const googleSignInAvailable = Platform.OS === 'web' && !!GOOGLE_WEB_CLIENT_ID;

/**
 * "continue with google" — only rendered when GOOGLE_WEB_CLIENT_ID is set on web.
 * Gets an id_token from Google Identity Services and hands it to `onIdToken`
 * (→ POST /api/v1/auth/social/google/, spec §1.12).
 */
export function GoogleButton({ onIdToken, onError, disabled }: { onIdToken: (idToken: string) => void; onError: (msg: string) => void; disabled?: boolean }) {
  const tr = useT();
  const [loading, setLoading] = useState(false);
  const idRef = useRef<GsiId | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const press = useCallback(async () => {
    if (loading || !GOOGLE_WEB_CLIENT_ID) return;
    setLoading(true);
    const id = idRef.current ?? (await loadGsi());
    if (!mounted.current) return;
    if (!id) {
      setLoading(false);
      onError(tr('google sign-in could not load. check your connection or use email + password.'));
      return;
    }
    if (!idRef.current) {
      idRef.current = id;
      id.initialize({
        client_id: GOOGLE_WEB_CLIENT_ID,
        cancel_on_tap_outside: true,
        callback: (r) => {
          if (!mounted.current) return;
          setLoading(false);
          if (r.credential) onIdToken(r.credential);
          else onError(tr('google did not return a token. please try again.'));
        },
      });
    }
    id.prompt((n) => {
      if (!mounted.current) return;
      if (n.isNotDisplayed?.() || n.isSkippedMoment?.() || n.isDismissedMoment?.()) {
        setLoading(false);
        if (n.isNotDisplayed?.()) onError(tr('google sign-in is blocked in this browser. use email + password instead.'));
      }
    });
  }, [loading, onError, onIdToken, tr]);

  if (!googleSignInAvailable) return null;
  return <OutlineBtn label={loading ? tr('waiting for google…') : tr('continue with google')} onPress={press} disabled={disabled || loading} />;
}
