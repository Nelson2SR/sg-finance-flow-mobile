/**
 * Routes uploads through the backend's /upload/parse endpoint.
 *
 * PDFs need backend round-tripping because they may be password-
 * protected and we use pikepdf (server-side) to decrypt them. The
 * password ships in the multipart body, is used once in backend RAM,
 * and is NEVER persisted server-side (see api/routes/upload.py — no
 * credential_store writes).
 *
 * Receipts/images also flow through this same endpoint now (used to be
 * direct-to-Gemini from the client). Reasons:
 *   1. Direct client calls had no request timeout — the spinner could
 *      hang indefinitely on a stalled Gemini connection.
 *   2. EXPO_PUBLIC_GEMINI_API_KEY wasn't included in any EAS build
 *      profile, so TestFlight builds silently failed.
 *   3. Prompt versioning and error handling live in one place.
 *
 * Error contract: a 422 with `code === 'PDF_PASSWORD_REQUIRED'` means
 * the caller should prompt the user for the password and retry. A 422
 * with `code === 'PDF_PASSWORD_INCORRECT'` means the password sent was
 * wrong; the caller should clear the stored value (if any) and prompt
 * fresh. Image uploads never produce these codes.
 */

import * as FileSystem from 'expo-file-system';

import { apiClient } from './apiClient';
import type { ScanResponse } from './geminiService';

export type PdfParseErrorCode = 'PDF_PASSWORD_REQUIRED' | 'PDF_PASSWORD_INCORRECT';

export class PdfPasswordError extends Error {
  readonly code: PdfParseErrorCode;
  readonly bank: string | null;
  constructor(code: PdfParseErrorCode, message: string, bank: string | null) {
    super(message);
    this.name = 'PdfPasswordError';
    this.code = code;
    this.bank = bank;
  }
}

/** Backend's /upload/parse response shape. */
interface ParseApiResponse {
  bank: string;
  account_type: string;
  statement_period: string | null;
  transaction_count: number;
  transactions: Array<{
    tx_date: string;
    description: string;
    amount: number;
    direction: 'DEBIT' | 'CREDIT';
    category: string;
    currency: string;
    labels?: string[];
  }>;
}

/**
 * Upload a PDF for parsing. Returns the same ``ScanResponse`` shape as
 * the direct-Gemini path so the Magic Scan review modal can render
 * either source uniformly.
 */
export async function parsePdfViaBackend(
  uri: string,
  password?: string,
): Promise<ScanResponse> {
  const form = new FormData();
  form.append('file', {
    uri,
    name: uri.split('/').pop() ?? 'statement.pdf',
    type: 'application/pdf',
  } as any);
  if (password) {
    form.append('pdf_password', password);
  }

  try {
    const resp = await apiClient.post<ParseApiResponse>('/upload/parse', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      // Some PDFs are big; allow more time than the default.
      timeout: 60_000,
    });

    const data = resp.data;
    return {
      sourceType: 'ESTATEMENT',
      transactions: data.transactions.map((t) => ({
        merchant: t.description,
        amount: Math.abs(Number(t.amount) || 0),
        date: t.tx_date,
        category: t.category,
        type: t.direction === 'CREDIT' ? 'INCOME' : 'EXPENSE',
        currency: t.currency,
        labels: t.labels,
      })),
    };
  } catch (err: any) {
    // Translate the typed backend error into something the caller can
    // branch on. The backend returns a structured detail body
    //   { code: 'PDF_PASSWORD_REQUIRED' | 'PDF_PASSWORD_INCORRECT',
    //     message, bank }
    // for the password-related 422s.
    const detail = err?.response?.data?.detail;
    if (
      err?.response?.status === 422 &&
      detail &&
      typeof detail === 'object' &&
      (detail.code === 'PDF_PASSWORD_REQUIRED' ||
        detail.code === 'PDF_PASSWORD_INCORRECT')
    ) {
      throw new PdfPasswordError(detail.code, detail.message, detail.bank ?? null);
    }
    throw err;
  }
}

/**
 * Read a local file as base64 — small helper used by the upload screen
 * when it needs to pre-flight a PDF's hash before sending. Kept here
 * so callers don't all reach into expo-file-system directly.
 */
export async function readFileAsBase64(uri: string): Promise<string> {
  return FileSystem.readAsStringAsync(uri, {
    encoding: (FileSystem.EncodingType as any)?.Base64 || ('base64' as any),
  });
}

/**
 * Upload a receipt image (or any photo of a transaction) for parsing.
 * Routes through the same /upload/parse endpoint as PDFs — the backend
 * branches on the multipart Content-Type and runs the receipt-shaped
 * Gemini prompt. Returns the same ``ScanResponse`` shape so the Magic
 * Scan review modal renders both sources identically.
 *
 * `mimeType` should be the picker's reported MIME (e.g. `image/heic`,
 * `image/png`) — not a hardcoded `image/jpeg`. Callers that hardcode
 * the MIME break the iOS Camera HEIC default and Gemini rejects the
 * mismatched payload.
 */
