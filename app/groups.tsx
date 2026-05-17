/**
 * Vault Group manage screen — single-screen MVP for PR-5b.
 *
 * Routes:
 *   /groups   (this file)   — list all groups + invite + create
 *
 * Per-group settings (rename, transfer ownership, remove member,
 * leave) live in a follow-up `/groups/[id]/settings.tsx` that we
 * defer to PR-5b-next so this PR has a focused surface to ship.
 *
 * The "Invite a member" button calls the backend, gets a code, and
 * opens the native Share sheet with a universal-link URL so the user
 * can drop it into WeChat / iMessage / WhatsApp. The recipient taps
 * the link, the app opens, the deep-link handler stashes the code,
 * and AuthContext auto-consumes it after sign-in.
 */

import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import {
  GradientCard,
  NeonButton,
  Surface,
} from '../components/ui';
import { AvatarStack } from '../components/features/AvatarStack';
import { useThemeColors } from '../hooks/use-theme-colors';
import { useVaultGroupsStore } from '../store/useVaultGroupsStore';

const INVITE_BASE_URL = 'https://sgff.app/invite/';

/**
 * Curated emoji set for the "Create a new group" picker. Hand-picked
 * to cover the shared-spending contexts called out in the body copy —
 * households, trips, roommates, project teams, plus a few generic
 * options. The first entry is the default so the form is never
 * submitted with a null emoji.
 *
 * Order is intentional: most-common cases first. Keep this list
 * short (≤ 12) so the horizontal picker scrolls minimally on a
 * 375pt-wide phone.
 */
const GROUP_EMOJI_OPTIONS = [
  '🏡', // household / home
  '👫', // couple
  '👨‍👩‍👧', // family
  '🛋', // roommates
  '✈️', // trip
  '🍽', // dining / meals
  '💼', // business / team
  '🎉', // event
  '🚗', // car / road trip
  '🐾', // pet
  '⛺', // camp / outdoors
  '💰', // generic
] as const;

