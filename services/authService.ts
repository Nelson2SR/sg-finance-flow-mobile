/**
 * Passwordless auth — WeChat OAuth + Phone OTP.
 *
 * Talks to the backend's /api/v1/auth/* routes (see
 * sg_finance_flow/api/routes/auth_v2.py). The legacy username/password
 * flow has been removed in PR-2; the backend keeps the old endpoints
 * mounted until PR-4 so a stale dev build won't 404, but no code path
 * in this app uses them anymore.
 */

import axios from 'axios';

import { API_CONFIG } from '../constants/Config';

const BASE_URL = API_CONFIG.BASE_URL;

export interface AuthUser {
  id: number;
  display_name: string | null;
  avatar_url: string | null;
  email: string | null;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: 'bearer';
  user: AuthUser;
}

/**
 * Exchange a WeChat short-lived code for our access+refresh pair.
 * In dev (no WeChat AppID configured backend-side), the stub provider
 * accepts codes of the form `dev-<id>`.
 */
export async function loginWithWeChat(code: string): Promise<AuthResponse> {
  const resp = await axios.post<AuthResponse>(`${BASE_URL}/auth/oauth/wechat`, { code });
  return resp.data;
}

/**
 * Trigger an SMS OTP send. Backend returns 202 with `{status:'sent'}`.
 * No data needed on the client side — just await the resolution.
 */
export async function requestPhoneOtp(phone: string): Promise<void> {
  await axios.post(`${BASE_URL}/auth/phone/request`, { phone });
}

/**
 * Discriminated response from `POST /auth/phone/verify`. The backend
 * does the one-and-only Twilio check there (verifications are
 * single-use), and forks based on whether a user row exists:
 *
 *   user_exists=true  → access_token / refresh_token / user are set;
 *                       the client should `login(resp)` and route to
 *                       /(tabs).
 *   user_exists=false → signup_token / phone are set; the client
 *                       should confirm with the user, then POST to
 *                       /auth/phone/signup with the signup_token.
 */
export interface PhoneVerifyExistingUser {
  user_exists: true;
  access_token: string;
  refresh_token: string;
  token_type: 'bearer';
  user: AuthUser;
}
export interface PhoneVerifyNewUser {
  user_exists: false;
  signup_token: string;
  phone: string;
}
export type PhoneVerifyResponse = PhoneVerifyExistingUser | PhoneVerifyNewUser;

/**
 * Verify a 6-digit OTP. Always one network call → one Twilio check.
 * Inspect `user_exists` on the response to decide login vs signup.
 *
 * In dev (no Twilio configured backend-side), the stub provider
 * accepts the fixed code `000000` for any valid E.164 phone.
 */
export async function verifyPhoneOtp(phone: string, otp: string): Promise<PhoneVerifyResponse> {
  const resp = await axios.post<PhoneVerifyResponse>(
    `${BASE_URL}/auth/phone/verify`,
    { phone, otp },
  );
  return resp.data;
}

/**
 * Finish signup with the signup_token returned by `verifyPhoneOtp`.
 * No OTP is re-sent — the backend has already verified it. Returns
 * a brand-new auth pair (user.display_name=null; route to onboarding).
 */
export async function signupPhoneOtp(signupToken: string): Promise<AuthResponse> {
  const resp = await axios.post<AuthResponse>(`${BASE_URL}/auth/phone/signup`, {
    signup_token: signupToken,
  });
  return resp.data;
}

/**
 * Patch the signed-in user's profile. Sends an authenticated PATCH to
 * `/me/profile`. `accessToken` must be provided because this is called
 * during onboarding, before AuthContext has finished hydrating into the
 * apiClient interceptor.
 */
export async function updateProfile(
  accessToken: string,
  patch: { display_name?: string; avatar_url?: string },
): Promise<AuthUser> {
  const resp = await axios.patch<AuthUser>(`${BASE_URL}/me/profile`, patch, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return resp.data;
}

/**
 * Exchange a refresh token for a new access+refresh pair. The old
 * refresh token is revoked atomically server-side, so replaying it
 * will return 401.
 */
export async function refreshSession(refreshToken: string): Promise<AuthResponse> {
  const resp = await axios.post<AuthResponse>(`${BASE_URL}/auth/refresh`, {
    refresh_token: refreshToken,
  });
  return resp.data;
}

/**
 * Revoke the presented refresh token. If `accessToken` is provided,
 * the backend revokes ALL refresh tokens for that user (industry-
 * standard "log out everywhere"). Always idempotent — never throws on
 * an already-dead token.
 */
export async function logout(refreshToken: string, accessToken?: string): Promise<void> {
  const body = { refresh_token: refreshToken };
  const config = accessToken
    ? { headers: { Authorization: `Bearer ${accessToken}` } }
    : undefined;
  try {
    if (config) {
      await axios.post(`${BASE_URL}/auth/logout`, body, config);
    } else {
      await axios.post(`${BASE_URL}/auth/logout`, body);
    }
  } catch (err) {
    // Logout must be best-effort: clearing local state is what the user
    // actually cares about. Network failure here is not user-visible.
    if (__DEV__) {
      console.warn('[Auth] logout endpoint failed, ignoring:', err);
    }
  }
}
