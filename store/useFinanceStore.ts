import { create } from 'zustand';
import { financeApi, ApiTransaction, ApiAccount } from '../services/apiClient';


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

  deleteTransaction: (id: string) => void;
  syncData: () => Promise<void>;
  getTotalBalance: () => number;
}


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
    wallets: [...state.wallets, { ...wallet, id: `w${Date.now()}` }]
  })),

  addBudget: (budget) => set((state) => ({
     budgets: [...state.budgets, { ...budget, id: `b${Date.now()}` }]
  })),

  addTransaction: (tx, skipSync = false) => set((state) => {
    // Generate new tx and adjust wallet balance logically
    const newTx = { ...tx, id: Date.now().toString(), date: tx.date || new Date() };

    const modifier = tx.type === 'INCOME' ? tx.amount : -tx.amount;
    
    return {
      transactions: [newTx, ...state.transactions],
      wallets: state.wallets.map(w => w.id === tx.walletId ? { ...w, balance: w.balance + modifier } : w)
    };
  }),

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
      console.error('Sync failed', error);
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
