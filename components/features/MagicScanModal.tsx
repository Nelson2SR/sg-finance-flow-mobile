import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, ActivityIndicator, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { ScanResponse, ScannedTransaction } from '../../services/geminiService';

interface MagicScanModalProps {
  visible: boolean;
  onClose: () => void;
  scanData: ScanResponse | null;
  loading: boolean;
  onConfirm: (data: ScannedTransaction[]) => void;
}

export const MagicScanReviewModal = ({ visible, onClose, scanData, loading, onConfirm }: MagicScanModalProps) => {
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);

  // Auto-select all on data load
  React.useEffect(() => {
    if (scanData?.transactions) {
      setSelectedIndices(scanData.transactions.map((_, i) => i));
    }
  }, [scanData]);

  const toggleSelect = (index: number) => {
    if (selectedIndices.includes(index)) {
      setSelectedIndices(selectedIndices.filter(i => i !== index));
    } else {
      setSelectedIndices([...selectedIndices, index]);
    }
  };

  const handleConfirm = () => {
    if (scanData) {
      const selected = scanData.transactions.filter((_, i) => selectedIndices.includes(i));
      onConfirm(selected);
    }
  };

  const getTransactionIcon = (category: string | undefined) => {
    const cat = category?.toLowerCase() || 'other';
    switch(cat) {
       case 'dining': return { name: 'restaurant', color: '#ea580c' };
       case 'transport': return { name: 'car', color: '#2563eb' };
       case 'shopping': return { name: 'cart', color: '#7c3aed' };
       case 'salary': return { name: 'cash', color: '#10b981' };
       default: return { name: 'card', color: '#6366f1' };
    }
  };


  return (
    <Modal visible={visible} transparent animationType="slide">
      <View className="flex-1 justify-end">
        <BlurView intensity={90} tint="dark" className="absolute inset-0" />
        
        <View className="bg-white dark:bg-[#0a0a0f] h-[85%] rounded-t-[40px] px-6 pt-10 pb-12 border-t border-white/20 shadow-2xl">
          <View className="flex-row justify-between items-center mb-8">
            <View>
              <Text className="font-jakarta text-gray-400 font-jakarta-bold text-[10px] uppercase tracking-widest mb-1">
                {scanData?.sourceType === 'ESTATEMENT' ? 'E-Statement Analysis' : 'Receipt Analysis'}
              </Text>
              <Text className="font-jakarta text-gray-900 dark:text-white text-2xl font-jakarta-bold">Review Entries</Text>
            </View>
            <TouchableOpacity onPress={onClose} className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-900 justify-center items-center">
              <Ionicons name="close" size={24} color="#E0533D" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View className="flex-1 justify-center items-center">
              <ActivityIndicator size="large" color="#E0533D" />
              <View className="mt-8 items-center">
                <Text className="font-jakarta text-white font-jakarta-bold text-lg">Parsing with Gemini AI</Text>
                <Text className="font-jakarta text-gray-400 text-xs mt-1 uppercase tracking-widest">Applying SG Bank Extractors...</Text>
              </View>
            </View>
          ) : scanData ? (
            <View className="flex-1">
              <View className="flex-row justify-between items-center mb-6">
                <Text className="font-jakarta text-gray-500 dark:text-gray-400 font-jakarta-bold text-xs uppercase tracking-widest">
                  {scanData.transactions.length} Transactions Found
                </Text>
                <TouchableOpacity onPress={() => setSelectedIndices(selectedIndices.length === scanData.transactions.length ? [] : scanData.transactions.map((_, i) => i))}>
                  <Text className="font-jakarta text-brand-500 font-jakarta-bold text-xs">Toggle All</Text>
                </TouchableOpacity>
              </View>

              <FlatList
                data={scanData.transactions}
                keyExtractor={(_, i) => i.toString()}
                showsVerticalScrollIndicator={false}
                renderItem={({ item, index }) => {
                  const isSelected = selectedIndices.includes(index);
                  const icon = getTransactionIcon(item.category);
                  return (
                    <TouchableOpacity 
                      onPress={() => toggleSelect(index)}
                      activeOpacity={0.7}
                      className={`mb-4 flex-row items-center p-4 rounded-[20px] border ${isSelected ? 'bg-brand-500/10 border-brand-500/30' : 'bg-gray-50 dark:bg-white/5 border-white/5 opacity-60'}`}
                    >
                      <View className={`w-12 h-12 rounded-full justify-center items-center mr-4 ${isSelected ? 'bg-brand-500' : 'bg-gray-200 dark:bg-gray-800'}`}>
                        <Ionicons name={isSelected ? (icon.name as any) : 'ellipse-outline'} size={20} color={isSelected ? '#fff' : '#4b5563'} />
                      </View>
                      
                      <View className="flex-1">
                        <Text className={`font-jakarta-bold text-base ${isSelected ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>{item.merchant}</Text>
                        <View className="flex-row gap-2 items-center mt-1">
                           <View className="bg-white/50 dark:bg-white/10 px-2 py-0.5 rounded-md">
                              <Text className="font-jakarta text-[8px] font-jakarta-bold uppercase tracking-widest text-gray-500">{item.category}</Text>
                           </View>
                           <Text className="font-jakarta text-[10px] text-gray-400">{item.date}</Text>
                        </View>
                      </View>

                      <View className="items-end">
                        <Text className={`font-jakarta-bold text-lg ${item.type === 'INCOME' ? 'text-emerald-500' : isSelected ? 'text-gray-900 dark:text-white' : 'text-gray-500'}`}>
                          {item.type === 'INCOME' ? '+' : '-'}{item.currency} {item.amount.toFixed(2)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />

              <View className="pt-6 border-t border-white/10">
                <TouchableOpacity 
                  onPress={handleConfirm}
                  disabled={selectedIndices.length === 0}
                  className={`bg-brand-500 py-5 rounded-[24px] items-center shadow-2xl shadow-brand-500/40 ${selectedIndices.length === 0 ? 'opacity-50' : ''}`}
                >
                  <Text className="font-jakarta text-white font-jakarta-bold tracking-widest uppercase">
                    Commit {selectedIndices.length} to Vault
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View className="flex-1 justify-center items-center">
              <Ionicons name="alert-circle" size={60} color="#E0533D" />
              <Text className="font-jakarta text-gray-400 font-jakarta-bold mt-6 tracking-widest uppercase text-xs">Failed to extract data</Text>
              <TouchableOpacity onPress={onClose} className="mt-8">
                <Text className="font-jakarta text-brand-500 font-jakarta-bold">Return to Manual Entry</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};
