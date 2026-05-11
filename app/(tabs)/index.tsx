import React from 'react';
import { View, Text, TouchableOpacity, FlatList, Dimensions, NativeSyntheticEvent, NativeScrollEvent, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFinanceStore } from '../../store/useFinanceStore';
import { TransactionAdderModal } from '../../components/features/TransactionAdderModal';
import { CreateVaultModal } from '../../components/features/CreateVaultModal';
import { TrendChart } from '../../components/features/TrendChart';
import { useRouter } from 'expo-router';
import { MagicScanWindow } from '../../components/features/MagicScanWindow';
import { scanDocumentWithGemini, ScanResponse, ScannedTransaction } from '../../services/geminiService';
import { MagicScanReviewModal } from '../../components/features/MagicScanModal';
import { financeApi } from '../../services/apiClient';
import { useAuth } from '../../context/AuthContext';


const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();
  const [modalVisible, setModalVisible] = React.useState(false);
  const [vaultModalVisible, setVaultModalVisible] = React.useState(false);
  
  const [isScanning, setIsScanning] = React.useState(false);
  const [scanResult, setScanResult] = React.useState<ScanResponse | null>(null);
  const [scanModalVisible, setScanModalVisible] = React.useState(false);
  const [scanWindowVisible, setScanWindowVisible] = React.useState(false);
  
  const wallets = useFinanceStore(s => s.wallets);
  const transactions = useFinanceStore(s => s.transactions);
  const activeWalletId = useFinanceStore(s => s.activeWalletId);
  const setActiveWallet = useFinanceStore(s => s.setActiveWallet);
  const addTransaction = useFinanceStore(s => s.addTransaction);
  const syncData = useFinanceStore(s => s.syncData);
  const { isAuthenticated } = useAuth();

  React.useEffect(() => {
    if (isAuthenticated) {
      syncData();
    }
  }, [isAuthenticated]);

  const localTransactions = transactions.filter(t => t.walletId === activeWalletId).slice(0, 5);

  const extendedWallets = [...wallets, { id: 'NEW_VAULT_TRIGGER', name: 'Add Vault', type: 'NEW', balance: 0, currency: '' }];

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollPosition / width);
    const targetWallet = extendedWallets[index];
    if (targetWallet && targetWallet.id !== activeWalletId && targetWallet.id !== 'NEW_VAULT_TRIGGER') {
      setActiveWallet(targetWallet.id);
    }
  };

  const handleSelectFile = async (uri: string, mimeType: string) => {
    setScanWindowVisible(false);
    setScanModalVisible(true);
    setIsScanning(true);
    const data = await scanDocumentWithGemini(uri, mimeType);
    setIsScanning(false);
    setScanResult(data);
  };

  const confirmScan = async (scannedTransactions: ScannedTransaction[]) => {
    // 1. Update local state immediately for UX
    scannedTransactions.forEach(tx => {
      addTransaction({
        walletId: activeWalletId,
        merchant: tx.merchant,
        amount: tx.amount,
        category: tx.category,
        date: new Date(tx.date),
        type: tx.type
      });
    });

    // 2. Sync to backend if authenticated
    if (isAuthenticated) {
      try {
        const activeWallet = wallets.find(w => w.id === activeWalletId);
        await financeApi.confirmUpload({
          file_hash: `mobile_${Date.now()}`, // Generated hash
          bank: activeWallet?.name || 'UNKNOWN',
          account_type: activeWallet?.type === 'PERSONAL' ? 'SAVINGS' : 'CREDIT_CARD',
          account_name: activeWallet?.name || 'Default',
          transactions: scannedTransactions.map(tx => ({
            tx_date: tx.date,
            description: tx.merchant,
            amount: tx.amount,
            direction: tx.type === 'INCOME' ? 'CREDIT' : 'DEBIT',
            category: tx.category,
            currency: 'SGD'
          }))
        });
        // Optionally refresh data
        syncData();
      } catch (error) {
        console.error('Failed to sync scan result to backend', error);
      }
    }

    setScanModalVisible(false);
  };


  const getWalletColor = (type: string) => {
    switch(type) {
      case 'PERSONAL': return { bg: 'bg-white/90 dark:bg-gray-800/60', text: 'text-brand-500' };
      case 'TRIP': return { bg: 'bg-rose-50/90 dark:bg-rose-900/40', text: 'text-rose-500' };
      case 'FAMILY': return { bg: 'bg-emerald-50/90 dark:bg-emerald-900/40', text: 'text-emerald-500' };
      case 'CRYPTO': return { bg: 'bg-amber-50/90 dark:bg-amber-900/40', text: 'text-amber-500' };
      default: return { bg: 'bg-white/90 dark:bg-gray-800/60', text: 'text-brand-500' };
    }
  };

  const getTransactionIcon = (domain: string) => {
     switch(domain.toLowerCase()) {
        case 'dining': return { name: 'restaurant-outline', bg: 'bg-orange-100/50 dark:bg-orange-900/20', color: '#ea580c' };
        case 'transport': return { name: 'car-outline', bg: 'bg-blue-100/50 dark:bg-blue-900/20', color: '#2563eb' };
        case 'entertainment': return { name: 'film-outline', bg: 'bg-purple-100/50 dark:bg-purple-900/20', color: '#7c3aed' };
        default: return { name: 'card-outline', bg: 'bg-gray-100/50 dark:bg-gray-800/20', color: '#4f46e5' };
     }
  };

  const renderWalletCard = ({ item }: { item: any }) => {
    if (item.id === 'NEW_VAULT_TRIGGER') {
        return (
          <View style={{ width }} className="items-center px-4">
            <TouchableOpacity 
              activeOpacity={0.8}
              onPress={() => setVaultModalVisible(true)}
              className="w-full h-48 rounded-[24px] justify-center items-center border-2 border-dashed border-gray-200 dark:border-gray-800 bg-white/20 dark:bg-white/5"
            >
               <Ionicons name="add-circle-outline" size={40} className="color-gray-300 dark:color-gray-800 mb-2" />
               <Text className="font-jakarta text-gray-400 dark:text-gray-600 font-jakarta-bold tracking-widest uppercase text-xs">Provision Vault</Text>
            </TouchableOpacity>
          </View>
        );
    }

    const style = getWalletColor(item.type);
    const isManualTracker = item.type === 'PERSONAL';
    const trackedSpend = transactions.filter(t => t.walletId === item.id && t.type === 'EXPENSE').reduce((a,b) => a + b.amount, 0);
    const trackedIncome = transactions.filter(t => t.walletId === item.id && t.type === 'INCOME').reduce((a,b) => a + b.amount, 0);

    return (
      <View style={{ width }} className="items-center px-4">
        <TouchableOpacity 
          activeOpacity={0.95} 
          onPress={() => router.push('/(tabs)/transactions')}
          className={`w-full h-48 rounded-[24px] p-6 justify-between border border-white/40 ${style.bg} shadow-xl`}
        >
          <View className="flex-row justify-between items-start">
             <View>
                <Text className={`font-jakarta-bold tracking-widest text-[10px] uppercase mb-1 ${style.text}`}>{item.type} VAULT</Text>
                <Text className="font-jakarta text-gray-900 dark:text-white text-lg font-jakarta-bold">{item.name}</Text>
             </View>
             
             <View className="flex-row">
                 <View className="w-8 h-8 rounded-full bg-blue-500 border-2 border-white/50 justify-center items-center z-20 shadow-sm">
                     <Text className="font-jakarta text-white font-jakarta-bold text-[10px]">P1</Text>
                 </View>
                 {item.type !== 'PERSONAL' && (
                   <View className="w-8 h-8 rounded-full bg-emerald-500 border-2 border-white/50 justify-center items-center -ml-3 z-10 shadow-sm">
                       <Text className="font-jakarta text-white font-jakarta-bold text-[10px]">P2</Text>
                   </View>
                 )}
             </View>
          </View>

          <View>
             {isManualTracker ? (
                <View>
                   <Text className="font-jakarta text-gray-400 font-jakarta-bold text-[10px] mb-1 uppercase tracking-wider">This Month Activity</Text>
                   <View className="flex-row items-baseline gap-2">
                      <Text className="font-jakarta text-emerald-500 font-jakarta-bold text-3xl">+{trackedIncome.toLocaleString()}</Text>
                      <Text className="font-jakarta text-gray-300 dark:text-gray-700 text-2xl">/</Text>
                      <Text className="font-jakarta text-rose-500 font-jakarta-bold text-3xl">-{trackedSpend.toLocaleString()}</Text>
                   </View>
                </View>
             ) : (
                <View>
                   <Text className="font-jakarta text-gray-400 font-jakarta-bold text-[10px] mb-1 uppercase tracking-wider">Current Balance ({item.currency})</Text>
                   <Text className="font-jakarta text-gray-900 dark:text-white text-5xl font-light tracking-tighter">
                      ${item.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                   </Text>
                </View>
             )}
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-white dark:bg-black">
      <SafeAreaView edges={['top']} className="z-10">
        <View className="flex-row justify-between items-center px-6 pt-2 pb-6">
          <View className="flex-row items-center gap-3">
            <View className="w-10 h-10 rounded-full bg-brand-500 justify-center items-center shadow-lg shadow-brand-500/40">
              <Text className="font-jakarta text-white font-jakarta-bold text-lg">SG</Text>
            </View>
            <View>
               <Text className="font-jakarta text-gray-400 font-jakarta-bold text-[10px] uppercase tracking-widest mb-1">Welcome back</Text>
               <Text className="font-jakarta text-gray-900 dark:text-white text-lg font-jakarta-bold">Dashboard</Text>
            </View>
          </View>
          <TouchableOpacity className="w-10 h-10 rounded-full bg-white dark:bg-gray-900 border border-white/20 justify-center items-center shadow-sm">
              <Ionicons name="notifications-outline" size={20} color="#E0533D" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 120 : 100 }}
      >
        <FlatList
          data={extendedWallets}
          renderItem={renderWalletCard}
          keyExtractor={item => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScroll}
          className="flex-none h-52 mb-6"
        />

        <View className="flex-row justify-center gap-2 mb-8">
          {extendedWallets.map((w) => {
            const isActive = w.id === activeWalletId;
            const isTrigger = w.id === 'NEW_VAULT_TRIGGER';
            return (
               <View key={w.id} className={`h-1.5 rounded-full ${isActive && !isTrigger ? 'w-6 bg-brand-500' : 'w-1.5 bg-gray-200 dark:bg-gray-800'}`} />
            )
          })}
        </View>

        <View className="flex-row justify-center gap-4 px-6 mb-10">
          <TouchableOpacity 
             onPress={() => setModalVisible(true)}
             className="flex-1 bg-white dark:bg-gray-900 rounded-[20px] p-5 border border-white/20 flex-row items-center justify-center gap-3 shadow-xl active:scale-95 transition-all">
            <Ionicons name="add-circle-outline" size={24} color="#E0533D" />
            <Text className="font-jakarta text-gray-900 dark:text-white font-jakarta-bold text-base tracking-wide">Add Entry</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
             onPress={() => setScanWindowVisible(true)}
             className="flex-1 bg-brand-500 rounded-[20px] p-5 shadow-xl shadow-brand-500/50 flex-row items-center justify-center gap-3 active:scale-95 transition-all">
            <Ionicons name="flash-outline" size={22} color="#ffffff" />
            <Text className="font-jakarta text-white font-jakarta-bold text-base tracking-wide">Magic Scan</Text>
          </TouchableOpacity>
        </View>

        <View className="bg-gray-50/50 dark:bg-gray-900/30 rounded-t-[32px] px-6 pt-10 border-t border-white/10 shadow-2xl">
          <TrendChart />
          
          <View className="flex-row justify-between items-end mb-6">
            <Text className="font-jakarta text-gray-900 dark:text-white text-xl font-jakarta-bold">Vault Activity</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/transactions')}>
               <Text className="font-jakarta text-brand-600 dark:text-brand-500 font-jakarta-bold tracking-wide">See All</Text>
            </TouchableOpacity>
          </View>

          {localTransactions.length === 0 ? (
            <View className="items-center justify-center py-10 opacity-50">
              <Ionicons name="leaf-outline" size={32} color="#ccc" />
              <Text className="font-jakarta text-gray-400 mt-2 font-medium">No activity in this vault.</Text>
            </View>
          ) : (
            <View className="gap-4">
              {localTransactions.map((tx) => {
                const iconDef = getTransactionIcon(tx.category);
                return (
                  <View key={tx.id} className="flex-row justify-between items-center bg-white/90 dark:bg-gray-800/40 p-4 rounded-[16px] border border-white/20 shadow-sm">
                    <View className="flex-row items-center gap-4">
                       <View className={`w-12 h-12 rounded-full ${iconDef.bg} justify-center items-center`}>
                          <Ionicons name={iconDef.name as any} size={20} color={iconDef.color} />
                       </View>
                       <View>
                          <Text className="font-jakarta text-gray-900 dark:text-white font-jakarta-bold text-base">{tx.merchant}</Text>
                          <Text className="font-jakarta text-gray-500 text-[10px] mt-0.5 font-jakarta-bold uppercase tracking-widest">{tx.category}</Text>
                       </View>
                    </View>
                    <Text className={`font-jakarta-bold tracking-wide text-base ${tx.type === 'INCOME' ? 'text-emerald-500' : 'text-gray-900 dark:text-white'}`}>
                      {tx.type === 'INCOME' ? '+' : '-'}${tx.amount.toFixed(2)}
                    </Text>
                  </View>
                )
              })}
            </View>
          )}
        </View>
      </ScrollView>

      <TransactionAdderModal visible={modalVisible} onClose={() => setModalVisible(false)} />
      <CreateVaultModal visible={vaultModalVisible} onClose={() => setVaultModalVisible(false)} />
      <MagicScanReviewModal 
        visible={scanModalVisible} 
        onClose={() => setScanModalVisible(false)} 
        loading={isScanning} 
        scanData={scanResult} 
        onConfirm={confirmScan}
      />
      <MagicScanWindow 
        visible={scanWindowVisible} 
        onClose={() => setScanWindowVisible(false)} 
        onSelectFile={handleSelectFile}
      />
    </View>
  );
}
