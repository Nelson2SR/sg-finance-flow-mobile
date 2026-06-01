/**
 * Tests for `isAccessTokenFresh` — the cold-start fast-path gate.
 *
 * The function is the load-bearing piece of the "skip /auth/refresh
 * when the cached token still has plenty of life" optimisation in
 * AuthContext. Getting this wrong means either (a) blowing the
 * optimisation by always returning false, or worse (b) returning true
 * for a token that's already expired and forcing every subsequent
 * request through a 401-then-refresh cycle.
 */

import { isAccessTokenFresh } from '../../lib/jwt';

/** Build a JWT with the given payload — header/signature are bogus. */
function makeToken(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.SIGNATURE_NOT_VERIFIED`;
}

const NOW = 1_700_000_000_000; // 2023-11-14T22:13:20Z, arbitrary stable epoch

describe('isAccessTokenFresh', () => {
  it('returns true for a token with >5 min of life remaining', () => {
    const exp = Math.floor(NOW / 1000) + 60 * 60; // 1 hour from now
    expect(isAccessTokenFresh(makeToken({ exp }), NOW)).toBe(true);
  });

  it('returns false at exactly the 5-min skew boundary (no leeway)', () => {
    const exp = Math.floor(NOW / 1000) + 5 * 60; // exactly 5 minutes from now
    expect(isAccessTokenFresh(makeToken({ exp }), NOW)).toBe(false);
  });

  it('returns false for a token within the 5-min skew window', () => {
    const exp = Math.floor(NOW / 1000) + 4 * 60; // 4 min from now
    expect(isAccessTokenFresh(makeToken({ exp }), NOW)).toBe(false);
  });

  it('returns false for an already-expired token', () => {
    const exp = Math.floor(NOW / 1000) - 60; // expired 1 minute ago
    expect(isAccessTokenFresh(makeToken({ exp }), NOW)).toBe(false);
  });

  it('returns false for a token missing the `exp` claim entirely', () => {
    expect(isAccessTokenFresh(makeToken({ sub: 'user-42' }), NOW)).toBe(false);
  });

  it('returns false for a token with a non-numeric `exp`', () => {
    expect(isAccessTokenFresh(makeToken({ exp: '1700003600' }), NOW)).toBe(false);
  });

  it('returns false for malformed input (no dots)', () => {
    expect(isAccessTokenFresh('not-a-jwt', NOW)).toBe(false);
  });

  it('returns false for a token whose payload is not valid JSON', () => {
    const garbage = Buffer.from('{not json').toString('base64url');
    expect(isAccessTokenFresh(`header.${garbage}.sig`, NOW)).toBe(false);
  });

  it('handles base64url-specific characters (-, _) without padding', () => {
    // Use a payload that produces base64url chars after encoding.
    // The key is the function must NOT choke on - or _ or missing padding.
    const exp = Math.floor(NOW / 1000) + 3600;
    const token = makeToken({ exp, sub: 'a/b+c=d' });
    expect(isAccessTokenFresh(token, NOW)).toBe(true);
  });

  it('uses Date.now() when no clock is provided', () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    expect(isAccessTokenFresh(makeToken({ exp }))).toBe(true);
  });
});
