import React, { useState } from 'react';
import { View, Text, SectionList, TouchableOpacity, Dimensions, ScrollView, TextInput, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format, isToday, isYesterday, startOfWeek, startOfMonth, startOfYear, isAfter } from 'date-fns';
import { useFinanceStore } from '../../store/useFinanceStore';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { BlurView } from 'expo-blur';

const { width } = Dimensions.get('window');

const getCategoryConfig = (category: string) => {
  switch(category.toLowerCase()) {
     case 'dining': return { name: 'restaurant-outline', bg: 'bg-orange-100/50 dark:bg-orange-900/20', icon: '#ea580c' };
     case 'transport': return { name: 'car-outline', bg: 'bg-blue-100/50 dark:bg-blue-900/20', icon: '#2563eb' };
     case 'entertainment': return { name: 'film-outline', bg: 'bg-purple-100/50 dark:bg-purple-900/20', icon: '#7c3aed' };
     case 'shopping': return { name: 'bag-handle-outline', bg: 'bg-pink-100/50 dark:bg-pink-950/20', icon: '#db2777' };
     case 'salary': return { name: 'cash-outline', bg: 'bg-emerald-100/50 dark:bg-emerald-950/20', icon: '#469B88' };
     case 'crypto': return { name: 'logo-bitcoin', bg: 'bg-amber-100/50 dark:bg-amber-950/20', icon: '#d97706' };
     default: return { name: 'card-outline', bg: 'bg-gray-100/50 dark:bg-gray-800/20', icon: '#4f46e5' };
  }
};

