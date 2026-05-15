# App Store Action Items — SG Finance Flow

> Status of every item from the [Deployment Guide](./APP_STORE_DEPLOYMENT_GUIDE.md). Updated 2026-05-16.
>
> Green ✅ items are done in this repo. Anything else is on you — the bulk of remaining work is account/asset/legal, not code.

---

## ✅ DONE in this repo

### Code & build configuration

- ✅ `app.json` — display name set to "SG Finance Flow", `ios.bundleIdentifier=com.sgfinanceflow.mobile`, `buildNumber=1`, Info.plist usage descriptions (Camera / Photos / FaceID), `ITSAppUsesNonExemptEncryption=false`, `expo-secure-store` plugin declared, Android `package` mirrored.
- ✅ `eas.json` — development / preview / production profiles with `EXPO_PUBLIC_API_URL` baked per environment; `autoIncrement: true` on production; submit profile with `ascAppId` + `appleTeamId` placeholders to fill once App Store Connect record exists.
- ✅ `constants/Config.ts` — API URL reads `EXPO_PUBLIC_API_URL` first, falls back to LAN IP in dev only. Throws at module load in release builds if unset — guaranteeing no build can ship pointed at a private IP.

### App Review compliance

- ✅ **WeChat login** hidden in release builds (`__DEV__`-gated in `app/login.tsx`). Phone OTP is the only v1.0 auth → sidesteps Apple Guideline 4.8 entirely.
- ✅ **Subscription Drains "Coming soon"** card on Analytics hidden in release builds (Apple 2.1 incomplete-functionality risk).
- ✅ **Budget cards** now show real spend (was a misleading modulo trick — Apple 2.3.1 misleading-functionality risk).
- ✅ **App Review backdoor** wired server-side: `APP_REVIEW_PHONE` + `APP_REVIEW_OTP` env vars enable a single (phone, otp) pair that bypasses Twilio. See `src/sg_finance_flow/auth/providers/phone.py:AppReviewOverrideProvider`. Disabled by default — only fires when both env vars are set.

### Documentation

- ✅ `docs/legal/PRIVACY_POLICY.md` — App-Review-ready draft. Covers GDPR + PDPA, third parties (Twilio / Gemini / Neon), data retention, deletion path. Fill in entity/address/email then host at a permanent URL.
- ✅ `docs/legal/TERMS_OF_SERVICE.md` — Singapore-law governed draft. Same caveat: fill in entity details and host.
- ✅ `docs/legal/SUPPORT.md` — FAQ with email contact. Host as the Support URL in App Store Connect.
- ✅ `docs/APP_REVIEW_NOTES.md` — copy-paste-ready review notes including demo credentials, privacy-label crib sheet, encryption export answers, age-rating answers, backend pre-submission checklist.

---

## 🟡 ONLY YOU CAN DO — and the order matters

### Step 1 — Apple Developer enrollment ($99/yr · ~1 week if Organization)

