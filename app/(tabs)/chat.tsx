import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useCopilotStore, WidgetPayload } from '../../store/useCopilotStore';
import { useFinanceStore } from '../../store/useFinanceStore';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import { scanDocumentWithGemini, ScanResponse, ScannedTransaction } from '../../services/geminiService';
import { MagicScanReviewModal } from '../../components/features/MagicScanModal';

export default function ChatCopilotScreen() {
  const [inputText, setInputText] = useState('');
  const messages = useCopilotStore(s => s.messages);
  const addMessage = useCopilotStore(s => s.addMessage);
  const addTransaction = useFinanceStore(s => s.addTransaction);
  const activeWalletId = useFinanceStore(s => s.activeWalletId);

  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResponse | null>(null);
  const [scanModalVisible, setScanModalVisible] = useState(false);

  const simulateRAGResponse = (text: string) => {
    const rawText = text.toLowerCase();
    
    if (rawText.includes('scan') || rawText.includes('receipt')) {
      setTimeout(() => {
        addMessage({
          sender: 'bot',
          text: 'I can parse statements and receipts. Please select the image or PDF from your device to initiate the Magic Scan parser.'
        });
      }, 700);
      return;
    }

    if (rawText.includes('transfer') || rawText.includes('move')) {
      setTimeout(() => {
        addMessage({
          sender: 'bot',
          text: 'I can help with that. Since you requested a transfer, please confirm the details below:',
          widget: { type: 'TRANSFER_CONFIRM', amount: 50, sourceWallet: 'Personal', targetWallet: 'Trip' }
        });
      }, 800);
    } else {
      setTimeout(() => {
        addMessage({
          sender: 'bot',
          text: 'I see. Looking at your balances, your expenditure on Dining is high. Consider holding off on eating out to protect your Safe-To-Spend limits.'
        });
      }, 800);
    }
  };

  const handleSend = () => {
    if (!inputText.trim()) return;
    addMessage({ sender: 'user', text: inputText });
    const cachedInt = inputText;
    setInputText('');
    simulateRAGResponse(cachedInt);
  };

  const handleMagicScan = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0].uri) {
      setScanModalVisible(true);
      setIsScanning(true);
      const data = await scanDocumentWithGemini(result.assets[0].uri, 'image/jpeg');
      setIsScanning(false);
      setScanResult(data);
    }
  };

  const confirmScan = (data: ScannedTransaction[]) => {
    data.forEach(item => {
      addTransaction({
        walletId: activeWalletId,
        merchant: item.merchant,
        amount: item.amount,
        category: item.category,
        date: new Date(item.date),
        type: item.type
      });
    });
    
    setScanModalVisible(false);
    addMessage({
      sender: 'bot',
      text: `Great! I've successfully parsed ${data.length} entries from that scan and added them to your vault. Your "Safe-to-Spend" limit has been updated.`
    });
  };

  return (
    <View className="flex-1 bg-white dark:bg-black">
      <SafeAreaView edges={['top']} className="z-20">
        <BlurView intensity={95} tint="light" className="px-6 pb-6 pt-2 border-b border-white/20">
          <View className="flex-row justify-between items-center">
             <View>
                <Text className="font-jakarta text-gray-400 font-jakarta-bold text-[10px] uppercase tracking-widest mb-1">Agentic AI</Text>
                <Text className="font-jakarta text-gray-900 dark:text-white text-2xl font-jakarta-bold">Copilot</Text>
             </View>
             <View className="w-10 h-10 rounded-full bg-brand-50 dark:bg-brand-900/30 justify-center items-center">
                <Ionicons name="sparkles-outline" size={20} color="#E0533D" />
             </View>
          </View>
        </BlurView>
      </SafeAreaView>

      <ScrollView 
        className="flex-1 px-6" 
        contentContainerStyle={{ paddingVertical: 24, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((msg) => (
          <View key={msg.id} className={`mb-8 flex-row ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
             
             {msg.sender === 'bot' && (
               <View className="w-10 h-10 rounded-full bg-brand-500 justify-center items-center mr-3 mt-1 shadow-lg shadow-brand-500/30">
                 <Ionicons name="sparkles" size={18} color="#fff" />
               </View>
             )}

             <View className="max-w-[85%]">
                <View className={`p-4 rounded-[20px] shadow-xl ${msg.sender === 'user' ? 'bg-brand-500' : 'bg-white/90 dark:bg-gray-900/40 border border-white/20'}`}>
                  <Text className={`text-base leading-relaxed font-jakarta font-medium ${msg.sender === 'user' ? 'text-white' : 'text-gray-900 dark:text-white'}`}>{msg.text}</Text>
                </View>

                {msg.widget && <ActionWidget payload={msg.widget} />}
             </View>
          </View>
        ))}
      </ScrollView>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        <View className="p-6 pb-10 bg-white/95 dark:bg-black/95 border-t border-white/10 flex-row items-center">
          <TouchableOpacity 
             onPress={handleMagicScan}
             className="w-12 h-12 bg-gray-50 dark:bg-gray-900 rounded-full justify-center items-center mr-3 border border-white/20 active:scale-90 transition-all">
             <Ionicons name="camera-outline" size={24} color="#E0533D" />
          </TouchableOpacity>
          <TextInput
            placeholder="Type anything..."
            placeholderTextColor="#9ca3af"
            className="flex-1 text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900 px-6 py-4 rounded-full border border-white/20 font-jakarta-bold text-sm shadow-inner"
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity onPress={handleSend} className="w-12 h-12 bg-brand-500 shadow-xl shadow-brand-500/40 rounded-full justify-center items-center ml-3 active:scale-95 transition-all">
             <Ionicons name="paper-plane" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <MagicScanReviewModal 
        visible={scanModalVisible} 
        onClose={() => setScanModalVisible(false)} 
        loading={isScanning} 
        scanData={scanResult} 
        onConfirm={confirmScan}
      />
    </View>
  );
}

function ActionWidget({ payload }: { payload: WidgetPayload }) {
  if (payload.type === 'TRANSFER_CONFIRM') {
    return (
      <View className="bg-white/90 dark:bg-brand-950/30 p-6 mt-4 rounded-[24px] border border-white/20 shadow-2xl">
         <View className="flex-row items-center justify-between mb-6 pb-4 border-b border-gray-100 dark:border-white/5">
            <Text className="font-jakarta text-gray-900 dark:text-brand-300 font-jakarta-bold uppercase tracking-widest text-[10px]">Verify Transaction</Text>
            <Ionicons name="swap-horizontal" size={20} color="#E0533D" />
         </View>
         <View className="flex-row justify-between mb-4">
            <Text className="font-jakarta text-gray-400 font-jakarta-bold text-xs">AMOUNT</Text>
            <Text className="font-jakarta text-gray-900 dark:text-white font-jakarta-bold text-xl">${payload.amount}</Text>
         </View>
         <View className="flex-row justify-between mb-8">
            <Text className="font-jakarta text-gray-400 font-jakarta-bold text-xs">PATH</Text>
            <Text className="font-jakarta text-gray-900 dark:text-white font-jakarta-bold text-sm">{payload.sourceWallet} ➝ {payload.targetWallet}</Text>
         </View>
         <TouchableOpacity className="bg-brand-500 py-4 rounded-xl items-center shadow-xl shadow-brand-500/40 active:scale-95 transition-all">
            <Text className="font-jakarta text-white font-jakarta-bold tracking-widest uppercase text-xs">Execute Command</Text>
         </TouchableOpacity>
      </View>
    );
  }
  return null;
}
