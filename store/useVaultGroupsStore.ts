/**
 * Vault Groups store (PR-5b mobile half of the feature).
 *
 * Carries the user's group memberships, the currently-active group id
 * (drives the activity / vault card scoping in the home tab), and the
 * "pending invite code" captured by the deep-link handler before the
 * user is signed in — the AuthContext consumes that on successful
 * login so first-time joiners land inside the inviter's group with no
 * extra taps.
 *
 * Sync semantics: `syncFromBackend()` is the single source of truth
 * for the membership list. Local mutating operations (create, join,
 * leave, ...) fire the corresponding backend call and re-sync on
 * success so the local list never drifts.
 */

import { create } from 'zustand';

import {
  ApiInvitePreview,
  ApiVaultGroup,
  groupsApi,
} from '../services/apiClient';

export type GroupRole = 'OWNER' | 'MEMBER';

interface State {
  groups: ApiVaultGroup[];
  activeGroupId: number | null;
  pendingInviteCode: string | null;
  isLoading: boolean;
}

interface Actions {
  /** Refresh the membership list. No-op if already in flight. */
  syncFromBackend: () => Promise<void>;
  /** Local-only set; the home tab observes this. */
  setActiveGroup: (groupId: number) => void;
  /** Stash an invite code captured from a deep link before sign-in. */
  setPendingInvite: (code: string | null) => void;
  /** Read-only convenience: returns the active group, falling back to
   *  the first group, or null when the user is in zero groups. */
  getActiveGroup: () => ApiVaultGroup | null;

  // ── mutating ops (each calls the backend and re-syncs) ───────────
  createGroup: (name: string, emoji?: string) => Promise<ApiVaultGroup>;
  renameGroup: (groupId: number, name?: string, emoji?: string) => Promise<void>;
  deleteGroup: (groupId: number) => Promise<void>;
  generateInvite: (groupId: number) => Promise<{ code: string; expiresAt: string }>;
  previewInvite: (code: string) => Promise<ApiInvitePreview>;
  consumeInvite: (code: string) => Promise<ApiVaultGroup>;
  leaveGroup: (groupId: number) => Promise<void>;
  removeMember: (groupId: number, userId: number) => Promise<void>;
  transferOwnership: (groupId: number, newOwnerUserId: number) => Promise<void>;
}

export type VaultGroupsStore = State & Actions;

let inflightSync: Promise<void> | null = null;

export const useVaultGroupsStore = create<VaultGroupsStore>((set, get) => ({
  groups: [],
  activeGroupId: null,
  pendingInviteCode: null,
  isLoading: false,

  syncFromBackend: async () => {
    if (inflightSync) return inflightSync;
    inflightSync = (async () => {
      set({ isLoading: true });
      try {
        const resp = await groupsApi.list();
        const groups = resp.data;
        set((s) => ({
          groups,
          // Keep the active selection if it still exists in the new
          // list, else fall back to the first group (or null).
          activeGroupId:
            s.activeGroupId != null && groups.some((g) => g.id === s.activeGroupId)
              ? s.activeGroupId
              : (groups[0]?.id ?? null),
          isLoading: false,
        }));
      } catch (err) {
        // Surface as a warn and leave the local list untouched —
        // network blips shouldn't blow away a valid local view.
        console.warn('[VaultGroups] sync failed', err);
        set({ isLoading: false });
      } finally {
        inflightSync = null;
      }
    })();
    return inflightSync;
  },

  setActiveGroup: (groupId) => set({ activeGroupId: groupId }),

  setPendingInvite: (code) => set({ pendingInviteCode: code }),

  getActiveGroup: () => {
    const s = get();
    if (s.activeGroupId == null) {
      return s.groups[0] ?? null;
    }
    return s.groups.find((g) => g.id === s.activeGroupId) ?? null;
  },

  createGroup: async (name, emoji) => {
    const resp = await groupsApi.create({ name, emoji });
    const created = resp.data;
    set((s) => ({
      groups: [...s.groups, created],
      activeGroupId: created.id,
    }));
    return created;
  },

  renameGroup: async (groupId, name, emoji) => {
    const resp = await groupsApi.update(groupId, { name, emoji });
    const updated = resp.data;
    set((s) => ({
      groups: s.groups.map((g) => (g.id === groupId ? updated : g)),
    }));
  },

  deleteGroup: async (groupId) => {
    await groupsApi.remove(groupId);
    set((s) => ({
      groups: s.groups.filter((g) => g.id !== groupId),
      activeGroupId:
        s.activeGroupId === groupId
          ? (s.groups.find((g) => g.id !== groupId)?.id ?? null)
          : s.activeGroupId,
    }));
  },

  generateInvite: async (groupId) => {
    const resp = await groupsApi.createInvite(groupId);
    return { code: resp.data.invite_code, expiresAt: resp.data.expires_at };
  },

  previewInvite: async (code) => {
    const resp = await groupsApi.previewInvite(code);
    return resp.data;
  },

  consumeInvite: async (code) => {
    const resp = await groupsApi.join(code);
    const joined = resp.data;
    set((s) => ({
      groups: s.groups.some((g) => g.id === joined.id)
        ? s.groups.map((g) => (g.id === joined.id ? joined : g))
        : [...s.groups, joined],
      activeGroupId: joined.id,
      pendingInviteCode: null,
    }));
    return joined;
  },

  leaveGroup: async (groupId) => {
    await groupsApi.leave(groupId);
    set((s) => ({
      groups: s.groups.filter((g) => g.id !== groupId),
      activeGroupId:
        s.activeGroupId === groupId
          ? (s.groups.find((g) => g.id !== groupId)?.id ?? null)
          : s.activeGroupId,
    }));
  },

  removeMember: async (groupId, userId) => {
    await groupsApi.removeMember(groupId, userId);
    // Refresh the affected group's member list rather than synthesising
    // a new shape locally.
    const resp = await groupsApi.get(groupId);
    set((s) => ({
      groups: s.groups.map((g) => (g.id === groupId ? resp.data : g)),
    }));
  },

  transferOwnership: async (groupId, newOwnerUserId) => {
    await groupsApi.transferOwnership(groupId, newOwnerUserId);
    const resp = await groupsApi.get(groupId);
    set((s) => ({
      groups: s.groups.map((g) => (g.id === groupId ? resp.data : g)),
    }));
  },
}));
