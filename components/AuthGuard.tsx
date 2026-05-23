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
 *
 * After PR-2 there is no separate "vault unlock" gate — successful login
 * is the only condition for tab access.
 *
 * Onboarding gate: a freshly-created account has a null display_name
 * until the user completes /new-profile. We drive such users to
 * onboarding here rather than relying on the signup screen's manual
 * router.replace('/new-profile') — that call races this effect (which
 * fires the moment isAuthenticated flips true while still on /login)
 * and, if the guard's '/(tabs)' redirect lands last, onboarding is
 * skipped and the name is never collected. Gating on display_name makes
 * it deterministic and also recovers a user who force-quit mid-onboarding
 * (relaunch refreshes a null-name user straight into /(tabs)).
 */
export function useAuthGuard() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    if (!navigationState?.key || isLoading) return;

    const inAuthGroup = segments[0] === 'login';
    const inOnboarding = segments[0] === 'new-profile';
    // An authenticated user without a usable display_name still needs to
    // pass through /new-profile. Whitespace-only counts as not set.
    const needsOnboarding =
      isAuthenticated && !(user?.display_name && user.display_name.trim());

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/login');
    } else if (needsOnboarding && !inOnboarding) {
      router.replace('/new-profile');
    } else if (isAuthenticated && !needsOnboarding && (inAuthGroup || inOnboarding)) {
      router.replace('/(tabs)');
    }
  }, [
    isAuthenticated,
    isLoading,
    user?.display_name,
    segments,
    navigationState?.key,
    router,
  ]);
}

export function AuthGuard() {
  useAuthGuard();
  return null;
}
