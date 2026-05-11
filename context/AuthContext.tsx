import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { Alert } from 'react-native';

interface AuthContextType {
  token: string | null;
  masterPassphrase: string | null;
  isLoading: boolean;
  login: (token: string, username: string) => Promise<void>;
  logout: () => Promise<void>;
  unlockVault: (passphrase: string) => Promise<boolean>;
  isAuthenticated: boolean;
  isVaultUnlocked: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [masterPassphrase, setMasterPassphrase] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadToken();
  }, []);

  async function loadToken() {
    try {
      const savedToken = await SecureStore.getItemAsync('userToken');
      if (savedToken) {
        setToken(savedToken);
      }
    } catch (e) {
      console.error('Failed to load token', e);
    } finally {
      setIsLoading(false);
    }
  }

  const login = async (newToken: string, username: string) => {
    await SecureStore.setItemAsync('userToken', newToken);
    await SecureStore.setItemAsync('username', username);
    setToken(newToken);
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync('userToken');
    await SecureStore.deleteItemAsync('masterPassphrase');
    setToken(null);
    setMasterPassphrase(null);
  };

  const unlockVault = async (passphrase: string): Promise<boolean> => {
    // In a real app, we'd verify this with the backend or a local hash
    // For now, we'll store it securely if it's the first time, or verify it
    try {
      const savedPass = await SecureStore.getItemAsync('masterPassphrase');
      console.log('--- Vault Unlock Attempt ---');
      console.log('Saved Passphrase Exists:', !!savedPass);
      
      if (!savedPass) {
        console.log('First time setup - saving new passphrase');
        await SecureStore.setItemAsync('masterPassphrase', passphrase);
        setMasterPassphrase(passphrase);
        return true;
      }

      if (savedPass === passphrase) {
        console.log('Unlock successful');
        setMasterPassphrase(passphrase);
        return true;
      } else {
        console.log('Unlock failed - mismatch');
        Alert.alert('Error', 'Incorrect Master Passphrase');
        return false;
      }

    } catch (e) {
      return false;
    }
  };

  const value = {
    token,
    masterPassphrase,
    isLoading,
    login,
    logout,
    unlockVault,
    isAuthenticated: !!token,
    isVaultUnlocked: !!masterPassphrase,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
