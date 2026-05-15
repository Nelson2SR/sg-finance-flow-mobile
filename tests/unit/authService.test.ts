/**
 * Coverage for the passwordless authService — WeChat OAuth + Phone OTP.
 *
 * Tests confirm the HTTP shape we send to the backend matches the
 * contract in sg_finance_flow/api/routes/auth_v2.py, and that logout
 * is best-effort (never throws upward) so the UI can always clear
 * local state.
 */

jest.mock('axios', () => ({ post: jest.fn() }));

jest.mock('../../constants/Config', () => ({
  API_CONFIG: { BASE_URL: 'http://localhost:8000/api/v1' },
}));

import axios from 'axios';
import {
  loginWithWeChat,
  logout,
  refreshSession,
  requestPhoneOtp,
  verifyPhoneOtp,
} from '../../services/authService';

const mockedAxios = axios as jest.Mocked<typeof axios>;

const sampleAuthResponse = {
  access_token: 'a',
  refresh_token: 'r',
  token_type: 'bearer',
  user: { id: 1, display_name: 'Su Rong', avatar_url: null, email: null },
};

beforeEach(() => jest.clearAllMocks());

describe('loginWithWeChat', () => {
  it('POSTs the code to /auth/oauth/wechat and returns the body', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: sampleAuthResponse });
    const got = await loginWithWeChat('dev-alice');
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/auth/oauth/wechat',
      { code: 'dev-alice' },
    );
    expect(got).toEqual(sampleAuthResponse);
  });
});

describe('requestPhoneOtp', () => {
  it('POSTs the phone to /auth/phone/request', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: { status: 'sent' } });
    await requestPhoneOtp('+6591234567');
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/auth/phone/request',
      { phone: '+6591234567' },
    );
  });
});

describe('verifyPhoneOtp', () => {
  it('POSTs phone + otp to /auth/phone/verify and returns the login branch when user_exists', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: { user_exists: true, ...sampleAuthResponse },
    });
    const got = await verifyPhoneOtp('+6591234567', '000000');
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/auth/phone/verify',
      { phone: '+6591234567', otp: '000000' },
    );
    expect(got.user_exists).toBe(true);
    if (got.user_exists) {
      expect(got.user.id).toBe(1);
    }
  });

  it('returns the signup branch when user_exists is false', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        user_exists: false,
        signup_token: 'jwt.signup.token',
        phone: '+6591234567',
      },
    });
    const got = await verifyPhoneOtp('+6591234567', '000000');
    expect(got.user_exists).toBe(false);
    if (!got.user_exists) {
      expect(got.signup_token).toBe('jwt.signup.token');
      expect(got.phone).toBe('+6591234567');
    }
  });
});

describe('refreshSession', () => {
  it('POSTs refresh_token to /auth/refresh', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: sampleAuthResponse });
    await refreshSession('old-refresh');
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/auth/refresh',
      { refresh_token: 'old-refresh' },
    );
  });
});

describe('logout', () => {
  it('POSTs refresh_token to /auth/logout without auth header by default', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: undefined });
    await logout('r1');
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/auth/logout',
      { refresh_token: 'r1' },
    );
  });

  it('includes the Bearer header when accessToken is supplied (revoke-all path)', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: undefined });
    await logout('r1', 'a1');
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/auth/logout',
      { refresh_token: 'r1' },
      { headers: { Authorization: 'Bearer a1' } },
    );
  });

  it('swallows network errors — logout must be best-effort for the UI', async () => {
    mockedAxios.post.mockRejectedValueOnce(new Error('boom'));
    // Must NOT throw — UI relies on this to always clear local state.
    await expect(logout('r1')).resolves.toBeUndefined();
  });
});
