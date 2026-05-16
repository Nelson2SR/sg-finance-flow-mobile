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
  /** Limit the chart to the last N days of activity. Defaults to 30. */
  windowDays?: number;
}

interface Slice {
  category: string;
  amount: number;
  share: number;
  color: string;
}

function buildSlices(
  transactions: Transaction[],
  categories: Category[],
  windowDays: number,
): { slices: Slice[]; total: number } {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - windowDays);

  const totals = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.type !== 'EXPENSE') continue;
    if (tx.date < cutoff) continue;
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

export function CategoryDonut({ transactions, categories, windowDays = 30 }: Props) {
  const { slices, total } = useMemo(
    () => buildSlices(transactions, categories, windowDays),
    [transactions, categories, windowDays],
  );

  return (
    <GradientCard padding="lg" className="mb-8 overflow-hidden">
      <View className="flex-row justify-between items-center mb-6">
        <View>
          <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest mb-1">
            Last {windowDays} days
          </Text>
          <Text className="font-jakarta-bold text-text-high text-lg">Category spend</Text>
        </View>
        {total > 0 && (
          <View className="items-end">
            <Text className="font-jakarta-bold text-text-high text-base">
              ${total.toFixed(0)}
            </Text>
            <Text className="font-jakarta text-text-low text-[10px]">total spend</Text>
          </View>
        )}
      </View>

      {slices.length === 0 ? (
        <View className="items-center justify-center py-10">
          <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest mb-2">
            No spend yet
          </Text>
          <Text className="font-jakarta text-text-mid text-sm text-center leading-relaxed px-4">
            Categorised expenses in the last {windowDays} days will appear here.
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
