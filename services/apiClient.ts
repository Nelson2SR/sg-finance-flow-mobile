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
