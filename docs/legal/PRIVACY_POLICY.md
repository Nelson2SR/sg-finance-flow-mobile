# Privacy Policy — VaultWise

**Effective date:** 2026-05-16
**App:** VaultWise (iOS · App Store)
**Operator:** Su Rong (individual developer, Singapore)
**Contact:** wowstorm99@gmail.com

> This document explains what data VaultWise collects, how we use
> it, who else sees it, and the choices you have. Plain language —
> short, specific. If anything reads as fuzzy, email us; we'll fix it.

## 1. What we are

VaultWise is a personal finance tracker. You import bank statements
you already have, the app categorises them, and you see your spending
trends. We are **not** a financial institution. We do not move money. We
do not connect to bank APIs. We do not give investment advice.

## 2. What we collect

### 2.1 You give us this data

| Data | Where it lives | Why we need it |
|---|---|---|
| Phone number (E.164) | Our backend (`identity_links` table, Neon Postgres, EU/US region) | Authenticating you. We never display it; we hash it for analytics. |
| Display name (optional, you set it) | Backend (`users` table) | What the app shows on your profile |
| Bank statements (PDFs) | **Parsed in memory; the PDF itself is never stored on our servers** | To extract transactions you can categorise. The decrypted PDF lives only for the duration of one parse request. |
| Bank statement passwords | **Your device's iOS Keychain only** — never our servers, never logged | So you don't re-enter them every time you import |
| Transactions (date, amount, merchant, category) | Backend (`transactions` table) | The product itself |
| Categorisation rules you create | Backend (`categorisation_rules` table) | So your rules survive a reinstall |

### 2.2 What we automatically collect

| Data | Why | Retention |
|---|---|---|
| Access/refresh tokens (issued by us) | Keep you signed in | 30 days for refresh; rotated on every use |
| Source IP — hashed (HMAC-SHA256), not stored plaintext | Refresh-token forensics if a token is stolen | Lives with the refresh-token row |
| User-Agent string | Same as above | Same |
| Crash logs (no PII) | Fix bugs | 90 days |

### 2.3 What we **don't** collect

- We don't read your contacts.
- We don't track you across other apps. No IDFA. No third-party advertising SDKs.
- We don't sell anything to anyone.

## 3. Who else sees your data

We use these third parties because we couldn't build them ourselves. They each see only the slice they need.

| Provider | What they see | Why |
|---|---|---|
| **Twilio** (Verify API) | Your phone number, the OTP code we asked them to send | Sending the one-time login code |
| **Google Gemini** (LLM) | The **text** of statement PDFs you scan (account number redacted), **receipt images** you scan, the transactions extracted from them, and your **Copilot chat messages** plus a short summary of your recent activity | AI extraction & categorisation of transactions; answering Copilot questions |
| **Neon** (Postgres host) | Everything in §2.1 + §2.2 above | Database hosting |
| **Apple** (iOS Keychain) | Your bank statement passwords | Local secure storage on your device |

**AI features are opt-in.** The first time you use Magic Scan or the Copilot, the app shows a consent screen that names Google Gemini, lists exactly what is sent, and asks your permission before anything is transmitted. Until you agree, no document, receipt, transaction, or message is sent to the AI. You can withdraw consent any time in **Settings → Privacy → AI Data Sharing**, after which the app stops sending data to Gemini and asks again the next time you use an AI feature.

Google Gemini's data handling for paid API customers: input is **not used for model training**. Bank PDF passwords are decrypted on our backend in memory and are **never** sent to Gemini. Twilio retains OTP records for 30 days for audit; we cannot disable this on their side.

## 4. How we secure it

- Transport: TLS 1.3 everywhere. No plaintext over the wire.
- At rest: bank-statement passwords are stored only in the iOS Keychain on your device, protected by Face ID / Touch ID / passcode. We never see them.
- Database: Neon Postgres with at-rest encryption. Backups encrypted.
- Tokens: refresh tokens are SHA-256 hashed before storage; we cannot reconstruct the plaintext if our database is breached.
- IP addresses are HMAC-SHA256 hashed under a server-side key — not reversible by rainbow table.

## 5. Your rights

You can, at any time:

- **See your data** — email wowstorm99@gmail.com; we'll send a JSON export within 30 days.
- **Delete your account** — in the app, go to **Profile → Danger Zone → Delete account**. This immediately and permanently deletes your account and all associated data: transactions, wallets, categories, labels, vault groups you own, identity link, and auth tokens. It cannot be undone. (You can also email us and we'll do it for you.)
- **Correct data** — edit your display name in Settings; edit transactions in the Transactions tab; delete categorisation rules in Vault Config.
- **Withdraw consent** — uninstall the app. To also delete the server-side copy, email us.

We respect GDPR (if you're in the EU/EEA) and PDPA (Singapore). Singapore residents can contact the Personal Data Protection Commission if they're unhappy with our response: [pdpc.gov.sg](https://www.pdpc.gov.sg/).

## 6. Children

VaultWise is not directed at children under 13. We don't knowingly collect data from anyone under 13. If you believe a child has used the app, email us and we'll delete the account.

## 7. Changes

If we materially change how we handle your data, we will notify you in the app at least 14 days before the change takes effect. The "Effective date" at the top of this page always reflects the current version.

## 8. Contact

- **Email:** wowstorm99@gmail.com
- **Postal:** 12A Hougang Street 11, Singapore 534074
- **Data Protection Officer:** Su Rong (sole owner / operator)
