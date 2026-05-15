# Support — SG Finance Flow

> Quick answers below. If yours isn't here, email us and we'll get back within 1–2 business days.

**Email:** support@sgfinanceflow.com

---

## Frequently asked

### I can't get the OTP code

- Check the number you typed — it must include the country code (e.g. `+6591234567`, not `91234567`).
- The code expires in 10 minutes. Tap **Resend** if it's been longer.
- If you're on a trial Twilio account / your phone isn't a verified caller ID on the backend, you won't receive the SMS. Contact us with your phone number and we'll verify it.

### My bank statement won't parse

- We support DBS, OCBC, UOB, Citi out of the box. Other banks may work but aren't tested.
- If your PDF is password-protected, you'll be prompted for the password on first import. The password lives only in your iPhone's Keychain — we never see it.
- If parsing fails repeatedly on a real statement, email the file to support@sgfinanceflow.com (or, for privacy, redact the account number first). We'll add the bank to our extractor.

### How do I share my vault with my partner / family?

- Settings → Vault Groups → Create a new group.
- Open the group → Generate Invite → share the link.
- They open the link on their phone and join. Transactions you import into that group are now visible to both of you.
- Each member's individual transactions stay private unless they're imported into a shared group.

### I added a wallet to the wrong group

- Today, wallets can't be moved between groups. The simplest fix: re-create the wallet in the correct group, then delete the original.
- We're working on a move-wallet flow. Tell us if you need this and we'll prioritise it.

### How do I delete my account?

- Settings → Account → **Sign out everywhere**. This wipes your tokens immediately and schedules full account deletion within 7 days.
- To accelerate, email support@sgfinanceflow.com with the phone number you registered with.

### Is my data shared with anyone?

Three third parties touch your data, each for one specific purpose:

| Provider | What they see | Why |
|---|---|---|
| Twilio | Phone + OTP | Sending login codes |
| Google Gemini | Statement text (account numbers redacted) | AI categorisation |
| Neon Postgres | Your transactions, vault groups, identity link | Database hosting |

Full breakdown in our [Privacy Policy](./PRIVACY_POLICY.md). We do not sell data. There are no advertising SDKs in the app.

### What happens if I switch phones?

Sign in with your phone number on the new device. Your vault groups, transactions, and rules sync automatically. Bank statement passwords are device-local (iOS Keychain) — you'll be prompted to re-enter them the first time you import on the new phone.

### My Face ID isn't working

Settings → Face ID & Passcode → ensure SG Finance Flow is enabled in the app list. If it still doesn't work, restart your phone — iOS occasionally drops the entitlement after an OS upgrade.

---

## Reporting a bug

Email support@sgfinanceflow.com with:

- iOS version (Settings → General → About)
- App version (Settings → scroll to bottom)
- What you tapped before it happened
- A screenshot if possible

Logs that contain personal data are kept for 90 days then deleted automatically.

## Reporting a security issue

If you think you've found a security vulnerability, please email **security@sgfinanceflow.com** rather than filing a public issue. We'll respond within 48 hours.

## Feedback / feature requests

Same email: support@sgfinanceflow.com. We read everything; we just can't always promise a timeline.