export default function TransactionsScreen() {
  const transactions = useFinanceStore(s => s.transactions);
  const wallets = useFinanceStore(s => s.wallets);
  const activeWalletId = useFinanceStore(s => s.activeWalletId);
  const setActiveWallet = useFinanceStore(s => s.setActiveWallet);
  const deleteTransaction = useFinanceStore(s => s.deleteTransaction);

  const [timeFilter, setTimeFilter] = useState<'WEEK' | 'MONTH' | 'YEAR' | 'ALL'>('ALL');
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filtering Logic
  const filteredTransactions = transactions.filter(t => {
    // Vault Filter
    if (activeWalletId !== 'ALL' && t.walletId !== activeWalletId) return false;
    
    // Time Filter
    const now = new Date();
    if (timeFilter === 'WEEK' && !isAfter(t.date, startOfWeek(now))) return false;
    if (timeFilter === 'MONTH' && !isAfter(t.date, startOfMonth(now))) return false;
    if (timeFilter === 'YEAR' && !isAfter(t.date, startOfYear(now))) return false;
    
    // Search Filter
    if (searchQuery && !t.merchant.toLowerCase().includes(searchQuery.toLowerCase())) return false;

    return true;
  });

  // Group by Date for SectionList
  const grouped = filteredTransactions.reduce((acc, curr) => {
    const dateStr = format(curr.date, 'yyyy-MM-dd');
    if (!acc[dateStr]) acc[dateStr] = [];
    acc[dateStr].push(curr);
    return acc;
  }, {} as Record<string, typeof transactions>);

  const sections = Object.keys(grouped).sort((a,b) => b.localeCompare(a)).map(date => {
    let title = format(new Date(date), 'MMMM d, yyyy');
    if (isToday(new Date(date))) title = 'Today';
    else if (isYesterday(new Date(date))) title = 'Yesterday';
    return { title, data: grouped[date] };
  });

  const renderRightActions = (id: string) => (
    <TouchableOpacity 
      onPress={() => deleteTransaction(id)}
      className="bg-rose-500 justify-center items-end px-6 pr-8 h-full rounded-r-[16px] mb-3"
    >
      <Ionicons name="trash-outline" size={24} color="#fff" />
    </TouchableOpacity>
  );

  return (
    <View className="flex-1 bg-white dark:bg-black">
      <SafeAreaView edges={['top']} className="z-20">
        <BlurView intensity={95} tint="light" className="px-6 pb-6 pt-2 border-b border-white/20">
          <View className="flex-row justify-between items-center mb-6">
             <View>
                <Text className="font-jakarta text-gray-400 font-jakarta-bold text-[10px] uppercase tracking-widest mb-1">Financial Log</Text>
                <Text className="font-jakarta text-gray-900 dark:text-white text-2xl font-jakarta-bold">Activity</Text>
             </View>
             <TouchableOpacity 
                onPress={() => setShowSearch(!showSearch)}
                className="w-10 h-10 rounded-full bg-white dark:bg-gray-800 border border-white/20 justify-center items-center shadow-sm"
             >
                <Ionicons name={showSearch ? "close-outline" : "search-outline"} size={20} color="#E0533D" />
             </TouchableOpacity>
          </View>

          {showSearch && (
            <View className="mb-4 bg-white/80 dark:bg-gray-800/80 rounded-xl px-4 py-2.5 flex-row items-center border border-white/20 shadow-inner">
              <Ionicons name="search" size={16} color="#E0533D" className="mr-2" />
              <TextInput 
                placeholder="Search merchants..." 
                className="flex-1 font-jakarta text-sm text-gray-900 dark:text-white"
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor="#9ca3af"
                autoFocus
              />
            </View>
          )}
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4" contentContainerStyle={{ gap: 8 }}>
             {['ALL', 'WEEK', 'MONTH', 'YEAR'].map(f => (
                <TouchableOpacity 
                  key={f}
                  onPress={() => setTimeFilter(f as any)}
                  className={`px-6 py-2.5 rounded-full border ${timeFilter === f ? 'bg-brand-500 border-brand-500 shadow-lg shadow-brand-500/30' : 'bg-white/50 dark:bg-gray-800/50 border-white/20'}`}
                >
                   <Text className={`font-jakarta-bold text-[10px] tracking-widest uppercase ${timeFilter === f ? 'text-white' : 'text-gray-500'}`}>
                      {f === 'ALL' ? 'History' : `This ${f}`}
                   </Text>
                </TouchableOpacity>
             ))}
          </ScrollView>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
             <TouchableOpacity 
                onPress={() => setActiveWallet('ALL')}
                className={`px-5 py-3 rounded-xl border flex-row items-center gap-2 ${activeWalletId === 'ALL' ? 'bg-financy-secondary border-financy-secondary shadow-lg' : 'bg-white/50 dark:bg-gray-800/50 border-white/20'}`}
             >
                <Ionicons name="apps-outline" size={14} color={activeWalletId === 'ALL' ? '#fff' : '#666'} />
                <Text className={`font-jakarta-bold text-xs ${activeWalletId === 'ALL' ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`}>
                   All Vaults
                </Text>
             </TouchableOpacity>

             {wallets.map(w => (
                <TouchableOpacity 
                   key={w.id} 
                   onPress={() => setActiveWallet(w.id)}
                   className={`px-5 py-3 rounded-xl border ${activeWalletId === w.id ? 'bg-brand-500 border-brand-500 shadow-lg shadow-brand-500/30' : 'bg-white/50 dark:bg-gray-800/50 border-white/20'}`}
                >
                   <Text className={`font-jakarta-bold text-xs ${activeWalletId === w.id ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`}>
                      {w.name}
                   </Text>
                </TouchableOpacity>
             ))}
          </ScrollView>
        </BlurView>
      </SafeAreaView>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ 
          paddingHorizontal: 24, 
          paddingBottom: Platform.OS === 'ios' ? 120 : 100, 
          paddingTop: 16 
        }}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section: { title } }) => (
          <Text className="font-jakarta text-gray-400 dark:text-gray-600 font-jakarta-bold uppercase tracking-widest text-[9px] mt-6 mb-4">{title}</Text>
        )}
        renderItem={({ item }) => {
          const cat = getCategoryConfig(item.category);
          return (
            <Swipeable renderRightActions={() => renderRightActions(item.id)}>
              <View className="flex-row justify-between items-center bg-white/90 dark:bg-gray-900/40 p-4 mb-3 rounded-[16px] border border-white/20 shadow-sm">
                <View className="flex-row items-center gap-4">
                  <View className={`w-12 h-12 rounded-full ${cat.bg} justify-center items-center`}>
                    <Ionicons name={cat.name as any} size={20} color={cat.icon} />
                  </View>
                  <View>
                    <Text className="font-jakarta text-gray-900 dark:text-white font-jakarta-bold text-base">{item.merchant}</Text>
                    <Text className="font-jakarta text-gray-400 font-jakarta-bold text-[10px] uppercase tracking-widest mt-0.5">{item.category}</Text>
                  </View>
                </View>
                <View className="items-end">
                   <Text className={`font-jakarta-bold tracking-wide text-base ${item.type === 'INCOME' ? 'text-emerald-500' : 'text-gray-900 dark:text-white'}`}>
                     {item.type === 'INCOME' ? '+' : '-'}${item.amount.toFixed(2)}
                   </Text>
                   <Text className="font-jakarta text-gray-400 text-[9px] mt-1">{format(item.date, 'p')}</Text>
                </View>
              </View>
            </Swipeable>
          );
        }}
        ListEmptyComponent={() => (
           <View className="items-center justify-center mt-20 opacity-50">
             <View className="w-20 h-20 bg-gray-50 dark:bg-gray-800 rounded-full justify-center items-center mb-4">
               <Ionicons name="search-outline" size={32} color="#E0533D" />
             </View>
             <Text className="font-jakarta text-gray-500 dark:text-gray-400 font-jakarta-bold text-center">No transactions match your filters.</Text>
           </View>
        )}
      />
    </View>
  );
}
