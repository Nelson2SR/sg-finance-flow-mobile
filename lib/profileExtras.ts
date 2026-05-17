/**
 * Local-only profile extras (phone, birthday, gender, local avatar URI).
 *
 * The backend's `AuthUser` row currently only carries `display_name` and
 * `avatar_url` — phone is captured at sign-in but isn't returned on the
 * user object, and birthday/gender aren't a backend concern yet. Until
 * the API ships those columns, this module stores them in iOS Keychain /
 * Android Keystore (via `expo-secure-store`), keyed per user so a device
 * shared between accounts keeps them isolated.
 *
 * Keys: `profile-extras.{userId}` → JSON blob. Single-key storage is
 * fine here — the blob is tiny (a few hundred bytes), and SecureStore's
 * per-write cost dominates anything we'd save by splitting.
 *
 * `avatarUri` holds an on-device file URI (e.g. from expo-image-picker).
 * It's NOT the same field as the backend's `avatar_url` — the backend
 * has no upload endpoint yet, so picked avatars live on-device only.
 * The Profile screen prefers the local URI when present, falls back to
 * `user.avatar_url` from the backend otherwise.
 */

import * as SecureStore from 'expo-secure-store';

export type Gender = 'male' | 'female' | 'other' | 'prefer_not';

export interface ProfileExtras {
  phone?: string;
  birthday?: string; // ISO `YYYY-MM-DD`
  gender?: Gender;
  avatarUri?: string;
}

const key = (userId: number) => `profile-extras.${userId}`;

export async function getProfileExtras(userId: number): Promise<ProfileExtras> {
  const raw = await SecureStore.getItemAsync(key(userId));
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as ProfileExtras) : {};
  } catch {
    // Corrupted blob — start fresh. We never throw here; the screen
    // should always render against an empty-state default.
    return {};
  }
}

export async function updateProfileExtras(
  userId: number,
  patch: Partial<ProfileExtras>,
): Promise<ProfileExtras> {
  const current = await getProfileExtras(userId);
  const next: ProfileExtras = { ...current, ...patch };
  // Strip empty strings so a cleared field round-trips as undefined
  // instead of an empty string the UI would treat as "set".
  for (const k of Object.keys(next) as (keyof ProfileExtras)[]) {
    if (next[k] === '' || next[k] === undefined) {
      delete next[k];
    }
  }
  await SecureStore.setItemAsync(key(userId), JSON.stringify(next));
  return next;
}

export async function clearProfileExtras(userId: number): Promise<void> {
  await SecureStore.deleteItemAsync(key(userId));
}
