import { GoogleGenerativeAI } from "@google/generative-ai";
import * as FileSystem from 'expo-file-system/legacy';




const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? "";

// Ordered by preference; on persistent 5xx/429 we fall through to the next.
const MODEL_CHAIN = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
] as const;

const MAX_RETRIES_PER_MODEL = 3;
const BASE_BACKOFF_MS = 1000;

let genAI: GoogleGenerativeAI | null = null;
const modelCache = new Map<string, any>();

const getModel = (name: string) => {
  if (!GEMINI_API_KEY) {
    throw new Error("EXPO_PUBLIC_GEMINI_API_KEY is not set. Add it to .env.local.");
  }
  if (!genAI) genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  let cached = modelCache.get(name);
  if (!cached) {
    cached = genAI.getGenerativeModel({ model: name });
    modelCache.set(name, cached);
  }
  return cached;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 503 (overloaded), 429 (rate limit), and other 5xx are transient.
const isRetryableError = (err: any): boolean => {
  const status = err?.status ?? err?.response?.status;
  if (status === 429 || status === 503 || (status >= 500 && status < 600)) return true;
  const msg = String(err?.message ?? "");
  return /\b(503|429|overloaded|high demand|unavailable|rate.?limit)\b/i.test(msg);
};

const generateWithFallback = async (parts: any[]): Promise<any> => {
  let lastError: any;
  for (const modelName of MODEL_CHAIN) {
    for (let attempt = 0; attempt < MAX_RETRIES_PER_MODEL; attempt++) {
      try {
        const model = getModel(modelName);
        return await model.generateContent(parts);
      } catch (err) {
        lastError = err;
        if (!isRetryableError(err)) throw err;
        const delay = BASE_BACKOFF_MS * 2 ** attempt + Math.floor(Math.random() * 250);
        console.warn(
          `Gemini ${modelName} attempt ${attempt + 1}/${MAX_RETRIES_PER_MODEL} failed (retryable). Retrying in ${delay}ms.`,
        );
        await sleep(delay);
      }
    }
    console.warn(`Gemini ${modelName} exhausted retries; falling through to next model.`);
  }
  throw lastError;
};

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

const extractJson = (text: string): string => {
  // Try to find markdown code block first
  const match = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
  if (match) {
    return match[1].trim();
  }
  
  // Fallback: Find first { and last }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    return text.substring(start, end + 1);
  }
  
  return text.trim();
};

// Fallback taxonomy if the caller doesn't pass one. Matches the
// hardcoded list the scanner used pre-vault-config.
const FALLBACK_TAXONOMY: ScanTaxonomy = {
  expenseCategories: [
    'Dining',
    'Transport',
    'Entertainment',
    'Shopping',
    'Health',
    'Utilities',
    'Groceries',
    'Other',
  ],
  incomeCategories: ['Salary', 'Investment', 'Other'],
  labels: [],
};

export const scanDocumentWithGemini = async (
  uri: string,
  mimeType: string,
  taxonomy: ScanTaxonomy = FALLBACK_TAXONOMY,
): Promise<ScanResponse | null> => {
  try {
    const base64Data = await FileSystem.readAsStringAsync(uri, {
      encoding: (FileSystem.EncodingType as any)?.Base64 || 'base64' as any,
    });

    const isPdf = mimeType === 'application/pdf';

    // Compact list helpers so the prompt stays terse. We use a closed
    // vocabulary so the model can't invent categories that don't exist
    // in the user's Vault Config (and silently break Activity filtering).
    const expenseList = (taxonomy.expenseCategories.length ? taxonomy.expenseCategories : FALLBACK_TAXONOMY.expenseCategories).join(', ');
    const incomeList = (taxonomy.incomeCategories.length ? taxonomy.incomeCategories : FALLBACK_TAXONOMY.incomeCategories).join(', ');
    const labelList = taxonomy.labels.length ? taxonomy.labels.join(', ') : '(none configured)';

    const prompt = `
      You are a specialized financial parser for Singaporean bank e-statements (DBS, OCBC, UOB, Citi) and retail receipts.

      Analyze the attached ${isPdf ? 'PDF document' : 'image'} and extract all transactions into a JSON array.

      Requirements:
      1. For e-statements: extract every line item from the transaction history table.
      2. For receipts: extract the main transaction details.
      3. For each transaction, determine if it is an EXPENSE or INCOME.
      4. CATEGORY: pick exactly one value from the user's category vocabulary below.
         - EXPENSE rows → pick from: ${expenseList}.
         - INCOME rows → pick from: ${incomeList}.
         - If none match well, use "Other" (or the closest "Other"-style label that exists in the list).
         - Match is case-insensitive but echo the user's exact casing in the output.
      5. LABELS: from the user's label vocabulary below, return zero or more that genuinely apply.
         User labels: ${labelList}.
         - Be conservative. Only emit a label if there is clear evidence (e.g. a recurring monthly card charge → "Subscription"; an essential grocery run → "Needs"; a flight or hotel → "Travel"; a CPF entry → "CPF").
         - Never invent labels not in the user's list.
         - Most rows should have 0 or 1 labels; some 2; rarely 3.
         - Return an empty array when uncertain.

      Output JSON format:
      {
        "sourceType": "${isPdf ? 'ESTATEMENT' : 'RECEIPT'}",
        "transactions": [
          {
            "merchant": "Description or Merchant Name",
            "amount": 12.50,
            "date": "YYYY-MM-DD",
            "category": "Dining",
            "type": "EXPENSE",
            "currency": "SGD",
            "labels": ["Needs"]
          }
        ]
      }

      Only return the JSON. No preamble.
    `;

    const result = await generateWithFallback([
      prompt,
      {
        inlineData: {
          data: base64Data,
          mimeType: mimeType,
        },
      },
    ]);

    const response = await result.response;
    const text = response.text();
    const jsonString = extractJson(text);
    const parsed = JSON.parse(jsonString);
    
    // Defensive mapping to ensure no undefined fields. Labels are
    // also filtered against the user's actual vocabulary so the LLM
    // can't slip in a tag the user never configured — the worst case
    // when this filter trips is the row arrives with fewer labels than
    // Gemini proposed, which is preferable to dirty data.
    const allowedLabels = new Set(
      taxonomy.labels.map(l => l.toLowerCase()),
    );
    const filterLabels = (raw: any): string[] | undefined => {
      if (!Array.isArray(raw)) return undefined;
      const cleaned = raw
        .map(v => String(v ?? '').trim())
        .filter(v => v.length > 0)
        .filter(v => allowedLabels.size === 0 || allowedLabels.has(v.toLowerCase()));
      return cleaned.length > 0 ? Array.from(new Set(cleaned)) : undefined;
    };
    return {
      sourceType: parsed.sourceType || (isPdf ? 'ESTATEMENT' : 'RECEIPT'),
      transactions: (parsed.transactions || []).map((tx: any) => ({
        merchant: tx.merchant || 'Unknown Merchant',
        amount: Number(tx.amount) || 0,
        date: tx.date || new Date().toISOString().split('T')[0],
        category: tx.category || 'Other',
        type: tx.type === 'INCOME' ? 'INCOME' : 'EXPENSE',
        currency: tx.currency || 'SGD',
        labels: filterLabels(tx.labels),
      })),
    } as ScanResponse;

  } catch (error) {
    console.error("Gemini Scan Error:", error);
    return null;
  }
};