- [ ] Apple ID with 2FA at [appleid.apple.com](https://appleid.apple.com)
- [ ] Enroll at [developer.apple.com/programs](https://developer.apple.com/programs/) — choose Individual (fast) or Organization (D-U-N-S required, 5–7 business days)
- [ ] Sign the Paid Apps Agreement in App Store Connect (required even for free apps if future IAP is planned)
- [ ] Enter banking + tax forms (Agreements, Tax & Banking)

### Step 2 — Register bundle ID

- [ ] [developer.apple.com/account/resources/identifiers](https://developer.apple.com/account/resources/identifiers/list) → "+" → App IDs → App
- [ ] Description: `SG Finance Flow Mobile`
- [ ] Bundle ID: Explicit → `com.sgfinanceflow.mobile` *(must match `app.json`)*
- [ ] Capabilities to enable now (free for v1.0): Associated Domains (for future invite links), Push Notifications (future)

### Step 3 — Domain + hosting for legal pages

- [ ] Register `sgfinanceflow.com` (or your chosen domain — also update the URLs across the docs)
- [ ] Host `PRIVACY_POLICY.md` at `https://sgfinanceflow.com/privacy` (any static-site host works — GitHub Pages, Vercel, Cloudflare Pages)
- [ ] Host `SUPPORT.md` at `https://sgfinanceflow.com/support`
- [ ] Optionally host `TERMS_OF_SERVICE.md` at `https://sgfinanceflow.com/terms` (not strictly required by Apple but recommended)
- [ ] Replace `[Your legal entity]` and `[Add your registered business address]` placeholders in the three docs

### Step 4 — Deploy the backend to a public HTTPS URL

- [ ] Deploy `sg-finance-flow` to Render / Fly.io / Railway / Vercel Functions (or your platform of choice)
- [ ] Use a real custom domain with TLS 1.3 (Cloudflare in front works well)
- [ ] Set env vars on the production backend:
  - `APP_ENV=production`
  - `DATABASE_URL=<Neon production URL>`
  - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`
  - `AUTH_SECRET_KEY` — generate fresh, NEVER reuse the dev value
  - `MASTER_PASSPHRASE` — at least 16 chars, NEVER reuse the dev value
  - `GEMINI_API_KEY`
  - **For App Review only** — `APP_REVIEW_PHONE=+6512345678`, `APP_REVIEW_OTP=123456` (rotate / remove after approval)
- [ ] Verify health: `curl https://your-domain.com/api/v1/health` → 200
- [ ] Verify the App Review backdoor (curl commands in `docs/APP_REVIEW_NOTES.md`)

### Step 5 — Update `eas.json` with the production URL

- [ ] Edit the `production.env.EXPO_PUBLIC_API_URL` value in `eas.json` to your real production URL
- [ ] Commit + push

### Step 6 — App Store Connect record

- [ ] [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → Apps → "+" → New App
- [ ] Platform: iOS · Name: `SG Finance Flow` · Primary Language: English (U.S.) · Bundle ID: `com.sgfinanceflow.mobile` · SKU: `SGFINFLOW001`
- [ ] Capture the **ASC App ID** and your **Apple Team ID** → paste both into `eas.json`'s `submit.production.ios` block, replacing the `REPLACE_WITH_*` placeholders

### Step 7 — Assets

#### App icon

- [x] Current `assets/images/icon.png` is 1024×1024 PNG without alpha — **compliant**
- [ ] Visually review for Apple's icon guidelines: no text in the icon, no rounded corners (Apple applies the mask)
- [ ] If you want a custom design, hire/design and replace `assets/images/icon.png` (and Android variants in the same folder)

#### Screenshots (required for App Store Connect)

You need 5–10 screenshots **per device class**. Smallest viable set:

- [ ] iPhone 6.9" (16 Pro Max) — 1320 × 2868 px
- [ ] iPhone 6.7" (14 Plus) — 1290 × 2796 px
- [ ] iPad Pro 13" — 2064 × 2752 px (because `supportsTablet: true`)

Recommended shots in order:
1. **Onboarding** — Sign in screen + the phone-OTP step
2. **Home with wallets** — your `Surong` vault + a Family Vault, balances visible
3. **Magic Scan** — the scan window with a sample statement parsed
4. **Transactions list** — Activity tab with a few categorised rows
5. **Analytics** — Aura + Cashflow Momentum
6. **Vault Groups** — Settings → Vault Groups with an invite
7. **Onboarding new profile** — the "Set up your profile" screen
8. **Dark mode** — re-shoot one of the above in dark mode

How to capture:
- iOS Simulator: `Device → Resolution → 100%` then `⌘+S` to save screenshot. The simulator gives you pixel-accurate sizes.
- Or run on a real iPhone 15/16 Pro Max + iPad, screen-capture, and crop.

### Step 8 — App Privacy + Age Rating questionnaires

- [ ] App Store Connect → your app → App Privacy → paste in answers from `docs/APP_REVIEW_NOTES.md` § "App Privacy Labels"
- [ ] App Information → Age Rating → use the table in `APP_REVIEW_NOTES.md` § "Age Rating Questionnaire" → expect 4+

### Step 9 — First build

```bash
cd sg-finance-flow-mobile
npm install -g eas-cli                # if not already
eas login                              # use your Apple-linked Expo account
eas build:configure                    # one-time; pulls credentials, scaffolds keys
eas build --platform ios --profile production
```

EAS will prompt to manage your distribution certificate + provisioning profile — **let it (the "automatic" option is reliable)**.

The first build takes 15–25 min in EAS Cloud. After it completes:

```bash
eas submit --platform ios --profile production
```

This uploads the `.ipa` to App Store Connect. Once it appears in TestFlight (5–10 min processing) you can:

- Add yourself as an internal tester → test from a real iPhone (no review needed)
- Add up to 100 internal testers
- Once you're satisfied, click **Submit for Review** on the App Store tab

### Step 10 — Final review submission

In App Store Connect → your app → 1.0 Prepare for Submission:

- [ ] **Promotional text**: `Track expenses effortlessly with AI-powered statement scanning and privacy-first design.`
- [ ] **Keywords**: `finance,budget,expense,tracker,AI,statement,bank,privacy,family,Singapore`
- [ ] **Description**: copy from `APP_STORE_DEPLOYMENT_GUIDE.md` § 4.3
- [ ] **Support URL**: `https://sgfinanceflow.com/support`
- [ ] **Marketing URL**: optional
- [ ] **Privacy Policy URL**: `https://sgfinanceflow.com/privacy`
- [ ] **Copyright**: `© 2026 SG Finance Flow`
- [ ] **App Review Information** — Demo Account section: paste from `docs/APP_REVIEW_NOTES.md` § "Review Notes"
- [ ] **Build**: select your TestFlight build
- [ ] **Encryption Export Compliance**: questionnaire — answers in `APP_REVIEW_NOTES.md`
- [ ] Click **Submit for Review**

Expect 24–48 hours for finance apps. Common rejection causes covered in `APP_STORE_DEPLOYMENT_GUIDE.md` § 7.5.

### Step 11 — Day after approval (do not forget)

- [ ] Remove `APP_REVIEW_PHONE` + `APP_REVIEW_OTP` from production env (kill the backdoor)
- [ ] Tag the commit: `git tag v1.0.0-app-store-approved && git push --tags`
- [ ] Announce launch

---

## 🧹 Dead code / cleanup recommendations (not blocking)

- `lib/api.ts` — old Tanstack-Query-stubbed mock with hardcoded `localhost:8000`. **Nothing imports it.** Safe to delete:
  ```bash
  cd sg-finance-flow-mobile && git rm lib/api.ts && git commit -m "Drop unused lib/api.ts mock"
  ```
- `DEV_FAKE_TOKEN` / `DEV_DISABLE_AUTH` in `constants/Config.ts` — `DEV_DISABLE_AUTH` is hardcoded `false`. Path is cold but the comments are valuable for future debugging. Leave for now.

---

## ⏱ Rough timeline if you start today

| Task | Effort | Wall time |
|---|---|---|
| Apple Developer enrollment | 30 min | 1–7 days (D-U-N-S delay if Org) |
| Domain registration + DNS | 30 min | Same day |
| Hosting legal pages | 1 hour | Same day |
| Backend deploy + secrets | 2–4 hours | Same day |
| Screenshots | 3–4 hours | 1 day |
| EAS first build + TestFlight upload | 1 hour | Same day (~25 min build) |
| App Privacy labels + Age Rating | 30 min | Same day |
| Description + metadata in ASC | 1 hour | Same day |
| **Apple Review** | (Apple's clock) | **24–72 hours** |

**Realistic ship date if everything goes well: ~1 week. If Org enrollment + first review iteration: ~2 weeks.**
