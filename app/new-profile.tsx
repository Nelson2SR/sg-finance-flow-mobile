import React, { useState } from 'react';
import { Alert, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { GradientCard, NeonButton, Surface } from '../components/ui';
import { API_CONFIG } from '../constants/Config';
import { useAuth } from '../context/AuthContext';
import { useThemeColors } from '../hooks/use-theme-colors';
import { updateProfile } from '../services/authService';
import { useVaultGroupsStore } from '../store/useVaultGroupsStore';

/**
 * First-run onboarding shown immediately after `/auth/phone/signup`.
 * Requires a display name (1–64 chars) before letting the user enter
 * the app — `display_name` is what every other screen falls back to
 * when rendering the current-user chip.
 *
 * Skipping is intentionally not offered: the alternative is the
 * settings screen rendering "user #N" forever, which is what the
 * "lands on a testing account" complaint was about.
 */
export default function NewProfileScreen() {
  const router = useRouter();
  const themeColors = useThemeColors();
  const { accessToken, user, logout } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  const handleContinue = async () => {
    const trimmed = displayName.trim();
    if (trimmed.length < 1) {
      Alert.alert('Pick a name', 'Enter at least one character.');
      return;
    }
    if (trimmed.length > 64) {
      Alert.alert('Too long', 'Display name must be 64 characters or fewer.');
      return;
    }
    if (!accessToken) {
      Alert.alert(
        'Session lost',
        'Sign in again to set up your profile.',
      );
      router.replace('/login');
      return;
    }
    setIsBusy(true);
    try {
      await updateProfile(accessToken, { display_name: trimmed });
      // Backend renamed the auto-created "My Vault" → display_name in
      // the same request. Refresh the local store so the home tab
      // doesn't keep showing the stale placeholder until next reload.
      await useVaultGroupsStore.getState().syncFromBackend().catch(() => {});
      router.replace('/(tabs)');
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const msg = typeof detail === 'string'
        ? detail
        : `Could not reach the API server at ${API_CONFIG.BASE_URL}.`;
      Alert.alert('Could not save', msg);
    } finally {
      setIsBusy(false);
    }
  };

  const inputClass = (name: string) =>
    `bg-surface-3 px-4 py-4 rounded-2xl text-text-high font-jakarta text-base border ${
      focused === name ? 'border-accent-coral' : 'border-hairline'
    }`;

  const innerContainerClass =
    Platform.OS === 'web'
      ? 'flex-1 px-6 justify-center w-full max-w-md mx-auto'
      : 'flex-1 px-6 justify-center';

  return (
    <Surface halo>
      <SafeAreaView className={innerContainerClass}>
        <View className="items-center mb-10">
          <View
            className="w-20 h-20 rounded-[24px] bg-accent-coral justify-center items-center mb-6"
            style={{ boxShadow: '0 0 32px rgba(255, 107, 74, 0.55)' }}>
            <Ionicons name="person-circle-outline" size={44} color="white" />
          </View>
          <Text className="font-jakarta-bold text-text-high text-[36px] tracking-tighter text-center">
            Set up your profile
          </Text>
          <Text className="font-jakarta text-text-mid text-center mt-2 text-sm">
            Welcome! Tell us what to call you.
          </Text>
        </View>

        <GradientCard padding="lg" accent="coral">
          <View className="mb-7">
            <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest mb-2 px-1">
              Display name
            </Text>
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="e.g. Nelson"
              placeholderTextColor={themeColors.textDim}
              maxLength={64}
              autoFocus
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleContinue}
              className={inputClass('name')}
              onFocus={() => setFocused('name')}
              onBlur={() => setFocused(null)}
            />
            {user?.id ? (
              <Text className="font-jakarta text-text-low text-[11px] mt-2 px-1">
                Account #{user.id} — you can change this anytime in Settings.
              </Text>
            ) : null}
          </View>

          <NeonButton size="lg" block loading={isBusy} onPress={handleContinue}>
            Continue
          </NeonButton>
        </GradientCard>

        <View className="mt-8 items-center">
          <Pressable
            onPress={async () => {
              // The user is already authenticated server-side; just
              // dropping to /login would loop back via AuthGuard. Wipe
              // the local session so they can sign in with a different
              // number (the server-side account stays — a true delete
              // is a Settings concern, not first-run).
              await logout();
              router.replace('/login');
            }}
            disabled={isBusy}>
            <Text className="font-jakarta-bold text-text-dim text-[10px] uppercase tracking-widest">
              ← Sign out
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Surface>
  );
}
