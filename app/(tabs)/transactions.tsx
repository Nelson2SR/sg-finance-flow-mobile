import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  SectionList,
  ScrollView,
  TextInput,
  Platform,
  Pressable,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, isToday, isYesterday } from 'date-fns';
import Swipeable from 'react-native-gesture-handler/Swipeable';

import { useFinanceStore } from '../../store/useFinanceStore';
import { useCategoriesStore } from '../../store/useCategoriesStore';
import { GradientCard, NeonButton, ScreenHeader, Skeleton, SkeletonRow, Surface, SurfaceHeaderArea } from '../../components/ui';
import { FilterPill } from '../../components/features/FilterPill';
import { MonthYearPicker, monthYearDisplay, monthYearToRange, type MonthYearValue } from '../../components/features/MonthYearPicker';
import { useThemeColors } from '../../hooks/use-theme-colors';
import { resolveCategoryStyle, resolveLabelColor, tintWithAlpha } from '../../lib/categoryStyle';

export default function TransactionsScreen() {
  const themeColors = useThemeColors();
  const transactions = useFinanceStore(s => s.transactions);
  const wallets = useFinanceStore(s => s.wallets);
  const activeWalletId = useFinanceStore(s => s.activeWalletId);
  const setActiveWallet = useFinanceStore(s => s.setActiveWallet);
  const deleteTransaction = useFinanceStore(s => s.deleteTransaction);
  const isSyncing = useFinanceStore(s => s.isSyncing);
  const hasSynced = useFinanceStore(s => s.hasSynced);
  const syncData = useFinanceStore(s => s.syncData);

  const [monthFilter, setMonthFilter] = useState<MonthYearValue>('ALL');
  const [walletFilter, setWalletFilter] = useState<string | null>(null); // null = All wallets
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null); // null = All categories
  const [labelFilter, setLabelFilter] = useState<string | null>(null); // null = All labels
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const allLabels = useCategoriesStore(s => s.labels);
  const allCategoriesList = useCategoriesStore(s => s.categories);

  // Default the Wallet filter to whichever wallet is currently active
  // in the store — the user's expectation is "show my wallet first,
  // not everyone's transactions in the active vault group."
  useEffect(() => {
    if (walletFilter === null && activeWalletId) {
      setWalletFilter(activeWalletId);
    }
  }, [activeWalletId, walletFilter]);

  // Whenever any filter changes, kick off a fresh sync so the user
  // sees a brief refresh spinner and the underlying data is current.
  // The client-side filter below still does the actual filtering;
  // syncing keeps the dataset honest with the backend.
  useEffect(() => {
    void syncData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthFilter, walletFilter, categoryFilter, labelFilter]);

  const { start: monthStart, end: monthEnd } = useMemo(
    () => monthYearToRange(monthFilter),
    [monthFilter],
  );

  const filteredTransactions = transactions.filter(t => {
    if (t.date < monthStart || t.date > monthEnd) return false;
    if (walletFilter !== null && t.walletId !== walletFilter) return false;
    if (categoryFilter !== null && t.category !== categoryFilter) return false;
    if (labelFilter !== null) {
      const target = labelFilter.toLowerCase();
      if (!(t.labels ?? []).some(l => l.toLowerCase() === target)) return false;
    }
    if (searchQuery && !t.merchant.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  // Toggle helper kept for the per-row label chip → top filter shortcut.
  const toggleLabelFilter = (name: string) =>
    setLabelFilter(current => (current === name ? null : name));

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

  // Build the option lists for each FilterPill. "All wallets" / "All
  // categories" / "All labels" each show up as a top row with a
  // sentinel `null` value so the user can clear the filter without
  // hunting for a separate button.
  const walletOptions = useMemo(
    () => [
      { value: null, label: 'All wallets' },
      ...wallets.map((w) => ({
        value: w.id,
        label: w.name,
        caption: `${w.type} · ${w.currency}`,
      })),
    ],
    [wallets],
  );
  const categoryOptions = useMemo(
    () => [
      { value: null, label: 'All categories' },
      ...allCategoriesList
        .filter((c) => c.kind === 'expense' || c.kind === 'income')
        .map((c) => ({
          value: c.name,
          label: c.name,
          caption: c.kind === 'income' ? 'Income' : 'Expense',
        })),
    ],
    [allCategoriesList],
  );
  const labelOptions = useMemo(
    () => [
      { value: null, label: 'All labels' },
      ...allLabels.map((l) => ({ value: l.name, label: l.name })),
    ],
    [allLabels],
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

        {/* Compact filter row — one row, four dropdowns. Replaces the
            three full-width chip rows that used to push the activity
            list halfway down the screen. Each dropdown opens a bottom
            sheet from FilterPill; the Date dropdown's sheet contains
            the year+month grid via MonthYearPicker. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 10, paddingHorizontal: 24, paddingBottom: 8 }}>
          <FilterPill
            label="Date"
            display={monthYearDisplay(monthFilter)}
            active={monthFilter !== 'ALL'}
            options={[{ value: 'ALL' as MonthYearValue, label: 'All time' }]}
            value={monthFilter}
            onChange={setMonthFilter}
            extraContent={
              <MonthYearPicker value={monthFilter} onChange={setMonthFilter} />
            }
          />
          <FilterPill
            label="Wallet"
            display={
              walletFilter === null
                ? 'All wallets'
                : wallets.find((w) => w.id === walletFilter)?.name ?? 'Wallet'
            }
            active={walletFilter !== null}
            options={walletOptions}
            value={walletFilter}
            onChange={setWalletFilter}
          />
          <FilterPill
            label="Category"
            display={categoryFilter ?? 'All categories'}
            active={categoryFilter !== null}
            options={categoryOptions}
            value={categoryFilter}
            onChange={setCategoryFilter}
          />
          {allLabels.length > 0 && (
            <FilterPill
              label="Label"
              display={labelFilter ?? 'All labels'}
              active={labelFilter !== null}
              options={labelOptions}
              value={labelFilter}
              onChange={setLabelFilter}
            />
          )}
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
        refreshControl={
          <RefreshControl
            refreshing={isSyncing}
            onRefresh={() => void syncData()}
            tintColor="#FF6B4A"
          />
        }
        renderSectionHeader={({ section: { title } }) => (
          <Text className="font-jakarta-bold text-text-low uppercase tracking-widest text-[10px] mt-6 mb-3">
            {title}
          </Text>
        )}
        renderItem={({ item }) => {
          const cat = resolveCategoryStyle(item.category, allCategoriesList);
          const isIncome = item.type === 'INCOME';
          return (
            <View className="mb-3">
              <Swipeable renderRightActions={() => renderRightActions(item.id)}>
                <GradientCard padding="md" radius="row">
                  <View className="flex-row justify-between items-center">
                    {/* flex-1 + min-w-0 so the left side claims only the
                        remaining width — without this, long category +
                        label chips pushed the right-side amount column
                        off-screen ("-$" with no number visible). */}
                    <View className="flex-row items-center gap-4 flex-1" style={{ minWidth: 0 }}>
                      <View
                        className="w-11 h-11 rounded-2xl justify-center items-center"
                        style={{
                          backgroundColor: tintWithAlpha(cat.tint, 0.14),
                          borderWidth: 1,
                          borderColor: tintWithAlpha(cat.tint, 0.32),
                        }}>
                        <Ionicons name={cat.name as any} size={18} color={cat.tint} />
                      </View>
                      <View className="flex-1">
                        <Text className="font-jakarta-bold text-text-high text-base">
                          {item.merchant}
                        </Text>
                        <View className="flex-row flex-wrap gap-1.5 mt-0.5 items-center">
                          <Text
                            className="font-jakarta-bold text-[10px] uppercase tracking-widest"
                            style={{ color: cat.tint }}>
                            {item.category}
                          </Text>
                          {/* Labels: small mint chips, only when present.
                              Tappable — sets the top label filter to the
                              chosen tag. Active filter chip glows. */}
                          {(item.labels ?? []).map(lbl => {
                            const isActiveFilter = labelFilter === lbl;
                            const tint = resolveLabelColor(lbl);
                            return (
                              <Pressable
                                key={lbl}
                                onPress={() => toggleLabelFilter(lbl)}
                                className="px-1.5 rounded"
                                style={{
                                  backgroundColor: isActiveFilter
                                    ? tint
                                    : tintWithAlpha(tint, 0.16),
                                  borderWidth: 1,
                                  borderColor: isActiveFilter
                                    ? tint
                                    : tintWithAlpha(tint, 0.32),
                                  boxShadow: isActiveFilter
                                    ? `0 0 10px ${tintWithAlpha(tint, 0.45)}`
                                    : undefined,
                                }}>
                                <Text
                                  className="font-jakarta-bold text-[9px] uppercase tracking-widest"
                                  style={{ color: isActiveFilter ? '#ffffff' : tint }}>
                                  {lbl}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>
                    </View>
                    <View
                      className="items-end ml-3"
                      // flex-shrink-0 so the amount column never gets
                      // squeezed even if the left side gets very long.
                      style={{ flexShrink: 0 }}>
                      <Text
                        className={`font-jakarta-bold tracking-wide text-base ${
                          isIncome ? 'text-accent-mint' : 'text-text-high'
                        }`}
                        numberOfLines={1}>
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
        ListEmptyComponent={() =>
          isSyncing && !hasSynced ? (
            // Cold-start: show four skeleton rows so the surface doesn't
            // flash an empty message during the initial sync.
            <View className="gap-3 mt-4">
              {[0, 1, 2, 3].map(i => (
                <GradientCard key={i} padding="md" radius="row">
                  <View className="flex-row items-center gap-4">
                    <Skeleton width={44} height={44} radius={14} />
                    <View style={{ flex: 1 }}>
                      <SkeletonRow lines={2} />
                    </View>
                    <Skeleton width={70} height={18} />
                  </View>
                </GradientCard>
              ))}
            </View>
          ) : (
            <View className="items-center justify-center mt-24">
              <View className="w-20 h-20 bg-surface-2 border border-hairline rounded-full justify-center items-center mb-4">
                <Ionicons name="search-outline" size={28} color="#FF6B4A" />
              </View>
              <Text className="font-jakarta-bold text-text-mid text-center">
                No transactions match your filters.
              </Text>
            </View>
          )
        }
      />
    </Surface>
  );
}
