/**
 * Type definitions for the Magic Scan flow.
 *
 * The direct-to-Gemini client implementation that used to live here
 * was removed when Magic Scan moved to the backend's /upload/parse
 * endpoint (the client-side path hung in TestFlight because
 * EXPO_PUBLIC_GEMINI_API_KEY wasn't in any EAS profile, and there
 * was no request timeout). See `services/uploadService.ts` for the
 * `parsePdfWithPasswordFlow` and `parseImageViaBackend` helpers
 * that replaced it.
 *
 * These types are kept here (rather than moved to a neutral
 * `scanTypes.ts`) to avoid churning every Magic Scan consumer's
 * import path in the same PR.
 */

export interface ScannedTransaction {
  merchant: string;
  amount: number;
  date: string;
  category: string;
  type: 'EXPENSE' | 'INCOME';
  currency: string;
  /**
   * Auto-suggested labels picked from the caller-supplied vocabulary
   * (the user's Settings → Vault Config → Labels list). 0..N entries.
   * Surfaced to the user as chips in the Magic Scan review modal so
   * they can confirm / strip / extend before committing.
   */
  labels?: string[];
}

export interface ScanResponse {
  transactions: ScannedTransaction[];
  sourceType: 'ESTATEMENT' | 'RECEIPT';
}

/**
 * Optional taxonomy passed alongside the scan so the LLM can tag each
 * parsed row with the user's own configured categories + labels rather
 * than a hardcoded fallback enum. Both lists default to the global
 * fallback when omitted (legacy callers stay working).
 */
export interface ScanTaxonomy {
  expenseCategories: string[];
  incomeCategories: string[];
  labels: string[];
}
