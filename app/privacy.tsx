import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { GradientCard, Surface } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useThemeColors } from '../hooks/use-theme-colors';
import {
  forgetAllBankPasswords,
  forgetBankPassword,
  listSavedBanks,
} from '../lib/bankPasswords';

export default function PrivacyScreen() {
  const router = useRouter();
  const themeColors = useThemeColors();
  const { user } = useAuth();

  const [banks, setBanks] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const list = await listSavedBanks(user.id);
      setBanks(list);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const confirmForget = (bank: string) => {
    Alert.alert(
      `Forget ${bank} password?`,
      `We'll remove this bank's PDF password from your iOS Keychain. The next time you import a ${bank} statement, we'll ask for it again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Forget',
          style: 'destructive',
          onPress: async () => {
            if (!user?.id) return;
            await forgetBankPassword(user.id, bank);
            void refresh();
          },
        },
      ],
    );
  };

  const confirmForgetAll = () => {
    Alert.alert(
      'Forget all bank passwords?',
      'This wipes every PDF password stored in your iOS Keychain. You will be asked to re-enter each one on the next import. Your account and transactions are untouched.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Forget all',
          style: 'destructive',
          onPress: async () => {
            if (!user?.id) return;
            await forgetAllBankPasswords(user.id);
            void refresh();
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
          <Text className="font-jakarta-bold text-text-high text-base">Privacy</Text>
          <View className="w-10" />
        </View>

        <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
          {/* ── On-device passwords ────────────────────────────────────── */}
          <Text className="font-jakarta-bold text-text-high text-xl mb-1">
            Bank PDF Passwords
          </Text>
          <Text className="font-jakarta text-text-low text-xs mb-5 leading-relaxed">
            Your bank statement PDF passwords live in your iOS Keychain. They never
            touch our servers and never appear in our database. Removing them here
            does not affect your account or transactions — we'll just ask again the
            next time you import that bank's statement.
          </Text>

          <GradientCard padding="none" className="mb-4 overflow-hidden">
            {loading ? (
              <View className="p-5">
                <Text className="font-jakarta text-text-low text-sm">Loading…</Text>
              </View>
            ) : banks.length === 0 ? (
              <View className="p-5">
                <Text className="font-jakarta text-text-low text-sm">
                  No passwords saved yet. We'll prompt you the next time you scan an
                  encrypted statement.
                </Text>
              </View>
            ) : (
              banks.map((bank, idx) => (
                <Pressable
                  key={bank}
                  onPress={() => confirmForget(bank)}
                  className="flex-row justify-between items-center p-5 active:bg-surface-3"
                  style={
                    idx < banks.length - 1
                      ? { borderBottomWidth: 1, borderBottomColor: themeColors.hairline }
                      : undefined
                  }>
                  <View className="flex-row items-center gap-4">
                    <View
                      className="w-9 h-9 rounded-2xl justify-center items-center"
                      style={{ backgroundColor: 'rgba(255, 107, 74, 0.15)' }}>
                      <Ionicons name="key" size={16} color="#FF6B4A" />
                    </View>
                    <View>
                      <Text className="font-jakarta-bold text-text-high text-sm">
                        {bank}
                      </Text>
                      <Text className="font-jakarta text-text-low text-[11px] mt-0.5">
                        Stored on this device only
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="trash-outline" size={16} color={themeColors.textLow} />
                </Pressable>
              ))
            )}
          </GradientCard>

          {banks.length > 0 && (
            <Pressable
              onPress={confirmForgetAll}
              className="bg-surface-3 px-5 py-4 rounded-2xl border border-hairline mb-8">
              <Text className="font-jakarta-bold text-center text-[12px] uppercase tracking-widest text-accent-coral">
                Forget all bank passwords
              </Text>
            </Pressable>
          )}

          {/* ── Privacy contract callout ───────────────────────────────── */}
          <View className="mb-12 px-1">
            <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest mb-2">
              Our privacy contract
            </Text>
            <Text className="font-jakarta text-text-mid text-xs leading-relaxed">
              When you scan a password-protected statement, the password is read from
              your Keychain (or typed once and stored there), sent to our backend
              over TLS, used in memory to decrypt the file, and immediately
              discarded. It is never written to disk and never stored in our database.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Surface>
  );
}