export default function GroupsScreen() {
  const router = useRouter();
  const themeColors = useThemeColors();
  const groups = useVaultGroupsStore(s => s.groups);
  const activeGroupId = useVaultGroupsStore(s => s.activeGroupId);
  const setActiveGroup = useVaultGroupsStore(s => s.setActiveGroup);
  const syncFromBackend = useVaultGroupsStore(s => s.syncFromBackend);
  const createGroup = useVaultGroupsStore(s => s.createGroup);
  const generateInvite = useVaultGroupsStore(s => s.generateInvite);
  const leaveGroup = useVaultGroupsStore(s => s.leaveGroup);
  const consumeInvite = useVaultGroupsStore(s => s.consumeInvite);
  const renameGroup = useVaultGroupsStore(s => s.renameGroup);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState<string>(GROUP_EMOJI_OPTIONS[0]);
  const [busyGroupId, setBusyGroupId] = useState<number | null>(null);

  // Owner-only edit modal — bottom-sheet name + emoji editor, hidden
  // unless the open id matches a group the user owns. We snapshot
  // the draft locally so cancelling doesn't write through to the store.
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmoji, setEditEmoji] = useState<string>(GROUP_EMOJI_OPTIONS[0]);
  const [savingEdit, setSavingEdit] = useState(false);
  const editingGroup = groups.find((g) => g.id === editingGroupId) ?? null;

  const openEdit = (groupId: number, currentName: string, currentEmoji?: string | null) => {
    setEditingGroupId(groupId);
    setEditName(currentName);
    setEditEmoji(currentEmoji ?? GROUP_EMOJI_OPTIONS[0]);
  };
  const closeEdit = () => {
    setEditingGroupId(null);
    setSavingEdit(false);
  };
  const commitEdit = async () => {
    if (editingGroupId === null) return;
    const trimmed = editName.trim();
    if (!trimmed) {
      Alert.alert('Name required', 'Give the group a name.');
      return;
    }
    if (trimmed.length > 64) {
      Alert.alert('Too long', 'Group name must be 64 characters or fewer.');
      return;
    }
    setSavingEdit(true);
    try {
      await renameGroup(editingGroupId, trimmed, editEmoji);
      closeEdit();
    } catch (err: any) {
      Alert.alert(
        'Could not save group',
        err?.response?.data?.detail ?? 'Please try again.',
      );
      setSavingEdit(false);
    }
  };

  useEffect(() => {
    void syncFromBackend();
  }, [syncFromBackend]);

  const handleInvite = async (groupId: number) => {
    setBusyGroupId(groupId);
    try {
      const { code } = await generateInvite(groupId);
      const url = INVITE_BASE_URL + code;
      const group = groups.find(g => g.id === groupId);
      const groupName = group?.name ?? 'my vault';

      // Reveal the code in an Alert *before* the Share sheet so dev
      // testing isn't blocked by the absence of working universal-link
      // config. The recipient (or a re-login as a different user)
      // pastes the code into the "Have a code?" row at the top.
      Alert.alert(
        'Invite ready',
        `Code: ${code}\n\nLink: ${url}\n\nShare this code or link with whoever you want to add to "${groupName}".`,
        [
          { text: 'Done', style: 'cancel' },
          {
            text: 'Share',
            onPress: () =>
              Share.share({
                message: `Join "${groupName}" on VaultWise: ${url}`,
                url,
              }),
          },
        ],
      );
    } catch (err: any) {
      Alert.alert(
        'Could not generate invite',
        err?.response?.data?.detail ?? 'Please try again.',
      );
    } finally {
      setBusyGroupId(null);
    }
  };

  /**
   * Manually paste an invite code. Useful for dev testing without
   * a working universal-link config — and also a reasonable backup
   * UX for production users on platforms whose messenger app strips
   * URL preview previews (rare, but happens).
   */
  const handleJoinByCode = () => {
    const finish = async (code: string | null) => {
      if (!code) return;
      try {
        const joined = await consumeInvite(code.trim());
        Alert.alert('Joined!', `You're now a member of "${joined.name}".`);
      } catch (err: any) {
        const detail = err?.response?.data?.detail;
        const message =
          typeof detail === 'object' && detail?.message
            ? detail.message
            : typeof detail === 'string'
              ? detail
              : 'The code may be expired or already used.';
        Alert.alert('Could not join', message);
      }
    };

    if (Platform.OS !== 'ios') {
      Alert.alert(
        'iOS only',
        'Pasting an invite code with a text prompt is iOS-only for now. On Android, please use the share link instead.',
      );
      return;
    }
    (Alert as any).prompt(
      'Have an invite code?',
      'Paste the code (or the bit after /invite/ in a share link) to join the group.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => finish(null) },
        { text: 'Join', onPress: (value?: string) => finish(value ?? null) },
      ],
      'plain-text',
    );
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) {
      Alert.alert('Name required', 'Give the new group a name.');
      return;
    }
    setCreating(true);
    try {
      await createGroup(name, newEmoji);
      setNewName('');
      // Reset picker to the default for the next create.
      setNewEmoji(GROUP_EMOJI_OPTIONS[0]);
    } catch (err: any) {
      Alert.alert(
        'Could not create group',
        err?.response?.data?.detail ?? 'Please try again.',
      );
    } finally {
      setCreating(false);
    }
  };

  const confirmLeave = (groupId: number, name: string, isOwner: boolean) => {
    if (isOwner) {
      Alert.alert(
        'Transfer ownership first',
        'Owners must hand over the group to another member (or delete the group) before leaving. Member transfer is coming in the next update.',
      );
      return;
    }
    Alert.alert(
      `Leave "${name}"?`,
      "You'll stop seeing this group's shared activity. Your own transactions stay yours.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            setBusyGroupId(groupId);
            try {
              await leaveGroup(groupId);
            } catch (err: any) {
              Alert.alert(
                'Could not leave group',
                err?.response?.data?.detail ?? 'Please try again.',
              );
            } finally {
              setBusyGroupId(null);
            }
          },
        },
      ],
    );
  };

  return (
    <Surface halo>
      <SafeAreaView className="flex-1">
        <View className="flex-row items-center justify-between px-6 pt-2 pb-4">
          <Pressable
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-surface-2 border border-hairline justify-center items-center">
            <Ionicons name="chevron-back" size={20} color={themeColors.textHigh} />
          </Pressable>
          <Text className="font-jakarta-bold text-text-high text-base">Vault Groups</Text>
          <View className="w-10" />
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}>
          <Text className="font-jakarta text-text-low text-xs mb-5 leading-relaxed">
            A Vault Group lets you share your transaction view with other people.
            All members see every member's activity, each row stamped with the
            author's avatar.
          </Text>

          {/* ── Join via code ───────────────────────────────────────── */}
          <Pressable
            onPress={handleJoinByCode}
            className="mb-6">
            <GradientCard padding="lg" accent="mint">
              <View className="flex-row justify-between items-center">
                <View className="flex-1 pr-4">
                  <Text className="font-jakarta-bold text-text-high text-base mb-1">
                    Have an invite code?
                  </Text>
                  <Text className="font-jakarta text-text-mid text-xs leading-relaxed">
                    Paste a code from someone who invited you to join their group.
                  </Text>
                </View>
                <View
                  className="w-10 h-10 rounded-full justify-center items-center"
                  style={{ backgroundColor: 'rgba(91, 224, 176, 0.18)' }}>
                  <Ionicons name="enter-outline" size={20} color="#5BE0B0" />
                </View>
              </View>
            </GradientCard>
          </Pressable>

          {/* ── Group list ──────────────────────────────────────────── */}
          {groups.length === 0 ? (
            <GradientCard padding="lg" className="mb-6">
              <Text className="font-jakarta text-text-low text-sm">
                You're not in any group yet. Create one below to start inviting
                people.
              </Text>
            </GradientCard>
          ) : (
            groups.map((g) => {
              const isActive = g.id === activeGroupId;
              const isOwner = g.role === 'OWNER';
              return (
                <View key={g.id} className="mb-3">
                  <GradientCard padding="lg" accent={isActive ? 'coral' : undefined}>
                    <View className="flex-row justify-between items-start mb-4">
                      <View className="flex-1 pr-4">
                        <View className="flex-row items-center gap-2 mb-1">
                          <Text className="font-jakarta-bold text-text-high text-base">
                            {g.emoji ? `${g.emoji}  ` : ''}{g.name}
                          </Text>
                          {isActive && (
                            <View
                              className="px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: 'rgba(255, 107, 74, 0.18)' }}>
                              <Text className="font-jakarta-bold text-accent-coral text-[9px] uppercase tracking-widest">
                                Active
                              </Text>
                            </View>
                          )}
                          {isOwner && (
                            <View
                              className="px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: 'rgba(91, 224, 176, 0.18)' }}>
                              <Text className="font-jakarta-bold text-accent-mint text-[9px] uppercase tracking-widest">
                                Owner
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text className="font-jakarta text-text-low text-[11px]">
                          {g.members.length} {g.members.length === 1 ? 'member' : 'members'}
                        </Text>
                      </View>
                      <AvatarStack members={g.members} size={28} maxVisible={4} />
                    </View>

                    <View className="flex-row gap-2">
                      {!isActive && (
                        <Pressable
                          onPress={() => setActiveGroup(g.id)}
                          className="flex-1 bg-surface-3 py-3 rounded-xl border border-hairline">
                          <Text className="font-jakarta-bold text-text-high text-center text-xs uppercase tracking-widest">
                            Set active
                          </Text>
                        </Pressable>
                      )}
                      <Pressable
                        onPress={() => handleInvite(g.id)}
                        disabled={busyGroupId === g.id}
                        className="flex-1 bg-accent-coral py-3 rounded-xl"
                        style={{ opacity: busyGroupId === g.id ? 0.5 : 1 }}>
                        <Text className="font-jakarta-bold text-white text-center text-xs uppercase tracking-widest">
                          {busyGroupId === g.id ? 'Generating…' : 'Invite'}
                        </Text>
                      </Pressable>
                      {isOwner && (
                        <Pressable
                          onPress={() => openEdit(g.id, g.name, g.emoji)}
                          className="px-4 py-3 rounded-xl bg-surface-3 border border-hairline">
                          <Ionicons name="pencil" size={16} color={themeColors.textMid} />
                        </Pressable>
                      )}
                      <Pressable
                        onPress={() => confirmLeave(g.id, g.name, isOwner)}
                        className="px-4 py-3 rounded-xl bg-surface-3 border border-hairline">
                        <Ionicons name="exit-outline" size={16} color={themeColors.textMid} />
                      </Pressable>
                    </View>
                  </GradientCard>
                </View>
              );
            })
          )}

          {/* ── Create new group ────────────────────────────────────── */}
          <Text className="font-jakarta-bold text-text-high text-xl mb-1 mt-6">
            Create a new group
          </Text>
          <Text className="font-jakarta text-text-low text-xs mb-4 leading-relaxed">
            Spin up a fresh group for any shared-spending context — a household,
            a trip, roommates, a project team. Each group has its own activity
            view and member roster.
          </Text>
          <GradientCard padding="lg">
            <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest mb-2 px-1">
              Pick an icon
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
              className="mb-4">
              {GROUP_EMOJI_OPTIONS.map((emoji) => {
                const isSelected = emoji === newEmoji;
                return (
                  <Pressable
                    key={emoji}
                    onPress={() => setNewEmoji(emoji)}
                    className="justify-center items-center"
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: isSelected
                        ? 'rgba(255, 107, 74, 0.18)'
                        : 'rgba(255, 255, 255, 0.04)',
                      borderWidth: 1.5,
                      borderColor: isSelected
                        ? '#FF6B4A'
                        : themeColors.hairline,
                    }}>
                    <Text style={{ fontSize: 22 }}>{emoji}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest mb-2 px-1">
              Group name
            </Text>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder="e.g. Roommates, Family, Bali Trip"
              placeholderTextColor={themeColors.textDim}
              className="bg-surface-3 px-4 py-4 rounded-2xl text-text-high font-jakarta text-base border border-hairline mb-4"
            />
            <NeonButton size="md" block loading={creating} onPress={handleCreate}>
              Create group
            </NeonButton>
          </GradientCard>
        </ScrollView>

        {/* Owner-only rename + emoji bottom sheet. The Modal is mounted
            only while open so the TextInput auto-focuses cleanly when
            the sheet appears. */}
        {editingGroupId !== null && (
          <Modal
            visible
            transparent
            animationType="fade"
            onRequestClose={closeEdit}>
            <Pressable
              style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
              onPress={closeEdit}>
              <Pressable
                onPress={(e) => e.stopPropagation()}
                style={{
                  marginTop: 'auto',
                  backgroundColor: themeColors.surface1,
                  paddingTop: 16,
                  paddingBottom: 32,
                  paddingHorizontal: 24,
                  borderTopLeftRadius: 32,
                  borderTopRightRadius: 32,
                  borderTopWidth: 1,
                  borderTopColor: themeColors.hairline,
                }}>
                <View className="items-center mb-4">
                  <View
                    style={{
                      width: 40,
                      height: 4,
                      borderRadius: 999,
                      backgroundColor: themeColors.hairline,
                    }}
                  />
                </View>
                <View className="flex-row justify-between items-center mb-5">
                  <Text className="font-jakarta-bold text-text-high text-lg">
                    Edit group
                  </Text>
                  <Pressable
                    onPress={closeEdit}
                    className="w-9 h-9 rounded-full bg-surface-2 border border-hairline justify-center items-center">
                    <Ionicons name="close" size={16} color={themeColors.textMid} />
                  </Pressable>
                </View>

                <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest mb-2 px-1">
                  Name
                </Text>
                <TextInput
                  value={editName}
                  onChangeText={setEditName}
                  placeholder={editingGroup?.name ?? 'Group name'}
                  placeholderTextColor={themeColors.textDim}
                  maxLength={64}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={commitEdit}
                  className="bg-surface-3 px-4 py-4 rounded-2xl text-text-high font-jakarta text-base border border-hairline mb-5"
                />

                <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest mb-2 px-1">
                  Emoji
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, paddingRight: 16 }}
                  className="mb-6">
                  {GROUP_EMOJI_OPTIONS.map((e) => {
                    const picked = e === editEmoji;
                    return (
                      <Pressable
                        key={e}
                        onPress={() => setEditEmoji(e)}
                        className="w-12 h-12 rounded-2xl justify-center items-center border"
                        style={{
                          backgroundColor: picked
                            ? 'rgba(255, 107, 74, 0.14)'
                            : themeColors.surface2,
                          borderColor: picked ? '#FF6B4A' : themeColors.hairline,
                        }}>
                        <Text style={{ fontSize: 20 }}>{e}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <NeonButton size="md" block loading={savingEdit} onPress={commitEdit}>
                  Save changes
                </NeonButton>
              </Pressable>
            </Pressable>
          </Modal>
        )}
      </SafeAreaView>
    </Surface>
  );
}
