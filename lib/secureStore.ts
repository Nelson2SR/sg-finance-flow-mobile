/**
 * Typed wrapper around expo-secure-store for auth tokens.
 *
 * Centralises the storage-key strings so we never end up with two parts
 * of the app writing to e.g. 'userToken' vs 'accessToken' and racing.
 * Tokens live in iOS Keychain / Android Keystore — see PRD_09 §4.4 for
 * the privacy contract.
 *
 * Bank-PDF-password helpers (also keyed under Keychain) land in PR-3.
 */

import * as SecureStore from 'expo-secure-store';

const KEY_ACCESS = 'auth.accessToken';
const KEY_REFRESH = 'auth.refreshToken';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export async function getTokens(): Promise<TokenPair | null> {
  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(KEY_ACCESS),
    SecureStore.getItemAsync(KEY_REFRESH),
  ]);
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export async function setTokens(pair: TokenPair): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(KEY_ACCESS, pair.accessToken),
    SecureStore.setItemAsync(KEY_REFRESH, pair.refreshToken),
  ]);
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(KEY_ACCESS),
    SecureStore.deleteItemAsync(KEY_REFRESH),
  ]);
}

/**
 * Best-effort access-token read for synchronous-feeling code paths.
 * Returns null if no token is stored. Use this only inside HTTP
 * interceptors where we cannot suspend on a Promise resolution chain
 * outside of the interceptor itself.
 */
export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY_ACCESS);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY_REFRESH);
}
