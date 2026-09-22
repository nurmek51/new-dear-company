import AsyncStorage from '@react-native-async-storage/async-storage';
import { TOKEN_STORAGE_KEY } from './config';

/**
 * JWT pair storage (spec §0.1). Web can rely on the httpOnly cookies the API
 * sets, but we also keep the JSON pair so the same Bearer path works on native
 * and when cookies are blocked cross-site.
 */
export interface TokenPair {
  access: string;
  refresh: string;
}

let cached: TokenPair | null | undefined;

export async function loadTokens(): Promise<TokenPair | null> {
  if (cached !== undefined) return cached;
  try {
    const raw = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
    cached = raw ? (JSON.parse(raw) as TokenPair) : null;
  } catch {
    cached = null;
  }
  return cached;
}

export async function saveTokens(pair: TokenPair): Promise<void> {
  cached = pair;
  await AsyncStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(pair));
}

export async function clearTokens(): Promise<void> {
  cached = null;
  await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
}

export function peekTokens(): TokenPair | null {
  return cached ?? null;
}
