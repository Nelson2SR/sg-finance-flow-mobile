import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

import { API_CONFIG } from '../constants/Config';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from '../lib/secureStore';
import { refreshSession } from './authService';

const BASE_URL = API_CONFIG.BASE_URL;

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── Token + active vault group injection ─────────────────────────────────
//
// Two stamps on every authenticated request:
//   1. Authorization: Bearer <access_token>   (who you are)
//   2. X-Vault-Group-Id: <activeGroupId>      (which group you're operating in)
//
// The active group is held in useVaultGroupsStore. We dereference it lazily
// inside the interceptor (not at module-load) so the latest user selection
// is sent on each request — if the user switches groups, the very next
// request goes to the new one. Auth endpoints (/auth/*) don't need or want
// the header, so we skip it for those.
let activeVaultGroupIdGetter: () => number | null = () => null;
export function registerActiveVaultGroupGetter(fn: () => number | null): void {
  activeVaultGroupIdGetter = fn;
}

apiClient.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const url = config.url ?? '';
  const isAuthRoute = url.startsWith('/auth/') || url === '/auth';
  if (!isAuthRoute) {
    const groupId = activeVaultGroupIdGetter();
    if (groupId !== null && groupId !== undefined) {
      config.headers['X-Vault-Group-Id'] = String(groupId);
    }
  }
  return config;
});

/**
 * 401-driven refresh with single-flight queueing.
 *
 * Multiple parallel requests that all 401 race naturally — we want
 * exactly ONE /auth/refresh call to fire and the rest to wait on its
 * result. `refreshPromise` is that single in-flight refresh; any
 * subsequent 401 retries return its (cached) outcome.
 *
 * On refresh failure, tokens are cleared and the original 401 bubbles
 * up — the AuthContext's effect picks that up and routes back to /login.
 *
 * Callbacks registered via `onAuthFailed` fire when the refresh path
 * gives up; AuthContext uses this to drop in-memory user state.
 */
type RetryConfig = InternalAxiosRequestConfig & {
  _isAuthRetry?: boolean;
  /** Marks a request that has already been retried once for a
   *  Render-side cold-start 502/503/504. Prevents loops. */
  _isColdStartRetry?: boolean;
};

let refreshPromise: Promise<string | null> | null = null;
const authFailedListeners = new Set<() => void>();

export function onAuthFailed(listener: () => void): () => void {
  authFailedListeners.add(listener);
  return () => authFailedListeners.delete(listener);
}

async function doRefresh(): Promise<string | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;
  try {
    const pair = await refreshSession(refreshToken);
    await setTokens({
      accessToken: pair.access_token,
      refreshToken: pair.refresh_token,
    });
    return pair.access_token;
  } catch {
    await clearTokens();
    authFailedListeners.forEach((fn) => fn());
    return null;
  }
}

apiClient.interceptors.response.use(
  (resp) => resp,
  async (error: AxiosError) => {
    const original = error.config as RetryConfig | undefined;
    const status = error.response?.status;

    // ── Cold-start retry (502/503/504) ──────────────────────────────
    // Render free tier spins instances down after idle gaps; the edge
    // proxy returns 502/503/504 while the instance is mid-restart.
    // The wake takes ~5-10s typically; retry once after a delay so the
    // next request lands on the warm instance. Marked with
    // `_isColdStartRetry` so we don't loop forever if the second
    // attempt also fails. Auth endpoints are excluded — their 502s
    // shouldn't be retried silently (they're rare and the user is
    // already on a loading screen that can show real feedback).
    if (
      original &&
      !original._isColdStartRetry &&
      (status === 502 || status === 503 || status === 504) &&
      !(typeof original.url === 'string' && original.url.startsWith('/auth/'))
    ) {
      original._isColdStartRetry = true;
      // 6s is a sweet spot — Render's free-tier wake usually finishes
      // in 3-8s; longer waits feel like the app is frozen and the
      // user starts tapping things.
      await new Promise<void>((resolve) => setTimeout(resolve, 6000));
      return apiClient(original);
    }

    // ── 401 refresh-then-retry ──────────────────────────────────────
    // Bail unless this is a 401, we have a request to retry, and we
    // haven't already retried this request once (no infinite loops if
    // the refreshed token also 401s).
    if (
      !original ||
      original._isAuthRetry ||
      status !== 401
    ) {
      throw error;
    }

    // Never try to refresh the refresh endpoint itself — that path is
    // 401-on-bad-refresh by design.
    if (typeof original.url === 'string' && original.url.endsWith('/auth/refresh')) {
      throw error;
    }

    if (!refreshPromise) {
      refreshPromise = doRefresh().finally(() => {
        refreshPromise = null;
      });
    }
    const newToken = await refreshPromise;
    if (!newToken) throw error;

    original._isAuthRetry = true;
    original.headers = original.headers ?? ({} as any);
    (original.headers as any).Authorization = `Bearer ${newToken}`;
    return apiClient(original);
  },
);

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
  account_name: string;
  account_type: 'SAVINGS' | 'CREDIT_CARD' | 'UNKNOWN';
  currency: string;
  /** Mobile-facing wallet category that drives the Home tab carousel
   * accents. Persisted server-side so a refresh/reinstall doesn't
   * downgrade every wallet to PERSONAL. */
  wallet_type: 'PERSONAL' | 'TRIP' | 'FAMILY' | 'CRYPTO';
  balance: number | string;
  created_at: string;
}

