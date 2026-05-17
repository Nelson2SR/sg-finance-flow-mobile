/**
 * HeroMonthPicker — large, prominent month navigator used at the top
 * of the Insights tab. Replaces the small FilterPill for screens where
 * the date is the primary axis and deserves visual weight.
 *
 * Layout:
 *   ┌───────────────────────────────────────────────────────────┐
 *   │  ◀         APR 2026 · This month                       ▶  │
 *   └───────────────────────────────────────────────────────────┘
 *
 * Tapping the centre opens a polished bottom-sheet picker
 * (year tabs + month grid). Chevrons step ±1 month without opening
 * the sheet. Future months in the current year are blocked.
 */

import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { useThemeColors } from '../../hooks/use-theme-colors';

const MONTH_LABELS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
const MONTH_LABELS_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface Props {
  /** `'YYYY-MM'` selected month code. */
  value: string;
  onChange: (next: string) => void;
}

function parseMonthCode(code: string): { year: number; monthIdx: number } {
  const [y, m] = code.split('-').map((n) => parseInt(n, 10));
  return { year: y, monthIdx: m - 1 };
}

function toMonthCode(year: number, monthIdx: number): string {
  return `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
}

function shiftMonth(code: string, delta: number): string {
  const { year, monthIdx } = parseMonthCode(code);
  const d = new Date(year, monthIdx + delta, 1);
  return toMonthCode(d.getFullYear(), d.getMonth());
}

function isFutureMonth(code: string): boolean {
  const { year, monthIdx } = parseMonthCode(code);
  const now = new Date();
  if (year > now.getFullYear()) return true;
  if (year === now.getFullYear() && monthIdx > now.getMonth()) return true;
  return false;
}

export function HeroMonthPicker({ value, onChange }: Props) {
  const themeColors = useThemeColors();
  const [open, setOpen] = useState(false);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthIdx = now.getMonth();
  const currentCode = toMonthCode(currentYear, currentMonthIdx);

  const parsed = parseMonthCode(value);
  const monthLabel = MONTH_LABELS_FULL[parsed.monthIdx];
  const isCurrent = value === currentCode;
  const isPrevMonth = value === shiftMonth(currentCode, -1);
  const subtitle = isCurrent
    ? 'This month'
    : isPrevMonth
      ? 'Last month'
      : `${parsed.year}`;

  const canGoNext = !isFutureMonth(shiftMonth(value, 1));

  const years = useMemo(
    () => Array.from({ length: 5 }, (_, i) => currentYear - i),
    [currentYear],
  );
  const [sheetYear, setSheetYear] = useState<number>(parsed.year);

  // Re-seed the sheet year whenever the picker opens, so it always
  // lands on the currently-selected month's year (not whatever the
  // user last scrolled to).
  React.useEffect(() => {
    if (open) setSheetYear(parsed.year);
  }, [open, parsed.year]);

  const pickFromSheet = (monthIdx: number) => {
    onChange(toMonthCode(sheetYear, monthIdx));
    setOpen(false);
  };

  return (
    <View className="mb-6">
      <View
        className="rounded-[24px] overflow-hidden border"
        style={{
          backgroundColor: themeColors.surface2,
          borderColor: themeColors.hairline,
          boxShadow: themeColors.surface0 === '#05060A'
            ? '0 8px 24px rgba(0, 0, 0, 0.6)'
            : '0 8px 24px rgba(15, 23, 42, 0.08)',
        }}>
        <LinearGradient
          colors={['rgba(255, 107, 74, 0.18)', 'rgba(255, 107, 74, 0)']}
          locations={[0, 1]}
          pointerEvents="none"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '100%' }}
        />
        <View className="flex-row items-center px-3 py-4">
          <Pressable
            onPress={() => onChange(shiftMonth(value, -1))}
            hitSlop={12}
            className="w-11 h-11 rounded-full justify-center items-center"
            style={{ backgroundColor: themeColors.surface3 }}>
            <Ionicons name="chevron-back" size={18} color={themeColors.textHigh} />
          </Pressable>

          <Pressable
            onPress={() => setOpen(true)}
            className="flex-1 items-center justify-center"
            hitSlop={8}>
            <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest mb-1">
              {subtitle}
            </Text>
            <View className="flex-row items-baseline gap-2">
              <Text className="font-jakarta-bold text-text-high text-[26px] tracking-tight">
                {monthLabel}
              </Text>
              <Text className="font-jakarta-bold text-accent-coral text-lg tracking-tight">
                {parsed.year}
              </Text>
            </View>
            <View className="flex-row items-center gap-1 mt-1.5">
              <Ionicons name="calendar-outline" size={11} color={themeColors.textLow} />
              <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest">
                Tap to change
              </Text>
            </View>
          </Pressable>

          <Pressable
            onPress={() => canGoNext && onChange(shiftMonth(value, 1))}
            disabled={!canGoNext}
            hitSlop={12}
            className="w-11 h-11 rounded-full justify-center items-center"
            style={{
              backgroundColor: themeColors.surface3,
              opacity: canGoNext ? 1 : 0.35,
            }}>
            <Ionicons name="chevron-forward" size={18} color={themeColors.textHigh} />
          </Pressable>
        </View>
      </View>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
          onPress={() => setOpen(false)}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              marginTop: 'auto',
              backgroundColor: themeColors.surface1,
              paddingTop: 16,
              paddingBottom: 32,
              paddingHorizontal: 24,
              borderTopLeftRadius: 32,
              borderTopRightRadius: 32,
              borderTopWidth: 1,
              borderTopColor: themeColors.hairline,
            }}>
            {/* Drag affordance — purely visual, gives the sheet a more
                polished, native feel. */}
            <View className="items-center mb-4">
              <View
                style={{
                  width: 40,
                  height: 4,
                  borderRadius: 999,
                  backgroundColor: themeColors.hairline,
                }}
              />
            </View>

            <View className="flex-row justify-between items-center mb-5">
              <Text className="font-jakarta-bold text-text-high text-lg">Pick a month</Text>
              <Pressable
                onPress={() => setOpen(false)}
                className="w-9 h-9 rounded-full bg-surface-2 border border-hairline justify-center items-center">
                <Ionicons name="close" size={16} color={themeColors.textMid} />
              </Pressable>
            </View>

            {/* Quick "Jump to current" pill. Saves a tap when the user
                has scrolled back six months for a comparison. */}
            <Pressable
              onPress={() => {
                onChange(currentCode);
                setOpen(false);
              }}
              className="flex-row items-center justify-between p-4 rounded-2xl mb-5"
              style={{
                backgroundColor: isCurrent ? 'rgba(255, 107, 74, 0.14)' : themeColors.surface2,
                borderWidth: 1,
                borderColor: isCurrent ? 'rgba(255, 107, 74, 0.5)' : themeColors.hairline,
              }}>
              <View className="flex-row items-center gap-3">
                <View
                  className="w-9 h-9 rounded-full justify-center items-center"
                  style={{ backgroundColor: 'rgba(255, 107, 74, 0.18)' }}>
                  <Ionicons name="today-outline" size={16} color="#FF6B4A" />
                </View>
                <View>
                  <Text className="font-jakarta-bold text-text-high text-sm">This month</Text>
                  <Text className="font-jakarta text-text-low text-[11px] mt-0.5">
                    {MONTH_LABELS_FULL[currentMonthIdx]} {currentYear}
                  </Text>
                </View>
              </View>
              {isCurrent && <Ionicons name="checkmark-circle" size={18} color="#FF6B4A" />}
            </Pressable>

            <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest mb-2 px-1">
              Year
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingRight: 16 }}
              className="mb-4">
              {years.map((y) => {
                const selected = y === sheetYear;
                return (
                  <Pressable
                    key={y}
                    onPress={() => setSheetYear(y)}
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

            <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest mb-2 px-1">
              Month
            </Text>
            <View className="flex-row flex-wrap" style={{ marginHorizontal: -4 }}>
              {MONTH_LABELS_SHORT.map((label, idx) => {
                const monthCodeForCell = toMonthCode(sheetYear, idx);
                const isFuture = isFutureMonth(monthCodeForCell);
                const isPicked = monthCodeForCell === value;
                return (
                  <View key={label} style={{ width: '33.333%', padding: 4 }}>
                    <Pressable
                      onPress={() => !isFuture && pickFromSheet(idx)}
                      disabled={isFuture}
                      className="py-4 rounded-2xl items-center border"
                      style={{
                        backgroundColor: isPicked
                          ? '#FF6B4A'
                          : isFuture
                            ? 'transparent'
                            : themeColors.surface2,
                        borderColor: isPicked ? '#FF6B4A' : themeColors.hairline,
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
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
