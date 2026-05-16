/**
 * FilterPill — compact dropdown trigger used in the Activity tab's
 * filter row. Renders as a coral-tinted pill showing the current
 * selection's short label + a chevron. Tapping opens a bottom-sheet
 * Modal with the full options list; picking a row fires onChange.
 *
 * Designed to replace the long horizontal chip rows that used to
 * scroll for screens — one compact dropdown per dimension, total
 * vertical real estate ≤ 50pt.
 */

import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '../../hooks/use-theme-colors';

export interface FilterOption<T extends string | number | null> {
  /** Unique key for React diffing. */
  value: T;
  /** What shows in the dropdown row. */
  label: string;
  /** Optional secondary text (e.g. currency / count). */
  caption?: string;
}

interface Props<T extends string | number | null> {
  /** Tag above the pill, e.g. "Wallet" or "Category". */
  label: string;
  /** Short string shown inside the pill (the active selection). */
  display: string;
  /** Whether the pill should glow as active (i.e. user has filtered). */
  active?: boolean;
  options: FilterOption<T>[];
  value: T;
  onChange: (next: T) => void;
  /** Optional renderer for an extra row (e.g. month picker) shown
   *  above the options list. */
  extraContent?: React.ReactNode;
}

export function FilterPill<T extends string | number | null>({
  label,
  display,
  active = false,
  options,
  value,
  onChange,
  extraContent,
}: Props<T>) {
  const themeColors = useThemeColors();
  const [open, setOpen] = React.useState(false);

  return (
    <View style={{ flexShrink: 0 }}>
      <Text className="font-jakarta-bold text-text-low text-[9px] uppercase tracking-widest mb-1 px-1">
        {label}
      </Text>
      <Pressable
        onPress={() => setOpen(true)}
        className="flex-row items-center gap-1.5 px-3 py-2 rounded-full border"
        style={{
          backgroundColor: active ? 'rgba(255, 107, 74, 0.15)' : themeColors.surface2,
          borderColor: active ? 'rgba(255, 107, 74, 0.6)' : themeColors.hairline,
        }}>
        <Text
          className={`font-jakarta-bold text-xs ${
            active ? 'text-accent-coral' : 'text-text-mid'
          }`}
          numberOfLines={1}>
          {display}
        </Text>
        <Ionicons
          name="chevron-down"
          size={12}
          color={active ? '#FF6B4A' : themeColors.textMid}
        />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }}
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
              maxHeight: '80%',
            }}>
            <View className="flex-row justify-between items-center mb-4">
              <Text className="font-jakarta-bold text-text-high text-base">{label}</Text>
              <Pressable
                onPress={() => setOpen(false)}
                className="w-9 h-9 rounded-full bg-surface-2 border border-hairline justify-center items-center">
                <Ionicons name="close" size={16} color={themeColors.textMid} />
              </Pressable>
            </View>
            {extraContent}
            {options.map((opt) => {
              const isPicked = opt.value === value;
              return (
                <Pressable
                  key={String(opt.value ?? 'null')}
                  onPress={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className="flex-row items-center justify-between p-3 rounded-2xl mb-1.5 active:bg-surface-3"
                  style={{
                    backgroundColor: isPicked ? 'rgba(255, 107, 74, 0.12)' : 'transparent',
                    borderWidth: 1,
                    borderColor: isPicked ? 'rgba(255, 107, 74, 0.45)' : 'transparent',
                  }}>
                  <View style={{ flex: 1 }}>
                    <Text className="font-jakarta-bold text-text-high text-sm">{opt.label}</Text>
                    {opt.caption && (
                      <Text className="font-jakarta text-text-low text-[11px] mt-0.5">
                        {opt.caption}
                      </Text>
                    )}
                  </View>
                  {isPicked && (
                    <Ionicons name="checkmark-circle" size={18} color="#FF6B4A" />
                  )}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
