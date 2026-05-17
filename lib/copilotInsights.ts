/**
 * Build the advisor persona's opening message from the user's actual
 * finance state — replaces the previous hardcoded "Transport up 20%"
 * placeholder, which fabricated numbers the user had never seen.
 *
 * The greeting is intentionally a single sentence (so it reads like a
 * chat opener, not a report) and picks ONE signal in priority order:
 *   1. Empty wallets / no transactions → onboarding nudge
 *   2. Tight budget (≥80% used) → cap warning
 *   3. Significant month-over-month shift in the top category (≥10%)
 *   4. Active budget context with current spend ratio
 *   5. Bare-bones spend summary as a fallback
 *
 * All numbers come from real transactions/budgets; we never invent
 * a category name or percentage. Returns a string ready to drop into
 * a ChatMessage bubble.
 */

import {
  getBudgetAmountForMonth,
  currentMonthCode,
  type Budget,
  type Transaction,
  type Wallet,
} from '../store/useFinanceStore';

interface GreetingInput {
  transactions: Transaction[];
  budgets: Budget[];
  wallets: Wallet[];
}

function dollars(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

export function buildAdvisorGreeting({
  transactions,
  budgets,
  wallets,
}: GreetingInput): string {
  if (wallets.length === 0) {
    return 'Welcome to VaultWise. Add a wallet from Home and I can start surfacing patterns in your spending.';
  }
  if (transactions.length === 0) {
    return "Welcome back. Import a statement or scan a receipt and I'll start flagging what changes month to month.";
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const monthName = now.toLocaleDateString('en-US', { month: 'long' });

  const monthExpenses = transactions.filter(
    (t) => t.type === 'EXPENSE' && t.date >= monthStart,
  );
  const prevMonthExpenses = transactions.filter(
    (t) => t.type === 'EXPENSE' && t.date >= prevMonthStart && t.date < monthStart,
  );

  if (monthExpenses.length === 0) {
    if (prevMonthExpenses.length > 0) {
      const prevTotal = prevMonthExpenses.reduce((a, b) => a + b.amount, 0);
      return `Welcome back. Nothing logged for ${monthName} yet — last month you spent ${dollars(prevTotal)} across ${prevMonthExpenses.length} ${prevMonthExpenses.length === 1 ? 'transaction' : 'transactions'}. Want me to compare once new activity lands?`;
    }
    return `Welcome back. Nothing logged for ${monthName} yet — drop in a receipt or import a statement and I'll get to work.`;
  }

  const totalSpend = monthExpenses.reduce((a, b) => a + b.amount, 0);

  const byCat = new Map<string, number>();
  for (const tx of monthExpenses) {
    byCat.set(tx.category, (byCat.get(tx.category) ?? 0) + tx.amount);
  }
  const sortedCats = [...byCat.entries()].sort(([, a], [, b]) => b - a);
  const [topCat, topAmt] = sortedCats[0];
  const topPct = totalSpend > 0 ? Math.round((topAmt / totalSpend) * 100) : 0;

  // Active budgets are those with at least one amount version recorded.
  const activeBudgets = budgets.filter((b) => b.versions.length > 0);
  const cap = activeBudgets.reduce(
    (a, b) => a + getBudgetAmountForMonth(b, currentMonthCode()),
    0,
  );

  if (cap > 0) {
    const pct = Math.round((totalSpend / cap) * 100);
    const remaining = cap - totalSpend;
    if (pct >= 80) {
      return remaining > 0
        ? `Heads up — you've used ${pct}% of your ${monthName} budget (${dollars(totalSpend)} of ${dollars(cap)}). Only ${dollars(remaining)} safe to spend. Want me to flag what's burning fastest?`
        : `You're over budget for ${monthName} by ${dollars(Math.abs(remaining))} (spent ${dollars(totalSpend)} of ${dollars(cap)}). Want me to walk through where it went?`;
    }
  }

  // Month-over-month delta on the top category — a real signal when it
  // exists, skipped silently otherwise.
  const prevTopAmt = prevMonthExpenses
    .filter((t) => t.category === topCat)
    .reduce((a, b) => a + b.amount, 0);
  if (prevTopAmt > 0) {
    const delta = Math.round(((topAmt - prevTopAmt) / prevTopAmt) * 100);
    if (Math.abs(delta) >= 10) {
      const direction = delta > 0 ? 'up' : 'down';
      return `Hi! Your ${monthName} ${topCat} spend is ${dollars(topAmt)} (${topPct}% of total) — ${direction} ${Math.abs(delta)}% vs last month. Want me to break it down?`;
    }
  }

  if (cap > 0) {
    const remaining = Math.max(cap - totalSpend, 0);
    return `Hi! You've spent ${dollars(totalSpend)} of your ${dollars(cap)} ${monthName} budget (${dollars(remaining)} left). Top category is ${topCat}. Want me to dig in?`;
  }

  return `Hi! You've logged ${dollars(totalSpend)} across ${monthExpenses.length} ${monthExpenses.length === 1 ? 'transaction' : 'transactions'} so far this ${monthName}. Top category: ${topCat} (${topPct}%). Want me to dig in?`;
}