export interface CreateAccountPayload {
  name: string;
  currency?: string;
  wallet_type?: 'PERSONAL' | 'TRIP' | 'FAMILY' | 'CRYPTO';
  bank?: 'DBS' | 'OCBC' | 'UOB' | 'CITI' | 'UNKNOWN';
  account_type?: 'SAVINGS' | 'CREDIT_CARD' | 'UNKNOWN';
}

export const financeApi = {
  getAccounts: () => apiClient.get<ApiAccount[]>('/accounts'),
  createAccount: (data: CreateAccountPayload) =>
    apiClient.post<ApiAccount>('/accounts', {
      name: data.name,
      currency: data.currency ?? 'SGD',
      wallet_type: data.wallet_type ?? 'PERSONAL',
      bank: data.bank ?? 'UNKNOWN',
      account_type: data.account_type ?? 'SAVINGS',
    }),
  deleteAccount: (accountId: number) =>
    apiClient.delete<{ success: boolean; message: string }>(`/accounts/${accountId}`),
  getTransactions: (params?: any) =>
    apiClient.get<{ items: ApiTransaction[]; total: number }>('/transactions', { params }),
  confirmUpload: (data: {
    file_hash: string;
    bank: string;
    account_type: string;
    account_name: string;
    transactions: any[];
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

// ── Vault Groups (PR-5b) ─────────────────────────────────────────────────

export interface ApiVaultGroupMember {
  user_id: number;
  display_name: string | null;
  avatar_url: string | null;
  role: 'OWNER' | 'MEMBER';
  joined_at: string;
}

export interface ApiVaultGroup {
  id: number;
  name: string;
  emoji: string | null;
  created_at: string;
  role: 'OWNER' | 'MEMBER';
  members: ApiVaultGroupMember[];
}

export interface ApiGroupInvite {
  invite_code: string;
  expires_at: string;
  share_url: string | null;
}

export interface ApiInvitePreview {
  group: ApiVaultGroup;
  inviter_display_name: string | null;
  expires_at: string;
}

export const groupsApi = {
  list: () => apiClient.get<ApiVaultGroup[]>('/groups'),
  create: (body: { name: string; emoji?: string }) =>
    apiClient.post<ApiVaultGroup>('/groups', body),
  get: (id: number) => apiClient.get<ApiVaultGroup>(`/groups/${id}`),
  update: (id: number, body: { name?: string; emoji?: string }) =>
    apiClient.patch<ApiVaultGroup>(`/groups/${id}`, body),
  remove: (id: number) => apiClient.delete<void>(`/groups/${id}`),

  createInvite: (groupId: number, body: { email?: string } = {}) =>
    apiClient.post<ApiGroupInvite>(`/groups/${groupId}/invite`, body),
  previewInvite: (code: string) =>
    apiClient.get<ApiInvitePreview>(`/groups/invitations/${code}`),
  join: (code: string) =>
    apiClient.post<ApiVaultGroup>('/groups/join', { invite_code: code }),

  leave: (groupId: number) =>
    apiClient.post<void>(`/groups/${groupId}/leave`),
  removeMember: (groupId: number, userId: number) =>
    apiClient.delete<void>(`/groups/${groupId}/members/${userId}`),
  transferOwnership: (groupId: number, newOwnerUserId: number) =>
    apiClient.post<void>(`/groups/${groupId}/transfer-ownership`, {
      new_owner_user_id: newOwnerUserId,
    }),
};
