import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

import { API_CONFIG } from '../constants/Config';

const BASE_URL = API_CONFIG.BASE_URL;

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to inject JWT token
apiClient.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('userToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Numeric fields coming from the FastAPI backend are Decimal columns,
 * which Pydantic serialises as JSON strings by default. The mobile UI
 * expects plain numbers, so callers must coerce these via `Number()`
 * before doing math on them. See `useFinanceStore.syncData` for the
 * canonical mapping; renderers should never call `.toFixed()` on a raw
 * `ApiTransaction.amount` value.
 */
export interface ApiTransaction {
  id: number;
  tx_date: string;
  description: string;
  amount: number | string;
  direction: 'DEBIT' | 'CREDIT';
  category: string;
  currency: string;
  /** Free-form labels attached via the transaction_labels join. */
  labels?: string[];
}

export interface ApiAccount {
  id: number;
  name: string;
  bank: string;
  account_type: 'SAVINGS' | 'CREDIT_CARD';
  balance: number | string;
  currency: string;
}

export const financeApi = {
  getAccounts: () => apiClient.get<ApiAccount[]>('/accounts'),
  getTransactions: (params?: any) => apiClient.get<{ items: ApiTransaction[], total: number }>('/transactions', { params }),
  confirmUpload: (data: {
    file_hash: string,
    bank: string,
    account_type: string,
    account_name: string,
    transactions: any[]
  }) => apiClient.post('/upload/confirm', data),
};


// ─── Copilot (LLM-backed chat) ────────────────────────────────────────────
// Mirror of the backend's CopilotChatRequest/Response. Keep this file the
// single source of truth for over-the-wire shape so both ends stay aligned.

export interface CopilotMessageDto {
  role: 'user' | 'model';
  text: string;
}

export interface CopilotWalletSnapshotDto {
  name: string;
  type: string;
  currency: string;
  balance: number;
}

export interface CopilotTransactionSnapshotDto {
  /**
   * Backend transaction id. Required for UPDATE_TRANSACTION_CATEGORY /
   * DELETE_TRANSACTION proposals — without it the LLM has nothing to
   * cite in the action payload. Optional because local-only seeded
   * rows (pre-syncData) don't have a server id.
   */
  id?: number;
  merchant: string;
  category: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  date: string; // YYYY-MM-DD
}

export interface CopilotSnapshotDto {
  wallets: CopilotWalletSnapshotDto[];
  recent_transactions: CopilotTransactionSnapshotDto[];
}

/**
 * The user's Vault Config vocabulary sent with each chat turn so the
 * LLM can ground CREATE_TRANSACTION proposals in the user's configured
 * categories + labels rather than a generic fallback enum.
 */
export interface CopilotTaxonomyDto {
  expense_categories: string[];
  income_categories: string[];
  labels: string[];
}

export interface CopilotChatRequestDto {
  persona: 'advisor' | 'friend';
  message: string;
  history: CopilotMessageDto[];
  snapshot?: CopilotSnapshotDto;
  taxonomy?: CopilotTaxonomyDto;
}

export type CopilotActionTypeDto =
  | 'CREATE_TRANSACTION'
  | 'DELETE_TRANSACTION'
  | 'UPDATE_TRANSACTION_CATEGORY'
  | 'TRANSFER'
  | 'ROLLBACK_ACTION';

export interface CopilotToolCallDto {
  type: CopilotActionTypeDto;
  payload: Record<string, any>;
  summary: string;
}

export interface CopilotChatResponseDto {
  text: string;
  fallback: boolean;
  tool_call?: CopilotToolCallDto | null;
}

export interface CopilotActionResponseDto {
  id: number;
  action_type: CopilotActionTypeDto | string;
  payload: Record<string, any>;
  /**
   * Server-captured state needed to roll the action back (e.g. the
   * newly-assigned transaction_id for a CREATE_TRANSACTION). Surfaced
   * to the client so it can apply mobile-only side effects — e.g.
   * patching the local store's just-created row with LLM-suggested
   * labels that the backend doesn't store yet.
   */
  reversal_payload?: Record<string, any> | null;
  summary: string;
  status: 'executed' | 'rolled_back' | 'expired';
  created_at: string;
  rolled_back_at: string | null;
  expires_at: string;
}

export const copilotApi = {
  chat: (body: CopilotChatRequestDto) =>
    apiClient.post<CopilotChatResponseDto>('/copilot/chat', body),

  executeAction: (body: { type: string; payload: Record<string, any>; summary: string }) =>
    apiClient.post<CopilotActionResponseDto>('/copilot/actions', body),

  listActions: (onlyUndoable = true) =>
    apiClient.get<CopilotActionResponseDto[]>('/copilot/actions', {
      params: { only_undoable: onlyUndoable },
    }),

  rollbackAction: (actionId: number) =>
    apiClient.post<CopilotActionResponseDto>(`/copilot/actions/${actionId}/rollback`),
};


// ─── Vault Config (categories + labels) ──────────────────────────────────
// Mirror of the FastAPI shapes under /api/v1/categories,
// /api/v1/labels, and /api/v1/transactions/{id}/labels.

export type CategoryKindDto = 'expense' | 'income';

export interface ApiCategory {
  id: number;
  name: string;
  kind: CategoryKindDto;
  icon: string;
  color: string;
  sort_order: number;
}

export interface CreateCategoryDto {
  name: string;
  kind: CategoryKindDto;
  icon: string;
  color: string;
  sort_order?: number;
}

export interface UpdateCategoryDto {
  name?: string;
  kind?: CategoryKindDto;
  icon?: string;
  color?: string;
  sort_order?: number;
}

export interface ApiLabel {
  id: number;
  name: string;
}

export const categoriesApi = {
  list: () => apiClient.get<ApiCategory[]>('/categories'),
  create: (body: CreateCategoryDto) => apiClient.post<ApiCategory>('/categories', body),
  update: (id: number, body: UpdateCategoryDto) =>
    apiClient.put<ApiCategory>(`/categories/${id}`, body),
  remove: (id: number) =>
    apiClient.delete<{ success: boolean; message: string }>(`/categories/${id}`),
};

export const labelsApi = {
  list: () => apiClient.get<ApiLabel[]>('/labels'),
  create: (name: string) => apiClient.post<ApiLabel>('/labels', { name }),
  update: (id: number, name: string) => apiClient.put<ApiLabel>(`/labels/${id}`, { name }),
  remove: (id: number) =>
    apiClient.delete<{ success: boolean; message: string }>(`/labels/${id}`),
  /** Replace the full set of labels on a transaction. Returns the
   *  canonical label names after the write (auto-create + dedup). */
  setForTransaction: (transactionId: number, labels: string[]) =>
    apiClient.put<string[]>(`/transactions/${transactionId}/labels`, { labels }),
};
