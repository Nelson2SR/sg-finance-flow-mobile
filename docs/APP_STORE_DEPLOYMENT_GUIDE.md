# 🍎 App Store Deployment Guide — VaultWise

> **App**: VaultWise · **Bundle ID**: `com.sgfinanceflow.mobile` (proposed)
> **Tech Stack**: Expo 54 (React Native 0.81) · FastAPI · Neon Postgres
> **Target**: iOS 16+ (iPhone & iPad) · Free with future IAP potential
> **Last Updated**: 2026-05-14

---

## Table of Contents

1. [Phase 0 — Prerequisites & Apple Developer Program](#phase-0--prerequisites--apple-developer-program)
2. [Phase 1 — App Store Connect: Create the App Record](#phase-1--app-store-connect-create-the-app-record)
3. [Phase 2 — Expo EAS Build Configuration](#phase-2--expo-eas-build-configuration)
4. [Phase 3 — Code Signing & Provisioning](#phase-3--code-signing--provisioning)
5. [Phase 4 — App Store Metadata & Creative Assets](#phase-4--app-store-metadata--creative-assets)
6. [Phase 5 — Finance-Specific App Review Compliance](#phase-5--finance-specific-app-review-compliance)
7. [Phase 6 — TestFlight Beta Testing](#phase-6--testflight-beta-testing)
8. [Phase 7 — Final Submission & Release](#phase-7--final-submission--release)
9. [Pre-Flight Checklist](#pre-flight-checklist)

---

## Phase 0 — Prerequisites & Apple Developer Program

### 0.1 Apple Developer Program Enrollment

| Requirement | Status | Action |
|---|---|---|
| Apple ID with two-factor authentication | `[ ]` | Enable at [appleid.apple.com](https://appleid.apple.com) |
| Apple Developer Program membership ($99/yr) | `[ ]` | Enroll at [developer.apple.com/programs](https://developer.apple.com/programs/) |
| D-U-N-S Number (if enrolling as Organization) | `[ ]` | Request free at [dnb.com](https://www.dnb.com/) — takes 5-7 business days |
| Paid Apps agreement signed in App Store Connect | `[ ]` | Required even for free apps if future IAP is planned |

> [!IMPORTANT]
> **Organization vs Individual**: If you plan to display a company name (e.g., "VaultWise Pte Ltd") under the app on the App Store, you must enroll as an **Organization**. Individual accounts show your personal legal name.

### 0.2 Development Environment

| Tool | Required Version | Install |
|---|---|---|
| macOS | Sonoma 15+ | System update |
| Xcode | 16.0+ | Mac App Store |
| Node.js | 20 LTS+ | `brew install node` |
| EAS CLI | Latest | `npm install -g eas-cli` |
| CocoaPods | 1.15+ | `sudo gem install cocoapods` |

### 0.3 Backend Readiness

Before submitting to App Review, ensure:

- [ ] Production FastAPI backend is deployed and accessible over **HTTPS (TLS 1.3)**
- [ ] Production Neon Postgres database is migrated and seeded
- [ ] API base URL is set in production environment config (not localhost/ngrok)
- [ ] Demo/test account credentials prepared for App Review team

---

## Phase 1 — App Store Connect: Create the App Record

> Reference: [Add a new app — Apple Developer](https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app)

### 1.1 Navigate to App Store Connect

1. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. Click **Apps** → **"+"** → **New App**

### 1.2 Required Fields for the New App Dialog

| Field | Value | Notes |
|---|---|---|
| **Platforms** | ☑ iOS | iPad support via `supportsTablet: true` in app.json |
| **Name** | `VaultWise` | Max 30 characters. Must be unique on the App Store. |
| **Primary Language** | `English (U.S.)` | Add Simplified Chinese localization later |
| **Bundle ID** | `com.sgfinanceflow.mobile` | Must match `ios.bundleIdentifier` in app.json. Register first in Certificates portal. |
| **SKU** | `SGFINFLOW001` | Internal reference. Cannot be changed after creation. |
| **User Access** | Full Access | Or limit to specific team members |

> [!WARNING]
> **The app Name is reservable but not permanent** — you can change it before the first submission. After the first approval, name changes require a new version submission.

### 1.3 Register the Bundle ID

Before creating the app record, register the Bundle ID:

1. Go to [developer.apple.com/account/resources/identifiers](https://developer.apple.com/account/resources/identifiers/list)
2. Click **"+"** → **App IDs** → **App**
3. Enter:
   - **Description**: `VaultWise Mobile`
   - **Bundle ID**: Explicit → `com.sgfinanceflow.mobile`
4. Enable capabilities:
   - ☑ Associated Domains (if using universal links)
   - ☑ Push Notifications (for sync notifications)
   - ☑ Sign In with Apple (Phase 2 auth — register now for future use)

### 1.4 Update app.json

```diff
 "ios": {
-  "supportsTablet": true
+  "supportsTablet": true,
+  "bundleIdentifier": "com.sgfinanceflow.mobile",
+  "buildNumber": "1",
+  "infoPlist": {
+    "NSCameraUsageDescription": "VaultWise needs camera access to scan receipts and bank statements.",
+    "NSPhotoLibraryUsageDescription": "VaultWise needs photo library access to import receipt images.",
+    "NSFaceIDUsageDescription": "Use Face ID to securely unlock your financial data.",
+    "ITSAppUsesNonExemptEncryption": false
+  }
 },
```

---

## Phase 2 — Expo EAS Build Configuration

### 2.1 Initialize EAS

```bash
# Login to Expo
npx eas-cli login

# Initialize EAS in the project
npx eas-cli build:configure
```

### 2.2 Create eas.json

```json
{
  "cli": {
    "version": ">= 15.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": { "simulator": true }
    },
    "preview": {
      "distribution": "internal",
      "ios": { "buildConfiguration": "Release" }
    },
    "production": {
      "ios": {
        "buildConfiguration": "Release",
        "image": "latest"
      },
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {
      "ios": {
        "ascAppId": "YOUR_ASC_APP_ID",
        "appleTeamId": "YOUR_TEAM_ID"
      }
    }
  }
}
```

### 2.3 Build Commands

```bash
# Development build (simulator)
npx eas-cli build --platform ios --profile development

# Preview build (TestFlight internal)
npx eas-cli build --platform ios --profile preview

# Production build (App Store submission)
npx eas-cli build --platform ios --profile production

# Submit to App Store Connect
npx eas-cli submit --platform ios --profile production
```

---

## Phase 3 — Code Signing & Provisioning

### 3.1 Automatic (Recommended — EAS Managed)

EAS Build can manage all signing credentials automatically:

```bash
npx eas-cli credentials
# Select: iOS → Build Credentials → Set up automatically
```

This creates and manages:
- ✅ Distribution Certificate
- ✅ Provisioning Profile (App Store)
- ✅ Push Notification Key (APNs)

### 3.2 Manual (If Required)

If you need manual control:

1. **Distribution Certificate**: Certificates portal → `+` → iOS Distribution
2. **Provisioning Profile**: Profiles → `+` → App Store → Select your certificate + Bundle ID
3. Download both and configure in `eas.json`:

```json
"production": {
  "ios": {
    "credentialsSource": "local",
    "provisioningProfilePath": "./certs/dist.mobileprovision",
    "distributionCertificate": {
      "path": "./certs/dist.p12",
      "password": "YOUR_PASSWORD"
    }
  }
}
```

---

## Phase 4 — App Store Metadata & Creative Assets

### 4.1 App Information (General Tab)

| Field | Value |
|---|---|
| **Subtitle** | `Smart Finance Tracking & AI Copilot` |
| **Category** | Primary: `Finance` / Secondary: `Productivity` |
| **Age Rating** | Complete questionnaire (expect: 4+) |

### 4.2 Version Information

| Field | Value | Constraints |
|---|---|---|
| **Promotional Text** | `Track expenses effortlessly with AI-powered statement scanning and privacy-first design.` | Max 170 chars |
| **Keywords** | `finance,budget,expense,tracker,AI,statement,bank,privacy,family,Singapore` | Max 100 chars |
| **Support URL** | `https://sgfinanceflow.com/support` | Required |
| **Privacy Policy URL** | `https://sgfinanceflow.com/privacy` | **Required for finance apps** |

### 4.3 App Description (Draft)

```
VaultWise — Your private, AI-powered financial companion.

🔒 PRIVACY FIRST
Your bank statement passwords never leave your device. Stored in iOS 
Keychain with biometric protection, your sensitive data stays exactly 
where it should — on your phone.

📸 MAGIC SCAN
Import bank statements (DBS, OCBC, UOB, Citi) with a single tap. Our 
AI automatically extracts and categorizes every transaction.

🤖 AI COPILOT
Ask your financial concierge anything: "Why am I broke this month?" 
Get actionable insights with one-tap confirmation widgets.

📊 SMART ANALYTICS
Beautiful charts reveal your spending patterns. Track budgets and 
monitor trends with clarity-focused visualizations.

👨‍👩‍👧‍👦 FAMILY SHARING
Track household expenses together while maintaining individual privacy.

✨ FEATURES
• Swipe-to-categorize imported transactions
• Multi-wallet management (checking, savings, cash)
• Custom budget tracking with smart alerts
• Voice and text transaction entry
• Glassmorphic Apple-native design
• Dark mode support • Offline-capable with background sync

Built for Singapore residents who value convenience and privacy.
```

### 4.4 Screenshots (Required)

> [!IMPORTANT]
> **Guideline 2.3.3**: Screenshots must accurately reflect the app's current functionality.

#### Required Device Sizes

| Display Size | Resolution | Required? |
|---|---|---|
| iPhone 6.9" (16 Pro Max) | 1320 × 2868 px | **Yes** |
| iPhone 6.7" (14 Plus) | 1290 × 2796 px | **Yes** |
| iPhone 6.5" (11 Pro Max) | 1242 × 2688 px | **Yes** |
| iPhone 5.5" (8 Plus) | 1242 × 2208 px | **Yes** |
| iPad Pro 13" | 2064 × 2752 px | **Yes** (supportsTablet: true) |

#### Recommended Screenshot Sequence (5-10 per device)

1. **Dashboard** — Balance overview with wallet cards
2. **Magic Scan** — Statement upload / AI extraction
3. **Swipe Categorize** — Tinder-style transaction review
4. **AI Copilot** — Chat with action widget
5. **Analytics** — Spending breakdown charts
6. **Family Sharing** — Multi-member view
7. **Privacy Toggle** — "Keep it private to this device" prompt
8. **Dark Mode** — Feature screen in dark theme

### 4.5 App Icon Requirements

- **Size**: 1024 × 1024 px
- **Format**: PNG, no alpha/transparency
- **No rounded corners** (Apple applies the mask)
- **No text** in the icon (frequently rejected)

---

## Phase 5 — Finance-Specific App Review Compliance

> [!CAUTION]
> Finance apps receive **heightened scrutiny** from App Review. Address these guidelines carefully.

### 5.1 Guideline 5.1.1 — Data Collection & Privacy Labels

Complete the App Privacy section in App Store Connect:

| Data Type | Collected? | Linked to Identity? | Tracking? |
|---|---|---|---|
| Financial Info (transactions, balances) | ☑ Yes | ☑ Yes | ☐ No |
| Contact Info (phone for OTP) | ☑ Yes | ☑ Yes | ☐ No |
| Identifiers (user ID) | ☑ Yes | ☑ Yes | ☐ No |
| Usage Data (interactions) | ☑ Yes | ☐ No | ☐ No |
| Diagnostics (crash logs) | ☑ Yes | ☐ No | ☐ No |

### 5.2 Guideline 5.2.5 — Finance Category Clarification

VaultWise is a **personal finance tracker**, NOT a financial institution:

- ✅ Does NOT move money between accounts
- ✅ Does NOT provide investment advice
- ✅ Does NOT access bank APIs (no Open Banking)
- ✅ Only parses user-uploaded PDF statements locally
- ✅ Comparable to Mint, YNAB, Monarch

**Include in App Review Notes:**

```
VaultWise is a personal budgeting and expense tracking app. 
It does NOT connect to bank APIs, does NOT facilitate financial 
transactions, and does NOT provide financial advice.

Users manually upload their own bank statement PDFs, which are 
parsed on-device using AI for transaction categorization. Bank 
statement passwords are stored in iOS Keychain and never 
transmitted to our servers.

Demo account for testing:
Phone: +65 9XXX XXXX
OTP: [provide test bypass or sandbox number]
```

### 5.3 Demo Account for App Review

> [!WARNING]
> **This is the #1 rejection reason** for apps with phone auth. Reviewers cannot receive real SMS.

You MUST either:
1. Provide a hardcoded test phone + OTP that always works, OR
2. Set up a Twilio test number that auto-verifies in the review environment

### 5.4 Encryption Export Compliance

Your app uses only standard HTTPS/TLS — this qualifies for exemption:

```json
"ITSAppUsesNonExemptEncryption": false
```

If you later add E2E encryption ("Pro Privacy Mode"), update to `true` and upload compliance docs.

### 5.5 Gemini API Data Disclosure

Since transaction text (not passwords) is sent to Google Gemini for categorization:
- [ ] Disclose this in your Privacy Policy
- [ ] Ensure PII stripping is implemented before API calls
- [ ] Declare "third-party analytics" or "app functionality" in privacy labels

### 5.6 Required Legal Pages

| Page | URL | Status |
|---|---|---|
| Privacy Policy | `https://sgfinanceflow.com/privacy` | `[ ]` |
| Terms of Service | `https://sgfinanceflow.com/terms` | `[ ]` |
| Support Page | `https://sgfinanceflow.com/support` | `[ ]` |

---

## Phase 6 — TestFlight Beta Testing

### 6.1 Upload a Build

```bash
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios
```

### 6.2 Internal Testing (Immediate — No Review)

- Add up to 100 internal testers in App Store Connect → TestFlight
- Builds available immediately after processing

### 6.3 External Testing (Requires Beta Review)

- Add up to 10,000 external testers
- Provide: Beta description, feedback email, test credentials
- Beta review typically takes 24-48 hours

### 6.4 Testing Checklist

- [ ] Cold launch → login flow works end-to-end
- [ ] Magic Scan PDF upload + AI categorization
- [ ] Swipe-to-categorize interaction
- [ ] AI Copilot responds correctly
- [ ] Family sharing invitation flow
- [ ] Biometric unlock (Face ID / Touch ID)
- [ ] Dark mode renders correctly
- [ ] iPad layout is not broken
- [ ] Offline mode shows cached data

---

## Phase 7 — Final Submission & Release

### 7.1 Create the Version

1. App Store Connect → Your App → **"+ Version or Platform"**
2. Version: `1.0.0`
3. Select the build from TestFlight

### 7.2 Pricing & Availability

| Setting | Value |
|---|---|
| **Price** | Free |
| **Availability** | All countries (or select: Singapore, China) |
| **Pre-order** | No |

### 7.3 Release Strategy

| Option | When to Use |
|---|---|
| **Manually release** | Coordinate with marketing (recommended for v1.0) |
| **Auto after approval** | Ship ASAP |
| **Scheduled date** | Coordinated launch event |

### 7.4 Submit for Review

1. Click **"Submit for Review"**
2. Answer final questionnaire:
   - IDFA usage? → **No**
   - Export compliance? → **No** (standard HTTPS only)
   - Content rights? → **Yes**
3. Wait 24-48 hours (finance apps may take longer)

### 7.5 Common Rejection Reasons for Finance Apps

| Reason | Prevention |
|---|---|
| No demo credentials | Provide working test account in review notes |
| Privacy policy missing | Host at permanent URL before submission |
| Misleading screenshots | Only show features that exist in the build |
| Incomplete functionality | No "Coming Soon" screens or dead buttons |
| Privacy label mismatch | Labels must match actual data collection |
| Missing permission strings | Camera, Photos, Face ID need NSUsageDescription |

---

## Pre-Flight Checklist

### Account & Legal
- [ ] Apple Developer Program active
- [ ] Paid Apps agreement signed
- [ ] Banking info entered (for future IAP)
- [ ] Tax forms completed
- [ ] Privacy Policy live at permanent URL
- [ ] Support page live at permanent URL

### Code & Build
- [x] `ios.bundleIdentifier` set in app.json — `com.sgfinanceflow.mobile`
- [x] All `NSUsageDescription` strings in infoPlist (Camera / Photos / FaceID)
- [x] `ITSAppUsesNonExemptEncryption: false`
- [x] Production API URL plumbed via `EXPO_PUBLIC_API_URL` env var; throws at module load if unset in release builds
- [x] `eas.json` exists with development / preview / production profiles
- [x] WeChat login + Subscription Drains "Coming Soon" gated behind `__DEV__`
- [x] Budget cards now show real-spend (was a misleading modulo trick)
- [x] No console.log with sensitive data (only `console.warn/.error` for non-PII)
- [x] App Review backdoor (`APP_REVIEW_PHONE` + `APP_REVIEW_OTP`) wired into the phone provider
- [ ] EAS Build succeeds with `production` profile — **needs Apple Dev account first**
- [ ] Version and build number correct *(currently 1.0.0 / build 1; `autoIncrement: true` in eas.json takes over after first build)*

### App Store Connect
- [ ] App name and subtitle finalized
- [ ] Description written (4000 char max)
- [ ] Keywords optimized (100 char max)
- [ ] Screenshots for all required sizes
- [ ] App icon 1024×1024, no transparency
- [ ] Copyright: `© 2026 VaultWise`
- [ ] App Review notes with demo credentials
- [ ] Privacy labels completed
- [ ] Age rating questionnaire done
- [ ] Category: Finance / Productivity

### Testing
- [ ] TestFlight internal testing done
- [ ] Physical device testing done
- [ ] iPad layout verified
- [ ] Dark mode verified
- [ ] Offline mode verified
- [ ] No crashes in logs

---

## Quick Reference — Key Apple URLs

| Resource | URL |
|---|---|
| App Store Connect | [appstoreconnect.apple.com](https://appstoreconnect.apple.com) |
| Certificates & Identifiers | [developer.apple.com/account/resources](https://developer.apple.com/account/resources) |
| App Review Guidelines | [developer.apple.com/app-store/review/guidelines](https://developer.apple.com/app-store/review/guidelines/) |
| Screenshot Specs | [developer.apple.com/.../screenshot-specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications) |
| Privacy Labels | [developer.apple.com/.../manage-app-privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy) |
| TestFlight | [developer.apple.com/testflight](https://developer.apple.com/testflight/) |
| Export Compliance | [developer.apple.com/.../export-compliance](https://developer.apple.com/help/app-store-connect/manage-app-information/overview-of-export-compliance) |
