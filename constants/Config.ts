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
