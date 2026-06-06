import type { Transaction } from '../store/useFinanceStore';

/**
 * Total income and expense for a wallet within the calendar month of
 * `reference`. Backs the Home screen's "This Month Activity" card.
 *
 * Previously the card summed a wallet's transactions across all time
 * (no date filter), so a month with no activity still displayed the
 * all-time totals. Scoping to `reference`'s year + month fixes that.
 *
 * TRANSFER rows are intentionally excluded — the card only contrasts
 * money in vs money out.
 */
export function sumMonthlyActivity(
  transactions: Transaction[],
  walletId: string,
  reference: Date,
): { income: number; expense: number } {
  const year = reference.getFullYear();
  const month = reference.getMonth();

  let income = 0;
  let expense = 0;
  for (const t of transactions) {
    if (t.walletId !== walletId) continue;
    if (t.date.getFullYear() !== year || t.date.getMonth() !== month) continue;
    if (t.type === 'INCOME') income += t.amount;
    else if (t.type === 'EXPENSE') expense += t.amount;
  }
  return { income, expense };
}
