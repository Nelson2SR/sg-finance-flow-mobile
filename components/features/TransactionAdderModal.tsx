import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFinanceStore } from '../../store/useFinanceStore';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function TransactionAdderModal({ visible, onClose }: Props) {
  const [amount, setAmount] = useState('0');
  const [type, setType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [category, setCategory] = useState('');
  const addTransaction = useFinanceStore(s => s.addTransaction);
  const activeWalletId = useFinanceStore(s => s.activeWalletId);

  const handleKeyPress = (val: string) => {
    if (val === 'backspace') {
      setAmount(prev => prev.length > 1 ? prev.slice(0, -1) : '0');
    } else if (val === '.') {
      if (!amount.includes('.')) setAmount(prev => prev + '.');
    } else {
      setAmount(prev => prev === '0' ? val : prev + val);
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
        merchant: 'Manual Entry'
      });
      onClose();
      // Reset form
      setAmount('0');
      setCategory('');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet">
      <SafeAreaView className="flex-1 bg-[#111116]">
        {/* Header */}
        <View className="flex-row justify-between items-center p-6 pb-2">
          <TouchableOpacity onPress={onClose} className="w-10 h-10 rounded-full bg-gray-900 justify-center items-center">
             <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
          <View className="flex-row bg-black rounded-lg p-1">
             <TouchableOpacity 
               onPress={() => setType('EXPENSE')}
               className={`px-4 py-1.5 rounded-md ${type === 'EXPENSE' ? 'bg-rose-500' : 'bg-transparent'}`}>
                <Text className={`font-semibold ${type === 'EXPENSE' ? 'text-white' : 'text-gray-500'}`}>Expense</Text>
             </TouchableOpacity>
             <TouchableOpacity 
               onPress={() => setType('INCOME')}
               className={`px-4 py-1.5 rounded-md ${type === 'INCOME' ? 'bg-emerald-500' : 'bg-transparent'}`}>
                <Text className={`font-semibold ${type === 'INCOME' ? 'text-white' : 'text-gray-500'}`}>Income</Text>
             </TouchableOpacity>
          </View>
        </View>

        {/* Display Amount */}
        <View className="items-center justify-center mt-12 mb-8">
           <Text className={`text-6xl font-light tracking-tighter ${type === 'EXPENSE' ? 'text-rose-400' : 'text-emerald-400'}`}>
              ${amount}
           </Text>
        </View>

        {/* Input Form Fields */}
        <View className="px-6 flex-1 gap-4">
           {/* Category Pseudo-Selector */}
           <View className="flex-row gap-4 mb-4">
              {['Food', 'Commute', 'Groceries'].map((cat) => (
                <TouchableOpacity 
                   key={cat}
                   onPress={() => setCategory(cat)}
                   className={`px-4 py-2 border rounded-full ${category === cat ? 'bg-brand-900 border-brand-500' : 'border-gray-800 bg-black'}`}>
                   <Text className={`${category === cat ? 'text-brand-300' : 'text-gray-500'} font-medium`}>{cat}</Text>
                </TouchableOpacity>
              ))}
           </View>
           
           <TouchableOpacity className="flex-row justify-between items-center bg-black p-4 rounded-2xl border border-gray-800">
             <View className="flex-row items-center gap-3">
                <Ionicons name="calendar-outline" size={20} color="#6366f1" />
                <Text className="font-jakarta text-white font-medium">Today</Text>
             </View>
             <Ionicons name="chevron-forward" size={18} color="#666" />
           </TouchableOpacity>

           <TouchableOpacity className="flex-row justify-between items-center bg-black p-4 rounded-2xl border border-gray-800">
             <View className="flex-row items-center gap-3">
                <Ionicons name="wallet-outline" size={20} color="#6366f1" />
                <Text className="font-jakarta text-white font-medium">Personal Account</Text>
             </View>
             <Ionicons name="chevron-forward" size={18} color="#666" />
           </TouchableOpacity>
        </View>

        {/* Custom Keypad Footer */}
        <View className="bg-black pt-4 pb-8 px-6 rounded-t-[40px] shadow-lg border-t border-gray-900">
          <View className="flex-row justify-between mb-4">
            <KeypadBtn label="1" onPress={() => handleKeyPress('1')} />
            <KeypadBtn label="2" onPress={() => handleKeyPress('2')} />
            <KeypadBtn label="3" onPress={() => handleKeyPress('3')} />
          </View>
          <View className="flex-row justify-between mb-4">
            <KeypadBtn label="4" onPress={() => handleKeyPress('4')} />
            <KeypadBtn label="5" onPress={() => handleKeyPress('5')} />
            <KeypadBtn label="6" onPress={() => handleKeyPress('6')} />
          </View>
          <View className="flex-row justify-between mb-4">
            <KeypadBtn label="7" onPress={() => handleKeyPress('7')} />
            <KeypadBtn label="8" onPress={() => handleKeyPress('8')} />
            <KeypadBtn label="9" onPress={() => handleKeyPress('9')} />
          </View>
          <View className="flex-row justify-between">
            <KeypadBtn label="." onPress={() => handleKeyPress('.')} />
            <KeypadBtn label="0" onPress={() => handleKeyPress('0')} />
            <KeypadBtn icon="backspace" onPress={() => handleKeyPress('backspace')} color="#F43F5E" />
          </View>
          
          <TouchableOpacity onPress={handleSave} className="bg-brand-600 mt-6 py-4 rounded-full items-center justify-center active:bg-brand-700">
             <Text className="font-jakarta text-white font-semibold text-lg">Save Transaction</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function KeypadBtn({ label, icon, color, onPress }: any) {
  return (
    <TouchableOpacity onPress={onPress} className="w-24 h-14 bg-[#111116] rounded-2xl justify-center items-center active:bg-gray-800">
      {icon ? (
         <Ionicons name={icon} size={24} color={color || '#fff'} />
      ) : (
         <Text className="font-jakarta text-white text-2xl font-light">{label}</Text>
      )}
    </TouchableOpacity>
  );
}
