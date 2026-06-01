/**
 * Tiny JWT helpers — just enough to decide whether to skip the cold-
 * start `/auth/refresh` round-trip in AuthContext. We are NOT verifying
 * the signature here; the backend does that on every authed request,
 * and a stale-but-not-yet-expired access token will still fail server-
 * side if the user has been revoked. This file's only job is to answer
 * "is it worth even trying to use the cached access token, or should
 * we go straight to refresh?".
 */

const FRESHNESS_SKEW_MS = 5 * 60 * 1000;

interface JwtPayload {
  exp?: number;
}

function base64UrlDecode(s: string): string {
  // base64url → base64
  let b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  // pad to a multiple of 4
  while (b64.length % 4) b64 += '=';
  // Hermes (RN 0.74+) and Node 16+ both expose atob globally. Buffer is
  // the Node fallback so this stays testable under Jest if atob ever
  // gets shimmed out.
  const g = globalThis as { atob?: (s: string) => string };
  if (typeof g.atob === 'function') return g.atob(b64);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('buffer').Buffer.from(b64, 'base64').toString('binary');
}

/**
 * Returns true when the token's `exp` is far enough in the future that
 * using it as-is for the next user request is reasonable. Caller-side
 * default: ≥ 5 minutes of remaining life.
 *
 * Returns false for any decode failure, any token that lacks `exp`, and
 * any token that's already inside the skew window. False means "go
 * refresh"; true means "the cached token is fine, skip the refresh".
 *
 * `now` is overridable for tests.
 */
export function isAccessTokenFresh(token: string, now: number = Date.now()): boolean {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return false;
    const payload = JSON.parse(base64UrlDecode(parts[1])) as JwtPayload;
    if (typeof payload.exp !== 'number') return false;
    const expMs = payload.exp * 1000;
    return expMs - now > FRESHNESS_SKEW_MS;
  } catch {
    return false;
  }
}
