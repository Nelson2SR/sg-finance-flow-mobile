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

export interface CopilotChatRequestDto {
  persona: 'advisor' | 'friend';
  message: string;
  history: CopilotMessageDto[];
  snapshot?: CopilotSnapshotDto;
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
