import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, Platform } from 'react-native';
import type { MonthYearValue } from '../../components/features/MonthYearPicker';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import {
  useFinanceStore,
  getBudgetAmountForMonth,
  currentMonthCode,
  type Budget,
} from '../../store/useFinanceStore';
import { useCategoriesStore } from '../../store/useCategoriesStore';
import { CreateBudgetModal } from '../../components/features/CreateBudgetModal';
import { EditBudgetModal } from '../../components/features/EditBudgetModal';
import { CategoryDonut } from '../../components/features/CategoryDonut';
import { FilterPill } from '../../components/features/FilterPill';
import { MonthYearPicker, monthYearDisplay } from '../../components/features/MonthYearPicker';
import { Surface, SurfaceHeaderArea, GradientCard, ScreenHeader, NeonButton } from '../../components/ui';
import { useThemeColors } from '../../hooks/use-theme-colors';

/** First / last day of a `'YYYY-MM'` month code as a half-open
 *  [start, end) range — matches the Activity tab's pattern so
 *  inclusion semantics stay consistent across the app. */
function monthCodeRange(monthCode: string): { start: Date; end: Date } {
  const [y, m] = monthCode.split('-').map(Number);
  return {
    start: new Date(y, m - 1, 1),
    end: new Date(y, m, 1),
  };
}

const AURA_RADIUS = 100;
const AURA_CIRCUMFERENCE = 2 * Math.PI * AURA_RADIUS;

const AmbientAura = ({ overallLimit, currentSpend }: { overallLimit: number; currentSpend: number }) => {
  const themeColors = useThemeColors();
  const ratio = overallLimit > 0 ? Math.min(currentSpend / overallLimit, 1) : 0;
  const remaining = Math.max(overallLimit - currentSpend, 0);

  // Arc color shifts through mint → amber → rose as the spend ratio climbs.
  let stroke = '#5BE0B0';
  if (ratio > 0.8) stroke = '#FF5C7C';
  else if (ratio > 0.5) stroke = '#FFB547';

  // stroke-dasharray on a full Circle avoids the degenerate-arc bug from
  // the previous Path-based implementation.
  const dashLength = ratio * AURA_CIRCUMFERENCE;

  return (
    <View className="items-center justify-center my-8">
      <Svg width={240} height={240} viewBox="0 0 240 240">
        <Circle cx={120} cy={120} r={AURA_RADIUS} stroke={themeColors.hairline} strokeWidth={14} fill="transparent" />
        {ratio > 0 && (
          <Circle
            cx={120}
            cy={120}
            r={AURA_RADIUS}
            stroke={stroke}
            strokeWidth={14}
            strokeLinecap="round"
            fill="transparent"
            strokeDasharray={`${dashLength} ${AURA_CIRCUMFERENCE}`}
            transform="rotate(-90 120 120)"
          />
        )}
      </Svg>
      <View className="absolute inset-0 items-center justify-center">
        <Text className="font-jakarta-bold text-text-low tracking-widest text-[10px] uppercase mb-1">
          Safe to Spend
        </Text>
        <Text className="font-jakarta-light text-text-high text-[40px] tracking-tighter">
          ${remaining.toFixed(0)}
        </Text>
      </View>
    </View>
  );
};

type InsightTab = 'budget' | 'category' | 'recurring';

const TAB_OPTIONS: { id: InsightTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'budget', label: 'Budget', icon: 'wallet-outline' },
  { id: 'category', label: 'Category', icon: 'pie-chart-outline' },
  { id: 'recurring', label: 'Recurring', icon: 'repeat-outline' },
];

interface InsightTabsProps {
  active: InsightTab;
  onChange: (next: InsightTab) => void;
}

