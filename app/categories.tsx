import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useCategoriesStore, Category, CategoryKind } from '../store/useCategoriesStore';
import { useFinanceStore } from '../store/useFinanceStore';
import { CategoryEditModal } from '../components/features/CategoryEditModal';
import { Surface, GradientCard, NeonButton } from '../components/ui';
import { useThemeColors } from '../hooks/use-theme-colors';

/**
 * Categories CRUD screen.
 *
 * Two tabs (Expense / Income) toggle which list is shown. Each row
 * renders the category's colored circle + name + usage count
 * ("N transactions"). Tap a row to edit, tap + to create. The
 * underlying store is `useCategoriesStore`; the per-category usage
 * count is derived live from `useFinanceStore.transactions` so the
 * list stays accurate without any extra plumbing.
 */
export default function CategoriesScreen() {
  const router = useRouter();
  const themeColors = useThemeColors();

  const categories = useCategoriesStore(s => s.categories);
  const transactions = useFinanceStore(s => s.transactions);

  const [kind, setKind] = useState<CategoryKind>('expense');
  const [editing, setEditing] = useState<Category | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const visible = categories.filter(c => c.kind === kind);

  // Index transaction counts by (lowercased) category name so legacy
  // free-text categories on existing rows still match user-renamed
  // categories case-insensitively.
  const countByCategoryName = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const t of transactions) {
      const k = (t.category || '').trim().toLowerCase();
      m.set(k, (m.get(k) || 0) + 1);
    }
    return m;
  }, [transactions]);

  return (
    <Surface>
      <SafeAreaView edges={['top']}>
        {/* Header — back arrow + title + invisible spacer to center title */}
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
            <Text className="font-jakarta-bold text-text-high text-xl">Categories</Text>
          </View>
          <View className="w-9" />
        </View>

        {/* Kind toggle */}
        <View className="px-6 pb-4">
          <View className="flex-row bg-surface-2 border border-hairline rounded-full p-1">
            {(['expense', 'income'] as CategoryKind[]).map(k => {
              const selected = kind === k;
              return (
                <Pressable
                  key={k}
                  onPress={() => setKind(k)}
                  className={`flex-1 py-2.5 rounded-full items-center ${
                    selected ? 'bg-accent-coral' : ''
                  }`}
                  style={selected ? { boxShadow: '0 0 14px rgba(255, 107, 74, 0.4)' } : null}>
                  <Text
                    className={`font-jakarta-bold text-xs uppercase tracking-widest ${
                      selected ? 'text-white' : 'text-text-mid'
                    }`}>
                    {k === 'expense' ? 'Expenses' : 'Income'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </SafeAreaView>

      {/* List */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingBottom: Platform.OS === 'ios' ? 120 : 100,
        }}
        showsVerticalScrollIndicator={false}>
        {visible.length === 0 ? (
          <GradientCard padding="lg" className="items-center mt-6">
            <Ionicons name="folder-open-outline" size={28} color={themeColors.textLow} />
            <Text className="font-jakarta-bold text-text-mid text-sm mt-3 text-center">
              No {kind === 'expense' ? 'expense' : 'income'} categories yet
            </Text>
            <Text className="font-jakarta text-text-low text-xs mt-1.5 text-center">
              Tap the + button below to add your first one.
            </Text>
          </GradientCard>
        ) : (
          <View className="gap-2">
            {visible.map(cat => {
              const count = countByCategoryName.get(cat.name.trim().toLowerCase()) || 0;
              return (
                <Pressable
                  key={cat.id}
                  onPress={() => setEditing(cat)}
                  className="active:opacity-80">
                  <GradientCard padding="md" radius="row">
                    <View className="flex-row items-center gap-4">
                      <View
                        className="w-11 h-11 rounded-full justify-center items-center"
                        style={{ backgroundColor: cat.color }}>
                        <Ionicons name={cat.icon} size={18} color="#fff" />
                      </View>
                      <View className="flex-1">
                        <Text className="font-jakarta-bold text-text-high text-base">
                          {cat.name}
                        </Text>
                        <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest mt-0.5">
                          {count} transaction{count === 1 ? '' : 's'}
                        </Text>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={16}
                        color={themeColors.textLow}
                      />
                    </View>
                  </GradientCard>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Floating + action — fixed to bottom-right so it doesn't fight the
          tab bar's coral focal point. Same coral glow language as other CTAs. */}
      <View
        className="absolute right-6"
        style={{ bottom: Platform.OS === 'ios' ? 40 : 28 }}>
        <NeonButton size="lg" icon="add" onPress={() => setCreateOpen(true)}>
          New category
        </NeonButton>
      </View>

      <CategoryEditModal
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        defaultKind={kind}
      />
      <CategoryEditModal
        visible={!!editing}
        onClose={() => setEditing(null)}
        editing={editing ?? undefined}
      />
    </Surface>
  );
}
