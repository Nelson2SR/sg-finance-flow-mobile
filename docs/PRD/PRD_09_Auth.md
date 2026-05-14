# PRD 09: Authentication & On-Device Privacy

## 1. The Big Idea
**"One tap in, your bank password never leaves your phone."**

We replace the current `username + password + vault passphrase` flow with a single passwordless tap (WeChat or Phone OTP). The "Zero Cloud Lock-in" promise from CLAUDE.md is preserved by moving bank PDF password handling fully on-device — not by asking the user to memorise a second passphrase. The result: mainstream-app UX with a privacy story we can put on the marketing page without an asterisk.

## 2. Diagnostics (What Kills Finance App Logins?)
- **Two passwords is a non-starter.** Mainstream finance apps (Mint, YNAB, Copilot, Monarch) all use one credential. Asking for two trains users to assume something is broken.
- **Email/password is dead weight.** Reset flows, breach surface area, "is this user real" debates — all gone if we lean on platform SSO.
- **Vault unlock on every cold launch.** Today's `unlockVault` step blocks the home screen behind a typed passphrase. Biometric is not currently the gatekeeper of anything sensitive — it's just inconvenience theatre.
- **WeChat-shaped hole.** No mainland-region story today. SG-based but China-resident users (a real ICP segment) cannot sign up smoothly.

## 3. Killer Interaction (The Signature)
**"The Private Import Toggle"**

The first time the user picks a password-protected bank PDF (DBS / OCBC / UOB / Citi statements), we ask **once**:

> 🔒 _This statement is password-protected. How should we handle the password?_
> ▸ **Keep it private to this device** (Recommended) — _Stored in iOS Keychain. Never leaves your phone._
> ▸ **Let the server unlock it** — _Faster on slow phones. Discarded after parsing._

The choice is remembered per-device. Future imports show a discreet **🔒 Private import** badge on each transaction. No second password. No vault. The user *feels* the privacy without having to memorise anything.

## 4. Feature Requirements

### 4.1 Login providers (Phase 1)
- **WeChat OAuth** — primary identity for the SG/China audience. Open Platform registration gated by mainland entity timeline (see ARCH §8).
- **Phone OTP (SMS)** — fallback when WeChat unavailable; cross-region day-one path. Twilio Verify or equivalent.

Both resolve to a **single User record** identified by a stable `subject_id` per provider; users can link the other provider to the same account later (Profile → Linked Accounts).

Apple Sign-In and Google Sign-In are **explicitly deferred to Phase 2** — added once the global rollout begins. The identity model is designed so adding them is an additive migration, no schema rewrite.

### 4.2 Onboarding
1. Splash → two large buttons (WeChat, Phone).
2. Provider consent → returns to app with provider token / verified OTP.
3. Backend exchanges provider token → issues our JWT.
4. **Done.** No second step. Land on Dashboard.

### 4.3 Email/password — removed
- Endpoints `/auth/register` and `/auth/login` deleted.
- The `users.hashed_password` column is dropped in the same migration.
- No legacy users exist in production yet, so no migration screen is needed; the change ships as a clean cut.

### 4.4 Bank PDF password handling
- On-device by default. Stored in **iOS Keychain / Android Keystore**, keyed by `(user_id, bank)`.
- A "Forget passwords" button in Settings → Privacy purges the local Keychain entry without affecting the account.
- Backend `credential_store` table (which today stores AES-encrypted PDF passwords server-side) is **deprecated in this PRD** — see ARCH_AUTH §5.

### 4.5 Logout & session
- Single "Sign out" button. No "lock vault" separate state.
- Tokens are 30-day rotating refresh + 1-hour access.
- Biometric prompt on cold launch is opt-in (Settings → Security → "Require Face ID on launch"). It gates the *app surface*, not a separate vault.

## 5. Out of Scope (Deferred)
- **Apple Sign-In and Google Sign-In** — Phase 2, paired with global rollout. The identity table already has room for them; adding a provider is one `INSERT INTO identity_links` upsert away.
- **Full E2E vault passphrase** for users who want server-blind storage of transactions + amounts. We will revisit when there is a privacy-conscious segment asking for it — likely framed as "Pro Privacy Mode" in Settings, modelled on Actual Budget's opt-in, irreversible passphrase.
- **Family sharing under E2E** — incompatible by definition; explicitly disabled if/when Pro Privacy Mode ships.
- **Hardware-key auth (Passkeys / WebAuthn)** — natural successor when Apple/Google passkey adoption is universal.

## 6. Success Metrics
- **Time-to-first-import** drops from current ~90s (signup + email verify + vault) to ≤15s.
- **Drop-off at login screen** falls below 10% of installs (current: untracked).
- **Support tickets** mentioning "forgot passphrase" drop to zero (current: present in dev testing).
- **Privacy claim audit**: on the path "bank PDF password → backend memory," packet capture shows zero plaintext password bytes.
