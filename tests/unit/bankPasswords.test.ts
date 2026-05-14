/**
 * Coverage for the on-device bank-PDF-password Keychain wrapper.
 *
 * We mock `expo-secure-store` so the tests run without a real keychain.
 * The wrapper keeps a small JSON index of which banks the user has
 * stored a password for; the tests pin its invariants:
 *
 *   - set → get round-trips
 *   - forget removes from both the password key and the index
 *   - forgetAll wipes everything
 *   - list reads from the index, not the storage at large
 *   - the index handles corruption gracefully
 */

jest.mock('expo-secure-store', () => {
  const memory: Record<string, string> = {};
  return {
    setItemAsync: jest.fn(async (k: string, v: string) => {
      memory[k] = v;
    }),
    getItemAsync: jest.fn(async (k: string) => memory[k] ?? null),
    deleteItemAsync: jest.fn(async (k: string) => {
      delete memory[k];
    }),
    __reset: () => {
      for (const k of Object.keys(memory)) delete memory[k];
    },
  };
});

import * as SecureStore from 'expo-secure-store';
import {
  forgetAllBankPasswords,
  forgetBankPassword,
  getBankPassword,
  listSavedBanks,
  setBankPassword,
} from '../../lib/bankPasswords';

const reset = () => {
  (SecureStore as any).__reset();
  (SecureStore.setItemAsync as jest.Mock).mockClear();
  (SecureStore.deleteItemAsync as jest.Mock).mockClear();
};

beforeEach(reset);

describe('setBankPassword / getBankPassword', () => {
  it('round-trips a saved password', async () => {
    await setBankPassword(7, 'DBS', 's3cret');
    expect(await getBankPassword(7, 'DBS')).toBe('s3cret');
  });

  it('uppercases bank slug so lookups are case-insensitive', async () => {
    await setBankPassword(7, 'dbs', 's3cret');
    expect(await getBankPassword(7, 'DBS')).toBe('s3cret');
    expect(await getBankPassword(7, 'Dbs')).toBe('s3cret');
  });

  it('scopes passwords by user id', async () => {
    await setBankPassword(7, 'DBS', 'one');
    await setBankPassword(8, 'DBS', 'two');
    expect(await getBankPassword(7, 'DBS')).toBe('one');
    expect(await getBankPassword(8, 'DBS')).toBe('two');
  });

  it('refuses to write an empty password', async () => {
    await setBankPassword(7, 'DBS', '');
    expect(await getBankPassword(7, 'DBS')).toBeNull();
    // And nothing was indexed either.
    expect(await listSavedBanks(7)).toEqual([]);
  });

  it('returns null for an unset bank', async () => {
    expect(await getBankPassword(7, 'OCBC')).toBeNull();
  });
});

describe('listSavedBanks', () => {
  it('returns all banks with stored passwords for a user', async () => {
    await setBankPassword(7, 'DBS', 'a');
    await setBankPassword(7, 'OCBC', 'b');
    await setBankPassword(7, 'UOB', 'c');
    const banks = await listSavedBanks(7);
    expect(banks.sort()).toEqual(['DBS', 'OCBC', 'UOB']);
  });

  it('does not bleed banks across user ids', async () => {
    await setBankPassword(7, 'DBS', 'a');
    await setBankPassword(8, 'OCBC', 'b');
    expect(await listSavedBanks(7)).toEqual(['DBS']);
    expect(await listSavedBanks(8)).toEqual(['OCBC']);
  });

  it('returns [] when no banks saved', async () => {
    expect(await listSavedBanks(7)).toEqual([]);
  });

  it('returns [] when the index is corrupted JSON', async () => {
    // Manually poison the index key.
    await (SecureStore as any).setItemAsync('bankpw_idx::7', 'not-valid-json');
    expect(await listSavedBanks(7)).toEqual([]);
  });

  it('does not duplicate banks on repeat saves', async () => {
    await setBankPassword(7, 'DBS', 'a');
    await setBankPassword(7, 'DBS', 'b');
    expect(await listSavedBanks(7)).toEqual(['DBS']);
  });
});

describe('forgetBankPassword', () => {
  it('removes the password and the index entry', async () => {
    await setBankPassword(7, 'DBS', 'a');
    await setBankPassword(7, 'OCBC', 'b');

    await forgetBankPassword(7, 'DBS');

    expect(await getBankPassword(7, 'DBS')).toBeNull();
    expect(await listSavedBanks(7)).toEqual(['OCBC']);
  });

  it('is idempotent for a bank that was never saved', async () => {
    // Must not throw.
    await forgetBankPassword(7, 'WHATEVER');
    expect(await listSavedBanks(7)).toEqual([]);
  });
});

describe('forgetAllBankPasswords', () => {
  it('wipes every password and the index for the user', async () => {
    await setBankPassword(7, 'DBS', 'a');
    await setBankPassword(7, 'OCBC', 'b');
    await setBankPassword(7, 'UOB', 'c');

    await forgetAllBankPasswords(7);

    expect(await getBankPassword(7, 'DBS')).toBeNull();
    expect(await getBankPassword(7, 'OCBC')).toBeNull();
    expect(await getBankPassword(7, 'UOB')).toBeNull();
    expect(await listSavedBanks(7)).toEqual([]);
  });

  it('does not touch another user', async () => {
    await setBankPassword(7, 'DBS', 'a');
    await setBankPassword(8, 'DBS', 'b');

    await forgetAllBankPasswords(7);

    expect(await getBankPassword(8, 'DBS')).toBe('b');
  });
});
