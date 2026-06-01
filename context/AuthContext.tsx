import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

import {
  API_CONFIG,
  DEV_DISABLE_AUTH,
  DEV_FAKE_TOKEN,
} from '../constants/Config';
import { forgetAllBankPasswords } from '../lib/bankPasswords';
import {
  clearTokens,
  getCachedUser,
  getTokens,
  setCachedUser,
  setTokens,
} from '../lib/secureStore';
import { isAccessTokenFresh } from '../lib/jwt';
import { useVaultGroupsStore } from '../store/useVaultGroupsStore';
import { useFinanceStore } from '../store/useFinanceStore';
import { useCategoriesStore } from '../store/useCategoriesStore';
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
  /** Replace the in-memory user without re-issuing tokens. Used after
   * profile edits so dependent UIs (settings header, etc.) update. */
  updateUser: (user: AuthUser) => void;
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
    // Fire a no-auth warmup ping the moment the app starts so a sleeping
    // Render instance begins waking in parallel with token refresh and
    // SecureStore reads. On the free tier the wake-up takes 15-50s; if
    // we wait until the first user-blocking request to trigger it, the
    // home screen sits empty for the same duration. Fire-and-forget —
    // we don't care about the response, only about kicking the instance.
    const pingHealth = () => {
      void fetch(`${API_CONFIG.BASE_URL}/health`, { method: 'GET' }).catch(() => {
        // Swallow — this is a warmup, not a precondition.
      });
    };
    pingHealth();

    void hydrate();
    // The apiClient's response interceptor calls these listeners when a
    // 401-driven refresh fails (refresh token revoked/expired). We drop
    // local state so the AuthGuard routes back to /login.
    const unsub = onAuthFailed(() => {
      setUser(null);
      setAccessToken(null);
      setRefreshToken(null);
    });

    // Keep-alive: ping /health every 10 min while the app is in the
    // foreground. Render's free tier spins instances down after ~15
    // min of inactivity; this keeps the instance warm during a usage
    // session so a user who scans receipts intermittently doesn't
    // hit 502s mid-session. Resets timing on every foreground entry
    // (and pings immediately to recover from a possible mid-session
    // sleep that happened while backgrounded).
    const KEEP_ALIVE_MS = 10 * 60 * 1000;
    let keepAliveTimer: ReturnType<typeof setInterval> | null = null;
    const startKeepAlive = () => {
      if (keepAliveTimer) return;
      keepAliveTimer = setInterval(pingHealth, KEEP_ALIVE_MS);
    };
    const stopKeepAlive = () => {
      if (keepAliveTimer) {
        clearInterval(keepAliveTimer);
        keepAliveTimer = null;
      }
    };
    const onAppStateChange = (next: AppStateStatus) => {
      if (next === 'active') {
        pingHealth();
        startKeepAlive();
      } else {
        stopKeepAlive();
      }
    };
    startKeepAlive();
    const subscription = AppState.addEventListener('change', onAppStateChange);

    return () => {
      unsub();
      stopKeepAlive();
      subscription.remove();
    };
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

      // Fast path: if the cached access token still has ≥5 min of life
      // and we have a cached user object, skip the `/auth/refresh`
      // round-trip entirely. The 401 interceptor will refresh on demand
      // if any request later comes back unauthorized. This saves the
      // 4-10s `/auth/refresh` RTT (Neon cold compute) on every warm
      // app reopen — and, just as importantly, on a flaky network the
      // home screen no longer sits behind a 10s refresh timeout.
      const cachedUser = await getCachedUser();
      if (cachedUser && isAccessTokenFresh(pair.accessToken)) {
        setUser(cachedUser);
        setAccessToken(pair.accessToken);
        setRefreshToken(pair.refreshToken);
        // Fire-and-forget — see bootstrapVaultGroups for why this is
        // not awaited; the home tab gates syncData on activeGroupId.
        void bootstrapVaultGroups();
        setIsLoading(false);
        return;
      }

      // Slow path: token is stale (or no cached user). Rotate the
      // refresh token and pick up a fresh access token + user.
      try {
        const fresh = await refreshSession(pair.refreshToken);
        await setTokens({
          accessToken: fresh.access_token,
          refreshToken: fresh.refresh_token,
        });
        await setCachedUser(fresh.user);
        setUser(fresh.user);
        setAccessToken(fresh.access_token);
        setRefreshToken(fresh.refresh_token);
        // Fire-and-forget — the home tab's syncData waits for
        // `activeGroupId` to land before issuing financeApi calls, so
        // the X-Vault-Group-Id header isn't missing. Awaiting here
        // used to add ~9s to TTI on cold Neon compute.
        void bootstrapVaultGroups();
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
    // Privacy hygiene: any time the authenticated user changes (sign
    // in as a different account, or first sign-in after sign-out),
    // wipe every locally-cached data store so the first frame of
    // /(tabs) shows the new user's empty state — never the previous
    // user's wallets / transactions / categories. Without this we
    // had a ~200ms flash of stale data after signup landed on Home
    // before syncData replaced it.
    const isAccountSwitch = user?.id !== resp.user.id;
    if (isAccountSwitch) {
      useFinanceStore.setState({
        wallets: [],
        transactions: [],
        budgets: [],
        activeWalletId: null,
        hasSynced: false,
        isSyncing: false,
        // Clear the dev-seed lock so the new account gets a fresh
        // seed (and a real account on the prod backend gets a clean
        // server-driven sync without the lock blocking it).
        hasUserData: false,
      });
      useCategoriesStore.setState({ categories: [], labels: [] });
      useVaultGroupsStore.setState({ groups: [], activeGroupId: null });
    }

    await setTokens({
      accessToken: resp.access_token,
      refreshToken: resp.refresh_token,
    });
    await setCachedUser(resp.user);
    setUser(resp.user);
    setAccessToken(resp.access_token);
    setRefreshToken(resp.refresh_token);
    // Fire-and-forget — login is on the user's blocking path (OTP
    // verify is in flight on /login). Letting it resolve before vault
    // groups land means the router transitions to /(tabs) ~1 RTT
    // sooner; the home tab's syncData gates on activeGroupId.
    void bootstrapVaultGroups();
  };

  /**
   * After a successful sign-in / refresh:
   *   1. sync the Vault Groups list (backend auto-creates a default
   *      on first login, so this is never empty for an authed user)
   *   2. if the deep-link handler stashed a pending invite code,
   *      consume it now → land inside the inviter's group
   *
   * Both steps swallow failures: a sync blip shouldn't block the user
   * from reaching /(tabs). The home tab's own sync-on-mount will
   * retry. A failed invite consume is mildly surprising but the
   * code stays cached until the user retries or signs in elsewhere.
   */
  async function bootstrapVaultGroups() {
    const groupsStore = useVaultGroupsStore.getState();
    try {
      await groupsStore.syncFromBackend();
    } catch (err) {
      console.warn('[Auth] vault groups sync failed', err);
    }
    if (groupsStore.pendingInviteCode) {
      try {
        await groupsStore.consumeInvite(groupsStore.pendingInviteCode);
      } catch (err) {
        console.warn('[Auth] pending invite consume failed', err);
        // Leave the code cached — user can retry from a banner.
      }
    }
  }

  const logout = async (opts?: { allDevices?: boolean }) => {
    if (refreshToken) {
      await logoutEndpoint(
        refreshToken,
        opts?.allDevices ? accessToken ?? undefined : undefined,
      );
    }
    // Belt-and-braces privacy hygiene: a "log out everywhere" should
    // also drop the on-device bank PDF password cache for this user.
    // Single-device logout keeps the cache so re-logging-in on the
    // same device doesn't re-prompt for every saved bank.
    if (opts?.allDevices && user?.id) {
      await forgetAllBankPasswords(user.id);
    }
    await clearTokens();
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
    // Clear every in-memory store so the login screen renders cleanly
    // and the next login starts from a true empty state.
    useFinanceStore.setState({
      wallets: [],
      transactions: [],
      budgets: [],
      activeWalletId: null,
      hasSynced: false,
      isSyncing: false,
    });
    useCategoriesStore.setState({ categories: [], labels: [] });
    useVaultGroupsStore.setState({ groups: [], activeGroupId: null });
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
        // Mirror profile-edit updates into the SecureStore cache so a
        // cold restart's fast-path doesn't restore the pre-edit user.
        updateUser: (next: AuthUser) => {
          setUser(next);
          void setCachedUser(next);
        },
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
