import React, { useState } from 'react';
import { View, Text, ScrollView, Dimensions, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Stop, Path, Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useFinanceStore } from '../../store/useFinanceStore';
import { CreateBudgetModal } from '../../components/features/CreateBudgetModal';
import { BlurView } from 'expo-blur';

const { width } = Dimensions.get('window');

const AmbientAura = ({ overallLimit, currentSpend }: { overallLimit: number, currentSpend: number }) => {
  const ratio = Math.min(currentSpend / (overallLimit || 1), 1);
  const remaining = Math.max(overallLimit - currentSpend, 0);
  
  let colors = { start: '#469B88', end: '#469B88', shadow: 'rgba(70, 155, 136, 0.2)' };
  if (ratio > 0.8) colors = { start: '#E0533D', end: '#E0533D', shadow: 'rgba(224, 83, 61, 0.2)' };
  else if (ratio > 0.5) colors = { start: '#fbbf24', end: '#d97706', shadow: 'rgba(245, 158, 11, 0.2)' };

  return (
    <View className="items-center justify-center my-10">
      <View style={{ shadowColor: colors.shadow, shadowRadius: 40, shadowOpacity: 1, shadowOffset: { width: 0, height: 10 } }}>
        <Svg width={240} height={240} viewBox="0 0 240 240">
          <Circle cx={120} cy={120} r={100} stroke="#f3f4f6" strokeWidth={14} fill="transparent" className="dark:stroke-gray-900" />
          <Path 
            d={`M 120 20 A 100 100 0 ${ratio > 0.5 ? 1 : 0} 1 ${120 + 100 * Math.sin(ratio * Math.PI * 2)} ${120 - 100 * Math.cos(ratio * Math.PI * 2)}`}
            stroke={colors.start}
            strokeWidth={14}
            strokeLinecap="round"
            fill="transparent"
          />
        </Svg>
        <View className="absolute inset-0 items-center justify-center">
            <Text className="font-jakarta text-gray-400 font-jakarta-bold tracking-widest text-[10px] uppercase mb-1">Safe to Spend</Text>
            <Text className="font-jakarta text-gray-900 dark:text-white text-5xl font-light tracking-tighter">${remaining.toFixed(0)}</Text>
        </View>
      </View>
    </View>
  );
};