export async function parseImageViaBackend(
  uri: string,
  mimeType: string,
): Promise<ScanResponse> {
  // Pick a sensible filename suffix from the mime so the backend's
  // tempfile + Gemini File API both accept the upload. Without a
  // matching suffix, Gemini's File API returns FAILED state.
  const suffixByMime: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/heic': '.heic',
    'image/heif': '.heif',
  };
  const suffix = suffixByMime[mimeType.toLowerCase()] ?? '.jpg';

  const form = new FormData();
  form.append('file', {
    uri,
    name: `receipt${suffix}`,
    type: mimeType,
  } as any);

  const resp = await apiClient.post<ParseApiResponse>('/upload/parse', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    // Receipts are usually <500KB; 45s is generous but caps the
    // "hang" failure mode that the direct-to-Gemini path had.
    timeout: 45_000,
  });

  const data = resp.data;
  return {
    sourceType: 'RECEIPT',
    transactions: data.transactions.map((t) => ({
      merchant: t.description,
      amount: Math.abs(Number(t.amount) || 0),
      date: t.tx_date,
      category: t.category,
      type: t.direction === 'CREDIT' ? 'INCOME' : 'EXPENSE',
      currency: t.currency,
      labels: t.labels,
    })),
  };
}

import { Alert, Platform } from 'react-native';

import {
  forgetBankPassword,
  getBankPassword,
  setBankPassword,
} from '../lib/bankPasswords';

/**
 * Drive the full encrypted-PDF parse flow:
 *
 *   1. Try parsing without a password.
 *   2. If backend returns PDF_PASSWORD_REQUIRED, check the Keychain
 *      for a cached password keyed on the bank the backend identified.
 *      Retry silently if found.
 *   3. If no cached password (or it was wrong), prompt the user.
 *      Cancel returns null; a correct password is written to the
 *      Keychain so next month's statement skips the prompt.
 *   4. Give up after ``maxAttempts`` to avoid loops on a corrupt file.
 *
 * Android: Alert.prompt is iOS-only, so encrypted PDFs on Android
 * show a graceful "iOS only" message until PR-3b ships a cross-
 * platform input modal. The vast majority of bank statements in our
 * target market are imported on iOS.
 */
export async function parsePdfWithPasswordFlow(
  uri: string,
  userId: number,
  options: { maxAttempts?: number } = {},
): Promise<ScanResponse | null> {
  // maxAttempts bounds how many *user prompts* we allow. The first
  // silent retry with a cached password doesn't count — otherwise a
  // stale Keychain entry would silently eat one of the user's tries.
  const maxAttempts = options.maxAttempts ?? 3;
  let prompts = 0;
  let bank: string | null = null;
  let password: string | null = null;

  // Defensive cap on total loop iterations (cached retry + prompts +
  // network blips) so a buggy backend cannot pin us forever.
  for (let i = 0; i < maxAttempts * 2 + 1; i++) {
    try {
      const result = await parsePdfViaBackend(uri, password ?? undefined);
      if (password && bank) {
        await setBankPassword(userId, bank, password);
      }
      return result;
    } catch (err: any) {
      if (!(err instanceof PdfPasswordError)) throw err;

      bank = err.bank ?? bank;

      // First-pass silent retry with a cached password — only fires
      // for PDF_PASSWORD_REQUIRED (the backend didn't even try one),
      // and only when we haven't already pulled it from the cache.
      if (bank && password === null && err.code === 'PDF_PASSWORD_REQUIRED') {
        const saved = await getBankPassword(userId, bank);
        if (saved) {
          password = saved;
          continue;
        }
      }

      // If we just used a cached password and the backend says it's
      // wrong, the cache is stale — wipe it before re-prompting so a
      // bad value doesn't haunt the user's next import.
      if (err.code === 'PDF_PASSWORD_INCORRECT' && bank && password !== null) {
        await forgetBankPassword(userId, bank);
      }

      prompts += 1;
      if (prompts > maxAttempts) break;

      const promptTitle =
        err.code === 'PDF_PASSWORD_INCORRECT'
          ? `Wrong password for ${bank ?? 'this statement'}`
          : `Unlock ${bank ?? 'this PDF statement'}`;
      const promptMessage =
        err.code === 'PDF_PASSWORD_INCORRECT'
          ? 'Try again — the password we tried did not match.'
          : 'Enter the PDF password from your bank. We will keep it on this device only.';

      const typed = await promptForPassword(promptTitle, promptMessage);
      if (!typed) return null;
      password = typed;
    }
  }

  Alert.alert('Could not unlock PDF', 'Gave up after several attempts. Try again later.');
  return null;
}

function promptForPassword(title: string, message: string): Promise<string | null> {
  return new Promise((resolve) => {
    if (Platform.OS !== 'ios') {
      Alert.alert(
        'Encrypted PDF',
        'Password-protected PDFs are currently iOS-only. Please import on an iPhone or remove the password first.',
      );
      resolve(null);
      return;
    }
    (Alert as any).prompt(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
        { text: 'Unlock', onPress: (value?: string) => resolve(value ?? null) },
      ],
      'secure-text',
    );
  });
}
