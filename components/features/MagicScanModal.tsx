import React, { useState } from 'react';
import { View, Text, Modal, Pressable, ActivityIndicator, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { ScanResponse, ScannedTransaction } from '../../services/geminiService';
import { useThemeColors } from '../../hooks/use-theme-colors';

interface MagicScanModalProps {
  visible: boolean;
  onClose: () => void;
  scanData: ScanResponse | null;
  loading: boolean;
  onConfirm: (data: ScannedTransaction[]) => void;
}

const getTransactionIcon = (category: string | undefined) => {
  const cat = category?.toLowerCase() || 'other';
  switch (cat) {
    case 'dining':
      return { name: 'restaurant', tint: '#FFB547' };
    case 'transport':
      return { name: 'car', tint: '#5BE0B0' };
    case 'shopping':
      return { name: 'cart', tint: '#A78BFA' };
    case 'salary':
      return { name: 'cash', tint: '#5BE0B0' };
    default:
      return { name: 'card', tint: '#FF6B4A' };
  }
};

export const MagicScanReviewModal = ({
  visible,
  onClose,
  scanData,
  loading,
  onConfirm,
}: MagicScanModalProps) => {
  const themeColors = useThemeColors();
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);

  React.useEffect(() => {
    if (scanData?.transactions) {
      setSelectedIndices(scanData.transactions.map((_, i) => i));
    }
  }, [scanData]);

  const toggleSelect = (index: number) => {
    setSelectedIndices(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index],
    );
  };

  const handleConfirm = () => {
    if (scanData) {
      const selected = scanData.transactions.filter((_, i) => selectedIndices.includes(i));
      onConfirm(selected);
    }
  };

  const allSelected = scanData ? selectedIndices.length === scanData.transactions.length : false;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View className="flex-1 justify-end">
        <BlurView intensity={90} tint="dark" className="absolute inset-0" />

        <View
          className="bg-surface-1 h-[85%] rounded-t-[40px] px-6 pt-8 pb-12"
          style={{ borderTopWidth: 1, borderTopColor: themeColors.hairline }}>
          <View className="flex-row justify-between items-center mb-8">
            <View>
              <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest mb-1">
                {scanData?.sourceType === 'ESTATEMENT' ? 'E-Statement Analysis' : 'Receipt Analysis'}
              </Text>
              <Text className="font-jakarta-bold text-text-high text-2xl">Review Entries</Text>
            </View>
            <Pressable
              onPress={onClose}
              className="w-10 h-10 rounded-full bg-surface-2 border border-hairline justify-center items-center">
              <Ionicons name="close" size={20} color="#FF6B4A" />
            </Pressable>
          </View>

          {loading ? (
            <View className="flex-1 justify-center items-center">
              <ActivityIndicator size="large" color="#FF6B4A" />
              <View className="mt-8 items-center">
                <Text className="font-jakarta-bold text-text-high text-base">
                  Parsing with Gemini AI
                </Text>
                <Text className="font-jakarta-bold text-text-low text-[10px] mt-1 uppercase tracking-widest">
                  Applying SG Bank Extractors...
                </Text>
              </View>
            </View>
          ) : scanData ? (
            <View className="flex-1">
              <View className="flex-row justify-between items-center mb-5">
                <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest">
                  {scanData.transactions.length} Transactions Found
                </Text>
                <Pressable
                  onPress={() =>
                    setSelectedIndices(
                      allSelected ? [] : scanData.transactions.map((_, i) => i),
                    )
                  }>
                  <Text className="font-jakarta-bold text-accent-coral text-xs">Toggle All</Text>
                </Pressable>
              </View>

              <FlatList
                data={scanData.transactions}
                keyExtractor={(_, i) => i.toString()}
                showsVerticalScrollIndicator={false}
                renderItem={({ item, index }) => {
                  const isSelected = selectedIndices.includes(index);
                  const icon = getTransactionIcon(item.category);
                  return (
                    <Pressable
                      onPress={() => toggleSelect(index)}
                      className={`mb-3 flex-row items-center p-4 rounded-2xl border ${
                        isSelected
                          ? 'bg-surface-2 border-accent-coral'
                          : 'bg-surface-2/60 border-hairline opacity-60'
                      }`}>
                      <View
                        className={`w-11 h-11 rounded-2xl justify-center items-center mr-3 ${isSelected ? 'bg-accent-coral' : 'bg-surface-3'}`}>
                        <Ionicons
                          name={isSelected ? (icon.name as any) : 'ellipse-outline'}
                          size={18}
                          color={isSelected ? '#fff' : themeColors.textLow}
                        />
                      </View>

                      <View className="flex-1">
                        <Text
                          className={`font-jakarta-bold text-sm ${isSelected ? 'text-text-high' : 'text-text-low'}`}>
                          {item.merchant}
                        </Text>
                        <View className="flex-row gap-2 items-center mt-1">
                          <View className="bg-surface-3 border border-hairline px-2 py-0.5 rounded-md">
                            <Text className="font-jakarta-bold text-[8px] uppercase tracking-widest text-text-mid">
                              {item.category}
                            </Text>
                          </View>
                          <Text className="font-jakarta text-text-low text-[10px]">{item.date}</Text>
                        </View>
                      </View>

                      <Text
                        className={`font-jakarta-bold text-sm ${
                          item.type === 'INCOME'
                            ? 'text-accent-mint'
                            : isSelected
                              ? 'text-text-high'
                              : 'text-text-low'
                        }`}>
                        {item.type === 'INCOME' ? '+' : '-'}
                        {item.currency} {item.amount.toFixed(2)}
                      </Text>
                    </Pressable>
                  );
                }}
              />

              <View
                className="pt-5"
                style={{ borderTopWidth: 1, borderTopColor: themeColors.hairline }}>
                <Pressable
                  onPress={handleConfirm}
                  disabled={selectedIndices.length === 0}
                  style={
                    selectedIndices.length > 0
                      ? { boxShadow: '0 0 24px rgba(255, 107, 74, 0.45)' }
                      : null
                  }
                  className={`bg-accent-coral py-4 rounded-full items-center ${selectedIndices.length === 0 ? 'opacity-50' : ''}`}>
                  <Text className="font-jakarta-bold text-white tracking-widest uppercase text-xs">
                    Commit {selectedIndices.length} to Vault
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View className="flex-1 justify-center items-center">
              <Ionicons name="alert-circle" size={56} color="#FF6B4A" />
              <Text className="font-jakarta-bold text-text-low mt-6 tracking-widest uppercase text-xs">
                Failed to extract data
              </Text>
              <Pressable onPress={onClose} className="mt-6">
                <Text className="font-jakarta-bold text-accent-coral text-sm">
                  Return to Manual Entry
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};
