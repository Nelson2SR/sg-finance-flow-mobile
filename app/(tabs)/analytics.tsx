import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Platform } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useFinanceStore } from '../../store/useFinanceStore';
import { CreateBudgetModal } from '../../components/features/CreateBudgetModal';
import { Surface, SurfaceHeaderArea, GradientCard, ScreenHeader, NeonButton } from '../../components/ui';
import { useThemeColors } from '../../hooks/use-theme-colors';

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

export default function AnalyticsScreen() {
  const themeColors = useThemeColors();
  const transactions = useFinanceStore(s => s.transactions);
  const activeWalletId = useFinanceStore(s => s.activeWalletId);
  const budgets = useFinanceStore(s => s.budgets);
  const [budgetModalVisible, setBudgetModalVisible] = useState(false);

  const activeBudgets = budgets.filter(
    b => b.wallets === 'ALL' || (activeWalletId !== null && b.wallets.includes(activeWalletId)),
  );
  // No magic fallback: when the user has no budgets, the aura collapses
  // to the empty track and we render a CTA instead of pretending there's
  // a 4k cap.
  const globalBudgetCap = activeBudgets.reduce((a, b) => a + b.amount, 0);

  const currentSpendRaw = transactions
    .filter(t => t.type === 'EXPENSE' && (activeBudgets.length > 0 ? true : t.walletId === activeWalletId))
    .reduce((acc, curr) => acc + curr.amount, 0);

  const totalIncome = transactions.filter(t => t.type === 'INCOME').reduce((a, b) => a + b.amount, 0);
  const totalSpend = transactions.filter(t => t.type === 'EXPENSE').reduce((a, b) => a + b.amount, 0);
  const cashflowMax = Math.max(totalIncome, totalSpend) || 1;

  // Fixed bar zone so bars never grow past the card and clip the title.
  const CASHFLOW_BAR_AREA = 140;
  const incomeBarHeight = Math.max((totalIncome / cashflowMax) * CASHFLOW_BAR_AREA, 8);
  const spendBarHeight = Math.max((totalSpend / cashflowMax) * CASHFLOW_BAR_AREA, 8);

  return (
    <Surface>
      <SurfaceHeaderArea>
        <ScreenHeader
          eyebrow="Insights Hub"
          title="Analytics"
          action={
            <NeonButton
              icon="add"
              size="sm"
              onPress={() => setBudgetModalVisible(true)}>
              New Budget
            </NeonButton>
          }
        />
      </SurfaceHeaderArea>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingBottom: Platform.OS === 'ios' ? 120 : 100,
          paddingTop: 12,
        }}
        showsVerticalScrollIndicator={false}>
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

        <GradientCard padding="lg" className="mb-8">
          <Text className="font-jakarta-bold text-text-high text-lg mb-6">Cashflow Momentum</Text>
          <View className="flex-row gap-8 justify-center" style={{ height: CASHFLOW_BAR_AREA }}>
            <View className="flex-1 items-center justify-end">
              <View
                className="w-14 rounded-[8px]"
                style={{
                  height: incomeBarHeight,
                  backgroundColor: '#5BE0B0',
                  boxShadow: '0 0 18px rgba(91, 224, 176, 0.35)',
                }}
              />
            </View>
            <View className="flex-1 items-center justify-end">
              <View
                className="w-14 rounded-[8px]"
                style={{
                  height: spendBarHeight,
                  backgroundColor: '#FF5C7C',
                  boxShadow: '0 0 18px rgba(255, 92, 124, 0.35)',
                }}
              />
            </View>
          </View>
          <View className="flex-row gap-8 justify-center mt-4">
            <View className="flex-1 items-center">
              <Text className="font-jakarta-bold text-accent-mint text-base">
                ${totalIncome.toLocaleString()}
              </Text>
              <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest mt-1">
                Income
              </Text>
            </View>
            <View className="flex-1 items-center">
              <Text className="font-jakarta-bold text-accent-rose text-base">
                ${totalSpend.toLocaleString()}
              </Text>
              <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest mt-1">
                Spend
              </Text>
            </View>
          </View>
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
              {activeBudgets.map(b => {
                const artificialSpend =
                  transactions
                    .filter(t => t.merchant && t.type === 'EXPENSE')
                    .reduce((a, c) => a + c.amount, 0) % b.amount;
                const p = Math.min(artificialSpend / b.amount, 1);
                const overBudget = p > 0.8;
                return (
                  <GradientCard key={b.id} padding="md" radius="row">
                    <View className="flex-row justify-between mb-4">
                      <View>
                        <Text className="font-jakarta-bold text-text-high text-base">{b.name}</Text>
                        <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest mt-1">
                          {b.recurrence}
                        </Text>
                      </View>
                      <View className="items-end">
                        <Text className="font-jakarta-bold text-text-high text-base">
                          ${artificialSpend.toFixed(0)}
                        </Text>
                        <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest mt-1">
                          of ${b.amount}
                        </Text>
                      </View>
                    </View>
                    <View className="h-2.5 bg-surface-3 rounded-full overflow-hidden">
                      <View
                        className="h-full rounded-full"
                        style={{
                          width: `${p * 100}%`,
                          backgroundColor: overBudget ? '#FF5C7C' : '#FF6B4A',
                        }}
                      />
                    </View>
                  </GradientCard>
                );
              })}
            </View>
          )}
        </View>

        <Text className="font-jakarta-bold text-text-high text-xl mb-5">Subscription Drains</Text>
        <GradientCard padding="lg" radius="row">
          <View className="items-center py-2">
            <Ionicons name="repeat-outline" size={22} color={themeColors.textLow} />
            <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest mt-2 mb-1">
              Coming soon
            </Text>
            <Text className="font-jakarta text-text-mid text-xs text-center leading-relaxed px-2">
              Recurring charges will surface here once we detect them in your imported activity.
            </Text>
          </View>
        </GradientCard>
      </ScrollView>

      <CreateBudgetModal visible={budgetModalVisible} onClose={() => setBudgetModalVisible(false)} />
    </Surface>
  );
}
