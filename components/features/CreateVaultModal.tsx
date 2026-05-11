import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Modal, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFinanceStore } from '../../store/useFinanceStore';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export const CreateVaultModal = ({ visible, onClose }: Props) => {
  const addWallet = useFinanceStore(s => s.addWallet);
  
  const [name, setName] = useState('');
  const [type, setType] = useState<'PERSONAL' | 'TRIP' | 'FAMILY' | 'CRYPTO'>('PERSONAL');
  const [currency, setCurrency] = useState('SGD');

  const handleSave = () => {
    if (!name.trim()) return;
    
    addWallet({
        name: name,
        type: type,
        currency: currency,
        balance: 0
    });
    
    setName('');
    setType('PERSONAL');
    onClose();
  };

  const types: {id: typeof type, label: string, icon: any, color: string}[] = [
      { id: 'PERSONAL', label: 'Bank', icon: 'card', color: 'text-brand-500' },
      { id: 'TRIP', label: 'Trip', icon: 'airplane', color: 'text-rose-500' },
      { id: 'FAMILY', label: 'Family', icon: 'people', color: 'text-emerald-500' },
      { id: 'CRYPTO', label: 'Crypto', icon: 'logo-bitcoin', color: 'text-amber-500' }
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 justify-end bg-black/40 dark:bg-black/80"
      >
        <View className="bg-white dark:bg-[#0a0a0f] rounded-t-[40px] px-6 pt-6 pb-12 border-t border-gray-200 dark:border-gray-900 shadow-2xl">
          <View className="flex-row justify-between items-center mb-8">
             <Text className="font-jakarta text-gray-900 dark:text-white text-2xl font-jakarta-bold">New Vault</Text>
             <TouchableOpacity onPress={onClose} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-900 justify-center items-center">
               <Ionicons name="close" size={20} className="color-gray-500 dark:color-gray-400" />
             </TouchableOpacity>
          </View>

          {/* Form Field */}
          <Text className="font-jakarta text-xs font-jakarta-bold uppercase tracking-widest text-gray-500 mb-2">Vault Name</Text>
          <TextInput 
             className="bg-gray-50 dark:bg-[#111116] border border-gray-200 dark:border-gray-900 text-gray-900 dark:text-white text-lg font-jakarta-bold rounded-2xl p-4 mb-6"
             placeholder="e.g. UOB Checking account"
             placeholderTextColor="#9ca3af"
             value={name}
             onChangeText={setName}
             autoFocus
          />

          <Text className="font-jakarta text-xs font-jakarta-bold uppercase tracking-widest text-gray-500 mb-2">Vault Type Context</Text>
          <View className="flex-row flex-wrap gap-3 mb-10">
              {types.map(t => (
                  <TouchableOpacity 
                     key={t.id} 
                     onPress={() => setType(t.id)}
                     className={`px-4 py-3 rounded-2xl flex-row items-center gap-2 border ${type === t.id ? 'bg-gray-100 dark:bg-gray-900 border-gray-300 dark:border-gray-700' : 'bg-transparent border-gray-200 dark:border-gray-900'}`}
                  >
                     <Ionicons name={t.icon} size={18} className={t.color} />
                     <Text className={`font-jakarta-bold ${type === t.id ? 'text-gray-900 dark:text-white' : 'text-gray-500'}`}>{t.label}</Text>
                  </TouchableOpacity>
              ))}
          </View>

          <TouchableOpacity 
            onPress={handleSave}
            className={`py-4 rounded-full items-center active:scale-95 ${name.trim() ? 'bg-brand-500 shadow-xl shadow-brand-500/30' : 'bg-gray-200 dark:bg-gray-900'}`}
          >
             <Text className={`font-jakarta-bold text-lg ${name.trim() ? 'text-white' : 'text-gray-400 dark:text-gray-600'}`}>Provision Vault</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
