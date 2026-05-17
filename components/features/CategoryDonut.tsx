/**
 * CategoryDonut — donut chart of spend share by category for the
 * active wallet's recent activity.
 *
 * Design notes:
 *   • Hand-rolled with react-native-svg (already a dep, no extra
 *     install). Each slice is a stroked `Circle` with
 *     `strokeDasharray` set to the slice arc length. This avoids the
 *     Path-arc rendering bugs that bit `AmbientAura` previously.
 *   • Empty / loading states are explicit — no slices when no spend.
 *   • Slice colour resolves from the user's category palette
 *     (Vault Config), so a category that's red in the picker is red
 *     here too. Falls back to a deterministic accent from the
 *     coral / mint / amber / rose / violet rotation.
 */

import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

import type { Transaction } from '../../store/useFinanceStore';
import type { Category } from '../../store/useCategoriesStore';
import { GradientCard } from '../ui';

const SIZE = 180;
const STROKE = 22;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const ROTATION_OFFSET = -90; // start at 12 o'clock

const FALLBACK_PALETTE = ['#FF6B4A', '#5BE0B0', '#FFB547', '#FF5C7C', '#A78BFA', '#5DADE2', '#F49AC2'];

interface Props {
  transactions: Transaction[];
  categories: Category[];
  /**
   * Which side of the cashflow to slice. Defaults to `'EXPENSE'`
   * so existing call-sites keep their old behaviour; pass
   * `'INCOME'` for the income donut on Home.
   */
  txType?: 'EXPENSE' | 'INCOME';
  /**
   * Window mode:
   *   • `'last-month'` — slice the previous calendar month
   *     (e.g. April 1-30 when today is May 17). Title says
   *     "Last month".
   *   • `'last-30-days'` — rolling 30-day window from today.
   *     Title says "Last 30 days". Legacy fallback so any
   *     remaining call site keeps working.
   * Defaults to `'last-month'` since that's the v1.0(4) Home design.
   */
  window?: 'last-month' | 'last-30-days';
  /**
   * Explicit `'YYYY-MM'` month override. When set, slices that
   * specific calendar month and the title shows "Apr 2026". Takes
   * precedence over `window`. Used by Insights, where the user
   * drives the date themselves.
   */
  monthCode?: string;
}

interface Slice {
  category: string;
  amount: number;
  share: number;
  color: string;
}

/**
 * Compute [start, end) date range for the requested window mode.
 * `last-month` always returns the FULL previous calendar month so
 * the Home Spend / Income pies stay symmetric and comparable.
 */
function windowRange(window: 'last-month' | 'last-30-days'): { start: Date; end: Date; label: string } {
  if (window === 'last-30-days') {
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return { start, end: new Date(), label: 'Last 30 days' };
  }
  // last-month: first day of previous calendar month → first day of this month
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 1);
  const label = start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  return { start, end, label };
}

function buildSlices(
  transactions: Transaction[],
  categories: Category[],
  txType: 'EXPENSE' | 'INCOME',
  range: { start: Date; end: Date },
): { slices: Slice[]; total: number } {
  const totals = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.type !== txType) continue;
    if (tx.date < range.start || tx.date >= range.end) continue;
    totals.set(tx.category, (totals.get(tx.category) ?? 0) + tx.amount);
  }

  const total = Array.from(totals.values()).reduce((a, b) => a + b, 0);
  if (total === 0) return { slices: [], total: 0 };

  // Sort big → small so the donut reads naturally and the legend
  // surfaces the categories that actually matter.
  const sorted = [...totals.entries()].sort(([, a], [, b]) => b - a);
  return {
    slices: sorted.map(([name, amount], idx) => {
      const cat = categories.find((c) => c.name === name);
      return {
        category: name,
        amount,
        share: amount / total,
        color: cat?.color ?? FALLBACK_PALETTE[idx % FALLBACK_PALETTE.length],
      };
    }),
    total,
  };
}

function monthCodeRange(monthCode: string): { start: Date; end: Date; label: string } {
  const [y, m] = monthCode.split('-').map((n) => parseInt(n, 10));
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1);
  const label = start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  return { start, end, label };
}

