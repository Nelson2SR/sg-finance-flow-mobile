import { useEffect } from 'react';
import { useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { useAuth } from '../context/AuthContext';

/**
 * Redirect logic split out so it is testable with renderHook(). Gates on
 * useRootNavigationState().key so router.replace() never fires before the
 * navigator has registered — calling it earlier was the source of the
 * "Couldn't find a navigation context" crash that surfaced wherever React
 * happened to be reconciling at the time (often inside the wallet/filter
 * chips on the Transactions tab).
 */
export function useAuthGuard() {
  const { isAuthenticated, isVaultUnlocked, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    if (!navigationState?.key || isLoading) return;

    const inAuthGroup = segments[0] === 'login';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/login');
    } else if (isAuthenticated && !isVaultUnlocked && !inAuthGroup) {
      router.replace('/login');
    } else if (isAuthenticated && isVaultUnlocked && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [
    isAuthenticated,
    isVaultUnlocked,
    isLoading,
    segments,
    navigationState?.key,
    router,
  ]);
}

export function AuthGuard() {
  useAuthGuard();
  return null;
}
