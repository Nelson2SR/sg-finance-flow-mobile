/**
 * Coverage for ``useVaultGroupsStore`` — PR-5b mobile half.
 *
 * Tests pin:
 *   - syncFromBackend hydrates state, picks a sane active group
 *   - createGroup appends + becomes active
 *   - consumeInvite is idempotent, sets the joined group active,
 *     and clears the pending code
 *   - leave / delete updates the active id if it was the dropped one
 *
 * The apiClient module is mocked so axios never fires. Each test
 * resets the store between runs.
 */

jest.mock('../../services/apiClient', () => ({
  groupsApi: {
    list: jest.fn(),
    create: jest.fn(),
    get: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    createInvite: jest.fn(),
    previewInvite: jest.fn(),
    join: jest.fn(),
    leave: jest.fn(),
    removeMember: jest.fn(),
    transferOwnership: jest.fn(),
  },
}));

import { groupsApi } from '../../services/apiClient';
import { useVaultGroupsStore } from '../../store/useVaultGroupsStore';

const sampleGroup = (overrides: any = {}) => ({
  id: 1,
  name: 'My Vault',
  emoji: '🏡',
  created_at: '2026-05-15T00:00:00Z',
  role: 'OWNER',
  members: [
    {
      user_id: 7,
      display_name: 'Alice',
      avatar_url: null,
      role: 'OWNER',
      joined_at: '2026-05-15T00:00:00Z',
    },
  ],
  ...overrides,
});

const reset = () => {
  useVaultGroupsStore.setState({
    groups: [],
    activeGroupId: null,
    pendingInviteCode: null,
    isLoading: false,
  });
  jest.clearAllMocks();
};

beforeEach(reset);

describe('syncFromBackend', () => {
  it('hydrates the groups list and picks the first as active', async () => {
    (groupsApi.list as jest.Mock).mockResolvedValueOnce({
      data: [sampleGroup({ id: 1 }), sampleGroup({ id: 2, name: 'Family' })],
    });
    await useVaultGroupsStore.getState().syncFromBackend();
    const s = useVaultGroupsStore.getState();
    expect(s.groups).toHaveLength(2);
    expect(s.activeGroupId).toBe(1);
  });

  it('preserves the active selection when it still exists', async () => {
    useVaultGroupsStore.setState({ activeGroupId: 2 });
    (groupsApi.list as jest.Mock).mockResolvedValueOnce({
      data: [sampleGroup({ id: 1 }), sampleGroup({ id: 2 })],
    });
    await useVaultGroupsStore.getState().syncFromBackend();
    expect(useVaultGroupsStore.getState().activeGroupId).toBe(2);
  });

  it('falls back to the new first group when the prior active vanished', async () => {
    useVaultGroupsStore.setState({ activeGroupId: 99 });
    (groupsApi.list as jest.Mock).mockResolvedValueOnce({
      data: [sampleGroup({ id: 5 })],
    });
    await useVaultGroupsStore.getState().syncFromBackend();
    expect(useVaultGroupsStore.getState().activeGroupId).toBe(5);
  });

  it('sets activeGroupId to null when the backend returns []', async () => {
    (groupsApi.list as jest.Mock).mockResolvedValueOnce({ data: [] });
    await useVaultGroupsStore.getState().syncFromBackend();
    expect(useVaultGroupsStore.getState().activeGroupId).toBeNull();
  });

  it('leaves local state untouched if the network call throws', async () => {
    useVaultGroupsStore.setState({
      groups: [sampleGroup({ id: 9 })],
      activeGroupId: 9,
    });
    (groupsApi.list as jest.Mock).mockRejectedValueOnce(new Error('net'));
    await useVaultGroupsStore.getState().syncFromBackend();
    expect(useVaultGroupsStore.getState().groups).toHaveLength(1);
    expect(useVaultGroupsStore.getState().activeGroupId).toBe(9);
  });
});

describe('createGroup', () => {
  it('appends the new group and marks it active', async () => {
    useVaultGroupsStore.setState({
      groups: [sampleGroup({ id: 1 })],
      activeGroupId: 1,
    });
    (groupsApi.create as jest.Mock).mockResolvedValueOnce({
      data: sampleGroup({ id: 2, name: 'Roommates' }),
    });
    const created = await useVaultGroupsStore.getState().createGroup('Roommates');
    expect(created.id).toBe(2);
    const s = useVaultGroupsStore.getState();
    expect(s.groups.map(g => g.id)).toEqual([1, 2]);
    expect(s.activeGroupId).toBe(2);
  });
});

