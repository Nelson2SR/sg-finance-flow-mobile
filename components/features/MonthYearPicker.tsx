/**
 * MonthYearPicker — picks a specific month within a selectable year.
 *
 * Designed for the Activity tab's date filter where presets like
 * "This week / This month / This year" don't compose with the user's
 * mental model of "show me April 2026" or "show me transactions in
 * January when I was on holiday".
 *
 * Encodes selection as a `'YYYY-MM'` string (or `'ALL'` for the
 * "no date filter" case). Parent owns the state; this component is
 * stateless beyond the year-scroll position.
 *
 * Year scope: current year + 4 years back (5 total). Older history
 * is unlikely on a 1.0 app; expand the range when usage justifies it.
 */

import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '../../hooks/use-theme-colors';

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export type MonthYearValue = 'ALL' | string; // 'YYYY-MM'

interface Props {
  value: MonthYearValue;
  onChange: (next: MonthYearValue) => void;
}

export function MonthYearPicker({ value, onChange }: Props) {
  const themeColors = useThemeColors();
  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonthIdx = now.getMonth(); // 0-based

  const years = useMemo(
    () => Array.from({ length: 5 }, (_, i) => thisYear - i),
    [thisYear],
  );

  // Parse the current value into (year, monthIdx) so the UI can show
  // which year tab is active + which month chip is selected.
  const parsed = useMemo(() => {
    if (value === 'ALL') return { year: thisYear, monthIdx: -1 };
    const [y, m] = value.split('-').map((n) => parseInt(n, 10));
    return { year: y, monthIdx: m - 1 };
  }, [value, thisYear]);

  const [selectedYear, setSelectedYear] = useState<number>(parsed.year);

  const pickMonth = (monthIdx: number) => {
    const code = `${selectedYear}-${String(monthIdx + 1).padStart(2, '0')}`;
    onChange(code);
  };

  return (
    <View className="mb-3">
      {/* "All time" toggle — single full-width chip on its own row so
          the user has a clear "clear the date filter" affordance. */}
      <Pressable
        onPress={() => onChange('ALL')}
        className="flex-row items-center justify-between p-3 rounded-2xl mb-3"
        style={{
          backgroundColor: value === 'ALL' ? 'rgba(255, 107, 74, 0.12)' : themeColors.surface2,
          borderWidth: 1,
          borderColor: value === 'ALL' ? 'rgba(255, 107, 74, 0.45)' : themeColors.hairline,
        }}>
        <Text className="font-jakarta-bold text-text-high text-sm">All time</Text>
        {value === 'ALL' && <Ionicons name="checkmark-circle" size={18} color="#FF6B4A" />}
      </Pressable>

      {/* Year selector — horizontal scroll with the 5 most recent. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingRight: 16 }}
        className="mb-3">
        {years.map((y) => {
          const selected = y === selectedYear;
          return (
            <Pressable
              key={y}
              onPress={() => setSelectedYear(y)}
              className="px-4 py-2 rounded-full border"
              style={{
                backgroundColor: selected ? '#FF6B4A' : themeColors.surface2,
                borderColor: selected ? '#FF6B4A' : themeColors.hairline,
              }}>
              <Text
                className={`font-jakarta-bold text-sm ${
                  selected ? 'text-white' : 'text-text-mid'
                }`}>
                {y}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* 3-column month grid. Disabled for future months in current year. */}
      <View className="flex-row flex-wrap" style={{ marginHorizontal: -4 }}>
        {MONTH_LABELS.map((label, idx) => {
          const isFuture = selectedYear === thisYear && idx > thisMonthIdx;
          const isPicked =
            value !== 'ALL' && parsed.year === selectedYear && parsed.monthIdx === idx;
          return (
            <View key={label} style={{ width: '33.333%', padding: 4 }}>
              <Pressable
                onPress={() => !isFuture && pickMonth(idx)}
                disabled={isFuture}
                className="py-3 rounded-2xl items-center border"
                style={{
                  backgroundColor: isPicked
                    ? '#FF6B4A'
                    : isFuture
                      ? 'transparent'
                      : themeColors.surface2,
                  borderColor: isPicked
                    ? '#FF6B4A'
                    : isFuture
                      ? themeColors.hairline
                      : themeColors.hairline,
                  opacity: isFuture ? 0.35 : 1,
                }}>
                <Text
                  className={`font-jakarta-bold text-sm ${
                    isPicked ? 'text-white' : 'text-text-high'
                  }`}>
                  {label}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** Helper: turn a `'YYYY-MM'` code into [start, end) Date pair for
 *  client-side filtering. 'ALL' returns a very-wide range. */
export function monthYearToRange(value: MonthYearValue): { start: Date; end: Date } {
  if (value === 'ALL') {
    return { start: new Date(2000, 0, 1), end: new Date(2099, 11, 31) };
  }
  const [y, m] = value.split('-').map((n) => parseInt(n, 10));
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0, 23, 59, 59, 999);
  return { start, end };
}

/** Helper: short pill display for the current MonthYearValue. */
export function monthYearDisplay(value: MonthYearValue): string {
  if (value === 'ALL') return 'All time';
  const [y, m] = value.split('-').map((n) => parseInt(n, 10));
  return `${MONTH_LABELS[m - 1]} ${y}`;
}
