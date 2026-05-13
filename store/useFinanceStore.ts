import { create } from 'zustand';
import { financeApi, ApiTransaction, ApiAccount } from '../services/apiClient';

// Monotonic ID minter. Prevents collisions when many items are added in the
// same millisecond (e.g. forEach over a batch of scanned transactions).
let _idSeq = 0;
const mintId = (prefix: string) => `${prefix}_${Date.now()}_${++_idSeq}`;

export type TransactionType = 'INCOME' | 'EXPENSE' | 'TRANSFER';

export interface Wallet {
  id: string;
  name: string;
  type: 'PERSONAL' | 'TRIP' | 'FAMILY' | 'CRYPTO';
  balance: number;
  currency: string;
}

export interface Budget {
  id: string;
  name: string;
  amount: number;
  currency: string;
  recurrence: 'DAILY' | 'MONTHLY' | 'ONCE';
  wallets: string[] | 'ALL';
}

export interface Transaction {
  id: string;
  walletId: string;
  type: TransactionType;
  amount: number;
  category: string;
  merchant: string;
  date: Date;
}

interface FinanceState {
  activeWalletId: string;
  wallets: Wallet[];
  budgets: Budget[];
  transactions: Transaction[];
  
  // Actions
  setActiveWallet: (id: string) => void;
  addWallet: (wallet: Omit<Wallet, 'id'>) => void;
  addBudget: (budget: Omit<Budget, 'id'>) => void;
  addTransaction: (tx: Omit<Transaction, 'id' | 'date'> & { date?: Date }, skipSync?: boolean) => void;
  addTransactionsBatch: (
    txs: (Omit<Transaction, 'id' | 'date'> & { date?: Date })[],
  ) => { added: Transaction[]; skipped: number };

  deleteTransaction: (id: string) => void;
  syncData: () => Promise<void>;
  getTotalBalance: () => number;
}

// Signature used to detect duplicates across re-scans. Same walletId/day/
// merchant/amount/type is treated as the same transaction.
const txSignature = (tx: {
  walletId: string;
  date: Date;
  merchant: string;
  amount: number;
  type: TransactionType;
}) => {
  const day = new Date(tx.date).toISOString().slice(0, 10);
  const merchant = (tx.merchant || '').trim().toLowerCase();
  return `${tx.walletId}|${day}|${merchant}|${tx.amount.toFixed(2)}|${tx.type}`;
};


export const useFinanceStore = create<FinanceState>((set, get) => ({
  activeWalletId: 'w1',

  wallets: [
    { id: 'w1', name: 'Bank Account', type: 'PERSONAL', balance: 14240.00, currency: 'SGD' },
    { id: 'w2', name: 'Japan Trip 2026', type: 'TRIP', balance: 450000.00, currency: 'JPY' },
    { id: 'w3', name: 'Family Vault', type: 'FAMILY', balance: 8000.00, currency: 'SGD' }
  ],

  budgets: [],

  transactions: [
    { id: 't1', walletId: 'w1', type: 'EXPENSE', amount: 2499.00, category: 'Electronics', merchant: 'Apple Store', date: new Date() },
    { id: 't2', walletId: 'w1', type: 'EXPENSE', amount: 45.00, category: 'Dining', merchant: 'Makansutra', date: new Date(Date.now() - 86400000) },
    { id: 't3', walletId: 'w1', type: 'INCOME', amount: 8000.00, category: 'Salary', merchant: 'Deposit', date: new Date(Date.now() - 259200000) },
  ],

  setActiveWallet: (id) => set({ activeWalletId: id }),

  addWallet: (wallet) => set((state) => ({
    wallets: [...state.wallets, { ...wallet, id: mintId('w') }]
  })),

  addBudget: (budget) => set((state) => ({
     budgets: [...state.budgets, { ...budget, id: mintId('b') }]
  })),

  addTransaction: (tx, skipSync = false) => set((state) => {
    // Generate new tx and adjust wallet balance logically
    const newTx = { ...tx, id: mintId('tx'), date: tx.date || new Date() };

    const modifier = tx.type === 'INCOME' ? tx.amount : -tx.amount;

    return {
      transactions: [newTx, ...state.transactions],
      wallets: state.wallets.map(w => w.id === tx.walletId ? { ...w, balance: w.balance + modifier } : w)
    };
  }),

  addTransactionsBatch: (txs) => {
    const state = get();
    const seen = new Set(state.transactions.map(txSignature));
    const added: Transaction[] = [];
    let skipped = 0;

    for (const tx of txs) {
      const resolved: Transaction = {
        ...tx,
        id: mintId('tx'),
        date: tx.date || new Date(),
      };
      const sig = txSignature(resolved);
      if (seen.has(sig)) {
        skipped++;
        continue;
      }
      seen.add(sig);
      added.push(resolved);
    }

    if (added.length === 0) return { added, skipped };

    // Aggregate wallet balance deltas per wallet for one consistent update.
    const deltas = new Map<string, number>();
    for (const t of added) {
      const d = t.type === 'INCOME' ? t.amount : -t.amount;
      deltas.set(t.walletId, (deltas.get(t.walletId) || 0) + d);
    }

    set((s) => ({
      transactions: [...added, ...s.transactions],
      wallets: s.wallets.map((w) =>
        deltas.has(w.id) ? { ...w, balance: w.balance + (deltas.get(w.id) || 0) } : w,
      ),
    }));

    return { added, skipped };
  },

  syncData: async () => {
    try {
      const [accountsRes, txsRes] = await Promise.all([
        financeApi.getAccounts(),
        financeApi.getTransactions({ page_size: 100 })
      ]);

      const mappedWallets: Wallet[] = accountsRes.data.map(acc => ({
        id: acc.id.toString(),
        name: acc.name,
        type: acc.account_type === 'SAVINGS' ? 'PERSONAL' : 'FAMILY', // Heuristic
        balance: acc.balance,
        currency: acc.currency
      }));

      const mappedTxs: Transaction[] = txsRes.data.items.map(tx => ({
        id: tx.id.toString(),
        walletId: 'w1', // Default to first wallet for now
        type: tx.direction === 'CREDIT' ? 'INCOME' : 'EXPENSE',
        amount: tx.amount,
        category: tx.category,
        merchant: tx.description,
        date: new Date(tx.tx_date)
      }));

      set({ 
        wallets: mappedWallets.length > 0 ? mappedWallets : get().wallets,
        transactions: mappedTxs,
        activeWalletId: mappedWallets[0]?.id || 'w1'
      });
    } catch (error) {
      // Use warn (not error) so RN's LogBox doesn't pop a red banner —
      // sync failures are non-fatal (the app falls back to seeded data)
      // and commonly expected in dev when the backend is offline or the
      // current token isn't valid against it.
      console.warn('Sync failed', error);
    }
  },


  deleteTransaction: (id) => set((state) => {
    const tx = state.transactions.find(t => t.id === id);
    if (!tx) return state;
    
    // Reverse the wallet balance impact
    const modifier = tx.type === 'INCOME' ? -tx.amount : tx.amount;
    return {
      transactions: state.transactions.filter(t => t.id !== id),
      wallets: state.wallets.map(w => w.id === tx.walletId ? { ...w, balance: w.balance + modifier } : w)
    };
  }),

  getTotalBalance: () => {
    const { wallets, activeWalletId } = get();
    return wallets.find(w => w.id === activeWalletId)?.balance || 0;
  }
}));