describe('consumeInvite', () => {
  it('adds the joined group, makes it active, clears the pending code', async () => {
    useVaultGroupsStore.setState({ pendingInviteCode: 'abc' });
    (groupsApi.join as jest.Mock).mockResolvedValueOnce({
      data: sampleGroup({ id: 42, name: 'Joined' }),
    });
    const joined = await useVaultGroupsStore.getState().consumeInvite('abc');
    expect(joined.id).toBe(42);
    const s = useVaultGroupsStore.getState();
    expect(s.groups.find(g => g.id === 42)).toBeTruthy();
    expect(s.activeGroupId).toBe(42);
    expect(s.pendingInviteCode).toBeNull();
  });

  it('is idempotent: re-joining an existing group updates rather than duplicates', async () => {
    useVaultGroupsStore.setState({
      groups: [sampleGroup({ id: 42, name: 'Stale' })],
    });
    (groupsApi.join as jest.Mock).mockResolvedValueOnce({
      data: sampleGroup({ id: 42, name: 'Fresh' }),
    });
    await useVaultGroupsStore.getState().consumeInvite('abc');
    const s = useVaultGroupsStore.getState();
    expect(s.groups.filter(g => g.id === 42)).toHaveLength(1);
    expect(s.groups[0].name).toBe('Fresh');
  });
});

describe('leaveGroup', () => {
  it('drops the group and migrates active if needed', async () => {
    useVaultGroupsStore.setState({
      groups: [
        sampleGroup({ id: 1 }),
        sampleGroup({ id: 2 }),
      ],
      activeGroupId: 1,
    });
    (groupsApi.leave as jest.Mock).mockResolvedValueOnce({ data: undefined });
    await useVaultGroupsStore.getState().leaveGroup(1);
    const s = useVaultGroupsStore.getState();
    expect(s.groups.map(g => g.id)).toEqual([2]);
    expect(s.activeGroupId).toBe(2);
  });

  it('preserves activeGroupId when leaving a non-active group', async () => {
    useVaultGroupsStore.setState({
      groups: [sampleGroup({ id: 1 }), sampleGroup({ id: 2 })],
      activeGroupId: 1,
    });
    (groupsApi.leave as jest.Mock).mockResolvedValueOnce({ data: undefined });
    await useVaultGroupsStore.getState().leaveGroup(2);
    expect(useVaultGroupsStore.getState().activeGroupId).toBe(1);
  });

  it('sets activeGroupId to null when leaving the last group', async () => {
    useVaultGroupsStore.setState({
      groups: [sampleGroup({ id: 1 })],
      activeGroupId: 1,
    });
    (groupsApi.leave as jest.Mock).mockResolvedValueOnce({ data: undefined });
    await useVaultGroupsStore.getState().leaveGroup(1);
    expect(useVaultGroupsStore.getState().activeGroupId).toBeNull();
  });
});

describe('getActiveGroup', () => {
  it('returns the actively-selected group', () => {
    useVaultGroupsStore.setState({
      groups: [sampleGroup({ id: 1 }), sampleGroup({ id: 2, name: 'B' })],
      activeGroupId: 2,
    });
    expect(useVaultGroupsStore.getState().getActiveGroup()?.name).toBe('B');
  });

  it('falls back to the first group when active id is null', () => {
    useVaultGroupsStore.setState({
      groups: [sampleGroup({ id: 1, name: 'A' })],
      activeGroupId: null,
    });
    expect(useVaultGroupsStore.getState().getActiveGroup()?.name).toBe('A');
  });

  it('returns null when groups is empty', () => {
    expect(useVaultGroupsStore.getState().getActiveGroup()).toBeNull();
  });
});

describe('setPendingInvite / setActiveGroup', () => {
  it('stash & clear pending invite', () => {
    useVaultGroupsStore.getState().setPendingInvite('xyz');
    expect(useVaultGroupsStore.getState().pendingInviteCode).toBe('xyz');
    useVaultGroupsStore.getState().setPendingInvite(null);
    expect(useVaultGroupsStore.getState().pendingInviteCode).toBeNull();
  });

  it('setActiveGroup is local-only (no network)', () => {
    useVaultGroupsStore.setState({
      groups: [sampleGroup({ id: 1 }), sampleGroup({ id: 2 })],
      activeGroupId: 1,
    });
    useVaultGroupsStore.getState().setActiveGroup(2);
    expect(useVaultGroupsStore.getState().activeGroupId).toBe(2);
    expect(groupsApi.list).not.toHaveBeenCalled();
  });
});
