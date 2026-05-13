/**
 * The DEV_DISABLE_AUTH flag in constants/Config.ts short-circuits AuthContext
 * so loadToken() drops a fake token instead of touching SecureStore. Pair it
 * with DEV_DISABLE_VAULT and the AuthGuard sends the user straight to /(tabs)
 * without ever showing /login. Without this, the dev simulator gets stuck on
 * the login screen whenever the FastAPI backend at 192.168.50.76:8000 is
 * unreachable.
 */

import { renderHook, act } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import React from 'react';

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('../../constants/Config', () => ({
  DEV_DISABLE_AUTH: true,
  DEV_DISABLE_VAULT: true,
  DEV_FAKE_TOKEN: 'dev-bypass-token',
  API_CONFIG: { BASE_URL: 'http://localhost:8000/api/v1' },
}));

import { AuthProvider, useAuth } from '../../context/AuthContext';

describe('AuthContext dev bypass', () => {
  beforeEach(() => jest.clearAllMocks());

  it('auto-seeds the fake token and marks the vault unlocked', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {});

    expect(result.current.token).toBe('dev-bypass-token');
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.isVaultUnlocked).toBe(true);
    expect(result.current.isLoading).toBe(false);
    // The bypass must not read SecureStore — that's the whole point.
    expect(SecureStore.getItemAsync).not.toHaveBeenCalled();
  });
});
