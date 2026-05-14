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
 * Verify a 6-digit OTP. Returns the auth pair on success.
 * In dev (no Twilio configured backend-side), the stub provider
 * accepts the fixed code `000000` for any valid E.164 phone.
 */
export async function verifyPhoneOtp(phone: string, otp: string): Promise<AuthResponse> {
  const resp = await axios.post<AuthResponse>(`${BASE_URL}/auth/phone/verify`, { phone, otp });
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
