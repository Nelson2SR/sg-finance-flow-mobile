/**
 * The backend's Statement model requires `file_hash` to be a 64-char
 * SHA-256 hex digest (`Field(min_length=64, max_length=64)`). Manual
 * entries and Magic Scan have no source PDF to hash, but they still
 * POST to /upload/confirm — so they must send a valid 64-hex token or
 * the endpoint 500s on Statement construction (the bug that silently
 * dropped every manual entry AND every scan).
 */

import { makeClientFileHash } from '../../lib/clientFileHash';

describe('makeClientFileHash', () => {
  it('returns exactly 64 characters (matches Statement.file_hash length)', () => {
    expect(makeClientFileHash()).toHaveLength(64);
  });

  it('returns only lowercase hex characters', () => {
    expect(makeClientFileHash()).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is unique across calls so per-group dedup never 409s on distinct entries', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) seen.add(makeClientFileHash());
    expect(seen.size).toBe(1000);
  });
});
