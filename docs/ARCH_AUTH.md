# Architecture: Hybrid Auth & On-Device Privacy

Companion to `PRD/PRD_09_Auth.md`. This doc is the engineering contract — endpoints, schemas, sequence diagrams, threat model, migration order.

## 1. Scope

| In scope (Phase 1) | Out of scope (Deferred) |
|---|---|
| WeChat + Phone-OTP login | Apple Sign-In, Google Sign-In (Phase 2, global rollout) |
| Backend identity table redesign | Full E2E vault passphrase (server-blind transactions) |
| On-device bank PDF password handling | Passkey / WebAuthn, Hardware-key 2FA |
| Clean-cut removal of email/password (no legacy users) | Family-sharing under E2E |

## 2. Identity Model

Today: `users(id, username UNIQUE, hashed_password)` — single-credential, password-only.

Target:

```
users
  id                  SERIAL PK
  display_name        TEXT       -- shown in UI, editable
  email               TEXT       -- optional, from provider claim, NOT a login key
  avatar_url          TEXT
  created_at          TIMESTAMPTZ
  -- hashed_password  DEPRECATED -- nullable in M-010, dropped in M-012

identity_links
  id                  SERIAL PK
  user_id             INT FK → users(id) ON DELETE CASCADE
  provider            TEXT  CHECK (provider IN ('wechat','phone'))
                            -- Phase 2 extends with 'apple','google'
  subject_id          TEXT  -- provider's stable user id (WeChat unionid,
                            --   E.164 phone number)
  email_claim         TEXT  -- snapshot of provider-claimed email at link time
                            --   (WeChat may omit; phone always NULL)
  linked_at           TIMESTAMPTZ
  UNIQUE (provider, subject_id)
  INDEX  (user_id)
```

One user, many `identity_links`. A user who signs up via Phone can later link WeChat from Settings → Linked Accounts so they don't end up with two accounts. The provider list is enforced by a CHECK constraint we'll relax in a Phase-2 migration when Apple/Google land.

## 3. Backend Endpoints

All endpoints under `/api/v1/auth/`.

| Method | Path                                | Purpose |
|--------|--------------------------------------|---------|
| POST   | `/auth/oauth/wechat`                | Exchange WeChat auth code → our JWT |
| POST   | `/auth/phone/request`               | Send SMS OTP to E.164 number |
| POST   | `/auth/phone/verify`                | Verify OTP → our JWT |
| POST   | `/auth/link`                        | Authenticated user adds another provider |
| POST   | `/auth/refresh`                     | Refresh access token using refresh token |
| POST   | `/auth/logout`                      | Revoke refresh token |
| **DELETE** | `~~/auth/register~~`            | **Removed** in M-010 |
| **DELETE** | `~~/auth/login~~`               | **Removed** in M-010 |

Phase 2 adds `/auth/oauth/apple` and `/auth/oauth/google` following the same exchange contract below.

### 3.1 Exchange contract (example: WeChat)

```
POST /api/v1/auth/oauth/wechat
{
  "code": "<short-lived code from WeChat SDK>",
  "user_info": { "nickname": "苏荣", "avatar_url": "..." } | null
}

200 OK
{
  "access_token":  "<our JWT, 1h>",
  "refresh_token": "<opaque, 30d, rotating>",
  "user": { "id": 42, "display_name": "苏荣", "avatar_url": "..." }
}

401 INVALID_PROVIDER_TOKEN — provider verification failed
409 PROVIDER_LINKED_TO_OTHER_USER — subject_id already mapped to a different user
```

Backend exchanges the WeChat `code` for `{openid, unionid, access_token}` via the WeChat `sns/oauth2/access_token` endpoint, uses `unionid` as `subject_id` (stable across our WeChat apps), upserts `identity_links`, upserts `users`, mints our JWT.

Phone flow: `/auth/phone/request` triggers Twilio Verify (HTTP 202, no body). `/auth/phone/verify` posts `{phone_e164, otp}`, Twilio verifies, then identical upsert + mint as above (`subject_id = phone_e164`).

### 3.2 Token strategy
- **Access token**: signed JWT, 1h TTL, `sub: user_id`. Carried in `Authorization: Bearer`.
- **Refresh token**: opaque random 256-bit, 30d TTL, **rotated on every use**, stored hashed (`sha256`) in `refresh_tokens(token_hash, user_id, expires_at, revoked_at)`.
- `/auth/logout` flips `revoked_at` on the presented refresh token's row.
- App keeps both in `expo-secure-store` (Keychain on iOS, EncryptedSharedPreferences on Android).

## 4. Mobile Flow

```
Cold launch
  └─ has refresh_token in SecureStore?
       ├─ yes → POST /auth/refresh
       │         ├─ 200 → land on (tabs)
       │         └─ 401 → drop tokens → /login
       └─ no  → /login

/login screen
  ├─ [WeChat]   → react-native-wechat-lib (native bridge)
  │                → POST /auth/oauth/wechat
  └─ [Phone]    → enter E.164 → /auth/phone/request
                    → enter OTP → /auth/phone/verify

Success: persist {access_token, refresh_token} in SecureStore, hydrate
useAuthStore, router.replace('/(tabs)').
```

Existing `unlockVault` step in `app/login.tsx` is **removed** in M-010. The `passphrase` state and `step === 2` branch are deleted.

## 5. Bank PDF Password Handling

This is the load-bearing piece of the "Zero Cloud Lock-in" promise.

