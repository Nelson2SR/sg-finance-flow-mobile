/**
 * Dev-only sample-data seed.
 *
 * Purpose: when running in `__DEV__` mode against an empty backend (or
 * the App Review demo account), make every screen visually alive so
 * design + interaction work doesn't require manually adding 20
 * transactions to see the donut chart, TrendChart, Active Routines,
 * etc.
 *
 * Contract:
 *   • Only runs when `__DEV__ === true`. Production builds never
 *     call it (and the import is tree-shaken out by `if (__DEV__)`
 *     guards at the call sites).
 *   • Only runs when the store is empty (wallets.length === 0 AND
 *     transactions.length === 0). The moment the user creates a real
 *     wallet, this is a no-op forever — real data always wins.
 *   • Writes only to local Zustand state — never POSTs anywhere.
 *     If you `eas build` and use the resulting binary against the
 *     prod backend, you see real data, not seed data.
 *
 * What's seeded:
 *   • 2 wallets — bank (SGD) + trip (JPY) — exercises the multi-
 *     currency rendering path on Home + the wallet dropdown.
 *   • ~24 transactions distributed across the last 6 months —
 *     mix of EXPENSE and INCOME so cashflow, TrendChart, and the
 *     category donut all have material to render.
 *   • 2 budgets — "Dining out" tracking Food & Drink @ $3000, and
 *     "Shopping" tracking Shopping @ $5000. Combined with the
 *     transactions seed, Insights shows real bar progress + an
 *     amber "Untracked this month" footer.
 */

import type { Budget, Transaction, Wallet } from '../store/useFinanceStore';

const SEED_WALLETS: Wallet[] = [
  {
    id: 'dev-wallet-1',
    name: 'OCBC 365',
    type: 'PERSONAL',
    balance: 14_240,
    currency: 'SGD',
  },
  {
    id: 'dev-wallet-2',
    name: 'Japan Trip',
    type: 'TRIP',
    balance: 450_000,
    currency: 'JPY',
  },
];

/**
 * Build a 6-month transaction history with realistic spend patterns:
 * mostly EXPENSE entries, a few INCOME (salary), spread across
 * recognisable categories so the donut chart has 4-5 visible slices.
 *
 * All dates are computed at import-time relative to "now" so the
 * seed always lines up with the current month grid in the UI.
 */