export default function AnalyticsScreen() {
  const transactions = useFinanceStore(s => s.transactions);
  const activeWalletId = useFinanceStore(s => s.activeWalletId);
  const budgets = useFinanceStore(s => s.budgets);
  const [budgetModalVisible, setBudgetModalVisible] = useState(false);

  const activeBudgets = budgets.filter(b => b.wallets === 'ALL' || b.wallets.includes(activeWalletId));
  const globalBudgetCap = activeBudgets.length > 0 ? activeBudgets.reduce((a, b) => a + b.amount, 0) : 4000;
  
  const currentSpendRaw = transactions
    .filter(t => t.type === 'EXPENSE' && (activeBudgets.length > 0 ? true : t.walletId === activeWalletId))
    .reduce((acc, curr) => acc + curr.amount, 0);

  const totalIncome = transactions.filter(t => t.type === 'INCOME').reduce((a, b) => a + b.amount, 0);
  const totalSpend = transactions.filter(t => t.type === 'EXPENSE').reduce((a, b) => a + b.amount, 0);
  const cashflowMax = Math.max(totalIncome, totalSpend) || 1;

  const renderComparativeCashflow = () => (
     <View className="bg-white/90 dark:bg-gray-900/40 rounded-[24px] p-6 border border-white/20 shadow-xl mb-8">
        <Text className="font-jakarta text-gray-900 dark:text-white font-jakarta-bold text-lg mb-8">Cashflow Momentum</Text>
        <View className="flex-row items-end gap-8 justify-center h-44">
           <View className="items-center flex-1">
              <View className="w-14 bg-emerald-500/80 rounded-[8px]" style={{ height: `${(totalIncome / cashflowMax) * 100}%`, minHeight: 10 }} />
              <Text className="font-jakarta text-emerald-600 font-jakarta-bold mt-4 text-base">${totalIncome}</Text>
              <Text className="font-jakarta text-gray-400 font-jakarta-bold text-[10px] uppercase tracking-widest mt-1">Income</Text>
           </View>
           <View className="items-center flex-1">
              <View className="w-14 bg-rose-500/80 rounded-[8px]" style={{ height: `${(totalSpend / cashflowMax) * 100}%`, minHeight: 10 }} />
              <Text className="font-jakarta text-rose-600 font-jakarta-bold mt-4 text-base">${totalSpend}</Text>
              <Text className="font-jakarta text-gray-400 font-jakarta-bold text-[10px] uppercase tracking-widest mt-1">Spend</Text>
           </View>
        </View>
     </View>
  );

  return (
    <View className="flex-1 bg-white dark:bg-black">
      <SafeAreaView edges={['top']} className="z-20">
        <BlurView intensity={95} tint="light" className="px-6 pb-6 pt-2 border-b border-white/20">
          <View className="flex-row justify-between items-center">
             <View>
                <Text className="font-jakarta text-gray-400 font-jakarta-bold text-[10px] uppercase tracking-widest mb-1">Insights Hub</Text>
                <Text className="font-jakarta text-gray-900 dark:text-white text-2xl font-jakarta-bold">Analytics</Text>
             </View>
             <TouchableOpacity 
                onPress={() => setBudgetModalVisible(true)}
                className="bg-brand-500 px-4 py-2.5 rounded-xl flex-row items-center gap-2 shadow-lg shadow-brand-500/40"
             >
                <Ionicons name="add" size={18} color="#fff" />
                <Text className="font-jakarta text-white font-jakarta-bold text-xs">New Budget</Text>
             </TouchableOpacity>
          </View>
        </BlurView>
      </SafeAreaView>

      <ScrollView 
        className="flex-1" 
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? 120 : 100, paddingTop: 20 }}
        showsVerticalScrollIndicator={false}
      >
        <AmbientAura overallLimit={globalBudgetCap} currentSpend={currentSpendRaw} />

        {renderComparativeCashflow()}

        <View className="mb-10">
            <Text className="font-jakarta text-gray-900 dark:text-white text-xl font-jakarta-bold mb-6">Active Routines</Text>
            
            {activeBudgets.length === 0 ? (
               <TouchableOpacity 
                 onPress={() => setBudgetModalVisible(true)}
                 className="bg-gray-50/50 dark:bg-gray-900/20 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-[24px] p-8 items-center justify-center"
               >
                  <Ionicons name="pie-chart-outline" size={32} className="color-gray-300 mb-4" />
                  <Text className="font-jakarta text-gray-400 font-jakarta-bold text-center text-sm uppercase tracking-widest">No active budgets</Text>
               </TouchableOpacity>
            ) : (
               <View className="gap-4">
                  {activeBudgets.map(b => {
                     const artificialSpend = transactions.filter(t => t.merchant && t.type === 'EXPENSE').reduce((a,c) => a+c.amount, 0) % b.amount; 
                     const p = Math.min(artificialSpend / b.amount, 1);
                     return (
                        <View key={b.id} className="bg-white/90 dark:bg-gray-900/40 border border-white/20 rounded-[20px] p-5 shadow-xl">
                           <View className="flex-row justify-between mb-4">
                              <View>
                                <Text className="font-jakarta text-gray-900 dark:text-white font-jakarta-bold text-base">{b.name}</Text>
                                <Text className="font-jakarta text-gray-400 font-jakarta-bold text-[10px] uppercase tracking-widest mt-1">{b.recurrence}</Text>
                              </View>
                              <View className="items-end">
                                <Text className="font-jakarta-bold text-gray-900 dark:text-white text-base">${artificialSpend.toFixed(0)}</Text>
                                <Text className="font-jakarta text-gray-400 font-jakarta-bold text-[10px] uppercase tracking-widest mt-1">of ${b.amount}</Text>
                              </View>
                           </View>
                           <View className="h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                              <View className={`h-full rounded-full ${p > 0.8 ? 'bg-rose-500' : 'bg-brand-500'}`} style={{ width: `${p * 100}%` }} />
                           </View>
                        </View>
                     )
                  })}
               </View>
            )}
        </View>

        <Text className="font-jakarta text-gray-900 dark:text-white text-xl font-jakarta-bold mb-6">Subscription Drains</Text>
        <View className="bg-white/90 dark:bg-gray-900/40 rounded-[20px] p-5 border border-white/20 shadow-xl flex-row justify-between items-center mb-4">
            <View className="flex-row items-center gap-4">
                <View className="w-12 h-12 bg-rose-50 dark:bg-rose-900/20 rounded-xl justify-center items-center">
                    <Ionicons name="videocam-outline" size={20} color="#E0533D" />
                </View>
                <View>
                    <Text className="font-jakarta text-gray-900 dark:text-white font-jakarta-bold text-base">Netflix Standard</Text>
                    <Text className="font-jakarta text-rose-500 font-jakarta-bold text-[10px] uppercase tracking-widest mt-1">Renews in 3 days</Text>
                </View>
            </View>
            <Text className="font-jakarta text-gray-900 dark:text-white font-jakarta-bold text-lg">-$15.99</Text>
        </View>
      </ScrollView>

      <CreateBudgetModal visible={budgetModalVisible} onClose={() => setBudgetModalVisible(false)} />
    </View>
  );
}
