import { Platform } from 'react-native';

/**
 * Backend configuration (API_INTEGRATION_SPEC.md §0).
 *
 * The app talks to the Django REST API and nothing else — there is no offline
 * or in-memory data source. `EXPO_PUBLIC_API_BASE_URL` must be set at build
 * time; the special values `/` and `same-origin` mean "the origin this web
 * build is served from" (the usual reverse-proxy deployment). When the value
 * is missing the app renders a configuration error instead of guessing.
 */
const SAME_ORIGIN_ALIASES = ['/', 'same-origin', 'same_origin'];

function resolveBaseUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_BASE_URL?.trim() ?? '';
  if (!explicit) return '';
  if (SAME_ORIGIN_ALIASES.includes(explicit.toLowerCase())) {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return window.location.origin.replace(/\/+$/, '');
    }
    return '';
  }
  return explicit.replace(/\/+$/, '');
}

export const API_BASE_URL = resolveBaseUrl();

/** False → every screen is blocked by the configuration error state. */
export const isApiConfigured = API_BASE_URL.length > 0;

/** Google Identity Services client id; the button is hidden when unset. */
export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() || undefined;

/** Public web origin, used to build Stripe return URLs on native. */
export const WEB_ORIGIN = process.env.EXPO_PUBLIC_WEB_ORIGIN?.trim().replace(/\/+$/, '') || undefined;

/** Default per-request timeout; long AI/upload calls pass their own. */
function positiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const REQUEST_TIMEOUT_MS = positiveNumber(process.env.EXPO_PUBLIC_REQUEST_TIMEOUT_MS, 30_000);

export const TOKEN_STORAGE_KEY = '@dear-company/jwt';
