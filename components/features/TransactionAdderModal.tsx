import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFinanceStore } from '../../store/useFinanceStore';
import { useCategoriesStore } from '../../store/useCategoriesStore';
import { useThemeColors } from '../../hooks/use-theme-colors';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function TransactionAdderModal({ visible, onClose }: Props) {
  const themeColors = useThemeColors();
  const [amount, setAmount] = useState('0');
  const [type, setType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  // Selected category is keyed by ID so a rename in Vault Config keeps
  // the selection valid until save (we persist the current name).
  const [categoryId, setCategoryId] = useState<string | null>(null);
  // Multi-select label IDs — 0..N per transaction.
  const [labelIds, setLabelIds] = useState<string[]>([]);

  const addTransaction = useFinanceStore(s => s.addTransaction);
  const activeWalletId = useFinanceStore(s => s.activeWalletId);

  // Vault Config is the source of truth for both pickers.
  const allCategories = useCategoriesStore(s => s.categories);
  const allLabels = useCategoriesStore(s => s.labels);
  const kindCategories = useMemo(
    () => allCategories.filter(c => c.kind === (type === 'EXPENSE' ? 'expense' : 'income')),
    [allCategories, type],
  );

  // Auto-select the first category whenever the modal opens or the
  // Expense/Income toggle flips — and clear an invalid prior selection.
  useEffect(() => {
    if (!visible) return;
    const stillValid = kindCategories.some(c => c.id === categoryId);
    if (!stillValid) {
      setCategoryId(kindCategories[0]?.id ?? null);
    }
  }, [visible, type, kindCategories, categoryId]);

  const handleKeyPress = (val: string) => {
    if (val === 'backspace') {
      setAmount(prev => (prev.length > 1 ? prev.slice(0, -1) : '0'));
    } else if (val === '.') {
      if (!amount.includes('.')) setAmount(prev => prev + '.');
    } else {
      setAmount(prev => (prev === '0' ? val : prev + val));
    }
  };

  const handleSave = () => {
    const num = parseFloat(amount);
    if (num <= 0) return;
    // Resolve the picker IDs to their current display names just before
    // saving so any in-flight rename in Vault Config is captured.
    const categoryName =
      allCategories.find(c => c.id === categoryId)?.name ?? 'Uncategorized';
    const labelNames = labelIds
      .map(id => allLabels.find(l => l.id === id)?.name)
      .filter((n): n is string => !!n);

    addTransaction({
      walletId: activeWalletId,
      type,
      amount: num,
      category: categoryName,
      merchant: 'Manual Entry',
      labels: labelNames.length > 0 ? labelNames : undefined,
    });
    onClose();
    setAmount('0');
    setLabelIds([]);
    // categoryId is auto-reseeded on next open via the useEffect above.
  };

  const toggleLabel = (id: string) =>
    setLabelIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  const isExpense = type === 'EXPENSE';

  // Reused row style for "Today" + "Personal Account".
  const rowClass = 'flex-row justify-between items-center bg-surface-2 p-4 rounded-2xl border border-hairline';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet">
      <SafeAreaView className="flex-1 bg-surface-0">
        {/* Header */}
        <View className="flex-row justify-between items-center px-6 pt-4 pb-2">
          <Pressable
            onPress={onClose}
            className="w-10 h-10 rounded-full bg-surface-2 border border-hairline justify-center items-center">
            <Ionicons name="close" size={20} color={themeColors.textMid} />
          </Pressable>
          <View className="flex-row bg-surface-2 border border-hairline rounded-full p-1">
            <Pressable
              onPress={() => setType('EXPENSE')}
              className={`px-4 py-1.5 rounded-full ${isExpense ? 'bg-accent-rose' : 'bg-transparent'}`}>
              <Text className={`font-jakarta-bold text-sm ${isExpense ? 'text-white' : 'text-text-low'}`}>
                Expense
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setType('INCOME')}
              className={`px-4 py-1.5 rounded-full ${!isExpense ? 'bg-accent-mint' : 'bg-transparent'}`}>
              <Text className={`font-jakarta-bold text-sm ${!isExpense ? 'text-white' : 'text-text-low'}`}>
                Income
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Display Amount */}
        <View className="items-center justify-center mt-10 mb-8">
          <Text
            className="font-jakarta-light tracking-tighter text-6xl"
            style={{ color: isExpense ? '#FF5C7C' : '#5BE0B0' }}>
            ${amount}
          </Text>
        </View>

        {/* Input form fields — categories + labels are sourced from
            Settings → Vault Config so the user's own taxonomy drives
            the manual-entry flow, not a hardcoded enum. */}
        <View className="px-6 flex-1 gap-4">
          {/* Category picker — horizontal scroll, icon + name, tinted
              with the category's configured color. */}
          <View>
            <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest mb-2 px-1">
              Category
            </Text>
            {kindCategories.length === 0 ? (
              <View className="px-1">
                <Text className="font-jakarta text-text-low text-xs leading-relaxed">
                  No {type === 'EXPENSE' ? 'expense' : 'income'} categories yet. Add one in Settings → Vault Config.
                </Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}>
                {kindCategories.map(cat => {
                  const selected = cat.id === categoryId;
                  return (
                    <Pressable
                      key={cat.id}
                      onPress={() => setCategoryId(cat.id)}
                      className="px-3 py-2 rounded-full flex-row items-center gap-2"
                      style={{
                        backgroundColor: selected ? cat.color : themeColors.surface2,
                        borderWidth: 1,
                        borderColor: selected ? cat.color : themeColors.hairline,
                        boxShadow: selected ? `0 0 14px ${cat.color}55` : undefined,
                      }}>
                      <Ionicons
                        name={cat.icon}
                        size={14}
                        color={selected ? '#fff' : cat.color}
                      />
                      <Text
                        className={`font-jakarta-bold text-xs ${
                          selected ? 'text-white' : 'text-text-mid'
                        }`}>
                        {cat.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>

          {/* Labels multi-select — 0..N chips. Mint accent because the
              rest of the app already uses mint for labels (scan modal,
              Activity rows). */}
          <View>
            <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest mb-2 px-1">
              Labels{' '}
              {labelIds.length > 0 ? (
                <Text className="text-accent-mint">· {labelIds.length} selected</Text>
              ) : null}
            </Text>
            {allLabels.length === 0 ? (
              <View className="px-1">
                <Text className="font-jakarta text-text-low text-xs leading-relaxed">
                  No labels yet. Add some in Settings → Vault Config.
                </Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}>
                {allLabels.map(lbl => {
                  const selected = labelIds.includes(lbl.id);
                  return (
                    <Pressable
                      key={lbl.id}
                      onPress={() => toggleLabel(lbl.id)}
                      className="px-3 py-2 rounded-full flex-row items-center gap-1.5"
                      style={{
                        backgroundColor: selected ? '#5BE0B0' : themeColors.surface2,
                        borderWidth: 1,
                        borderColor: selected ? '#5BE0B0' : themeColors.hairline,
                      }}>
                      <Ionicons
                        name={selected ? 'checkmark' : 'pricetag-outline'}
                        size={12}
                        color={selected ? '#fff' : themeColors.textMid}
                      />
                      <Text
                        className={`font-jakarta-bold text-xs ${
                          selected ? 'text-white' : 'text-text-mid'
                        }`}>
                        {lbl.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>

          <Pressable className={rowClass}>
            <View className="flex-row items-center gap-3">
              <Ionicons name="calendar-outline" size={20} color="#FF6B4A" />
              <Text className="font-jakarta-bold text-text-high text-sm">Today</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={themeColors.textLow} />
          </Pressable>

          <Pressable className={rowClass}>
            <View className="flex-row items-center gap-3">
              <Ionicons name="wallet-outline" size={20} color="#FF6B4A" />
              <Text className="font-jakarta-bold text-text-high text-sm">Personal Account</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={themeColors.textLow} />
          </Pressable>
        </View>

        {/* Custom Keypad Footer */}
        <View
          className="bg-surface-1 pt-4 pb-8 px-6 rounded-t-[40px]"
          style={{ borderTopWidth: 1, borderTopColor: themeColors.hairline }}>
          <View className="flex-row justify-between mb-3">
            <KeypadBtn label="1" onPress={() => handleKeyPress('1')} themeColors={themeColors} />
            <KeypadBtn label="2" onPress={() => handleKeyPress('2')} themeColors={themeColors} />
            <KeypadBtn label="3" onPress={() => handleKeyPress('3')} themeColors={themeColors} />
          </View>
          <View className="flex-row justify-between mb-3">
            <KeypadBtn label="4" onPress={() => handleKeyPress('4')} themeColors={themeColors} />
            <KeypadBtn label="5" onPress={() => handleKeyPress('5')} themeColors={themeColors} />
            <KeypadBtn label="6" onPress={() => handleKeyPress('6')} themeColors={themeColors} />
          </View>
          <View className="flex-row justify-between mb-3">
            <KeypadBtn label="7" onPress={() => handleKeyPress('7')} themeColors={themeColors} />
            <KeypadBtn label="8" onPress={() => handleKeyPress('8')} themeColors={themeColors} />
            <KeypadBtn label="9" onPress={() => handleKeyPress('9')} themeColors={themeColors} />
          </View>
          <View className="flex-row justify-between">
            <KeypadBtn label="." onPress={() => handleKeyPress('.')} themeColors={themeColors} />
            <KeypadBtn label="0" onPress={() => handleKeyPress('0')} themeColors={themeColors} />
            <KeypadBtn
              icon="backspace"
              onPress={() => handleKeyPress('backspace')}
              color="#FF5C7C"
              themeColors={themeColors}
            />
          </View>

          <Pressable
            onPress={handleSave}
            className="bg-accent-coral mt-6 py-4 rounded-full items-center justify-center active:scale-95"
            style={{ boxShadow: '0 0 24px rgba(255, 107, 74, 0.45)' }}>
            <Text className="font-jakarta-bold text-white text-base">Save Transaction</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

interface KeypadBtnProps {
  label?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  color?: string;
  onPress: () => void;
  themeColors: ReturnType<typeof useThemeColors>;
}

function KeypadBtn({ label, icon, color, onPress, themeColors }: KeypadBtnProps) {
  return (
    <Pressable
      onPress={onPress}
      className="w-24 h-14 bg-surface-2 border border-hairline rounded-2xl justify-center items-center active:bg-surface-3">
      {icon ? (
        <Ionicons name={icon} size={22} color={color || themeColors.textHigh} />
      ) : (
        <Text className="font-jakarta-light text-text-high text-2xl">{label}</Text>
      )}
    </Pressable>
  );
}
