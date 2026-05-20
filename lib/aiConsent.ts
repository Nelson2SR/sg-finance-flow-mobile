/**
 * AI data-sharing consent, persisted per user.
 *
 * App Review (Guideline 5.1.1(i) / 5.1.2(i)) requires that before the
 * app sends personal data to a third-party AI service we (a) disclose
 * what is sent, (b) name the recipient, and (c) obtain explicit
 * permission. The Magic Scan and Copilot features both send data to
 * Google Gemini (statement text, receipt images, transaction details,
 * chat messages), so the first time the user invokes either feature we
 * show a blocking consent sheet and record the grant here.
 *
 * Keyed per user (`ai-consent.{userId}`) so a device shared between
 * accounts asks each account once. Stored in SecureStore alongside the
 * other on-device prefs (see lib/profileExtras, lib/bankPasswords).
 */

import * as SecureStore from 'expo-secure-store';

const key = (userId: number) => `ai-consent.${userId}`;

export async function hasAiConsent(userId: number): Promise<boolean> {
  const raw = await SecureStore.getItemAsync(key(userId));
  return raw === 'granted';
}

export async function grantAiConsent(userId: number): Promise<void> {
  await SecureStore.setItemAsync(key(userId), 'granted');
}

export async function revokeAiConsent(userId: number): Promise<void> {
  await SecureStore.deleteItemAsync(key(userId));
}
