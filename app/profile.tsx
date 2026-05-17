/**
 * Profile subpage — pushed from the Settings tab.
 *
 * Edits the signed-in user's identity. Two storage tiers:
 *   • display_name + avatar_url: PATCH /me/profile (backend)
 *   • phone, birthday, gender, picked avatar URI: SecureStore via
 *     lib/profileExtras (on-device only — see that file's header).
 *
 * Phone is read-only here: it's captured at OTP sign-in (see login.tsx)
 * and changing it would mean re-authenticating. The "Sign out and use
 * a different number" flow is the right path for that.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';

import { GradientCard, Surface } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useThemeColors } from '../hooks/use-theme-colors';
import { updateProfile } from '../services/authService';
import {
  Gender,
  ProfileExtras,
  getProfileExtras,
  updateProfileExtras,
} from '../lib/profileExtras';
import { useVaultGroupsStore } from '../store/useVaultGroupsStore';

const GENDER_OPTIONS: { value: Gender; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'male', label: 'Male', icon: 'male' },
  { value: 'female', label: 'Female', icon: 'female' },
  { value: 'other', label: 'Other', icon: 'transgender' },
  { value: 'prefer_not', label: 'Prefer not', icon: 'ellipsis-horizontal' },
];

export default function ProfileScreen() {
  const router = useRouter();
  const themeColors = useThemeColors();
  const { user, accessToken, updateUser } = useAuth();

  const [extras, setExtras] = useState<ProfileExtras>({});
  const [extrasLoaded, setExtrasLoaded] = useState(false);

  // Display name draft mirrors the Settings tab's pattern — local
  // string that commits on blur, so editing feels instant.
  const [nameDraft, setNameDraft] = useState(user?.display_name ?? '');
  const [savingName, setSavingName] = useState(false);

  const [savingAvatar, setSavingAvatar] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  useEffect(() => {
    setNameDraft(user?.display_name ?? '');
  }, [user?.display_name]);

  const loadExtras = useCallback(async () => {
    if (!user?.id) return;
    const stored = await getProfileExtras(user.id);
    setExtras(stored);
    setExtrasLoaded(true);
  }, [user?.id]);

  useEffect(() => {
    void loadExtras();
  }, [loadExtras]);

  const persistExtras = async (patch: Partial<ProfileExtras>) => {
    if (!user?.id) return;
    const next = await updateProfileExtras(user.id, patch);
    setExtras(next);
  };

  const commitName = async () => {
    const trimmed = nameDraft.trim();
    if (!accessToken) return;
    if (trimmed === (user?.display_name ?? '').trim()) return;
    if (trimmed.length < 1 || trimmed.length > 64) {
      Alert.alert('Invalid name', 'Display name must be 1–64 characters.');
      setNameDraft(user?.display_name ?? '');
      return;
    }
    setSavingName(true);
    try {
      const updated = await updateProfile(accessToken, { display_name: trimmed });
      updateUser({
        id: updated.id,
        display_name: updated.display_name,
        avatar_url: updated.avatar_url,
        email: updated.email,
      });
      // The backend renames the default "My Vault" group to track
      // display_name — refresh so Home doesn't keep the stale label.
      await useVaultGroupsStore.getState().syncFromBackend().catch(() => {});
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      Alert.alert(
        'Could not save name',
        typeof detail === 'string' ? detail : 'Please try again.',
      );
      setNameDraft(user?.display_name ?? '');
    } finally {
      setSavingName(false);
    }
  };

  const handlePickAvatar = async () => {
    // The backend has no avatar upload endpoint yet, so the picked
    // image lives on this device only — stored as a file:// URI in
    // SecureStore and displayed below. When the API ships, we'll
    // upload + send the returned URL via updateProfile.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]?.uri) return;
    setSavingAvatar(true);
    try {
      await persistExtras({ avatarUri: result.assets[0].uri });
    } finally {
      setSavingAvatar(false);
    }
  };

  const handleClearAvatar = () => {
    Alert.alert(
      'Remove avatar?',
      'This clears the picture saved on this device. Your account still keeps any avatar set elsewhere.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => void persistExtras({ avatarUri: undefined }),
        },
      ],
    );
  };

  const handlePickBirthday = (event: any, date?: Date) => {
    // Android dismisses on pick; iOS keeps the picker open inside the
    // bottom sheet (the user taps Done to close it).
    if (Platform.OS !== 'ios') {
      setDatePickerOpen(false);
      if (event.type === 'dismissed') return;
    }
    if (!date) return;
    void persistExtras({ birthday: format(date, 'yyyy-MM-dd') });
  };

  const handlePickGender = (g: Gender) => {
    // Tapping the active chip again clears the selection.
    void persistExtras({ gender: extras.gender === g ? undefined : g });
  };

  const avatarSource = useMemo(() => {
    if (extras.avatarUri) return { uri: extras.avatarUri };
    if (user?.avatar_url) return { uri: user.avatar_url };
    return null;
  }, [extras.avatarUri, user?.avatar_url]);
  const initials = (user?.display_name || '?').substring(0, 2).toUpperCase();
  const birthdayDate = extras.birthday ? new Date(`${extras.birthday}T00:00:00`) : undefined;
  const birthdayDisplay = birthdayDate ? format(birthdayDate, 'd MMM yyyy') : 'Add birthday';

  return (
    <Surface halo>
      <SafeAreaView className="flex-1">
        <View className="flex-row items-center justify-between px-6 pt-2 pb-4">
          <Pressable
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-surface-2 border border-hairline justify-center items-center">
            <Ionicons name="chevron-back" size={20} color={themeColors.textHigh} />
          </Pressable>
          <Text className="font-jakarta-bold text-text-high text-base">Profile</Text>
          <View className="w-10" />
        </View>

        <ScrollView
          className="flex-1 px-6"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 48 }}>
          {/* ── Avatar ──────────────────────────────────────────────── */}
          <View className="items-center mt-2 mb-8">
            <Pressable onPress={handlePickAvatar} className="relative">
              <View
                className="w-28 h-28 rounded-full justify-center items-center overflow-hidden"
                style={{
                  backgroundColor: '#FF6B4A',
                  boxShadow: '0 0 28px rgba(255, 107, 74, 0.55)',
                }}>
                {avatarSource ? (
                  <Image source={avatarSource} style={{ width: 112, height: 112 }} />
                ) : (
                  <Text className="font-jakarta-bold text-white text-3xl tracking-widest uppercase">
                    {initials}
                  </Text>
                )}
              </View>
              <View
                className="absolute bottom-0 right-0 w-9 h-9 rounded-full justify-center items-center border-2"
                style={{
                  backgroundColor: themeColors.surface2,
                  borderColor: themeColors.surface0,
                }}>
                {savingAvatar ? (
                  <ActivityIndicator size="small" color="#FF6B4A" />
                ) : (
                  <Ionicons name="camera" size={16} color="#FF6B4A" />
                )}
              </View>
            </Pressable>
            {extras.avatarUri && (
              <Pressable onPress={handleClearAvatar} hitSlop={8} className="mt-4">
                <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest">
                  Remove photo
                </Text>
              </Pressable>
            )}
          </View>

          {/* ── Identity (backend-synced) ──────────────────────────── */}
          <Text className="font-jakarta-bold text-text-high text-xl mb-1">Identity</Text>
          <Text className="font-jakarta text-text-low text-xs mb-5 leading-relaxed">
            How you appear across the app. Display name syncs to your account; the
            avatar above is saved on this device until cloud sync ships.
          </Text>

          <GradientCard padding="none" className="mb-8 overflow-hidden">
            <View
              className="flex-row justify-between items-center p-5"
              style={{ borderBottomWidth: 1, borderBottomColor: themeColors.hairline }}>
              <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest">
                Display Name
              </Text>
              <View className="flex-row items-center gap-2">
                {savingName && <ActivityIndicator size="small" color="#FF6B4A" />}
                <TextInput
                  className="text-text-high font-jakarta-bold text-sm text-right min-w-[140px]"
                  style={{
                    minHeight: 32,
                    paddingVertical: 6,
                    includeFontPadding: false as any,
                  }}
                  value={nameDraft}
                  onChangeText={setNameDraft}
                  onBlur={commitName}
                  onSubmitEditing={commitName}
                  maxLength={64}
                  returnKeyType="done"
                  editable={!savingName}
                  placeholder="Add a name"
                  placeholderTextColor={themeColors.textDim}
                />
              </View>
            </View>
            <View className="flex-row justify-between items-center p-5">
              <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest">
                Account ID
              </Text>
              <Text className="font-jakarta-bold text-text-mid text-sm">
                #{user?.id ?? '?'}
              </Text>
            </View>
          </GradientCard>

          {/* ── Contact (read-only phone + birthday + gender) ─────── */}
          <Text className="font-jakarta-bold text-text-high text-xl mb-1">Personal</Text>
          <Text className="font-jakarta text-text-low text-xs mb-5 leading-relaxed">
            Saved on this device — these fields aren't synced to the backend yet, so
            they stay private until you choose to share.
          </Text>

          <GradientCard padding="none" className="mb-8 overflow-hidden">
            <View
              className="flex-row justify-between items-center p-5"
              style={{ borderBottomWidth: 1, borderBottomColor: themeColors.hairline }}>
              <View>
                <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest">
                  Phone
                </Text>
                <Text className="font-jakarta text-text-dim text-[10px] mt-1">
                  Set when you signed in
                </Text>
              </View>
              <Text className="font-jakarta-bold text-text-mid text-sm">
                {extrasLoaded ? extras.phone ?? '—' : '…'}
              </Text>
            </View>

            <Pressable
              onPress={() => setDatePickerOpen(true)}
              className="flex-row justify-between items-center p-5 active:bg-surface-3"
              style={{ borderBottomWidth: 1, borderBottomColor: themeColors.hairline }}>
              <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest">
                Birthday
              </Text>
              <View className="flex-row items-center gap-2">
                <Text
                  className={`font-jakarta-bold text-sm ${
                    extras.birthday ? 'text-text-high' : 'text-text-dim'
                  }`}>
                  {birthdayDisplay}
                </Text>
                <Ionicons name="calendar-outline" size={14} color={themeColors.textLow} />
              </View>
            </Pressable>

            <View className="p-5">
              <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest mb-3">
                Gender
              </Text>
              <View className="flex-row flex-wrap" style={{ marginHorizontal: -4 }}>
                {GENDER_OPTIONS.map((opt) => {
                  const isPicked = extras.gender === opt.value;
                  return (
                    <View key={opt.value} style={{ width: '50%', padding: 4 }}>
                      <Pressable
                        onPress={() => handlePickGender(opt.value)}
                        className="flex-row items-center gap-2 py-3 px-4 rounded-2xl border"
                        style={{
                          backgroundColor: isPicked
                            ? 'rgba(255, 107, 74, 0.14)'
                            : themeColors.surface2,
                          borderColor: isPicked ? '#FF6B4A' : themeColors.hairline,
                        }}>
                        <Ionicons
                          name={opt.icon}
                          size={14}
                          color={isPicked ? '#FF6B4A' : themeColors.textMid}
                        />
                        <Text
                          className={`font-jakarta-bold text-xs ${
                            isPicked ? 'text-accent-coral' : 'text-text-mid'
                          }`}>
                          {opt.label}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </View>
          </GradientCard>

        </ScrollView>

        {/* Birthday picker — wrapped in a bottom-sheet Modal so it
            gets a full-width container. The bare inline picker
            rendered inside the ScrollView gets clipped to a sliver
            on iOS, which is what the broken UI was showing. */}
        {datePickerOpen && (
          <Modal
            visible={datePickerOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setDatePickerOpen(false)}>
            <Pressable
              style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }}
              onPress={() => setDatePickerOpen(false)}>
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
                <View className="flex-row justify-between items-center mb-4">
                  <Text className="font-jakarta-bold text-text-high text-base">
                    Birthday
                  </Text>
                  <Pressable
                    onPress={() => setDatePickerOpen(false)}
                    className="px-4 py-2 rounded-full bg-accent-coral active:scale-95">
                    <Text className="font-jakarta-bold text-white text-sm">Done</Text>
                  </Pressable>
                </View>
                <DateTimePicker
                  value={birthdayDate ?? new Date(1995, 0, 1)}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  maximumDate={new Date()}
                  onChange={handlePickBirthday}
                  themeVariant="light"
                />
              </Pressable>
            </Pressable>
          </Modal>
        )}
      </SafeAreaView>
    </Surface>
  );
}
