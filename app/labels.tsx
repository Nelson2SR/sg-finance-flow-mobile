import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useCategoriesStore, Label } from '../store/useCategoriesStore';
import { LabelEditModal } from '../components/features/LabelEditModal';
import { Surface, GradientCard, NeonButton } from '../components/ui';
import { useThemeColors } from '../hooks/use-theme-colors';

/**
 * Labels CRUD screen.
 *
 * Labels are free-form text tags applied to transactions (0..N per
 * transaction). They have no icon or color — the picker for them is
 * just a name input, surfaced through the {@link LabelEditModal}.
 */
export default function LabelsScreen() {
  const router = useRouter();
  const themeColors = useThemeColors();

  const labels = useCategoriesStore(s => s.labels);

  const [editing, setEditing] = useState<Label | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <Surface>
      <SafeAreaView edges={['top']}>
        <View className="flex-row items-center justify-between px-6 pt-3 pb-4">
          <Pressable
            onPress={() => router.back()}
            className="w-9 h-9 rounded-full bg-surface-2 border border-hairline justify-center items-center active:scale-95">
            <Ionicons name="chevron-back" size={18} color={themeColors.textHigh} />
          </Pressable>
          <View className="items-center">
            <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest mb-1">
              Vault Config
            </Text>
            <Text className="font-jakarta-bold text-text-high text-xl">Labels</Text>
          </View>
          <View className="w-9" />
        </View>
      </SafeAreaView>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 4,
          paddingBottom: Platform.OS === 'ios' ? 120 : 100,
        }}
        showsVerticalScrollIndicator={false}>
        {labels.length === 0 ? (
          <GradientCard padding="lg" className="items-center mt-6">
            <Ionicons name="pricetag-outline" size={28} color={themeColors.textLow} />
            <Text className="font-jakarta-bold text-text-mid text-sm mt-3 text-center">
              No labels yet
            </Text>
            <Text className="font-jakarta text-text-low text-xs mt-1.5 text-center">
              Labels are free-form tags you can attach to any transaction
              (e.g. "Wants", "Reimbursable", "Trip-2026").
            </Text>
          </GradientCard>
        ) : (
          <View className="gap-2">
            {labels.map(lbl => (
              <Pressable
                key={lbl.id}
                onPress={() => setEditing(lbl)}
                className="active:opacity-80">
                <GradientCard padding="md" radius="row">
                  <View className="flex-row items-center gap-4">
                    <View
                      className="w-9 h-9 rounded-full justify-center items-center bg-surface-3"
                      style={{ borderWidth: 1, borderColor: themeColors.hairline }}>
                      <Ionicons name="pricetag" size={14} color="#FF6B4A" />
                    </View>
                    <Text className="flex-1 font-jakarta-bold text-text-high text-base">
                      {lbl.name}
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={themeColors.textLow}
                    />
                  </View>
                </GradientCard>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <View
        className="absolute right-6"
        style={{ bottom: Platform.OS === 'ios' ? 40 : 28 }}>
        <NeonButton size="lg" icon="add" onPress={() => setCreateOpen(true)}>
          New label
        </NeonButton>
      </View>

      <LabelEditModal visible={createOpen} onClose={() => setCreateOpen(false)} />
      <LabelEditModal
        visible={!!editing}
        onClose={() => setEditing(null)}
        editing={editing ?? undefined}
      />
    </Surface>
  );
}
