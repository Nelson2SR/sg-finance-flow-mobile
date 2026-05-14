/**
 * On-device bank PDF password store (PRD 09 §4.4).
 *
 * Bank PDF passwords NEVER leave the device, NEVER touch the backend
 * `credential_store` table (which is deprecated and dropped in PR-4).
 * The Magic Scan flow consults this store first; only if no password
 * is cached does it prompt the user, then writes the result back here
 * for future imports of the same bank's statements.
 *
 * Keys:
 *   bankpw::{userId}::{bank}  → the password itself
 *   bankpw_idx::{userId}      → JSON array of bank slugs the user has
 *                                stored a password for (used by the
 *                                Privacy settings screen to enumerate
 *                                without scanning every possible key).
 *
 * The Keychain itself enforces device-level access control — biometric
 * unlock + Secure Enclave on iOS, EncryptedSharedPreferences on Android.
 */

import * as SecureStore from 'expo-secure-store';

const passwordKey = (userId: number, bank: string) =>
  `bankpw::${userId}::${bank.toUpperCase()}`;
const indexKey = (userId: number) => `bankpw_idx::${userId}`;

async function readIndex(userId: number): Promise<string[]> {
  const raw = await SecureStore.getItemAsync(indexKey(userId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((b) => String(b).toUpperCase()) : [];
  } catch {
    // Index got corrupted — start fresh. The individual password
    // entries are still safe; they're just orphaned from listing.
    return [];
  }
}

async function writeIndex(userId: number, banks: string[]): Promise<void> {
  // Dedupe + uppercase. Empty array stored as empty string would be
  // confusing — delete the index key entirely instead.
  const unique = Array.from(new Set(banks.map((b) => b.toUpperCase())));
  if (unique.length === 0) {
    await SecureStore.deleteItemAsync(indexKey(userId));
  } else {
    await SecureStore.setItemAsync(indexKey(userId), JSON.stringify(unique));
  }
}

export async function getBankPassword(
  userId: number,
  bank: string,
): Promise<string | null> {
  return SecureStore.getItemAsync(passwordKey(userId, bank));
}

export async function setBankPassword(
  userId: number,
  bank: string,
  password: string,
): Promise<void> {
  if (!password) {
    // Defensive: don't store an empty password.
    return;
  }
  await SecureStore.setItemAsync(passwordKey(userId, bank), password);
  const idx = await readIndex(userId);
  if (!idx.includes(bank.toUpperCase())) {
    idx.push(bank.toUpperCase());
    await writeIndex(userId, idx);
  }
}

export async function forgetBankPassword(
  userId: number,
  bank: string,
): Promise<void> {
  await SecureStore.deleteItemAsync(passwordKey(userId, bank));
  const idx = await readIndex(userId);
  const filtered = idx.filter((b) => b !== bank.toUpperCase());
  await writeIndex(userId, filtered);
}

export async function forgetAllBankPasswords(userId: number): Promise<void> {
  const idx = await readIndex(userId);
  await Promise.all(
    idx.map((bank) => SecureStore.deleteItemAsync(passwordKey(userId, bank))),
  );
  await writeIndex(userId, []);
}

export async function listSavedBanks(userId: number): Promise<string[]> {
  return readIndex(userId);
}
