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
// Cache the user object alongside tokens so cold-start can short-
// circuit `/auth/refresh` when the access token is still fresh — the
// refresh response is the only place the user object normally lands,
// so without this we have no display_name / avatar to seed AuthContext
// from on a fast-path launch.
const KEY_USER = 'auth.user';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface CachedAuthUser {
  id: number;
  display_name: string | null;
  avatar_url: string | null;
  email: string | null;
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
    SecureStore.deleteItemAsync(KEY_USER),
  ]);
}

export async function setCachedUser(user: CachedAuthUser): Promise<void> {
  await SecureStore.setItemAsync(KEY_USER, JSON.stringify(user));
}

export async function getCachedUser(): Promise<CachedAuthUser | null> {
  const raw = await SecureStore.getItemAsync(KEY_USER);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CachedAuthUser;
  } catch {
    return null;
  }
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
