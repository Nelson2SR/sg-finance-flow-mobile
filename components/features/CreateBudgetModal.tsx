import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Modal, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFinanceStore } from '../../store/useFinanceStore';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export const CreateBudgetModal = ({ visible, onClose }: Props) => {
  const addBudget = useFinanceStore(s => s.addBudget);
  const wallets = useFinanceStore(s => s.wallets);
  
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [recurrence, setRecurrence] = useState<'DAILY' | 'MONTHLY' | 'ONCE'>('MONTHLY');
  const [walletMapping, setWalletMapping] = useState<string>('ALL'); // 'ALL' or walletIds

  const handleSave = () => {
    if (!name.trim() || !amount) return;
    
    addBudget({
        name: name,
        amount: parseFloat(amount),
        currency: 'SGD',
        wallets: walletMapping === 'ALL' ? 'ALL' : [walletMapping],
        recurrence: recurrence
    });
    
    setName('');
    setAmount('');
    setRecurrence('MONTHLY');
    setWalletMapping('ALL');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 justify-end bg-black/40 dark:bg-black/80"
      >
        <View className="bg-white dark:bg-[#0a0a0f] rounded-t-[40px] px-6 pt-6 pb-12 border-t border-gray-200 dark:border-gray-900 shadow-2xl h-[85%]">
          <View className="flex-row justify-between items-center mb-6">
             <Text className="font-jakarta text-gray-900 dark:text-white text-2xl font-jakarta-bold">New Budget</Text>
             <TouchableOpacity onPress={onClose} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-900 justify-center items-center">
               <Ionicons name="close" size={20} className="color-gray-500 dark:color-gray-400" />
             </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
             {/* Limit Frame */}
             <View className="items-center mb-8 mt-4">
                 <Text className="font-jakarta text-gray-400 dark:text-gray-500 font-jakarta-bold mb-2 uppercase tracking-widest text-xs">Maximum Limit (SGD)</Text>
                 <View className="flex-row items-center border-b-2 border-gray-200 dark:border-gray-800 pb-2">
                     <Text className="font-jakarta text-4xl text-gray-400 font-light mr-1">$</Text>
                     <TextInput 
                        className="text-black dark:text-white text-6xl font-jakarta-bold"
                        placeholder="0"
                        placeholderTextColor="#9ca3af"
                        keyboardType="decimal-pad"
                        value={amount}
                        onChangeText={setAmount}
                        autoFocus
                     />
                 </View>
             </View>

             <Text className="font-jakarta text-xs font-jakarta-bold uppercase tracking-widest text-gray-500 mb-2">Category Binding</Text>
             <TextInput 
                className="bg-gray-50 dark:bg-[#111116] border border-gray-200 dark:border-gray-900 text-gray-900 dark:text-white text-lg font-jakarta-bold rounded-2xl p-4 mb-6"
                placeholder="e.g. Dining Out"
                placeholderTextColor="#9ca3af"
                value={name}
                onChangeText={setName}
             />

             {/* Recurrence Model */}
             <Text className="font-jakarta text-xs font-jakarta-bold uppercase tracking-widest text-gray-500 mb-2">Cycle Horizon</Text>
             <View className="flex-row bg-gray-100 dark:bg-[#111116] p-1 rounded-2xl mb-6">
                {['DAILY', 'MONTHLY', 'ONCE'].map(rec => (
                   <TouchableOpacity 
                      key={rec} 
                      onPress={() => setRecurrence(rec as any)}
                      className={`flex-1 items-center py-3 rounded-xl ${recurrence === rec ? 'bg-white dark:bg-gray-800 shadow-sm' : ''}`}
                   >
                      <Text className={`font-jakarta-bold text-xs ${recurrence === rec ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>{rec}</Text>
                   </TouchableOpacity>
                ))}
             </View>

             {/* Wallet Targeting Matrix */}
             <Text className="font-jakarta text-xs font-jakarta-bold uppercase tracking-widest text-gray-500 mb-2">Network Bounds (Wallets)</Text>
             <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-8">
                 <TouchableOpacity 
                    onPress={() => setWalletMapping('ALL')}
                    className={`px-4 py-3 mr-3 rounded-2xl border ${walletMapping === 'ALL' ? 'bg-brand-50 border-brand-500 dark:bg-brand-900/30' : 'bg-transparent border-gray-200 dark:border-gray-800'}`}
                 >
                    <Text className={`font-jakarta-bold ${walletMapping === 'ALL' ? 'text-brand-600 dark:text-brand-400' : 'text-gray-500'}`}>Globally Active (All)</Text>
                 </TouchableOpacity>

                 {wallets.map(w => (
                    <TouchableOpacity 
                       key={w.id}
                       onPress={() => setWalletMapping(w.id)}
                       className={`px-4 py-3 mr-3 rounded-2xl border ${walletMapping === w.id ? 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700' : 'bg-transparent border-gray-100 dark:border-gray-900'}`}
                    >
                       <Text className={`font-jakarta-bold ${walletMapping === w.id ? 'text-gray-900 dark:text-white' : 'text-gray-500'}`}>{w.name}</Text>
                    </TouchableOpacity>
                 ))}
             </ScrollView>

             <TouchableOpacity 
               onPress={handleSave}
               className={`py-4 rounded-full items-center active:scale-95 ${name.trim() && amount ? 'bg-brand-500 shadow-xl shadow-brand-500/30' : 'bg-gray-200 dark:bg-gray-900'}`}
             >
                <Text className={`font-jakarta-bold text-lg ${name.trim() && amount ? 'text-white' : 'text-gray-400 dark:text-gray-600'}`}>Activate Routine</Text>
             </TouchableOpacity>

          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
