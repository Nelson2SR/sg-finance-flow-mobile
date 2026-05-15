import { Platform } from 'react-native';

/**
 * SG Finance Flow Mobile Configuration
 *
 * Backend URL resolution (in priority order):
 *
 *   1. `EXPO_PUBLIC_API_URL` env var (set by `eas.json` build profiles
 *      or at `expo start` time). This is the canonical path for
 *      preview/production builds — the URL is baked into the bundle
 *      at build time so it cannot accidentally be left at localhost.
 *
 *   2. Local LAN fallback for `expo start` development without an env
 *      var. Replace `LOCAL_IP` with your Mac's LAN IP so a physical
 *      iPhone on the same Wi-Fi can reach the dev server.
 *
 * In `__DEV__ === false` (release builds), step 2 is treated as fatal:
 * we throw at module-load if no env var was injected, so a production
 * build can NEVER ship pointing at a private IP.
 */

const LOCAL_IP = '192.168.50.76';
const DEV_FALLBACK = `http://${LOCAL_IP}:8000/api/v1`;

const envApiUrl = process.env.EXPO_PUBLIC_API_URL;

function resolveApiBaseUrl(): string {
  if (envApiUrl && envApiUrl.trim() !== '') {
    return envApiUrl;
  }
  if (!__DEV__) {
    // Fail loud: any release build that reaches this line was built
    // without EXPO_PUBLIC_API_URL and would otherwise try to talk to a
    // LAN IP that doesn't exist for end users. See eas.json.
    throw new Error(
      'EXPO_PUBLIC_API_URL is required for production builds. Set it in eas.json.',
    );
  }
  return DEV_FALLBACK;
}

export const API_CONFIG = {
  BASE_URL: resolveApiBaseUrl(),
};

// Skip the entire login flow in dev. When true, AuthContext synthesises
// a fake session so reloads land straight on /(tabs). The backend will
// reject the dev token with 401, so any endpoint that depends on a real
// user (Copilot, Magic Scan, transactions) will fall back to canned
// behaviour.
export const DEV_DISABLE_AUTH = false;

// Fake access token used when DEV_DISABLE_AUTH is on. Anything truthy works.
export const DEV_FAKE_TOKEN = 'dev-bypass-token';

// Pre-fill the OTP screen with the stub provider's fixed code so dev
// builds against a stub backend skip the manual typing step.
// See sg_finance_flow/auth/providers/phone.py:StubPhoneProvider.
export const DEV_PHONE_OTP_BYPASS = __DEV__;
export const DEV_PHONE_OTP_CODE = '000000';
