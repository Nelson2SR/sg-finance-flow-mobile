/**
 * Behaviour of `AuthContext` after the PR-2 passwordless cutover:
 *   - cold launch with no stored tokens → unauthenticated
 *   - cold launch with stored tokens → refresh succeeds → authenticated
 *   - cold launch with stored tokens → refresh fails → unauthenticated, tokens cleared
 *   - login(resp) writes to secure store and hydrates state
 *   - logout({allDevices}) calls the endpoint and clears state
 */

import React from 'react';
import { act, renderHook } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// Pin dev bypass off so we exercise the real path.
jest.mock('../../constants/Config', () => ({
  DEV_DISABLE_AUTH: false,
  DEV_FAKE_TOKEN: 'dev-bypass-token',
  DEV_PHONE_OTP_BYPASS: false,
  DEV_PHONE_OTP_CODE: '000000',
  API_CONFIG: { BASE_URL: 'http://localhost:8000/api/v1' },
}));

// Mock authService so we don't depend on axios / network.
jest.mock('../../services/authService', () => ({
  refreshSession: jest.fn(),
  logout: jest.fn(async () => undefined),
}));

// Mock apiClient's onAuthFailed since the real one imports from services/.
jest.mock('../../services/apiClient', () => ({
  onAuthFailed: jest.fn(() => () => undefined),
}));

import { AuthProvider, useAuth } from '../../context/AuthContext';
import {
  logout as mockLogout,
  refreshSession as mockRefresh,
} from '../../services/authService';

const refreshResponse = (overrides = {}) => ({
  access_token: 'fresh-access',
  refresh_token: 'fresh-refresh',
  token_type: 'bearer' as const,
  user: { id: 7, display_name: 'Su Rong', avatar_url: null, email: null },
  ...overrides,
});

describe('AuthContext (passwordless)', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('starts unauthenticated when there are no stored tokens', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {});

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.accessToken).toBeNull();
  });

  it('refreshes on cold launch when tokens are present', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockImplementation(async (k: string) =>
      k.includes('refresh') ? 'old-refresh' : 'old-access',
    );
    (mockRefresh as jest.Mock).mockResolvedValueOnce(refreshResponse());

    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {});

    expect(mockRefresh).toHaveBeenCalledWith('old-refresh');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'auth.accessToken',
      'fresh-access',
    );
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'auth.refreshToken',
      'fresh-refresh',
    );
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.id).toBe(7);
  });

  it('clears tokens and stays logged out when refresh fails', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockImplementation(async (k: string) =>
      k.includes('refresh') ? 'old-refresh' : 'old-access',
    );
    (mockRefresh as jest.Mock).mockRejectedValueOnce(new Error('401 revoked'));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {});

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('auth.accessToken');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('auth.refreshToken');
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('login() writes tokens and hydrates state', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {});

    await act(async () => {
      await result.current.login(refreshResponse({ access_token: 'a1', refresh_token: 'r1' }));
    });

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('auth.accessToken', 'a1');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('auth.refreshToken', 'r1');
    expect(result.current.accessToken).toBe('a1');
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('logout() revokes server-side and clears tokens', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {});

    await act(async () => {
      await result.current.login(refreshResponse({ access_token: 'a2', refresh_token: 'r2' }));
    });

    await act(async () => {
      await result.current.logout();
    });

    expect(mockLogout).toHaveBeenCalledWith('r2', undefined);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('auth.refreshToken');
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('logout({allDevices: true}) passes the access token so backend revokes all', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {});

    await act(async () => {
      await result.current.login(refreshResponse({ access_token: 'a3', refresh_token: 'r3' }));
    });

    await act(async () => {
      await result.current.logout({ allDevices: true });
    });

    expect(mockLogout).toHaveBeenCalledWith('r3', 'a3');
  });
});