### 5.1 Today (to be removed)
- Mobile sends `{ pdf_bytes, pdf_password }` over HTTPS to `/api/v1/upload/parse`.
- Backend opens PDF in temp memory, runs LLM.
- `credential_store` table (migration 001) AES-encrypts the password server-side, keyed per `(user_id, bank)` for "convenience re-use."
- **The password is in the request body, in backend RAM, and at-rest server-side.** All three violate the promise.

### 5.2 Target (Phase 1)
Two parallel paths, user chooses once per device per first encrypted-PDF import:

**Private path (default)**
1. Mobile detects PDF is encrypted (`pdf-lib` / `react-native-pdf`).
2. Prompts for the password locally. Stored in **Keychain / Keystore** under key `bank_pdf_pw::{userId}::{bank}` via `expo-secure-store`.
3. Mobile decrypts the PDF on-device → uploads the **decrypted PDF bytes** to `/api/v1/upload/parse`.
4. Backend never sees the password.

**Server path (opt-out)**
1. Mobile sends `{ pdf_bytes, pdf_password }` exactly as today.
2. Backend holds password in request-scoped memory only — `credential_store` table writes are **disabled** under this regime.
3. Password is discarded after parse; no retention.

### 5.3 Schema changes
- `credential_store` table is no longer written to. We keep the table for one release cycle for read-only emergency recovery, then drop in M-013.
- New column `users.private_pdf_default BOOLEAN DEFAULT TRUE` records the user's per-device choice, but the source of truth is the device — backend uses this only as a hint when migrating across devices.

## 6. Migration Sequence

No legacy users exist in production, so the rollout is a clean cut rather than a phased coexistence.

| Mig | What | Risk |
|-----|------|------|
| M-010 | Create `identity_links`, restructure `users` (drop `hashed_password`, add `display_name`/`email`/`avatar_url`), ship `/auth/oauth/wechat` + `/auth/phone/{request,verify}`, delete `/auth/register` + `/auth/login` | Medium — endpoint contract changes; coordinate mobile cut-over |
| M-011 | Replace `app/login.tsx` with the two-button passwordless screen; delete `passphrase`/`step === 2` branch; wire `expo-secure-store` for refresh-token persistence | Medium — single-rail UX, no fallback |
| M-012 | On-device PDF password handling (§5.2 private path) becomes the default; `credential_store` writes are removed | Medium — affects Magic Scan only |
| M-013 | Drop `credential_store` table after one release cycle of read-only standby | Low — irreversible but no production impact |

Pre-launch test users (dev environment only) are simply wiped before M-010 ships. There is no migration screen, no "link a provider to continue" flow.

Phase 2 (post-launch) adds `/auth/oauth/{apple,google}` and extends the `identity_links.provider` CHECK — additive, no user-facing migration.

## 7. Threat Model

| Threat | Today | After Phase 1 |
|---|---|---|
| Backend DB exfiltrated → user passwords leaked | bcrypt hashes leaked, must force-reset everyone | No password column to leak |
| Backend DB exfiltrated → bank PDF passwords leaked | AES key on server, ciphertext on server — single-server compromise = both | Bank PDF passwords are not on the backend at all (private path) |
| MITM on /auth/login | bcrypt over HTTPS; replay impossible due to nonce-less form | Same TLS; provider tokens are short-lived and bound to nonce |
| Compromised mobile device | Vault passphrase typed manually → attacker captures keystrokes | Bank passwords in Keychain → require device unlock + biometric (Secure Enclave) to read |
| User loses device | Login flow assumes they re-install + retype passphrase | Login via Apple/Google/WeChat is provider-anchored; bank passwords must be re-entered (acceptable, < monthly) |
| Provider compromised (WeChat takeover, SIM swap) | N/A | Attacker logs in as user → sees transactions. **Mitigations**: encrypted bank PDFs still need passwords from the *original* device's Keychain; add a 24h "new device" cooldown on first import after a new login; surface a "Recent logins" panel in Settings. SIM swap is the bigger risk than WeChat takeover — favour WeChat link in the UI to reduce phone-only accounts. |

## 8. Open Questions

1. **WeChat mainland approval is now critical-path.** With Apple/Google deferred to Phase 2, WeChat OAuth is the only non-SMS option at launch. Open Platform registration requires a Chinese business entity and a published Privacy Policy URL; submission-to-approval typically runs 2–4 weeks. **Decision needed before M-010**: either (a) confirm the registration is in flight, or (b) accept a phone-OTP-only launch and ship WeChat as a fast-follow.
2. **Phone-OTP cost.** Twilio Verify ≈ US$0.05 per SMS in SG, more in CN. With phone potentially carrying the bulk of signups, budget review needed before launch. Consider Aliyun SMS (CN) + Twilio (SG/global) as a dual provider behind a country-code router.
3. **Account-merge UX.** A user can sign up via Phone, then later try to sign in with WeChat — different `subject_id`s, intent is "same person." Plan: when an authenticated user adds a second provider via Settings → Linked Accounts, the link is unambiguous. There is **no automatic merge** across providers at sign-in time (no shared key — WeChat may not return an email, phone numbers don't appear in WeChat claims). The user must explicitly link from inside the app.
4. **Family sharing under provider auth.** Family invitations currently key off `username`. Switch to invite-by-`identity_links.subject_id` or surface a stable in-app handle. Coordinate with PRD_06 Settings + family routes.

## 9. References
- PRD_09_Auth.md (this doc's product side)
- CLAUDE.md §"Critical Rules" — Zero Cloud Lock-in
- Migration 001 (`credential_store` table, deprecated by §5)
- Migration 002 (`users` table, modified by §2)
- `app/login.tsx`, `services/authService.ts`, `api/routes/auth.py`, `api/security.py` (files touched)
