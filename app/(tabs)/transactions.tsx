import React, { useState } from 'react';
import { View, Text, SectionList, TouchableOpacity, ScrollView, TextInput, Platform, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, isToday, isYesterday, startOfWeek, startOfMonth, startOfYear, isAfter } from 'date-fns';
import { useFinanceStore } from '../../store/useFinanceStore';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { Surface, SurfaceHeaderArea, GradientCard, ScreenHeader, NeonButton } from '../../components/ui';
import { useThemeColors } from '../../hooks/use-theme-colors';

const getCategoryConfig = (category: string) => {
  switch (category.toLowerCase()) {
    case 'dining':
      return { name: 'restaurant-outline', tint: '#FFB547' };
    case 'transport':
      return { name: 'car-outline', tint: '#5BE0B0' };
    case 'entertainment':
      return { name: 'film-outline', tint: '#A78BFA' };
    case 'shopping':
      return { name: 'bag-handle-outline', tint: '#FF5C7C' };
    case 'salary':
      return { name: 'cash-outline', tint: '#5BE0B0' };
    case 'crypto':
      return { name: 'logo-bitcoin', tint: '#FFB547' };
    default:
      return { name: 'card-outline', tint: '#FF6B4A' };
  }
};

type TimeFilter = 'WEEK' | 'MONTH' | 'YEAR' | 'ALL';
const TIME_FILTERS: TimeFilter[] = ['ALL', 'WEEK', 'MONTH', 'YEAR'];

