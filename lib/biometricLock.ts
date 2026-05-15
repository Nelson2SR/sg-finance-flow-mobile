/**
 * Biometric lock state + helpers.
 *
 * Behaviour:
 *   - The user enables/disables the lock from Settings → Preferences.
 *     The preference persists across launches in SecureStore.
 *   - When enabled, the app is locked on:
 *       (a) cold launch (AuthContext finishes hydrating)
 *       (b) returning to foreground after spending >5s in background
 *           (matching iOS Keychain biometric-prompt UX in finance apps)
 *   - When disabled, the lock is a no-op.
 *
 * The lock state is exposed via a tiny Zustand store rather than React
 * context so the AuthGuard and the BiometricGate overlay can read it
 * without prop-drilling. The Settings toggle is the only writer of the
 * preference; lock/unlock are driven by AppState transitions inside
 * the BiometricGate component.
 */

import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

const PREF_KEY = 'biometric_lock_enabled';

interface BiometricState {
  /** True if the user has opted in (persisted preference). */
  enabled: boolean;
  /** True when the app is locked and the gate overlay should be shown. */
  isLocked: boolean;
  /** Read the persisted preference at startup. Idempotent. */
  hydrate: () => Promise<void>;
  /** Flip the preference; writes to SecureStore. */
  setEnabled: (next: boolean) => Promise<void>;
  /** Drop into the locked state (called by the foreground listener). */
  lock: () => void;
  /** Lift the lock (called by the gate after a successful prompt). */
  unlock: () => void;
}

export const useBiometricStore = create<BiometricState>((set, get) => ({
  enabled: false,
  // Default to locked-when-enabled so cold launch goes through the
  // prompt before tab content paints. If the preference resolves to
  // disabled in hydrate(), we drop the lock immediately.
  isLocked: true,
  hydrate: async () => {
    try {
      const raw = await SecureStore.getItemAsync(PREF_KEY);
      const enabled = raw === '1';
      set({ enabled, isLocked: enabled });
    } catch {
      set({ enabled: false, isLocked: false });
    }
  },
  setEnabled: async (next) => {
    try {
      await SecureStore.setItemAsync(PREF_KEY, next ? '1' : '0');
    } catch {
      // Best-effort persistence; preference still applies for this
      // session. The Settings UI can show its own toast if needed.
    }
    set({
      enabled: next,
      // Turning the lock on shouldn't immediately kick the user out —
      // they just confirmed who they are. Turning it off lifts any
      // pending lock.
      isLocked: next ? get().isLocked : false,
    });
  },
  lock: () => {
    // Only meaningful when the feature is enabled.
    if (get().enabled) set({ isLocked: true });
  },
  unlock: () => set({ isLocked: false }),
}));
