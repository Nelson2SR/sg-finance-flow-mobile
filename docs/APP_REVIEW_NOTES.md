# App Review Notes — VaultWise

> Copy-paste these into App Store Connect when submitting. **Read once
> first**: the demo-account values and version-specific paragraphs need
> to be filled in.

---

## Review Notes (paste into App Store Connect → App Information → App Review Information → Notes)

```
VaultWise is a personal budgeting and expense tracking app for
Singapore residents. It does NOT connect to bank APIs, does NOT
facilitate money movement, and does NOT provide financial advice. It
is comparable in scope to Mint, YNAB, or Monarch.

──────────────────────────────────────────────────────────────────
DEMO ACCOUNT (please use this — the app uses phone OTP and you
will not receive a real SMS to a review device)

  Phone number:  +6512345678
  OTP code:      123456

The backend recognises this exact (phone, OTP) pair as an App Review
override: no SMS is sent, no Twilio call is made, and the credential
short-circuits to a normal signed session. The override is gated by
two server-side environment variables and cannot be triggered by
end users.
──────────────────────────────────────────────────────────────────

WHAT TO TEST

  1. Sign in flow
     - Enter +6512345678 → tap Send code
     - Enter 123456 → tap Verify
     - On first login, you'll land on a "Set up your profile" screen.
       Type any name → tap Continue. You're in.

  2. Magic Scan (statement import)
     - Tap "Magic Scan" on the Home tab.
     - The picker accepts a PDF or photo. A sample DBS statement is
       attached to this submission (review-sample-statement.pdf).
     - Confirm the parsed transactions → they appear on Home and in
       the Transactions tab.

  3. Vault Groups
     - Settings → Vault Groups → Manage groups & invites.
     - Create a second group → switch to it on Home → confirm the
       transactions list updates (the new group is empty).

  4. Manual transaction entry
     - Home → Add Entry → type an amount → pick a category → Save.

PRIVACY / DATA HANDLING

  • Bank statement passwords are stored only in the iOS Keychain on
    the user's device. They are NEVER transmitted to our servers,
    NEVER logged, and NEVER persisted to the database.
  • Transaction text is sent to Google Gemini for categorisation
    (paid API tier — Gemini does NOT use this data for training).
  • Phone numbers are stored hashed for analytics; the plaintext lives
    only in the identity-link table for authentication.
  • Source IPs are HMAC-SHA256 hashed; we cannot recover the original.

GUIDELINE 5.2.5 — Why we're a tracker, not a finance app

  VaultWise does not:
  - Initiate money transfers
  - Connect to bank APIs (no Plaid / Yodlee / Open Banking)
  - Hold user funds
  - Issue investment advice

  The only network calls related to finance are:
  - PDF parsing via Google Gemini (text categorisation only)
  - Twilio Verify for OTP authentication
  - Our own Postgres backend for transaction storage

GUIDELINE 4.8 — Third-party login

  v1.0 ships with Phone OTP as the only authentication method.
  WeChat Login is in the codebase but feature-flagged off for
  release builds (visible only when __DEV__ === true). This avoids
  the Sign in with Apple equivalency requirement.

CONTACT FOR REVIEW QUESTIONS

  Name:   Su Rong
  Email:  wowstorm99@gmail.com
  Phone:  [optional]
```

---

## App Privacy Labels (App Store Connect → App Privacy)

Match these answers exactly to what the code does today. If anything
on this list changes, update the labels in ASC the same day — Apple
audits, and a mismatch is a guaranteed rejection.

### Data Collected

| Data Type | Used to Track | Linked to Identity | Purposes |
|---|---|---|---|
| **Phone Number** | No | Yes | App Functionality (auth), Analytics (aggregate counts) |
| **Other User Contact Info** *(display name, optional avatar URL)* | No | Yes | App Functionality |
| **Financial Info — Other Financial Info** *(transactions, balances)* | No | Yes | App Functionality |
| **User ID** *(our internal user_id)* | No | Yes | App Functionality |
| **Device ID** | No | Yes | App Functionality (refresh-token forensics) |
| **Crash Data** | No | No | App Functionality |
| **Performance Data** | No | No | App Functionality |
| **Product Interaction** *(taps, screen transitions — if you ever add this)* | No | No | Analytics |

### Data NOT Collected (answer "No" if asked)

- Health / Fitness data
- Location (precise OR coarse)
- Contacts
- Photos / Videos *(we read the picked photo for Magic Scan, but the bytes leave the app immediately for parsing — they're not stored under our control)*
- Audio data
- Search history
- Browsing history
- IDFA / Advertising data
- Third-party advertising
- Customer support transcripts

### "Used for tracking" — answer **No** across the board

We do not link our data to third-party data for advertising and do not
share device identifiers with data brokers.

---

## Encryption Export Compliance (final submission questionnaire)

```
1. Does your app use encryption?                    Yes
2. Does your app qualify for any exemptions?        Yes
   Reason: The app uses only standard encryption
   built into iOS (HTTPS / TLS for all network
   traffic, Keychain for local storage). No
   proprietary encryption algorithms.
3. ITSAppUsesNonExemptEncryption in Info.plist:     false
```

(Already set in `app.json` → `ios.infoPlist.ITSAppUsesNonExemptEncryption: false`.)

---

## Age Rating Questionnaire (expect 4+)

| Category | Answer |
|---|---|
| Cartoon / Fantasy Violence | None |
| Realistic Violence | None |
| Sexual Content / Nudity | None |
| Profanity / Crude Humor | None |
| Alcohol / Tobacco / Drug References | None |
| Gambling | None |
| Horror / Fear Themes | None |
| Mature Themes | None |
| Medical / Treatment Information | None |
| Unrestricted Web Access | No |
| User-Generated Content / Social | **No** (no in-app chat between users; Vault Group members only see numeric balances/transactions) |

Result: **Rated 4+**

---

## Backend pre-submission checklist

- [ ] `APP_REVIEW_PHONE=+6512345678` set on the production backend (env var)
- [ ] `APP_REVIEW_OTP=123456` set on the production backend (env var)
- [ ] Verified with `curl`:
  ```
  curl -sX POST https://vaultwise-api.onrender.com/api/v1/auth/phone/request \
    -H "Content-Type: application/json" \
    -d '{"phone":"+6512345678"}'
  # → {"status":"sent"}

  curl -sX POST https://vaultwise-api.onrender.com/api/v1/auth/phone/verify \
    -H "Content-Type: application/json" \
    -d '{"phone":"+6512345678","otp":"123456"}'
  # → {"user_exists": false, "signup_token": "...", "phone": "+6512345678"}
  ```
- [ ] Production backend is on HTTPS with TLS 1.3 (verify: `nmap --script ssl-enum-ciphers -p 443 vaultwise-api.onrender.com`)
- [ ] Privacy policy is reachable at the URL provided in ASC
- [ ] Support URL is reachable at the URL provided in ASC
- [ ] Rotate or remove the `APP_REVIEW_PHONE` / `APP_REVIEW_OTP` env vars **once the app is approved and live** — leaving them in production is a permanent backdoor.

---

## After approval

- Remove `APP_REVIEW_PHONE` + `APP_REVIEW_OTP` from production env (kill the backdoor).
- Tag the commit: `git tag v1.0.0-app-store-approved` (so future versions can diff).
- Update Phase 5.3 in `APP_STORE_DEPLOYMENT_GUIDE.md` to reflect what actually worked vs. didn't.