const InsightTabs = ({ active, onChange }: InsightTabsProps) => {
  const themeColors = useThemeColors();
  return (
    <View
      className="flex-row p-1 rounded-full mb-4 border"
      style={{
        backgroundColor: themeColors.surface2,
        borderColor: themeColors.hairline,
      }}>
      {TAB_OPTIONS.map((opt) => {
        const isActive = opt.id === active;
        return (
          <Pressable
            key={opt.id}
            onPress={() => onChange(opt.id)}
            className="flex-1 flex-row items-center justify-center gap-1.5 py-2 rounded-full"
            style={{
              backgroundColor: isActive ? '#FF6B4A' : 'transparent',
              boxShadow: isActive ? '0 4px 14px rgba(255, 107, 74, 0.45)' : undefined,
            }}>
            <Ionicons
              name={opt.icon}
              size={14}
              color={isActive ? '#fff' : themeColors.textMid}
            />
            <Text
              className={`font-jakarta-bold text-xs ${
                isActive ? 'text-white' : 'text-text-mid'
              }`}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

export default function AnalyticsScreen() {
  const themeColors = useThemeColors();
  const transactions = useFinanceStore(s => s.transactions);
  const wallets = useFinanceStore(s => s.wallets);
  const budgets = useFinanceStore(s => s.budgets);
  const categoriesByKind = useCategoriesStore(s => s.categories);
  const [budgetModalVisible, setBudgetModalVisible] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  // Month the whole tab is scoped to. Defaults to the current month.
  // Insights is intentionally month-focused, so we never expose an
  // "all time" option here.
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthCode());
  // Wallet the whole tab is scoped to. `null` means "all wallets" —
  // the aggregate view, which is the default for Insights so the
  // user gets a portfolio-wide picture before narrowing. Budget,
  // Category and Recurring all honour this filter.
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<InsightTab>('category');
  const monthRange = useMemo(() => monthCodeRange(selectedMonth), [selectedMonth]);
  const isCurrentMonth = selectedMonth === currentMonthCode();

  // Build the wallet picker options. Top sentinel row clears the
  // filter; bank/type/currency captions echo the Activity tab's
  // dropdown so the two screens read consistently.
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
  const walletPillDisplay =
    selectedWalletId === null
      ? 'All wallets'
      : wallets.find((w) => w.id === selectedWalletId)?.name ?? 'Wallet';
  const walletScopeLabel =
    selectedWalletId === null
      ? null
      : wallets.find((w) => w.id === selectedWalletId)?.name ?? null;

  // Budgets in scope. "All wallets" shows every budget; otherwise we
  // keep ones that explicitly include the selected wallet (or have
  // ALL scope).
  const activeBudgets = useMemo(
    () =>
      selectedWalletId === null
        ? budgets
        : budgets.filter(
            (b) => b.wallets === 'ALL' || b.wallets.includes(selectedWalletId),
          ),
    [budgets, selectedWalletId],
  );
  // No magic fallback: when the user has no budgets, the aura collapses
  // to the empty track and we render a CTA instead of pretending there's
  // a 4k cap.
  const globalBudgetCap = activeBudgets.reduce(
    (a, b) => a + getBudgetAmountForMonth(b, selectedMonth),
    0,
  );

  // Transactions scoped to the selected month + selected wallet.
  // Used by every tab's downstream calculations (category donuts,
  // safe-to-spend ratio, untracked-spend callout).
  const monthTxs = useMemo(
    () =>
      transactions.filter((t) => {
        if (t.date < monthRange.start || t.date >= monthRange.end) return false;
        if (selectedWalletId !== null && t.walletId !== selectedWalletId) return false;
        return true;
      }),
    [transactions, monthRange.start, monthRange.end, selectedWalletId],
  );
  const walletScopedTxs = useMemo(
    () =>
      selectedWalletId === null
        ? transactions
        : transactions.filter((t) => t.walletId === selectedWalletId),
    [transactions, selectedWalletId],
  );
  const currentSpendRaw = monthTxs
    .filter((t) => t.type === 'EXPENSE')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const headerAction =
    activeTab === 'budget' ? (
      <NeonButton
        icon="add"
        size="sm"
        onPress={() => setBudgetModalVisible(true)}>
        New Budget
      </NeonButton>
    ) : undefined;

  return (
    <Surface>
      <SurfaceHeaderArea>
        <ScreenHeader
          eyebrow="Insights Hub"
          title="Analytics"
          action={headerAction}
        />
      </SurfaceHeaderArea>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingBottom: Platform.OS === 'ios' ? 120 : 100,
          paddingTop: 4,
        }}
        showsVerticalScrollIndicator={false}>
        {/* Filter row — Date + Wallet split 50/50 across the full
            screen width. Eyebrow labels are hidden to keep the row
            short so the first Category card lands above the fold.
            Insights is month-focused, so the Date pill ignores
            the "All time" sentinel. */}
        <View className="flex-row gap-3 mb-3">
          <FilterPill
            label="Date"
            fullWidth
            hideLabel
            display={monthYearDisplay(selectedMonth)}
            active={!isCurrentMonth}
            options={[]}
            value={selectedMonth as MonthYearValue}
            onChange={(next) => {
              if (next === 'ALL') return;
              setSelectedMonth(next as string);
            }}
            extraContent={
              <MonthYearPicker
                value={selectedMonth}
                onChange={(next) => {
                  if (next === 'ALL') return;
                  setSelectedMonth(next);
                }}
              />
            }
          />
          <FilterPill
            label="Wallet"
            fullWidth
            hideLabel
            display={walletPillDisplay}
            active={selectedWalletId !== null}
            options={walletOptions}
            value={selectedWalletId}
            onChange={setSelectedWalletId}
          />
        </View>

        <InsightTabs active={activeTab} onChange={setActiveTab} />

        {activeTab === 'budget' && (
          <>
            <GradientCard padding="lg" accent="coral" className="mb-8 items-center">
              {activeBudgets.length > 0 ? (
                <AmbientAura overallLimit={globalBudgetCap} currentSpend={currentSpendRaw} />
              ) : (
                <View className="items-center justify-center py-12 px-6">
                  <Text className="font-jakarta-bold text-text-low tracking-widest text-[10px] uppercase mb-2">
                    No budgets yet
                  </Text>
                  <Text className="font-jakarta text-text-mid text-sm text-center leading-relaxed">
                    Tap “New Budget” to set a monthly cap and start tracking your safe-to-spend.
                  </Text>
                </View>
              )}
            </GradientCard>

            <View className="mb-8">
              <Text className="font-jakarta-bold text-text-high text-xl mb-5">Active Routines</Text>

              {activeBudgets.length === 0 ? (
                <Pressable onPress={() => setBudgetModalVisible(true)}>
                  <View
                    className="rounded-[24px] p-8 items-center justify-center bg-surface-2/40"
                    style={{
                      borderStyle: 'dashed',
                      borderWidth: 1.5,
                      borderColor: themeColors.textDim,
                    }}>
                    <Ionicons name="pie-chart-outline" size={28} color={themeColors.textLow} />
                    <Text className="font-jakarta-bold text-text-low text-center text-xs uppercase tracking-widest mt-3">
                      No active budgets
                    </Text>
                  </View>
                </Pressable>
              ) : (
                <View className="gap-3">
                  {activeBudgets
                    // DAILY budgets only make sense for the current
                    // month — backfilling "today's cap" against a past
                    // month would produce nonsense numbers. Hide them
                    // when scrolled into history; MONTHLY + ONCE stay
                    // visible and scope cleanly to the selected month.
                    .filter((b) => isCurrentMonth || b.recurrence !== 'DAILY')
                    .map((b) => {
                      const hasCategoryFilter = (b.categories?.length ?? 0) > 0;
                      // All cards now scope to the SELECTED month, not
                      // "right now". For ONCE budgets we still take the
                      // full lifetime up to the end of the picked month,
                      // so picking April shows the running total as of
                      // April 30 — that's what "ONCE budget in April"
                      // intuitively means.
                      const scopeStart =
                        b.recurrence === 'ONCE' ? new Date(0) : monthRange.start;
                      const inScope = transactions.filter((t) => {
                        if (t.type !== 'EXPENSE') return false;
                        if (t.date < scopeStart || t.date >= monthRange.end) return false;
                        if (b.wallets !== 'ALL' && !b.wallets.includes(t.walletId)) return false;
                        // Narrow further to the wallet picker's selection
                        // when one is active — a budget that covers
                        // multiple wallets should still respect the
                        // top-of-page filter.
                        if (selectedWalletId !== null && t.walletId !== selectedWalletId) return false;
                        if (hasCategoryFilter && !b.categories.includes(t.category)) return false;
                        return true;
                      });
                      const realSpend = inScope.reduce((a, c) => a + c.amount, 0);
                      const budgetAmount = getBudgetAmountForMonth(b, selectedMonth);
                      const p = budgetAmount > 0 ? Math.min(realSpend / budgetAmount, 1) : 0;
                      const overBudget = p > 0.8;
                      const periodLabel =
                        b.recurrence === 'DAILY'
                          ? 'Today'
                          : b.recurrence === 'MONTHLY'
                            ? monthYearDisplay(selectedMonth)
                            : 'All-time';
                      return (
                        <Pressable key={b.id} onPress={() => setEditingBudget(b)}>
                          <GradientCard padding="md" radius="row">
                            <View className="flex-row justify-between mb-2">
                              <View style={{ flex: 1 }}>
                                <Text className="font-jakarta-bold text-text-high text-base">{b.name}</Text>
                                <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest mt-1">
                                  {periodLabel}
                                  {hasCategoryFilter ? ` · ${b.categories.length} ${b.categories.length === 1 ? 'category' : 'categories'}` : ''}
                                </Text>
                              </View>
                              <View className="items-end">
                                <Text className="font-jakarta-bold text-text-high text-base">
                                  ${realSpend.toFixed(0)}
                                </Text>
                                <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest mt-1">
                                  of ${budgetAmount}
                                </Text>
                              </View>
                            </View>
                            {hasCategoryFilter && (
                              <Text className="font-jakarta text-text-low text-[11px] mb-3" numberOfLines={1}>
                                {b.categories.slice(0, 4).join(' · ')}
                                {b.categories.length > 4 ? ` · +${b.categories.length - 4} more` : ''}
                              </Text>
                            )}
                            <View className="h-2.5 bg-surface-3 rounded-full overflow-hidden mt-1">
                              <View
                                className="h-full rounded-full"
                                style={{
                                  width: `${p * 100}%`,
                                  backgroundColor: overBudget ? '#FF5C7C' : '#FF6B4A',
                                }}
                              />
                            </View>
                          </GradientCard>
                        </Pressable>
                      );
                    })}
                </View>
              )}

              {/* Untracked spend: EXPENSE rows in the SELECTED month that
                  no budget's category list covers. Helps answer "where
                  is the rest of my spending going for this month?". */}
              {(() => {
                const trackedCategories = new Set<string>(
                  activeBudgets.flatMap((b) => b.categories ?? []),
                );
                const untracked = monthTxs
                  .filter((t) => t.type === 'EXPENSE' && !trackedCategories.has(t.category))
                  .reduce((a, c) => a + c.amount, 0);
                if (untracked <= 0 || activeBudgets.length === 0) return null;
                return (
                  <View className="mt-3">
                    <GradientCard padding="md" radius="row">
                      <View className="flex-row justify-between items-center">
                        <View className="flex-row items-center gap-3">
                          <View
                            className="w-9 h-9 rounded-2xl justify-center items-center"
                            style={{ backgroundColor: 'rgba(255, 181, 71, 0.16)' }}>
                            <Ionicons name="alert-circle-outline" size={18} color="#FFB547" />
                          </View>
                          <View>
                            <Text className="font-jakarta-bold text-text-high text-sm">
                              Untracked {isCurrentMonth ? 'this month' : `in ${monthYearDisplay(selectedMonth)}`}
                            </Text>
                            <Text className="font-jakarta text-text-low text-[11px] mt-0.5">
                              No budget covers these categories yet.
                            </Text>
                          </View>
                        </View>
                        <Text className="font-jakarta-bold text-accent-amber text-base">
                          ${untracked.toFixed(0)}
                        </Text>
                      </View>
                    </GradientCard>
                  </View>
                );
              })()}
            </View>
          </>
        )}

        {activeTab === 'category' && (
          <>
            <CategoryDonut
              transactions={walletScopedTxs}
              categories={categoriesByKind}
              txType="EXPENSE"
              monthCode={selectedMonth}
            />
            <CategoryDonut
              transactions={walletScopedTxs}
              categories={categoriesByKind}
              txType="INCOME"
              monthCode={selectedMonth}
            />
          </>
        )}

        {activeTab === 'recurring' && (
          <View className="mb-8">
            <Text className="font-jakarta-bold text-text-high text-xl mb-5">Subscription Drains</Text>
            <GradientCard padding="lg" radius="card">
              <View className="items-center py-6">
                <View
                  className="w-12 h-12 rounded-2xl justify-center items-center mb-3"
                  style={{ backgroundColor: 'rgba(255, 107, 74, 0.15)' }}>
                  <Ionicons name="repeat-outline" size={22} color="#FF6B4A" />
                </View>
                <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest mb-2">
                  Coming soon
                </Text>
                <Text className="font-jakarta text-text-mid text-xs text-center leading-relaxed px-4">
                  Recurring charges for {monthYearDisplay(selectedMonth)}
                  {walletScopeLabel ? ` on ${walletScopeLabel}` : ' across all wallets'}
                  {' '}will surface here once we detect them in your imported activity.
                </Text>
              </View>
            </GradientCard>
          </View>
        )}
      </ScrollView>

      <CreateBudgetModal visible={budgetModalVisible} onClose={() => setBudgetModalVisible(false)} />
      <EditBudgetModal
        visible={editingBudget !== null}
        budget={editingBudget}
        onClose={() => setEditingBudget(null)}
      />
    </Surface>
  );
}
