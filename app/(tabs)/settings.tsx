import React, { useEffect, useState } from 'react';
import { Alert, View, Text, Switch, ScrollView, TextInput, Platform, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { useRouter } from 'expo-router';
import { Surface, SurfaceHeaderArea, GradientCard, ScreenHeader } from '../../components/ui';
import { useThemeColors } from '../../hooks/use-theme-colors';
import { useCopilotStore, CopilotPersona } from '../../store/useCopilotStore';
import { useCategoriesStore } from '../../store/useCategoriesStore';
import { useAuth } from '../../context/AuthContext';
import { updateProfile } from '../../services/authService';
import { useVaultGroupsStore } from '../../store/useVaultGroupsStore';

const PERSONA_OPTIONS: {
  id: CopilotPersona;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
}[] = [
  {
    id: 'advisor',
    label: 'Financial Advisor',
    description: 'Data-driven insights from your recent vault activity.',
    icon: 'analytics',
    tint: '#FF6B4A',
  },
  {
    id: 'friend',
    label: 'Emotional Friend',
    description: 'A WeChat-style cheerleader for the days that need it.',
    icon: 'heart',
    tint: '#5BE0B0',
  },
];

export default function SettingsScreen() {
  const themeColors = useThemeColors();
  const router = useRouter();
  const { colorScheme, setColorScheme } = useColorScheme();
  const enabledPersonas = useCopilotStore(s => s.enabledPersonas);
  const togglePersona = useCopilotStore(s => s.togglePersona);
  const categoriesCount = useCategoriesStore(s => s.categories.length);
  const labelsCount = useCategoriesStore(s => s.labels.length);
  const { user, accessToken, logout, updateUser } = useAuth();

  // Display name: keep a local draft so editing feels instant; sync to
  // /me/profile on blur. Re-seed when `user.display_name` changes (e.g.,
  // after onboarding completes or a refresh from elsewhere).
  const fallbackName = user?.display_name ?? '';
  const [nameDraft, setNameDraft] = useState(fallbackName);
  const [savingName, setSavingName] = useState(false);
  useEffect(() => {
    setNameDraft(user?.display_name ?? '');
  }, [user?.display_name]);

  const displayInitials = (user?.display_name || '?').substring(0, 2).toUpperCase();
  const headerName = user?.display_name?.trim() || `User #${user?.id ?? '?'}`;

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
      // Backend may have renamed the default "My Vault" — keep the
      // local store in sync so the home tab updates without a reload.
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

  // Row used inside the profile + preferences cards. Keeps spacing and
  // border-bottom consistent across both.
  const Row = ({
    icon,
    label,
    right,
    last,
  }: {
    icon?: keyof typeof Ionicons.glyphMap;
    label: string;
    right: React.ReactNode;
    last?: boolean;
  }) => (
    <View
      className="flex-row justify-between items-center p-5"
      style={!last ? { borderBottomWidth: 1, borderBottomColor: themeColors.hairline } : undefined}>
      <View className="flex-row items-center gap-4">
        {icon && <Ionicons name={icon} size={18} color="#FF6B4A" />}
        <Text
          className={
            icon
              ? 'font-jakarta-bold text-text-high text-sm'
              : 'font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest'
          }>
          {label}
        </Text>
      </View>
      {right}
    </View>
  );

  return (
    <Surface>
      <SurfaceHeaderArea>
        <ScreenHeader eyebrow="Profile & Identity" title="Settings" />
      </SurfaceHeaderArea>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingBottom: Platform.OS === 'ios' ? 120 : 100,
          paddingTop: 12,
          paddingHorizontal: 24,
        }}
        showsVerticalScrollIndicator={false}>
        <GradientCard padding="lg" accent="coral" className="mb-6">
          <View className="flex-row items-center gap-5">
            <View
              className="w-20 h-20 rounded-full bg-accent-coral justify-center items-center"
              style={{ boxShadow: '0 0 24px rgba(255, 107, 74, 0.5)' }}>
              <Text className="font-jakarta-bold text-white text-2xl tracking-widest uppercase">
                {displayInitials}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="font-jakarta-bold text-text-high text-2xl mb-1">
                {headerName}
              </Text>
              <Text className="font-jakarta text-text-low text-xs">
                Account #{user?.id ?? '?'}
              </Text>
            </View>
          </View>
        </GradientCard>

        <GradientCard padding="none" className="mb-8 overflow-hidden">
          <Row
            label="Display Name"
            right={
              <TextInput
                className="text-text-high font-jakarta-bold text-sm text-right min-w-[120px]"
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
            }
            last
          />
        </GradientCard>

        <Text className="font-jakarta-bold text-text-high text-xl mb-5">Preferences</Text>
        <GradientCard padding="none" className="mb-8 overflow-hidden">
          <Row
            icon="moon-outline"
            label="Dark Mode"
            right={
              <Switch
                value={colorScheme === 'dark'}
                onValueChange={val => setColorScheme(val ? 'dark' : 'light')}
                trackColor={{ true: '#FF6B4A', false: '#1E212B' }}
                thumbColor="#fff"
              />
            }
          />
          <Row
            icon="cash-outline"
            label="Currency"
            right={
              <Text className="font-jakarta-bold text-text-low text-xs uppercase tracking-widest">
                SGD
              </Text>
            }
            last
          />
        </GradientCard>

        {/* ── Vault Config ────────────────────────────────────────────
            CRUD entry points for the per-user taxonomy used across the
            app (categories on transactions, free-form labels). Both
            screens live outside `(tabs)` and are pushed via router. */}
        <Text className="font-jakarta-bold text-text-high text-xl mb-1">Vault Config</Text>
        <Text className="font-jakarta text-text-low text-xs mb-5 leading-relaxed">
          Organize how transactions are tagged. Categories carry an icon and color; labels are
          free-form tags you can stack on any transaction.
        </Text>
        <GradientCard padding="none" className="mb-8 overflow-hidden">
          <Pressable
            onPress={() => router.push('/categories')}
            className="flex-row justify-between items-center p-5 active:bg-surface-3"
            style={{ borderBottomWidth: 1, borderBottomColor: themeColors.hairline }}>
            <View className="flex-row items-center gap-4">
              <View
                className="w-9 h-9 rounded-2xl justify-center items-center"
                style={{ backgroundColor: 'rgba(255, 107, 74, 0.15)' }}>
                <Ionicons name="grid" size={16} color="#FF6B4A" />
              </View>
              <Text className="font-jakarta-bold text-text-high text-sm">Categories</Text>
            </View>
            <View className="flex-row items-center gap-1">
              <Text className="font-jakarta-bold text-text-low text-xs uppercase tracking-widest">
                {categoriesCount}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={themeColors.textLow} />
            </View>
          </Pressable>
          <Pressable
            onPress={() => router.push('/labels')}
            className="flex-row justify-between items-center p-5 active:bg-surface-3">
            <View className="flex-row items-center gap-4">
              <View
                className="w-9 h-9 rounded-2xl justify-center items-center"
                style={{ backgroundColor: 'rgba(91, 224, 176, 0.15)' }}>
                <Ionicons name="pricetag" size={14} color="#5BE0B0" />
              </View>
              <Text className="font-jakarta-bold text-text-high text-sm">Labels</Text>
            </View>
            <View className="flex-row items-center gap-1">
              <Text className="font-jakarta-bold text-text-low text-xs uppercase tracking-widest">
                {labelsCount}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={themeColors.textLow} />
            </View>
          </Pressable>
        </GradientCard>

        {/* ── Vault Groups ────────────────────────────────────────────
            Manage shared groups: who's in your active vault, invite
            new members via a universal link, switch between multiple
            groups, leave. See PRD 10 + ARCH_VAULT_GROUPS. */}
        <Text className="font-jakarta-bold text-text-high text-xl mb-1">Vault Groups</Text>
        <Text className="font-jakarta text-text-low text-xs mb-5 leading-relaxed">
          Share your transaction view with a partner, parents, or roommates.
          Each member's activity is stamped with their avatar.
        </Text>
        <GradientCard padding="none" className="mb-8 overflow-hidden">
          <Pressable
            onPress={() => router.push('/groups')}
            className="flex-row justify-between items-center p-5 active:bg-surface-3">
            <View className="flex-row items-center gap-4">
              <View
                className="w-9 h-9 rounded-2xl justify-center items-center"
                style={{ backgroundColor: 'rgba(91, 224, 176, 0.15)' }}>
                <Ionicons name="people" size={14} color="#5BE0B0" />
              </View>
              <Text className="font-jakarta-bold text-text-high text-sm">
                Manage groups & invites
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={themeColors.textLow} />
          </Pressable>
        </GradientCard>

        {/* ── Privacy ──────────────────────────────────────────────────
            Manage on-device bank PDF passwords — see PRD 09 §4.4 / the
            Zero Cloud Lock-in commitment in CLAUDE.md. */}
        <Text className="font-jakarta-bold text-text-high text-xl mb-1">Privacy</Text>
        <Text className="font-jakarta text-text-low text-xs mb-5 leading-relaxed">
          Bank PDF passwords are kept in your iOS Keychain on this device. We never
          store them on our servers.
        </Text>
        <GradientCard padding="none" className="mb-8 overflow-hidden">
          <Pressable
            onPress={() => router.push('/privacy')}
            className="flex-row justify-between items-center p-5 active:bg-surface-3">
            <View className="flex-row items-center gap-4">
              <View
                className="w-9 h-9 rounded-2xl justify-center items-center"
                style={{ backgroundColor: 'rgba(167, 139, 250, 0.15)' }}>
                <Ionicons name="lock-closed" size={14} color="#A78BFA" />
              </View>
              <Text className="font-jakarta-bold text-text-high text-sm">
                Bank passwords
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={themeColors.textLow} />
          </Pressable>
        </GradientCard>

        <Text className="font-jakarta-bold text-text-high text-xl mb-1">Copilot Personas</Text>
        <Text className="font-jakarta text-text-low text-xs mb-5 leading-relaxed">
          Enable the voices that join your chat. Selected personas reply in the same thread —
          this isn't a switcher, it's a group conversation.
        </Text>
        <GradientCard padding="none" className="mb-8 overflow-hidden">
          {PERSONA_OPTIONS.map((opt, idx) => {
            const enabled = enabledPersonas.includes(opt.id);
            const onlyEnabled = enabled && enabledPersonas.length === 1;
            return (
              <View
                key={opt.id}
                className="flex-row items-start gap-4 p-5"
                style={
                  idx < PERSONA_OPTIONS.length - 1
                    ? { borderBottomWidth: 1, borderBottomColor: themeColors.hairline }
                    : undefined
                }>
                <View
                  className="w-10 h-10 rounded-full justify-center items-center mt-0.5"
                  style={{
                    backgroundColor: opt.tint,
                    boxShadow: enabled ? `0 0 16px ${opt.tint}55` : undefined,
                    opacity: enabled ? 1 : 0.5,
                  }}>
                  <Ionicons name={opt.icon} size={16} color="#fff" />
                </View>
                <View className="flex-1">
                  <Text className="font-jakarta-bold text-text-high text-sm">{opt.label}</Text>
                  <Text className="font-jakarta text-text-low text-xs mt-1 leading-relaxed">
                    {opt.description}
                  </Text>
                  {onlyEnabled && (
                    <Text className="font-jakarta-bold text-accent-amber text-[10px] uppercase tracking-widest mt-2">
                      Last persona — keep at least one
                    </Text>
                  )}
                </View>
                <Switch
                  value={enabled}
                  onValueChange={() => togglePersona(opt.id)}
                  disabled={onlyEnabled}
                  trackColor={{ true: opt.tint, false: themeColors.surface3 }}
                  thumbColor="#fff"
                />
              </View>
            );
          })}
        </GradientCard>

        {/* ── Account ─────────────────────────────────────────────────
            Sign-out lives here so dev/test flows can rotate between
            stub WeChat users (`dev-<timestamp>` codes) without having
            to delete the app from the simulator. Shows the active
            user id so it's obvious whose session is being dropped. */}
        <Text className="font-jakarta-bold text-text-high text-xl mb-1">Account</Text>
        <Text className="font-jakarta text-text-low text-xs mb-5 leading-relaxed">
          Signed in as <Text className="font-jakarta-bold text-text-mid">
            {user?.display_name ?? `user #${user?.id ?? '?'}`}
          </Text>.
          Signing out clears tokens on this device and bounces you back to the
          login screen so the next provider tap creates a fresh session.
        </Text>
        <GradientCard padding="none" className="mb-8 overflow-hidden">
          <Pressable
            onPress={() =>
              Alert.alert(
                'Sign out?',
                'You will return to the login screen. Saved bank PDF passwords stay on this device.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Sign out',
                    style: 'destructive',
                    onPress: () => void logout(),
                  },
                ],
              )
            }
            className="flex-row justify-between items-center p-5 active:bg-surface-3">
            <View className="flex-row items-center gap-4">
              <View
                className="w-9 h-9 rounded-2xl justify-center items-center"
                style={{ backgroundColor: 'rgba(255, 92, 124, 0.15)' }}>
                <Ionicons name="log-out-outline" size={16} color="#FF5C7C" />
              </View>
              <Text className="font-jakarta-bold text-text-high text-sm">
                Sign out of this device
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={themeColors.textLow} />
          </Pressable>
          <Pressable
            onPress={() =>
              Alert.alert(
                'Sign out everywhere?',
                "Revokes every session for this account on every device, and wipes saved bank PDF passwords from this device's Keychain.",
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Sign out everywhere',
                    style: 'destructive',
                    onPress: () => void logout({ allDevices: true }),
                  },
                ],
              )
            }
            className="flex-row justify-between items-center p-5 active:bg-surface-3"
            style={{ borderTopWidth: 1, borderTopColor: themeColors.hairline }}>
            <View className="flex-row items-center gap-4">
              <View
                className="w-9 h-9 rounded-2xl justify-center items-center"
                style={{ backgroundColor: 'rgba(255, 92, 124, 0.25)' }}>
                <Ionicons name="globe-outline" size={16} color="#FF5C7C" />
              </View>
              <Text className="font-jakarta-bold text-text-high text-sm">
                Sign out everywhere
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={themeColors.textLow} />
          </Pressable>
        </GradientCard>

        <Text className="font-jakarta-bold text-text-high text-xl mb-5">Security Zone</Text>
        <Pressable>
          <GradientCard padding="lg" accent="rose" radius="card" className="mb-8">
            <View className="flex-row justify-between items-center">
              <View className="flex-1 pr-4">
                <Text className="font-jakarta-bold text-accent-rose text-base mb-1">
                  Purge Local Keychain
                </Text>
                <Text className="font-jakarta text-text-mid text-xs leading-relaxed">
                  Flush all cryptographic parameters and reset the local storage.
                </Text>
              </View>
              <Ionicons name="skull-outline" size={22} color="#FF5C7C" />
            </View>
          </GradientCard>
        </Pressable>
      </ScrollView>
    </Surface>
  );
}
