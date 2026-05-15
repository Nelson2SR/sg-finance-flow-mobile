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
  /**
   * Free-form labels attached to this transaction (e.g. "Needs",
   * "Reimbursable"). Populated by the Magic Scan auto-tagger and by
   * the user via the manual editor. Optional so existing seed rows
   * keep working without migration.
   */
  labels?: string[];
}

interface FinanceState {
  /** `null` before the first sync completes or when the user has no
   * wallets. Callers must guard against this; the older `string`-only
   * shape implicitly assumed a seeded `w1`. */
  activeWalletId: string | null;
  wallets: Wallet[];
  budgets: Budget[];
  transactions: Transaction[];
  /** True while syncData is in flight. The screens use this together
   * with `hasSynced` to decide between "show skeletons" (first sync,
   * no data yet) and "show empty state" (sync finished, still empty). */
  isSyncing: boolean;
  /** Flips to true after the first syncData call resolves, regardless
   * of success. Stays true across subsequent syncs so we don't
   * re-show the cold-start skeleton on every pull-to-refresh. */
  hasSynced: boolean;
  
  // Actions
  setActiveWallet: (id: string) => void;
  addWallet: (wallet: Omit<Wallet, 'id'>) => void;
  addBudget: (budget: Omit<Budget, 'id'>) => void;
  addTransaction: (tx: Omit<Transaction, 'id' | 'date'> & { date?: Date }, skipSync?: boolean) => void;
  addTransactionsBatch: (
    txs: (Omit<Transaction, 'id' | 'date'> & { date?: Date })[],
  ) => { added: Transaction[]; skipped: number };

  deleteTransaction: (id: string) => void;
  /**
   * Patch the labels on an existing local transaction by id. Used by
   * the Copilot CREATE_TRANSACTION flow to apply LLM-suggested labels
   * after a successful backend execute — the backend's Transaction
   * model doesn't yet store labels, so they live only in the local
   * Zustand store (Phase 1 invariant).
   */
  updateTransactionLabels: (id: string, labels: string[]) => void;
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
  // Empty until `syncData` populates from the backend. A brand-new user
  // with no bank accounts sees a true empty state rather than fake
  // wallets/transactions.
  activeWalletId: null,

  wallets: [],

  budgets: [],

  transactions: [],

  isSyncing: false,
  hasSynced: false,

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
    set({ isSyncing: true });
    try {
      const [accountsRes, txsRes] = await Promise.all([
        financeApi.getAccounts(),
        financeApi.getTransactions({ page_size: 100 })
      ]);

      // FastAPI serialises Decimal columns as JSON strings (Pydantic
      // default). The mobile UI assumes plain numbers — `tx.amount.toFixed(2)`
      // crashed the Home screen with "toFixed is not a function" when we
      // mapped these straight through. Coerce defensively here.
      const mappedWallets: Wallet[] = accountsRes.data.map(acc => ({
        id: acc.id.toString(),
        name: acc.name ?? acc.account_name,
        // `wallet_type` is the canonical mobile-facing category; only
        // fall back to the account_type heuristic for rows created
        // before migration 014.
        type: (acc.wallet_type as Wallet['type']) ??
              (acc.account_type === 'SAVINGS' ? 'PERSONAL' : 'FAMILY'),
        balance: Number(acc.balance) || 0,
        currency: acc.currency ?? 'SGD',
      }));

      // Anchor transactions to the first real wallet for now — the
      // backend tx schema doesn't yet carry a foreign key to accounts.
      // Once the join lands, replace this with the real `account_id`.
      const defaultWalletId = mappedWallets[0]?.id ?? '';
      const mappedTxs: Transaction[] = txsRes.data.items.map(tx => ({
        id: tx.id.toString(),
        walletId: defaultWalletId,
        type: tx.direction === 'CREDIT' ? 'INCOME' : 'EXPENSE',
        amount: Number(tx.amount) || 0,
        category: tx.category,
        merchant: tx.description,
        date: new Date(tx.tx_date),
        // Labels come from the transaction_labels join (Phase 2). Older
        // backends omit this field; treat undefined the same as no labels.
        labels:
          Array.isArray(tx.labels) && tx.labels.length > 0 ? tx.labels : undefined,
      }));

      set({
        wallets: mappedWallets,
        transactions: mappedTxs,
        activeWalletId: mappedWallets[0]?.id ?? null,
      });
    } catch (error) {
      // Use warn (not error) so RN's LogBox doesn't pop a red banner —
      // sync failures are non-fatal (the app falls back to seeded data)
      // and commonly expected in dev when the backend is offline or the
      // current token isn't valid against it.
      console.warn('Sync failed', error);
    } finally {
      // Flip both flags together: isSyncing → false, hasSynced → true.
      // Screens use hasSynced=false as the "show skeleton" condition so
      // a brand-new launch never blinks the empty state in for the
      // 200ms before data lands.
      set({ isSyncing: false, hasSynced: true });
    }
  },


  updateTransactionLabels: (id, labels) =>
    set((state) => ({
      transactions: state.transactions.map(t =>
        t.id === id ? { ...t, labels: labels.length > 0 ? labels : undefined } : t,
      ),
    })),

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
