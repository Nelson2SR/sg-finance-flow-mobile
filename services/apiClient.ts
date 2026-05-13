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

export interface ApiTransaction {
  id: number;
  tx_date: string;
  description: string;
  amount: number;
  direction: 'DEBIT' | 'CREDIT';
  category: string;
  currency: string;
}

export interface ApiAccount {
  id: number;
  name: string;
  bank: string;
  account_type: 'SAVINGS' | 'CREDIT_CARD';
  balance: number;
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

export interface CopilotChatResponseDto {
  text: string;
  fallback: boolean;
}

export const copilotApi = {
  chat: (body: CopilotChatRequestDto) =>
    apiClient.post<CopilotChatResponseDto>('/copilot/chat', body),
};
