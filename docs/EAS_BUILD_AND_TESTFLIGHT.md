# EAS Build → Submit → TestFlight Runbook

Day-to-day workflow for cutting a new TestFlight build of VaultWise Mobile. For first-time setup (Apple Developer enrolment, App Store Connect record, signing assets, metadata, App Review policies), see [`APP_STORE_DEPLOYMENT_GUIDE.md`](./APP_STORE_DEPLOYMENT_GUIDE.md) — this doc assumes that's all in place.

> **App**: VaultWise · **Bundle ID**: `com.sgfinanceflow.mobile`
> **Expo SDK**: 54 · **ASC App ID**: `6769999368` · **Apple Team ID**: `23P984AR9Z`
> **EAS project**: `b17b0a55-54d0-4dd3-ad51-f9fba5b2b36c`

---

## 1. Prerequisites (once per machine)

```bash
npm i -g eas-cli              # current minimum: >= 15.0.0
eas whoami                    # confirms login
eas login                     # only if 'Not logged in'
```

**Important:** `eas login` requires an interactive TTY. It does **not** work through Claude Code's bash tool or any non-TTY shell wrapper. Run it directly in your own terminal. Once logged in, the auth token is cached at `~/.expo/state.json` and persists across shells *on that machine* — but a different terminal app, SSH session, or CI runner will be unauthenticated until you log in there too.

Sanity-check the EAS config:

```bash
cat eas.json                  # confirm production profile + submit creds
cat app.json | grep -E 'version|buildNumber'
```

---

## 2. Profiles (`eas.json`)

| Profile        | Channel       | Distribution  | API base                                | Use it when…                                  |
|----------------|---------------|---------------|------------------------------------------|------------------------------------------------|
| `development`  | (none)        | internal, simulator | LAN dev server (`http://192.168…`)  | Building a dev-client for local hacking         |
| `preview`      | `preview`     | internal      | `https://vaultwise-api.onrender.com/...` | Ad-hoc internal QA without TestFlight overhead  |
| `production`   | `production`  | store         | `https://vaultwise-api.onrender.com/...` | Anything that should reach TestFlight / the App Store |

The production profile has `"autoIncrement": true`, so the iOS `buildNumber` increments automatically on every build — never hand-edit it. The semver `version` in `app.json` is yours to bump intentionally on user-visible releases.

---

## 3. Build

```bash
# Standard release build
eas build --platform ios --profile production
```

What happens:

1. EAS uploads the project tarball (respects `.easignore` / `.gitignore`).
2. The build runs in EAS cloud (~10–20 min for a clean build; ~5–10 min if dependency cache hits).
3. You get a build URL like `https://expo.dev/accounts/<owner>/projects/<slug>/builds/<id>`.
4. Once green, the IPA URL is on that build page: `https://expo.dev/artifacts/eas/<hash>.ipa`.

Useful flags:

- `--non-interactive` — fail instead of prompting (CI).
- `--message "Insights tabs + profile subpage"` — annotates the build in the dashboard. Worth setting; defaults to the latest commit subject.
- `--clear-cache` — nukes the dependency cache. Use only when you suspect a stale-cache miscompile.
- `--auto-submit` — chains step 4 on success. Convenient for trusted releases; skip if you want to eyeball the build first.

Track in-flight builds:

```bash
eas build:list --platform ios --limit 5
eas build:view <id>             # detailed status + logs link
```

---

## 4. Submit to App Store Connect / TestFlight

The `submit.production` block in `eas.json` already carries `ascAppId` and `appleTeamId`, so EAS knows where the IPA goes. App Store Connect API key credentials need to be set up once:

```bash
eas credentials                 # interactive — pick iOS → ASC API Key → upload
```

If you skip that step, submit will prompt for an Apple ID + app-specific password the first time and cache the result.

### Submit the most recent build

```bash
eas submit --platform ios --profile production --latest
```

### Submit a specific build (e.g. yesterday's IPA)

```bash
eas submit --platform ios --profile production \
  --url https://expo.dev/artifacts/eas/<hash>.ipa
```

Or by EAS build id:

