import { Transaction, Wallet } from '../store/useFinanceStore';

/**
 * Mock API boundaries mapping out the PRD requirements 
 * for Tanstack Query in Phase 3.
 * 
 * Once FastAPI logic is deployed on Render/Vercel, replace endpoints with process.env.EXPO_PUBLIC_API_URL
 */

const IS_MOCK = true;
const API_URL = 'http://localhost:8000';

export const FinanceAPI = {
  // Syncs all wallet balances securely
  fetchWallets: async (): Promise<Wallet[]> => {
    if (IS_MOCK) return [];
    const res = await fetch(`${API_URL}/wallets/`);
    return res.json();
  },

  // Receives the PDF from the Local Keychain interaction boundary
  uploadStatement: async (pdfBase64: string, keychainSecret: string) => {
    if (IS_MOCK) return { success: true, processed: 14 };
    
    // Secure transmission boundary. Password is NEVER stored in Postgres.
    const res = await fetch(`${API_URL}/statement/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file: pdfBase64, decryptionKey: keychainSecret })
    });
    return res.json();
  },

  // Generative AI functional-calling hook
  copilotQuery: async (prompt: string, contextWallets: Wallet[]) => {
    if (IS_MOCK) return {
      text: "I analyzed your request. I've prepared a widget to execute the transfer.",
      widget: { type: 'TRANSFER_CONFIRM', amount: 50 }
    };

    const res = await fetch(`${API_URL}/copilot/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, localContext: contextWallets })
    });
    return res.json();
  }
};
