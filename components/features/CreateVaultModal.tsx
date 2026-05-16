import React, { useState } from 'react';
import { ActivityIndicator, Alert, View, Text, Pressable, TextInput, Modal, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';

import { financeApi } from '../../services/apiClient';
import { useFinanceStore } from '../../store/useFinanceStore';
import { useThemeColors } from '../../hooks/use-theme-colors';

interface Props {
  visible: boolean;
  onClose: () => void;
}

type VaultType = 'PERSONAL' | 'TRIP' | 'FAMILY' | 'CRYPTO';

const TYPES: { id: VaultType; label: string; icon: keyof typeof Ionicons.glyphMap; tint: string }[] = [
  { id: 'PERSONAL', label: 'Bank', icon: 'card', tint: '#FF6B4A' },
  { id: 'TRIP', label: 'Trip', icon: 'airplane', tint: '#FF5C7C' },
  { id: 'FAMILY', label: 'Family', icon: 'people', tint: '#5BE0B0' },
  { id: 'CRYPTO', label: 'Crypto', icon: 'logo-bitcoin', tint: '#FFB547' },
];

// Currencies surfaced in the picker. Singapore-first (SGD), then the
// majors a Singaporean traveller/investor is most likely to track. The
// backend stores the 3-letter ISO code as-is — any value matching
// `^[A-Z]{3}$` is accepted, so this is a UI affordance, not a contract.
const CURRENCIES: { code: string; symbol: string; label: string }[] = [
  { code: 'SGD', symbol: 'S$',  label: 'Singapore Dollar' },
  { code: 'USD', symbol: '$',   label: 'US Dollar' },
  { code: 'CNY', symbol: '¥',   label: 'Chinese Yuan' },
  { code: 'MYR', symbol: 'RM',  label: 'Malaysian Ringgit' },
  { code: 'JPY', symbol: '¥',   label: 'Japanese Yen' },
  { code: 'EUR', symbol: '€',   label: 'Euro' },
  { code: 'GBP', symbol: '£',   label: 'British Pound' },
  { code: 'HKD', symbol: 'HK$', label: 'Hong Kong Dollar' },
  { code: 'AUD', symbol: 'A$',  label: 'Australian Dollar' },
  { code: 'TWD', symbol: 'NT$', label: 'Taiwan Dollar' },
];

export const CreateVaultModal = ({ visible, onClose }: Props) => {
  const themeColors = useThemeColors();
  const syncData = useFinanceStore(s => s.syncData);
  const setActiveWallet = useFinanceStore(s => s.setActiveWallet);

  const [name, setName] = useState('');
  const [type, setType] = useState<VaultType>('PERSONAL');
  const [currency, setCurrency] = useState('SGD');
  const [nameFocused, setNameFocused] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed || isSaving) return;
    setIsSaving(true);
    try {
      const resp = await financeApi.createAccount({
        name: trimmed,
        wallet_type: type,
        currency,
      });
      // Pull the full wallet list back so the Home carousel and every
      // group-scoped read sees the new row consistently; activeWalletId
      // is then set to the just-created id so the user sees it
      // foregrounded the moment the modal closes.
      await syncData();
      setActiveWallet(String(resp.data.id));
      setName('');
      setType('PERSONAL');
      onClose();
    } catch (err) {
      const detail = axios.isAxiosError(err) ? err.response?.data?.detail : null;
      Alert.alert(
        'Could not create wallet',
        typeof detail === 'string' ? detail : 'Please check your connection and try again.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const isValid = name.trim().length > 0 && !isSaving;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 justify-end bg-black/40">
        <View
          className="bg-surface-1 rounded-t-[40px] px-6 pt-6 pb-12"
          style={{ borderTopWidth: 1, borderTopColor: themeColors.hairline }}>
          <View className="flex-row justify-between items-center mb-8">
            <Text className="font-jakarta-bold text-text-high text-2xl">New Wallet</Text>
            <Pressable
              onPress={onClose}
              className="w-9 h-9 rounded-full bg-surface-2 border border-hairline justify-center items-center">
              <Ionicons name="close" size={18} color={themeColors.textMid} />
            </Pressable>
          </View>

          <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest mb-2">
            Wallet Name
          </Text>
          <TextInput
            className={`bg-surface-2 px-4 py-4 rounded-2xl text-text-high text-base font-jakarta-bold mb-6 border ${nameFocused ? 'border-accent-coral' : 'border-hairline'}`}
            placeholder="e.g. UOB Checking account"
            placeholderTextColor={themeColors.textDim}
            value={name}
            onChangeText={setName}
            onFocus={() => setNameFocused(true)}
            onBlur={() => setNameFocused(false)}
            autoFocus
          />

          <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest mb-2">
            Wallet Type
          </Text>
          <View className="flex-row flex-wrap gap-3 mb-6">
            {TYPES.map(t => {
              const selected = type === t.id;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => setType(t.id)}
                  className={`px-4 py-3 rounded-2xl flex-row items-center gap-2 border ${
                    selected ? 'bg-surface-3 border-accent-coral' : 'bg-surface-2 border-hairline'
                  }`}>
                  <Ionicons name={t.icon} size={16} color={t.tint} />
                  <Text
                    className={`font-jakarta-bold text-sm ${selected ? 'text-text-high' : 'text-text-mid'}`}>
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest mb-2">
            Currency
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingRight: 16 }}
            className="mb-10">
            {CURRENCIES.map((c) => {
              const selected = currency === c.code;
              return (
                <Pressable
                  key={c.code}
                  onPress={() => setCurrency(c.code)}
                  className={`px-4 py-3 rounded-2xl flex-row items-center gap-2 border ${
                    selected
                      ? 'bg-accent-coral border-accent-coral'
                      : 'bg-surface-2 border-hairline'
                  }`}
                  style={selected ? { boxShadow: '0 0 14px rgba(255, 107, 74, 0.4)' } : null}>
                  <Text
                    className={`font-jakarta-bold text-sm ${selected ? 'text-white' : 'text-text-mid'}`}>
                    {c.symbol}
                  </Text>
                  <Text
                    className={`font-jakarta-bold text-xs tracking-widest ${
                      selected ? 'text-white' : 'text-text-low'
                    }`}>
                    {c.code}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable
            onPress={handleSave}
            disabled={!isValid}
            style={isValid ? { boxShadow: '0 0 24px rgba(255, 107, 74, 0.45)' } : null}
            className={`py-4 rounded-full items-center justify-center active:scale-95 ${isValid ? 'bg-accent-coral' : 'bg-surface-3'}`}>
            {isSaving ? (
              <View className="flex-row items-center gap-2">
                <ActivityIndicator size="small" color="#fff" />
                <Text className="font-jakarta-bold text-white text-base">Adding…</Text>
              </View>
            ) : (
              <Text
                className={`font-jakarta-bold text-base ${isValid ? 'text-white' : 'text-text-low'}`}>
                Add Wallet
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