export function CategoryDonut({
  transactions,
  categories,
  txType = 'EXPENSE',
  window = 'last-month',
  monthCode,
}: Props) {
  const range = useMemo(
    () => (monthCode ? monthCodeRange(monthCode) : windowRange(window)),
    [window, monthCode],
  );
  const { slices, total } = useMemo(
    () => buildSlices(transactions, categories, txType, range),
    [transactions, categories, txType, range],
  );
  const title = txType === 'INCOME' ? 'Category income' : 'Category spend';
  const totalLabel = txType === 'INCOME' ? 'total income' : 'total spend';
  const emptyHeadline = txType === 'INCOME' ? 'No income yet' : 'No spend yet';
  const emptyBody =
    txType === 'INCOME'
      ? `Categorised income in ${range.label} will appear here.`
      : `Categorised expenses in ${range.label} will appear here.`;

  return (
    <GradientCard padding="lg" className="mb-8 overflow-hidden">
      <View className="flex-row justify-between items-center mb-6">
        <View>
          <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest mb-1">
            {range.label}
          </Text>
          <Text className="font-jakarta-bold text-text-high text-lg">{title}</Text>
        </View>
        {total > 0 && (
          <View className="items-end">
            <Text className="font-jakarta-bold text-text-high text-base">
              ${total.toFixed(0)}
            </Text>
            <Text className="font-jakarta text-text-low text-[10px]">{totalLabel}</Text>
          </View>
        )}
      </View>

      {slices.length === 0 ? (
        <View className="items-center justify-center py-10">
          <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest mb-2">
            {emptyHeadline}
          </Text>
          <Text className="font-jakarta text-text-mid text-sm text-center leading-relaxed px-4">
            {emptyBody}
          </Text>
        </View>
      ) : (
        <View className="flex-row gap-6 items-center">
          <View style={{ width: SIZE, height: SIZE }}>
            <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
              {/* Track */}
              <Circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                stroke="rgba(0,0,0,0.06)"
                strokeWidth={STROKE}
                fill="transparent"
              />
              {/* Slices: each arc is a Circle with a clipped
                  strokeDasharray, rotated to follow the running
                  cumulative share so the slices butt up cleanly. */}
              <G rotation={ROTATION_OFFSET} originX={SIZE / 2} originY={SIZE / 2}>
                {(() => {
                  let cumulative = 0;
                  return slices.map((s, i) => {
                    const dashLength = s.share * CIRCUMFERENCE;
                    const rotation = (cumulative / 1) * 360;
                    cumulative += s.share;
                    return (
                      <G
                        key={s.category}
                        rotation={rotation}
                        originX={SIZE / 2}
                        originY={SIZE / 2}>
                        <Circle
                          cx={SIZE / 2}
                          cy={SIZE / 2}
                          r={RADIUS}
                          stroke={s.color}
                          strokeWidth={STROKE}
                          fill="transparent"
                          strokeDasharray={`${dashLength} ${CIRCUMFERENCE}`}
                          strokeLinecap="butt"
                        />
                      </G>
                    );
                  });
                })()}
              </G>
            </Svg>
          </View>

          {/* Legend — caps at the top 5 categories. The "rest" row is
              shown only when there are more, so a single-category month
              doesn't render a confusing dangling "Other 0 %". */}
          <View className="flex-1 gap-2">
            {slices.slice(0, 5).map((s) => (
              <View key={s.category} className="flex-row items-center gap-2">
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 3,
                    backgroundColor: s.color,
                  }}
                />
                <Text className="font-jakarta-bold text-text-mid text-xs flex-1" numberOfLines={1}>
                  {s.category}
                </Text>
                <Text className="font-jakarta-bold text-text-low text-[11px] tracking-widest">
                  {Math.round(s.share * 100)}%
                </Text>
              </View>
            ))}
            {slices.length > 5 && (
              <Text className="font-jakarta text-text-low text-[10px] mt-1">
                + {slices.length - 5} more
              </Text>
            )}
          </View>
        </View>
      )}
    </GradientCard>
  );
}
