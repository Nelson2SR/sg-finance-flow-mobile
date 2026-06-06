/**
 * Generate a 64-char lowercase hex token for the `file_hash` field of a
 * /upload/confirm request.
 *
 * The backend's Statement model declares
 * `file_hash: str = Field(min_length=64, max_length=64)` — it expects a
 * SHA-256 hex digest of a source PDF. Manual entries and Magic Scan
 * results have no PDF, but they reuse the same confirm endpoint, so they
 * still need a value of exactly the right shape. Sending a short string
 * (e.g. `manual_<ts>` / `mobile_<ts>`) made the endpoint raise a Pydantic
 * ValidationError mid-handler → HTTP 500, which silently dropped every
 * manual entry and every scan import.
 *
 * This is NOT a cryptographic digest — there's no payload to hash and no
 * crypto dependency in the app. The backend only relies on `file_hash`
 * for per-group dedup (it 409s on a repeat), so any sufficiently-unique
 * 64-hex value is correct. 256 bits of entropy makes collisions across
 * a user's imports effectively impossible.
 */
export function makeClientFileHash(): string {
  let hex = '';
  while (hex.length < 64) {
    // 8 hex chars per 32-bit chunk; 8 chunks → 64 chars.
    hex += Math.floor(Math.random() * 0x100000000)
      .toString(16)
      .padStart(8, '0');
  }
  return hex.slice(0, 64);
}
