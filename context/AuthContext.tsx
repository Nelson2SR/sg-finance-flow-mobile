import React, { createContext, useContext, useEffect, useState } from 'react';

import {
  DEV_DISABLE_AUTH,
  DEV_FAKE_TOKEN,
} from '../constants/Config';
import {
  clearTokens,
  getTokens,
  setTokens,
} from '../lib/secureStore';
import { onAuthFailed } from '../services/apiClient';
import {
  AuthResponse,
  AuthUser,
  logout as logoutEndpoint,
  refreshSession,
} from '../services/authService';

interface AuthContextType {
  user: AuthUser | null;
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  /** Persist a fresh login pair to secure storage and hydrate context state. */
  login: (resp: AuthResponse) => Promise<void>;
  /** Revoke server-side and wipe local tokens. Defaults to single-device logout. */
  logout: (opts?: { allDevices?: boolean }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEV_USER: AuthUser = {
  id: 0,
  display_name: 'Dev Bypass',
  avatar_url: null,
  email: null,
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void hydrate();
    // The apiClient's response interceptor calls these listeners when a
    // 401-driven refresh fails (refresh token revoked/expired). We drop
    // local state so the AuthGuard routes back to /login.
    const unsub = onAuthFailed(() => {
      setUser(null);
      setAccessToken(null);
      setRefreshToken(null);
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function hydrate() {
    if (DEV_DISABLE_AUTH) {
      // Dev shortcut. Backend rejects the fake token with 401 — see
      // Config.ts for caveats.
      setUser(DEV_USER);
      setAccessToken(DEV_FAKE_TOKEN);
      setIsLoading(false);
      return;
    }

    try {
      const pair = await getTokens();
      if (!pair) {
        setIsLoading(false);
        return;
      }

      // Try to refresh on cold launch — this rotates the long-lived
      // refresh token AND gives us a fresh 1h access token, so the
      // user doesn't immediately hit a 401 on their first request.
      try {
        const fresh = await refreshSession(pair.refreshToken);
        await setTokens({
          accessToken: fresh.access_token,
          refreshToken: fresh.refresh_token,
        });
        setUser(fresh.user);
        setAccessToken(fresh.access_token);
        setRefreshToken(fresh.refresh_token);
      } catch {
        // Refresh token is dead — wipe and drop to /login.
        await clearTokens();
      }
    } catch (err) {
      console.warn('[Auth] hydrate failed', err);
    } finally {
      setIsLoading(false);
    }
  }

  const login = async (resp: AuthResponse) => {
    await setTokens({
      accessToken: resp.access_token,
      refreshToken: resp.refresh_token,
    });
    setUser(resp.user);
    setAccessToken(resp.access_token);
    setRefreshToken(resp.refresh_token);
  };

  const logout = async (opts?: { allDevices?: boolean }) => {
    if (refreshToken) {
      await logoutEndpoint(
        refreshToken,
        opts?.allDevices ? accessToken ?? undefined : undefined,
      );
    }
    await clearTokens();
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isLoading,
        isAuthenticated: !!accessToken,
        login,
        logout,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};
