import React, { useMemo } from 'react';
import { View, Text, Dimensions } from 'react-native';
import Svg, { Rect, Defs, LinearGradient, Stop, G } from 'react-native-svg';
import { GradientCard } from '../ui';
import { useFinanceStore, Transaction } from '../../store/useFinanceStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 48;
const CHART_HEIGHT = 160;

/**
 * Bucket transactions into income/expense pairs for the 6-month bar
 * chart. The rightmost bar is the `anchorMonth` (the month the user
 * picked in Insights, defaults to today) — that keeps the "vs Prev
 * Period" delta meaningfully scoped to the half-windows the user
 * actually sees.
 */
function build6MonthSeries(transactions: Transaction[], anchorMonth: Date) {
  const buckets: { month: string; income: number; expense: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(anchorMonth.getFullYear(), anchorMonth.getMonth() - i, 1);
    buckets.push({
      month: d.toLocaleDateString('en-US', { month: 'short' }),
      income: 0,
      expense: 0,
    });
  }
  // O(N) over all txs — fine even at thousands of rows; only the last
  // 6 buckets are addressable so anything outside the window silently
  // drops out.
  const firstBucketStart = new Date(anchorMonth.getFullYear(), anchorMonth.getMonth() - 5, 1);
  const afterLastBucket = new Date(anchorMonth.getFullYear(), anchorMonth.getMonth() + 1, 1);
  for (const tx of transactions) {
    if (tx.date < firstBucketStart || tx.date >= afterLastBucket) continue;
    const idx =
      (tx.date.getFullYear() - firstBucketStart.getFullYear()) * 12 +
      (tx.date.getMonth() - firstBucketStart.getMonth());
    if (idx < 0 || idx > 5) continue;
    if (tx.type === 'INCOME') buckets[idx].income += tx.amount;
    else buckets[idx].expense += tx.amount;
  }
  return buckets;
}

function computeMomentumDelta(buckets: { income: number; expense: number }[]): number | null {
  // Net cashflow comparison: recent 3 months vs prior 3 months. Returns
  // a percentage delta, or null when the prior window was flat (avoid
  // divide-by-zero / "Infinity%" rendering).
  const prior = buckets.slice(0, 3).reduce((a, b) => a + (b.income - b.expense), 0);
  const recent = buckets.slice(3).reduce((a, b) => a + (b.income - b.expense), 0);
  if (prior === 0) return null;
  return ((recent - prior) / Math.abs(prior)) * 100;
}

interface TrendChartProps {
  /**
   * Month the rightmost bar represents. ISO `YYYY-MM` form, e.g.
   * `'2026-04'`. Defaults to the current month when omitted, which
   * preserves the original Home behaviour. Insights passes the
   * value from its month picker so scrolling the picker scrolls the
   * 6-month window with it.
   */
  anchorMonth?: string;
  /**
   * When set, scope the series to a single wallet (Home uses this so
   * the bars track the currently-swiped wallet card). When omitted,
   * the chart aggregates across every wallet — useful for the
   * Insights view where wallets aren't the lens.
   */
  walletId?: string | null;
}

export const TrendChart = ({ anchorMonth, walletId }: TrendChartProps = {}) => {
  const allTransactions = useFinanceStore(s => s.transactions);
  const transactions = useMemo(
    () => (walletId ? allTransactions.filter((t) => t.walletId === walletId) : allTransactions),
    [allTransactions, walletId],
  );

  const anchorDate = useMemo(() => {
    if (!anchorMonth) return new Date();
    const [y, m] = anchorMonth.split('-').map(Number);
    return new Date(y, m - 1, 1);
  }, [anchorMonth]);

  const buckets = useMemo(
    () => build6MonthSeries(transactions, anchorDate),
    [transactions, anchorDate],
  );
  const months = buckets.map(b => b.month);
  const data = buckets.map(b => [b.income, b.expense] as [number, number]);
  const maxVal = Math.max(1, ...data.flat());
  const hasAnyData = data.flat().some(v => v > 0);
  const delta = computeMomentumDelta(buckets);

  const barWidth = 14;
  const SVG_WIDTH = CHART_WIDTH - 48;
  const pairWidth = barWidth * 2 + 4;
  const gap = (SVG_WIDTH - data.length * pairWidth) / (data.length + 1);

  return (
    <GradientCard padding="lg" className="mb-8 overflow-hidden">
      <View className="flex-row justify-between items-center mb-6">
        <View>
          <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest mb-1">
            6-Month Momentum
          </Text>
          <Text className="font-jakarta-bold text-text-high text-lg">Cashflow Trend</Text>
        </View>
        {delta !== null && (
          <View className="items-end">
            <Text
              className={`font-jakarta-bold text-xs ${
                delta >= 0 ? 'text-accent-mint' : 'text-accent-rose'
              }`}>
              {delta >= 0 ? '+' : ''}
              {delta.toFixed(1)}%
            </Text>
            <Text className="font-jakarta text-text-low text-[10px]">vs Prev Period</Text>
          </View>
        )}
      </View>

      {hasAnyData ? (
        <>
          <View style={{ height: CHART_HEIGHT, width: SVG_WIDTH }}>
            <Svg width={SVG_WIDTH} height={CHART_HEIGHT}>
              <Defs>
                <LinearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#5BE0B0" />
                  <Stop offset="1" stopColor="#5BE0B033" />
                </LinearGradient>
                <LinearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#FF5C7C" />
                  <Stop offset="1" stopColor="#FF5C7C33" />
                </LinearGradient>
              </Defs>

              <G transform={`translate(0, ${CHART_HEIGHT})`}>
                {data.map((vals, i) => {
                  const x = gap + i * (pairWidth + gap);
                  const incomeH = (vals[0] / maxVal) * (CHART_HEIGHT - 30);
                  const expenseH = (vals[1] / maxVal) * (CHART_HEIGHT - 30);

                  return (
                    <G key={i}>
                      <Rect x={x} y={-incomeH} width={barWidth} height={incomeH} fill="url(#incomeGrad)" rx={4} />
                      <Rect
                        x={x + barWidth + 4}
                        y={-expenseH}
                        width={barWidth}
                        height={expenseH}
                        fill="url(#expenseGrad)"
                        rx={4}
                      />
                    </G>
                  );
                })}
              </G>
            </Svg>
          </View>

          <View className="flex-row justify-between mt-4 px-2">
            {months.map((m, i) => (
              <Text key={i} className="font-jakarta-bold text-text-low text-[10px] uppercase">
                {m}
              </Text>
            ))}
          </View>
        </>
      ) : (
        <View className="items-center justify-center py-10">
          <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest mb-2">
            No activity yet
          </Text>
          <Text className="font-jakarta text-text-mid text-sm text-center leading-relaxed px-2">
            Import a statement or add a transaction — your 6-month momentum will appear here.
          </Text>
        </View>
      )}
    </GradientCard>
  );
};
