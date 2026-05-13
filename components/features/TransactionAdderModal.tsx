import React, { useState } from 'react';
import { View, Text, Pressable, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFinanceStore } from '../../store/useFinanceStore';
import { useThemeColors } from '../../hooks/use-theme-colors';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function TransactionAdderModal({ visible, onClose }: Props) {
  const themeColors = useThemeColors();
  const [amount, setAmount] = useState('0');
  const [type, setType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [category, setCategory] = useState('');
  const addTransaction = useFinanceStore(s => s.addTransaction);
  const activeWalletId = useFinanceStore(s => s.activeWalletId);

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
    if (num > 0) {
      addTransaction({
        walletId: activeWalletId,
        type,
        amount: num,
        category: category || 'General',
        merchant: 'Manual Entry',
      });
      onClose();
      setAmount('0');
      setCategory('');
    }
  };

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

        {/* Input Form Fields */}
        <View className="px-6 flex-1 gap-4">
          {/* Category chips */}
          <View className="flex-row gap-3 mb-2">
            {['Food', 'Commute', 'Groceries'].map(cat => {
              const selected = category === cat;
              return (
                <Pressable
                  key={cat}
                  onPress={() => setCategory(cat)}
                  className={`px-4 py-2 border rounded-full ${
                    selected
                      ? 'bg-accent-coral border-accent-coral'
                      : 'bg-surface-2 border-hairline'
                  }`}>
                  <Text
                    className={`font-jakarta-bold text-xs ${
                      selected ? 'text-white' : 'text-text-mid'
                    }`}>
                    {cat}
                  </Text>
                </Pressable>
              );
            })}
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
