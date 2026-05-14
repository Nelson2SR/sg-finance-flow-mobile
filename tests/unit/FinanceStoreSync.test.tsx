/**
 * Regression tests for ``useFinanceStore.syncData``.
 *
 * Bug history this guards against:
 *   1. FastAPI serialises Decimal columns as JSON strings (Pydantic
 *      default). The Home screen called ``tx.amount.toFixed(2)`` on
 *      the mapped result and crashed with "toFixed is not a function"
 *      because the raw string passed through unchanged.
 *   2. After a Copilot action, ``syncData`` needs to surface the new
 *      backend rows into the local Zustand store so Home and Activity
 *      reflect the change without a manual reload.
 */

import { useFinanceStore } from '../../store/useFinanceStore';

jest.mock('../../services/apiClient', () => ({
  financeApi: {
    getAccounts: jest.fn(),
    getTransactions: jest.fn(),
  },
}));

import { financeApi } from '../../services/apiClient';

const mockGetAccounts = financeApi.getAccounts as jest.Mock;
const mockGetTransactions = financeApi.getTransactions as jest.Mock;

describe('useFinanceStore.syncData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the store between tests so seeded data and prior calls
    // don't bleed across assertions.
    useFinanceStore.setState({
      wallets: [
        { id: 'w1', name: 'Bank Account', type: 'PERSONAL', balance: 14240, currency: 'SGD' },
      ],
      transactions: [],
      activeWalletId: 'w1',
    });
  });

  it('coerces stringified amounts from the backend into Numbers', async () => {
    // Mirror the exact wire shape FastAPI sends: Decimal → string.
    mockGetAccounts.mockResolvedValue({ data: [] });
    mockGetTransactions.mockResolvedValue({
      data: {
        items: [
          {
            id: 42,
            tx_date: '2026-05-14',
            description: 'Hidilao',
            amount: '100.00', // ← the string that crashed Home
            direction: 'DEBIT',
            category: 'Dining',
            currency: 'SGD',
          },
        ],
        total: 1,
      },
    });

    await useFinanceStore.getState().syncData();
    const [tx] = useFinanceStore.getState().transactions;

    expect(typeof tx.amount).toBe('number');
    expect(tx.amount).toBe(100);
    // The crashing call from the Home screen must now succeed.
    expect(() => tx.amount.toFixed(2)).not.toThrow();
    expect(tx.amount.toFixed(2)).toBe('100.00');
  });

  it('coerces stringified wallet balances into Numbers', async () => {
    mockGetAccounts.mockResolvedValue({
      data: [
        {
          id: 7,
          name: 'UOB Checking',
          bank: 'UOB',
          account_type: 'SAVINGS',
          balance: '4250.75', // string from Pydantic
          currency: 'SGD',
        },
      ],
    });
    mockGetTransactions.mockResolvedValue({ data: { items: [], total: 0 } });

    await useFinanceStore.getState().syncData();
    const [wallet] = useFinanceStore.getState().wallets;

    expect(typeof wallet.balance).toBe('number');
    expect(wallet.balance).toBe(4250.75);
  });

  it('falls back to 0 when an amount is missing/malformed instead of crashing', async () => {
    mockGetAccounts.mockResolvedValue({ data: [] });
    mockGetTransactions.mockResolvedValue({
      data: {
        items: [
          {
            id: 99,
            tx_date: '2026-05-14',
            description: 'Mystery',
            // Deliberately undefined to simulate a backend bug.
            amount: undefined as any,
            direction: 'DEBIT',
            category: 'Other',
            currency: 'SGD',
          },
        ],
        total: 1,
      },
    });

    await useFinanceStore.getState().syncData();
    const [tx] = useFinanceStore.getState().transactions;

    expect(tx.amount).toBe(0);
    expect(() => tx.amount.toFixed(2)).not.toThrow();
  });

  it('still accepts already-numeric amounts (no double-coercion regression)', async () => {
    mockGetAccounts.mockResolvedValue({ data: [] });
    mockGetTransactions.mockResolvedValue({
      data: {
        items: [
          {
            id: 1,
            tx_date: '2026-05-14',
            description: 'Numeric',
            amount: 12.5, // already a number
            direction: 'CREDIT',
            category: 'Salary',
            currency: 'SGD',
          },
        ],
        total: 1,
      },
    });

    await useFinanceStore.getState().syncData();
    const [tx] = useFinanceStore.getState().transactions;

    expect(tx.amount).toBe(12.5);
    expect(tx.type).toBe('INCOME');
  });
});
