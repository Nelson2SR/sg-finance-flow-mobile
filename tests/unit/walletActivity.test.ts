/**
 * Regression test for the Home "This Month Activity" card.
 *
 * Bug: the card summed every transaction for the wallet across all time
 * (filtered only by walletId + type, never by date), so in a month with
 * no activity it still showed the all-time totals. It must be scoped to
 * the calendar month of the reference date.
 */

import { sumMonthlyActivity } from '../../lib/walletActivity';
import type { Transaction } from '../../store/useFinanceStore';

const tx = (over: Partial<Transaction>): Transaction => ({
  id: Math.random().toString(),
  walletId: 'w1',
  type: 'EXPENSE',
  amount: 10,
  category: 'X',
  merchant: 'M',
  date: new Date(2026, 5, 6), // June 6 2026 (month is 0-based)
  ...over,
});

describe('sumMonthlyActivity', () => {
  it('sums only the reference-month income and expense for the wallet', () => {
    const txs = [
      tx({ type: 'INCOME', amount: 100, date: new Date(2026, 5, 2) }),
      tx({ type: 'EXPENSE', amount: 40, date: new Date(2026, 5, 20) }),
      tx({ type: 'EXPENSE', amount: 5, date: new Date(2026, 5, 28) }),
    ];
    expect(sumMonthlyActivity(txs, 'w1', new Date(2026, 5, 6))).toEqual({
      income: 100,
      expense: 45,
    });
  });

  it('excludes transactions from other months and other years', () => {
    const txs = [
      tx({ type: 'INCOME', amount: 100, date: new Date(2026, 5, 2) }), // June ✓
      tx({ type: 'INCOME', amount: 999, date: new Date(2026, 4, 30) }), // May ✗
      tx({ type: 'EXPENSE', amount: 999, date: new Date(2025, 5, 6) }), // June *2025* ✗
    ];
    expect(sumMonthlyActivity(txs, 'w1', new Date(2026, 5, 6))).toEqual({
      income: 100,
      expense: 0,
    });
  });

  it('excludes other wallets', () => {
    const txs = [
      tx({ type: 'EXPENSE', amount: 50, walletId: 'w1' }),
      tx({ type: 'EXPENSE', amount: 70, walletId: 'w2' }),
    ];
    expect(sumMonthlyActivity(txs, 'w1', new Date(2026, 5, 6))).toEqual({
      income: 0,
      expense: 50,
    });
  });

  it('returns zeros for a month with no activity', () => {
    const txs = [tx({ type: 'EXPENSE', amount: 50, date: new Date(2026, 3, 1) })];
    expect(sumMonthlyActivity(txs, 'w1', new Date(2026, 5, 6))).toEqual({
      income: 0,
      expense: 0,
    });
  });
});
