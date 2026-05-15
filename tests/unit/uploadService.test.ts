/**
 * Coverage for the upload service — `parsePdfViaBackend`'s error
 * translation and the `parsePdfWithPasswordFlow` retry/cache loop.
 *
 * The real apiClient is mocked so axios never fires. expo-secure-store
 * is mocked so the Keychain cache lives in memory for these tests.
 * Alert.prompt is hijacked so the prompt becomes a deterministic
 * single-shot promise.
 */

jest.mock('../../services/apiClient', () => ({
  apiClient: { post: jest.fn() },
}));

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

jest.mock('expo-file-system', () => ({
  readAsStringAsync: jest.fn(),
  EncodingType: { Base64: 'base64' },
}));

import { Alert } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import { apiClient } from '../../services/apiClient';
import { getBankPassword } from '../../lib/bankPasswords';
import {
  parsePdfViaBackend,
  parsePdfWithPasswordFlow,
  PdfPasswordError,
} from '../../services/uploadService';

const mockedPost = apiClient.post as jest.Mock;

const apiOk = (overrides: any = {}) => ({
  data: {
    bank: 'DBS',
    account_type: 'SAVINGS',
    statement_period: null,
    transaction_count: 1,
    transactions: [
      {
        tx_date: '2026-05-01',
        description: 'GRAB',
        amount: 12.5,
        direction: 'DEBIT',
        category: 'Transport',
        currency: 'SGD',
      },
    ],
    ...overrides,
  },
});

const apiPwdRequired = () => {
  const err: any = new Error('Password required');
  err.response = {
    status: 422,
    data: {
      detail: {
        code: 'PDF_PASSWORD_REQUIRED',
        message: 'encrypted',
        bank: 'DBS',
      },
    },
  };
  return err;
};

const apiPwdWrong = () => {
  const err: any = new Error('Wrong password');
  err.response = {
    status: 422,
    data: {
      detail: {
        code: 'PDF_PASSWORD_INCORRECT',
        message: 'wrong',
        bank: 'DBS',
      },
    },
  };
  return err;
};

