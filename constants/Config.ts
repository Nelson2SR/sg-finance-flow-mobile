import { Platform } from 'react-native';

/**
 * SG Finance Flow Mobile Configuration
 */

// Auto-detect backend URL based on environment
// 10.0.2.2 is the magic IP for Android Emulator to hit host localhost
// 127.0.0.1 works for iOS Simulator
// const LOCAL_IP = Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1';
const LOCAL_IP = '192.168.50.76';
// For real device testing, you should replace this with your computer's local IP
// Example: '192.168.1.5'
export const API_CONFIG = {
  BASE_URL: `http://${LOCAL_IP}:8000/api/v1`,
};

// Skip the Master Passphrase / vault unlock flow in dev builds.
// The "master passphrase" is a local-only second-factor stored in
// SecureStore (iOS Keychain). On first unlock whatever you type becomes
// the passphrase; subsequent unlocks just compare locally. It is *not*
// sent to the backend and currently doesn't encrypt anything — it's a
// placeholder for the eventual E2E-encrypted vault flow. Flip to false
// to exercise the screen.
export const DEV_DISABLE_VAULT = __DEV__;

// Skip the username/password login screen entirely in dev. When true,
// AuthContext auto-seeds DEV_FAKE_TOKEN and AuthGuard lets the user
// straight into /(tabs) — convenient, but the backend rejects that
// token with 401, so the Copilot endpoint falls back to canned phrases.
// Set to `false` to test against the real backend (live Gemini replies).
export const DEV_DISABLE_AUTH = false;

// Fake token used when DEV_DISABLE_AUTH is on. Anything truthy works.
export const DEV_FAKE_TOKEN = 'dev-bypass-token';