export default function TransactionsScreen() {
  const themeColors = useThemeColors();
  const transactions = useFinanceStore(s => s.transactions);
  const wallets = useFinanceStore(s => s.wallets);
  const activeWalletId = useFinanceStore(s => s.activeWalletId);
  const setActiveWallet = useFinanceStore(s => s.setActiveWallet);
  const deleteTransaction = useFinanceStore(s => s.deleteTransaction);

  const [timeFilter, setTimeFilter] = useState<TimeFilter>('ALL');
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTransactions = transactions.filter(t => {
    if (activeWalletId !== 'ALL' && t.walletId !== activeWalletId) return false;

    const now = new Date();
    if (timeFilter === 'WEEK' && !isAfter(t.date, startOfWeek(now))) return false;
    if (timeFilter === 'MONTH' && !isAfter(t.date, startOfMonth(now))) return false;
    if (timeFilter === 'YEAR' && !isAfter(t.date, startOfYear(now))) return false;

    if (searchQuery && !t.merchant.toLowerCase().includes(searchQuery.toLowerCase())) return false;

    return true;
  });

  const grouped = filteredTransactions.reduce(
    (acc, curr) => {
      const dateStr = format(curr.date, 'yyyy-MM-dd');
      if (!acc[dateStr]) acc[dateStr] = [];
      acc[dateStr].push(curr);
      return acc;
    },
    {} as Record<string, typeof transactions>,
  );

  const sections = Object.keys(grouped)
    .sort((a, b) => b.localeCompare(a))
    .map(date => {
      let title = format(new Date(date), 'MMMM d, yyyy');
      if (isToday(new Date(date))) title = 'Today';
      else if (isYesterday(new Date(date))) title = 'Yesterday';
      return { title, data: grouped[date] };
    });

  const renderRightActions = (id: string) => (
    <Pressable
      onPress={() => deleteTransaction(id)}
      className="bg-accent-rose justify-center items-end px-6 pr-8 h-full rounded-r-[16px] mb-3"
      style={{ boxShadow: '0 0 24px rgba(255, 92, 124, 0.4)' }}>
      <Ionicons name="trash-outline" size={22} color="#fff" />
    </Pressable>
  );

  // Filter chip used twice (time filter + vault filter).
  const Chip = ({
    active,
    onPress,
    children,
    icon,
  }: {
    active: boolean;
    onPress: () => void;
    children: React.ReactNode;
    icon?: keyof typeof Ionicons.glyphMap;
  }) => (
    <Pressable
      onPress={onPress}
      className={`px-5 py-2.5 rounded-full flex-row items-center gap-2 border ${
        active ? 'bg-accent-coral border-accent-coral' : 'bg-surface-2 border-hairline'
      }`}
      style={active ? { boxShadow: '0 0 18px rgba(255, 107, 74, 0.45)' } : null}>
      {icon && (
        <Ionicons name={icon} size={13} color={active ? '#fff' : themeColors.textMid} />
      )}
      <Text
        className={`font-jakarta-bold text-[10px] tracking-widest uppercase ${
          active ? 'text-white' : 'text-text-mid'
        }`}>
        {children}
      </Text>
    </Pressable>
  );

  return (
    <Surface>
      <SurfaceHeaderArea>
        <ScreenHeader
          eyebrow="Financial Log"
          title="Activity"
          action={
            <NeonButton
              variant="secondary"
              size="sm"
              icon={showSearch ? 'close-outline' : 'search-outline'}
              onPress={() => setShowSearch(!showSearch)}>
              {showSearch ? 'Close' : 'Search'}
            </NeonButton>
          }
        />

        {showSearch && (
          <View className="px-6 pb-4">
            <GradientCard padding="sm" radius="row">
              <View className="flex-row items-center gap-3">
                <Ionicons name="search" size={16} color="#FF6B4A" />
                <TextInput
                  placeholder="Search merchants..."
                  className="flex-1 font-jakarta text-text-high text-sm"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholderTextColor={themeColors.textDim}
                  autoFocus
                />
              </View>
            </GradientCard>
          </View>
        )}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 24 }}>
          {TIME_FILTERS.map(f => (
            <Chip key={f} active={timeFilter === f} onPress={() => setTimeFilter(f)}>
              {f === 'ALL' ? 'History' : `This ${f}`}
            </Chip>
          ))}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 24, paddingTop: 10 }}>
          <Chip
            active={activeWalletId === 'ALL'}
            onPress={() => setActiveWallet('ALL')}
            icon="apps-outline">
            All Vaults
          </Chip>
          {wallets.map(w => (
            <Chip key={w.id} active={activeWalletId === w.id} onPress={() => setActiveWallet(w.id)}>
              {w.name}
            </Chip>
          ))}
        </ScrollView>
      </SurfaceHeaderArea>

      <SectionList
        sections={sections}
        keyExtractor={item => item.id}
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingBottom: Platform.OS === 'ios' ? 120 : 100,
          paddingTop: 24,
        }}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section: { title } }) => (
          <Text className="font-jakarta-bold text-text-low uppercase tracking-widest text-[10px] mt-6 mb-3">
            {title}
          </Text>
        )}
        renderItem={({ item }) => {
          const cat = getCategoryConfig(item.category);
          const isIncome = item.type === 'INCOME';
          return (
            <View className="mb-3">
              <Swipeable renderRightActions={() => renderRightActions(item.id)}>
                <GradientCard padding="md" radius="row">
                  <View className="flex-row justify-between items-center">
                    <View className="flex-row items-center gap-4">
                      <View
                        className="w-11 h-11 rounded-2xl bg-surface-3 justify-center items-center"
                        style={{ borderWidth: 1, borderColor: themeColors.hairline }}>
                        <Ionicons name={cat.name as any} size={18} color={cat.tint} />
                      </View>
                      <View>
                        <Text className="font-jakarta-bold text-text-high text-base">
                          {item.merchant}
                        </Text>
                        <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest mt-0.5">
                          {item.category}
                        </Text>
                      </View>
                    </View>
                    <View className="items-end">
                      <Text
                        className={`font-jakarta-bold tracking-wide text-base ${
                          isIncome ? 'text-accent-mint' : 'text-text-high'
                        }`}>
                        {isIncome ? '+' : '-'}${item.amount.toFixed(2)}
                      </Text>
                      <Text className="font-jakarta text-text-low text-[10px] mt-1">
                        {format(item.date, 'p')}
                      </Text>
                    </View>
                  </View>
                </GradientCard>
              </Swipeable>
            </View>
          );
        }}
        ListEmptyComponent={() => (
          <View className="items-center justify-center mt-24">
            <View className="w-20 h-20 bg-surface-2 border border-hairline rounded-full justify-center items-center mb-4">
              <Ionicons name="search-outline" size={28} color="#FF6B4A" />
            </View>
            <Text className="font-jakarta-bold text-text-mid text-center">
              No transactions match your filters.
            </Text>
          </View>
        )}
      />
    </Surface>
  );
}