function buildSeedTransactions(): Transaction[] {
  const now = new Date();
  const daysAgo = (n: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - n);
    return d;
  };

  const txs: Omit<Transaction, 'id'>[] = [
    // ── Current month ──────────────────────────────────────────
    { walletId: 'dev-wallet-1', type: 'INCOME',  amount: 8_000,  category: 'Salary',         merchant: 'Acme Pte Ltd',  date: daysAgo(2),  labels: undefined },
    { walletId: 'dev-wallet-1', type: 'EXPENSE', amount: 49.50,  category: 'Food & Drink',   merchant: 'Toast Box',     date: daysAgo(0),  labels: ['Needs'] },
    { walletId: 'dev-wallet-1', type: 'EXPENSE', amount: 320,    category: 'Food & Drink',   merchant: 'NTUC FairPrice',date: daysAgo(1),  labels: ['Needs'] },
    { walletId: 'dev-wallet-1', type: 'EXPENSE', amount: 1_350,  category: 'Shopping',       merchant: 'Apple Store',   date: daysAgo(4),  labels: ['Wants'] },
    { walletId: 'dev-wallet-1', type: 'EXPENSE', amount: 89,     category: 'Transport',      merchant: 'Grab',          date: daysAgo(3),  labels: undefined },
    { walletId: 'dev-wallet-1', type: 'EXPENSE', amount: 450,    category: 'Health',     merchant: 'Raffles Clinic',date: daysAgo(8),  labels: ['Needs'] },

    // ── Last month ─────────────────────────────────────────────
    { walletId: 'dev-wallet-1', type: 'INCOME',  amount: 8_000,  category: 'Salary',         merchant: 'Acme Pte Ltd',  date: daysAgo(32), labels: undefined },
    { walletId: 'dev-wallet-1', type: 'EXPENSE', amount: 220,    category: 'Food & Drink',   merchant: 'Cold Storage',  date: daysAgo(35), labels: ['Needs'] },
    { walletId: 'dev-wallet-1', type: 'EXPENSE', amount: 78,     category: 'Food & Drink',   merchant: 'Pizza Hut',     date: daysAgo(40), labels: ['Wants'] },
    { walletId: 'dev-wallet-1', type: 'EXPENSE', amount: 2_100,  category: 'Shopping',       merchant: 'Uniqlo',        date: daysAgo(38), labels: ['Wants'] },
    { walletId: 'dev-wallet-1', type: 'EXPENSE', amount: 95,     category: 'Entertainment',  merchant: 'Cathay',        date: daysAgo(43), labels: ['Wants'] },
    { walletId: 'dev-wallet-1', type: 'EXPENSE', amount: 32,     category: 'Home & Bills',   merchant: 'Netflix',       date: daysAgo(45), labels: ['Subscription'] },

    // ── 2 months ago ───────────────────────────────────────────
    { walletId: 'dev-wallet-1', type: 'INCOME',  amount: 8_000,  category: 'Salary',         merchant: 'Acme Pte Ltd',  date: daysAgo(62), labels: undefined },
    { walletId: 'dev-wallet-1', type: 'EXPENSE', amount: 540,    category: 'Food & Drink',   merchant: 'Marketplace',   date: daysAgo(68), labels: ['Needs'] },
    { walletId: 'dev-wallet-1', type: 'EXPENSE', amount: 1_800,  category: 'Travel',         merchant: 'Singapore Airlines', date: daysAgo(70), labels: undefined },
    { walletId: 'dev-wallet-1', type: 'EXPENSE', amount: 32,     category: 'Home & Bills',   merchant: 'Netflix',       date: daysAgo(75), labels: ['Subscription'] },

    // ── 3 months ago ───────────────────────────────────────────
    { walletId: 'dev-wallet-1', type: 'INCOME',  amount: 8_000,  category: 'Salary',         merchant: 'Acme Pte Ltd',  date: daysAgo(92), labels: undefined },
    { walletId: 'dev-wallet-1', type: 'EXPENSE', amount: 410,    category: 'Food & Drink',   merchant: 'Sheng Siong',   date: daysAgo(95), labels: ['Needs'] },
    { walletId: 'dev-wallet-1', type: 'EXPENSE', amount: 480,    category: 'Shopping',       merchant: 'IKEA',          date: daysAgo(100), labels: ['Wants'] },

    // ── 4 months ago ───────────────────────────────────────────
    { walletId: 'dev-wallet-1', type: 'INCOME',  amount: 8_000,  category: 'Salary',         merchant: 'Acme Pte Ltd',  date: daysAgo(122), labels: undefined },
    { walletId: 'dev-wallet-1', type: 'EXPENSE', amount: 360,    category: 'Food & Drink',   merchant: 'NTUC FairPrice',date: daysAgo(126), labels: ['Needs'] },
    { walletId: 'dev-wallet-1', type: 'EXPENSE', amount: 950,    category: 'Transport',      merchant: 'COE Renewal',   date: daysAgo(130), labels: ['Needs'] },

    // ── 5 months ago ───────────────────────────────────────────
    { walletId: 'dev-wallet-1', type: 'INCOME',  amount: 8_000,  category: 'Salary',         merchant: 'Acme Pte Ltd',  date: daysAgo(152), labels: undefined },
    { walletId: 'dev-wallet-1', type: 'EXPENSE', amount: 280,    category: 'Food & Drink',   merchant: 'Cold Storage',  date: daysAgo(156), labels: ['Needs'] },
    { walletId: 'dev-wallet-1', type: 'EXPENSE', amount: 720,    category: 'Shopping',       merchant: 'Decathlon',     date: daysAgo(160), labels: ['Wants'] },

    // ── JPY wallet — a couple of trip-related entries ──────────
    { walletId: 'dev-wallet-2', type: 'EXPENSE', amount: 12_500, category: 'Food & Drink',   merchant: 'Sushiro',       date: daysAgo(90), labels: undefined },
    { walletId: 'dev-wallet-2', type: 'EXPENSE', amount: 6_300,  category: 'Transport',      merchant: 'JR Pass',       date: daysAgo(91), labels: undefined },
  ];

  return txs.map((tx, idx) => ({ ...tx, id: `dev-tx-${idx}` }));
}

const SEED_BUDGETS: Budget[] = [
  {
    id: 'dev-budget-1',
    name: 'Dining out',
    amount: 3_000,
    currency: 'SGD',
    recurrence: 'MONTHLY',
    wallets: 'ALL',
    categories: ['Food & Drink'],
  },
  {
    id: 'dev-budget-2',
    name: 'Shopping',
    amount: 5_000,
    currency: 'SGD',
    recurrence: 'MONTHLY',
    wallets: 'ALL',
    categories: ['Shopping'],
  },
];

export const DEV_SEED = {
  wallets: SEED_WALLETS,
  transactions: buildSeedTransactions(),
  budgets: SEED_BUDGETS,
  activeWalletId: SEED_WALLETS[0].id,
} as const;
