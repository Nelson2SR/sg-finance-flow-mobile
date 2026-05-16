/**
 * BiometricGate — full-screen overlay shown when the app is locked.
 *
 * Lives at the root layout level. Renders nothing when:
 *   • biometric lock is disabled in Settings, OR
 *   • the user is not authenticated (login screen handles its own auth)
 *
 * Otherwise it covers the tabs with an opaque card and pops the
 * native Face ID / Touch ID prompt. On success → unlock; on
 * cancel/failure → stay locked with a "Try again" button.
 *
 * The gate also listens to AppState to re-lock when the app returns
 * from background after >5s. Quick swipe-down → swipe-up cycles
 * (< 5s) don't re-prompt so glancing at a notification doesn't
 * feel hostile.
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { AppState, AppStateStatus, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';

import { useAuth } from '../context/AuthContext';
import { useBiometricStore } from '../lib/biometricLock';

const BACKGROUND_LOCK_GRACE_MS = 5_000;

export function BiometricGate() {
  const { isAuthenticated } = useAuth();
  const enabled = useBiometricStore(s => s.enabled);
  const isLocked = useBiometricStore(s => s.isLocked);
  const lock = useBiometricStore(s => s.lock);
  const unlock = useBiometricStore(s => s.unlock);

  const lastBackgroundedAt = useRef<number | null>(null);

  const runPrompt = useCallback(async () => {
    // If the device doesn't support biometrics, don't trap the user.
    // (Best-effort: a stricter app could fall back to a passcode UI.)
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = hasHardware && (await LocalAuthentication.isEnrolledAsync());
    if (!hasHardware || !isEnrolled) {
      unlock();
      return;
    }
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock VaultWise',
      // Letting the OS pick the type — iOS uses Face ID where available,
      // Touch ID otherwise. We don't disable device passcode fallback
      // (Apple's HIG strongly recommends keeping it).
    });
    if (result.success) {
      unlock();
    }
  }, [unlock]);

  // Fire the prompt automatically when (a) we're authenticated and
  // (b) the lock is currently engaged. This handles both cold-launch
  // hydration and AppState-triggered re-locks.
  useEffect(() => {
    if (isAuthenticated && enabled && isLocked) {
      void runPrompt();
    }
  }, [isAuthenticated, enabled, isLocked, runPrompt]);

  // AppState: re-lock when coming back from background after the
  // grace window. Background entry just stamps a timestamp; the
  // re-lock decision happens on the return-to-active edge.
  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'background' || next === 'inactive') {
        lastBackgroundedAt.current = Date.now();
      } else if (next === 'active') {
        const since = lastBackgroundedAt.current;
        lastBackgroundedAt.current = null;
        if (since !== null && Date.now() - since >= BACKGROUND_LOCK_GRACE_MS) {
          lock();
        }
      }
    });
    return () => sub.remove();
  }, [enabled, lock]);

  if (!isAuthenticated || !enabled || !isLocked) return null;

  return (
    <View
      pointerEvents="auto"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#0B0E14',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
        elevation: 9999,
      }}>
      <View
        className="w-20 h-20 rounded-[24px] bg-accent-coral justify-center items-center mb-6"
        style={{ boxShadow: '0 0 32px rgba(255, 107, 74, 0.55)' }}>
        <Ionicons name="lock-closed" size={40} color="white" />
      </View>
      <Text className="font-jakarta-bold text-white text-2xl tracking-tighter mb-2">
        VaultWise
      </Text>
      <Text className="font-jakarta text-text-mid text-sm mb-10 text-center px-8">
        Unlock with Face ID or Touch ID to continue.
      </Text>
      <Pressable
        onPress={runPrompt}
        className="bg-accent-coral px-8 py-4 rounded-full active:scale-95"
        style={{ boxShadow: '0 0 24px rgba(255, 107, 74, 0.45)' }}>
        <Text className="font-jakarta-bold text-white text-base">Try again</Text>
      </Pressable>
    </View>
  );
}
