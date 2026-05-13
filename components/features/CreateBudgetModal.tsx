import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, Modal, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFinanceStore } from '../../store/useFinanceStore';
import { useThemeColors } from '../../hooks/use-theme-colors';

interface Props {
  visible: boolean;
  onClose: () => void;
}

type Recurrence = 'DAILY' | 'MONTHLY' | 'ONCE';

export const CreateBudgetModal = ({ visible, onClose }: Props) => {
  const themeColors = useThemeColors();
  const addBudget = useFinanceStore(s => s.addBudget);
  const wallets = useFinanceStore(s => s.wallets);

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [recurrence, setRecurrence] = useState<Recurrence>('MONTHLY');
  const [walletMapping, setWalletMapping] = useState<string>('ALL');
  const [nameFocused, setNameFocused] = useState(false);

  const handleSave = () => {
    if (!name.trim() || !amount) return;
    addBudget({
      name,
      amount: parseFloat(amount),
      currency: 'SGD',
      wallets: walletMapping === 'ALL' ? 'ALL' : [walletMapping],
      recurrence,
    });
    setName('');
    setAmount('');
    setRecurrence('MONTHLY');
    setWalletMapping('ALL');
    onClose();
  };

  const isValid = name.trim().length > 0 && amount.length > 0;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 justify-end bg-black/40">
        <View
          className="bg-surface-1 rounded-t-[40px] px-6 pt-6 pb-12 h-[85%]"
          style={{ borderTopWidth: 1, borderTopColor: themeColors.hairline }}>
          <View className="flex-row justify-between items-center mb-6">
            <Text className="font-jakarta-bold text-text-high text-2xl">New Budget</Text>
            <Pressable
              onPress={onClose}
              className="w-9 h-9 rounded-full bg-surface-2 border border-hairline justify-center items-center">
              <Ionicons name="close" size={18} color={themeColors.textMid} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
            {/* Big amount input */}
            <View className="items-center mb-8 mt-4">
              <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest mb-2">
                Maximum Limit (SGD)
              </Text>
              <View
                className="flex-row items-center pb-2"
                style={{ borderBottomWidth: 2, borderBottomColor: themeColors.hairline }}>
                <Text className="font-jakarta-light text-text-low text-4xl mr-1">$</Text>
                <TextInput
                  className="text-text-high text-6xl font-jakarta-bold"
                  placeholder="0"
                  placeholderTextColor={themeColors.textDim}
                  keyboardType="decimal-pad"
                  value={amount}
                  onChangeText={setAmount}
                  autoFocus
                />
              </View>
            </View>

            <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest mb-2">
              Category Binding
            </Text>
            <TextInput
              className={`bg-surface-2 px-4 py-4 rounded-2xl text-text-high text-base font-jakarta-bold mb-6 border ${nameFocused ? 'border-accent-coral' : 'border-hairline'}`}
              placeholder="e.g. Dining Out"
              placeholderTextColor={themeColors.textDim}
              value={name}
              onChangeText={setName}
              onFocus={() => setNameFocused(true)}
              onBlur={() => setNameFocused(false)}
            />

            <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest mb-2">
              Cycle Horizon
            </Text>
            <View className="flex-row bg-surface-2 border border-hairline p-1 rounded-2xl mb-6">
              {(['DAILY', 'MONTHLY', 'ONCE'] as Recurrence[]).map(rec => {
                const selected = recurrence === rec;
                return (
                  <Pressable
                    key={rec}
                    onPress={() => setRecurrence(rec)}
                    className={`flex-1 items-center py-2.5 rounded-xl ${selected ? 'bg-accent-coral' : ''}`}>
                    <Text
                      className={`font-jakarta-bold text-xs ${selected ? 'text-white' : 'text-text-mid'}`}>
                      {rec}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest mb-2">
              Network Bounds (Wallets)
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-8">
              <Pressable
                onPress={() => setWalletMapping('ALL')}
                className={`px-4 py-3 mr-3 rounded-2xl border ${
                  walletMapping === 'ALL'
                    ? 'bg-surface-3 border-accent-coral'
                    : 'bg-surface-2 border-hairline'
                }`}>
                <Text
                  className={`font-jakarta-bold text-sm ${walletMapping === 'ALL' ? 'text-accent-coral' : 'text-text-mid'}`}>
                  Globally Active (All)
                </Text>
              </Pressable>

              {wallets.map(w => {
                const selected = walletMapping === w.id;
                return (
                  <Pressable
                    key={w.id}
                    onPress={() => setWalletMapping(w.id)}
                    className={`px-4 py-3 mr-3 rounded-2xl border ${
                      selected ? 'bg-surface-3 border-accent-coral' : 'bg-surface-2 border-hairline'
                    }`}>
                    <Text
                      className={`font-jakarta-bold text-sm ${selected ? 'text-text-high' : 'text-text-mid'}`}>
                      {w.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Pressable
              onPress={handleSave}
              disabled={!isValid}
              style={isValid ? { boxShadow: '0 0 24px rgba(255, 107, 74, 0.45)' } : null}
              className={`py-4 rounded-full items-center active:scale-95 ${isValid ? 'bg-accent-coral' : 'bg-surface-3'}`}>
              <Text
                className={`font-jakarta-bold text-base ${isValid ? 'text-white' : 'text-text-low'}`}>
                Activate Routine
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
