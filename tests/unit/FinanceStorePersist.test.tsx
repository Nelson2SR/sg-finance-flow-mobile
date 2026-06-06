/**
 * Regression tests for ``useFinanceStore.addTransaction`` backend persistence.
 *
 * Bug history this guards against:
 *   A manually-created entry was only written to the local Zustand store —
 *   no HTTP call was ever made. On logout the store is cleared and on the
 *   next login ``syncData`` overwrites it with the backend's (empty) list,
 *   so the entry silently vanished. ``addTransaction`` must now flush the
 *   new row to ``POST /upload/confirm`` (the same durable path the Magic
 *   Scan uses) whenever the user is bound to a backend vault group.
 */

import { useFinanceStore } from '../../store/useFinanceStore';
import { useVaultGroupsStore } from '../../store/useVaultGroupsStore';

jest.mock('../../services/apiClient', () => ({
  financeApi: {
    getAccounts: jest.fn(),
    getTransactions: jest.fn(),
    confirmUpload: jest.fn(),
  },
  // useVaultGroupsStore (imported transitively by useFinanceStore) registers
  // a getter at module load; stub it so the import doesn't throw.
  registerActiveVaultGroupGetter: jest.fn(),
  groupsApi: {},
}));

import { financeApi } from '../../services/apiClient';

const mockConfirmUpload = financeApi.confirmUpload as jest.Mock;

// Let any fire-and-forget persistence promise settle before asserting.
const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('useFinanceStore.addTransaction backend persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConfirmUpload.mockResolvedValue({ data: {} });
    useFinanceStore.setState({
      wallets: [
        { id: 'w1', name: 'OCBC 360', type: 'PERSONAL', balance: 1000, currency: 'SGD' },
      ],
      transactions: [],
      activeWalletId: 'w1',
      hasUserData: false,
    });
    // Bound to a backend vault group → persistence should fire.
    useVaultGroupsStore.setState({ groups: [], activeGroupId: 7 });
  });

  it('flushes a manually-created entry to POST /upload/confirm', async () => {
    useFinanceStore.getState().addTransaction({
      walletId: 'w1',
      type: 'EXPENSE',
      amount: 12.5,
      category: 'Dining',
      merchant: 'Kopitiam',
      date: new Date('2026-06-04'),
    });
    await flush();

    expect(mockConfirmUpload).toHaveBeenCalledTimes(1);
    const payload = mockConfirmUpload.mock.calls[0][0];
    // The backend rejects a file_hash that isn't exactly 64 hex chars
    // with a 500 — guard the shape that silently dropped every entry.
    expect(payload.file_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(payload.transactions).toHaveLength(1);
    expect(payload.transactions[0]).toMatchObject({
      tx_date: '2026-06-04',
      description: 'Kopitiam',
      amount: 12.5,
      direction: 'DEBIT',
      category: 'Dining',
      currency: 'SGD',
    });
    // Local state must still reflect the entry immediately.
    expect(useFinanceStore.getState().transactions).toHaveLength(1);
  });

  it('maps INCOME to a CREDIT direction in the persisted payload', async () => {
    useFinanceStore.getState().addTransaction({
      walletId: 'w1',
      type: 'INCOME',
      amount: 3000,
      category: 'Salary',
      merchant: 'ACME Pte Ltd',
      date: new Date('2026-06-01'),
    });
    await flush();

    expect(mockConfirmUpload.mock.calls[0][0].transactions[0].direction).toBe('CREDIT');
  });

  it('does not call the backend when skipSync is true', async () => {
    useFinanceStore.getState().addTransaction(
      {
        walletId: 'w1',
        type: 'EXPENSE',
        amount: 5,
        category: 'Coffee',
        merchant: 'Starbucks',
        date: new Date('2026-06-04'),
      },
      true,
    );
    await flush();

    expect(mockConfirmUpload).not.toHaveBeenCalled();
    expect(useFinanceStore.getState().transactions).toHaveLength(1);
  });

  it('skips the backend (but keeps the local entry) when no vault group is active', async () => {
    // Backend rejects writes without an X-Vault-Group-Id header, so when
    // the group hasn't resolved yet we must not fire a doomed request.
    useVaultGroupsStore.setState({ groups: [], activeGroupId: null });

    useFinanceStore.getState().addTransaction({
      walletId: 'w1',
      type: 'EXPENSE',
      amount: 9,
      category: 'Snacks',
      merchant: '7-Eleven',
      date: new Date('2026-06-04'),
    });
    await flush();

    expect(mockConfirmUpload).not.toHaveBeenCalled();
    expect(useFinanceStore.getState().transactions).toHaveLength(1);
  });
});
