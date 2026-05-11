import { renderHook, act } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../../context/AuthContext';
import * as SecureStore from 'expo-secure-store';
import React from 'react';

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

describe('AuthContext TDD', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('initializes with null token', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    const { result } = renderHook(() => useAuth(), { wrapper });
    
    // Wait for loadToken
    await act(async () => {});
    
    expect(result.current.token).toBeNull();
  });

  it('logins successfully', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    
    await act(async () => {
      await result.current.login('test_token', 'test_user');
    });

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('userToken', 'test_token');
    expect(result.current.token).toBe('test_token');
  });

  it('unlocks vault on first time', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    const { result } = renderHook(() => useAuth(), { wrapper });

    let success = false;
    await act(async () => {
      success = await result.current.unlockVault('my_pass');
    });

    expect(success).toBe(true);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('masterPassphrase', 'my_pass');
    expect(result.current.masterPassphrase).toBe('my_pass');
  });

  it('fails unlock on wrong passphrase', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('correct_pass');
    const { result } = renderHook(() => useAuth(), { wrapper });

    let success = true;
    await act(async () => {
      success = await result.current.unlockVault('wrong_pass');
    });

    expect(success).toBe(false);
    expect(result.current.masterPassphrase).toBeNull();
  });

  it('logouts and clears storage', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.logout();
    });

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('userToken');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('masterPassphrase');
    expect(result.current.token).toBeNull();
    expect(result.current.masterPassphrase).toBeNull();
  });
});