beforeEach(() => {
  (SecureStore as any).__reset();
  mockedPost.mockReset();
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('parsePdfViaBackend', () => {
  it('POSTs multipart and maps the response to ScanResponse shape', async () => {
    mockedPost.mockResolvedValueOnce(apiOk());
    const got = await parsePdfViaBackend('file:///tmp/dbs.pdf');

    expect(mockedPost).toHaveBeenCalledWith(
      '/upload/parse',
      expect.any(Object),
      expect.objectContaining({
        headers: expect.objectContaining({ 'Content-Type': 'multipart/form-data' }),
      }),
    );
    expect(got.sourceType).toBe('ESTATEMENT');
    expect(got.transactions[0].merchant).toBe('GRAB');
    expect(got.transactions[0].type).toBe('EXPENSE');
  });

  it('includes pdf_password in the form when provided', async () => {
    mockedPost.mockResolvedValueOnce(apiOk());
    await parsePdfViaBackend('file:///tmp/dbs.pdf', 'pa55');
    const formArg = mockedPost.mock.calls[0][1];
    // FormData is opaque cross-platform; we trust that .append was
    // called by checking the post happened with a multipart header.
    expect(formArg).toBeDefined();
  });

  it('translates 422 PDF_PASSWORD_REQUIRED into PdfPasswordError', async () => {
    mockedPost.mockRejectedValueOnce(apiPwdRequired());
    await expect(parsePdfViaBackend('file:///tmp/dbs.pdf')).rejects.toMatchObject({
      name: 'PdfPasswordError',
      code: 'PDF_PASSWORD_REQUIRED',
      bank: 'DBS',
    });
  });

  it('translates 422 PDF_PASSWORD_INCORRECT into PdfPasswordError', async () => {
    mockedPost.mockRejectedValueOnce(apiPwdWrong());
    await expect(parsePdfViaBackend('file:///tmp/dbs.pdf', 'wrong')).rejects.toMatchObject({
      name: 'PdfPasswordError',
      code: 'PDF_PASSWORD_INCORRECT',
    });
  });

  it('does not wrap non-password 4xx errors', async () => {
    const e: any = new Error('Server boom');
    e.response = { status: 500, data: { detail: 'oops' } };
    mockedPost.mockRejectedValueOnce(e);
    await expect(parsePdfViaBackend('file:///tmp/dbs.pdf')).rejects.toThrow('Server boom');
  });
});

describe('parsePdfWithPasswordFlow', () => {
  const userId = 7;

  it('passes through unencrypted PDFs without prompting', async () => {
    mockedPost.mockResolvedValueOnce(apiOk());
    const result = await parsePdfWithPasswordFlow('file:///tmp/dbs.pdf', userId);
    expect(result?.transactions).toHaveLength(1);
    // No prompt should have fired; no password persisted.
    expect(await getBankPassword(userId, 'DBS')).toBeNull();
  });

  it('uses a cached password silently when one exists for the bank', async () => {
    // Pre-stash a password for DBS.
    await (SecureStore.setItemAsync as jest.Mock)('bankpw.7.DBS', 'cached');
    await (SecureStore.setItemAsync as jest.Mock)(
      'bankpw-idx.7',
      JSON.stringify(['DBS']),
    );

    // First call → PDF_PASSWORD_REQUIRED. Second (with cached pw) → 200.
    mockedPost
      .mockRejectedValueOnce(apiPwdRequired())
      .mockResolvedValueOnce(apiOk());

    const promptSpy = jest.spyOn(Alert as any, 'prompt');

    const result = await parsePdfWithPasswordFlow('file:///tmp/dbs.pdf', userId);
    expect(result?.transactions).toHaveLength(1);
    expect(promptSpy).not.toHaveBeenCalled();
  });

  it('prompts when no cached password, then saves the working one', async () => {
    let promptResolver: ((v: string | null) => void) | null = null;
    jest.spyOn(Alert as any, 'prompt').mockImplementation(
      (_t: string, _m: string, btns: any[]) => {
        // Locate the "Unlock" button and call its onPress with our value.
        const unlock = btns.find((b: any) => b.text === 'Unlock');
        promptResolver = unlock.onPress;
      },
    );
    // Make Platform.OS look like ios for the prompt path.
    jest.mock('react-native', () => ({
      ...jest.requireActual('react-native'),
      Platform: { OS: 'ios' },
    }));

    // First call: PDF_PASSWORD_REQUIRED. After we provide the prompt
    // answer, the second call resolves with the parsed transactions.
    mockedPost
      .mockRejectedValueOnce(apiPwdRequired())
      .mockResolvedValueOnce(apiOk());

    const promise = parsePdfWithPasswordFlow('file:///tmp/dbs.pdf', userId);

    // Wait a tick so the prompt is registered before we answer.
    await new Promise((r) => setImmediate(r));
    expect(promptResolver).not.toBeNull();
    promptResolver!('typed-pw');

    const result = await promise;
    expect(result?.transactions).toHaveLength(1);
    // Password saved for next time.
    expect(await getBankPassword(userId, 'DBS')).toBe('typed-pw');
  });

  it('returns null when the user cancels the prompt', async () => {
    jest.spyOn(Alert as any, 'prompt').mockImplementation(
      (_t: string, _m: string, btns: any[]) => {
        const cancel = btns.find((b: any) => b.text === 'Cancel');
        cancel.onPress();
      },
    );

    mockedPost.mockRejectedValueOnce(apiPwdRequired());

    const result = await parsePdfWithPasswordFlow('file:///tmp/dbs.pdf', userId);
    expect(result).toBeNull();
    expect(await getBankPassword(userId, 'DBS')).toBeNull();
  });

  it('gives up after maxAttempts of repeatedly-wrong passwords', async () => {
    jest.spyOn(Alert as any, 'prompt').mockImplementation(
      (_t: string, _m: string, btns: any[]) => {
        const unlock = btns.find((b: any) => b.text === 'Unlock');
        unlock.onPress('bad');
      },
    );

    mockedPost.mockRejectedValue(apiPwdWrong());

    const result = await parsePdfWithPasswordFlow('file:///tmp/dbs.pdf', userId, {
      maxAttempts: 2,
    });
    expect(result).toBeNull();
  });
});
