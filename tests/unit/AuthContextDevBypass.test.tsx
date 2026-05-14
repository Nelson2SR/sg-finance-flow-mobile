/**
 * The DEV_DISABLE_AUTH flag in constants/Config.ts short-circuits AuthContext
 * so hydrate() returns a synthetic session instead of touching SecureStore or
 * hitting the refresh endpoint. Without this, the dev simulator gets stuck on
 * the login screen whenever the backend is unreachable.
 *
 * Post-PR-2: there is no separate "vault unlock" concept — authenticated is
 * the only state that gates tab access.
 */

import React from 'react';
import { act, renderHook } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('../../constants/Config', () => ({
  DEV_DISABLE_AUTH: true,
  DEV_FAKE_TOKEN: 'dev-bypass-token',
  DEV_PHONE_OTP_BYPASS: false,
  DEV_PHONE_OTP_CODE: '000000',
  API_CONFIG: { BASE_URL: 'http://localhost:8000/api/v1' },
}));

jest.mock('../../services/authService', () => ({
  refreshSession: jest.fn(),
  logout: jest.fn(),
}));

jest.mock('../../services/apiClient', () => ({
  onAuthFailed: jest.fn(() => () => undefined),
}));

import { AuthProvider, useAuth } from '../../context/AuthContext';

describe('AuthContext dev bypass', () => {
  beforeEach(() => jest.clearAllMocks());

  it('auto-seeds the fake token and synthesises a dev user', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {});

    expect(result.current.accessToken).toBe('dev-bypass-token');
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.display_name).toBe('Dev Bypass');
    expect(result.current.isLoading).toBe(false);
    // The bypass must not read SecureStore — that's the whole point.
    expect(SecureStore.getItemAsync).not.toHaveBeenCalled();
  });
});
