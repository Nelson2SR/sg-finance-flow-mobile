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
}

export interface ScanResponse {
  transactions: ScannedTransaction[];
  sourceType: 'ESTATEMENT' | 'RECEIPT';
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

export const scanDocumentWithGemini = async (uri: string, mimeType: string): Promise<ScanResponse | null> => {
  try {
    const base64Data = await FileSystem.readAsStringAsync(uri, {
      encoding: (FileSystem.EncodingType as any)?.Base64 || 'base64' as any,
    });



    const isPdf = mimeType === 'application/pdf';
    
    const prompt = `
      You are a specialized financial parser for Singaporean bank e-statements (DBS, OCBC, UOB, Citi) and retail receipts.
      
      Analyze the attached ${isPdf ? 'PDF document' : 'image'} and extract all transactions into a JSON array.
      
      Requirements:
      1. For e-statements: Extract all line items from the transaction history table. 
      2. For receipts: Extract the main transaction details.
      3. For each transaction, determine if it is an EXPENSE or INCOME.
      4. Categorize each transaction into one of: Dining, Transport, Entertainment, Shopping, Health, Utilities, Groceries, Salary, Investment, Other.
      
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
            "currency": "SGD"
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
    
    // Defensive mapping to ensure no undefined fields
    return {
      sourceType: parsed.sourceType || (isPdf ? 'ESTATEMENT' : 'RECEIPT'),
      transactions: (parsed.transactions || []).map((tx: any) => ({
        merchant: tx.merchant || 'Unknown Merchant',
        amount: Number(tx.amount) || 0,
        date: tx.date || new Date().toISOString().split('T')[0],
        category: tx.category || 'Other',
        type: tx.type === 'INCOME' ? 'INCOME' : 'EXPENSE',
        currency: tx.currency || 'SGD'
      }))
    } as ScanResponse;

  } catch (error) {
    console.error("Gemini Scan Error:", error);
    return null;
  }
};