```bash
eas submit --platform ios --profile production --id <build-id>
```

Submit is fast on our end (~30s upload, ~1 min orchestration). Apple's processing then takes 10–30 min before the build is visible in TestFlight, and a further 5–10 min before it accepts the first install.

---

## 5. TestFlight Testing

### Inviting testers (one-time per cohort)

1. App Store Connect → Apps → VaultWise → **TestFlight**.
2. **Internal Testing** group: members of your Apple Developer team. Up to 100 testers, no Beta App Review needed, ready ~5 min after Apple processes the build.
3. **External Testing** group: anyone with an email or a public link. Up to 10,000 testers, but the first build sent to external testers triggers **Beta App Review** (24–48 hours, with the same content rules as App Review).
4. Add the new build to the group(s) → testers get a push from the TestFlight app.

> Internal Testing is the right default during iteration. Only push to External when you need user feedback from people outside the dev account.

### Tester install flow

1. Tester installs the **TestFlight** app from the App Store.
2. Opens the invite email or the public link → "Accept" → "Install".
3. App icon shows an orange dot for 90 days, after which the build expires and they need to update to a fresher one.

### Promoting between builds

Once a tester is enrolled, they automatically receive every new build the dev pushes to their group (subject to "Automatic Updates" in TestFlight settings). No re-invite needed.

### Crash & feedback reports

- Crashes: ASC → TestFlight → Crashes tab. Symbolicated dSYMs are uploaded automatically by EAS so stack traces are readable.
- Feedback: testers can shake the device or use the TestFlight app's "Send Beta Feedback" flow → screenshots + notes land in ASC → TestFlight → Feedback.

---

## 6. Common gotchas

- **"Not logged in" inside Claude Code / scripts.** EAS auth is per-terminal; the Claude shell can't read your interactive `eas login`. Run `eas` commands in your own terminal, or set `EXPO_TOKEN` (from `expo.dev → Settings → Access Tokens`) as an env var for non-interactive use.
- **OTA vs binary.** `expo-updates` lets you ship JS-only changes via `eas update --channel production` without a new TestFlight build — but anything touching native modules, `app.json` permissions, or the bundle version must go through a fresh `eas build`. When in doubt, build.
- **autoIncrement strangeness.** If a build fails mid-way the build number still increments on the EAS side. Don't try to manually rewind — just submit the next successful build.
- **"Missing compliance" in TestFlight.** ASC asks about encryption export compliance. We use only TLS for transport + Apple's stock crypto for Keychain → answer "Yes (exempt)" in TestFlight. To make this automatic, add `"ios.config.usesNonExemptEncryption": false` to `app.json` — currently not set; revisit if the manual click gets annoying.
- **Bundle ID drift.** The bundle ID in `app.json` MUST match the one registered with the ASC App ID `6769999368`. Changing it breaks the submit silently with a confusing 4xx from ASC.
- **The IPA URL is a fresh artifact**, not a permanent link. Expo retains build artifacts for ~30 days; after that, `--url` submits fail with 404 and you need a rebuild.

---

## 7. Cheat sheet

```bash
# Build + submit in one shot (only when you trust the change)
eas build --platform ios --profile production --auto-submit \
  --message "Vault Group rename + Settings reorder"

# Check what's queued / building
eas build:list --platform ios --limit 5

# See submission status
eas submit:list --platform ios --limit 5

# OTA update (no rebuild) — JS-only changes
eas update --channel production --message "Fix typo on Settings hero"
```

---

## 8. Release flow checklist

For a TestFlight-bound iteration:

- [ ] Commit + push the changes you want shipped.
- [ ] Confirm `app.json` `version` is correct (bump for user-visible releases; leave alone for internal iterations).
- [ ] `eas build --platform ios --profile production --message "<one-liner>"`.
- [ ] Wait for green build → grab the IPA URL or just use `--latest`.
- [ ] `eas submit --platform ios --profile production --latest`.
- [ ] Wait for the ASC email ("Your build is now available for testing").
- [ ] Add the build to the Internal Testing group (or External, if appropriate).
- [ ] Smoke-test the install yourself from TestFlight before pinging other testers.
