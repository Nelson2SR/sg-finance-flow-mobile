import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Modal,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useCategoriesStore, Category, CategoryKind } from '../../store/useCategoriesStore';
import {
  CATEGORY_COLORS,
  CATEGORY_ICON_GROUPS,
  DEFAULT_CATEGORY_COLOR,
  DEFAULT_CATEGORY_ICON,
  IoniconName,
} from '../../constants/CategoryIcons';
import { GradientCard, NeonButton } from '../ui';
import { useThemeColors } from '../../hooks/use-theme-colors';

interface CategoryEditModalProps {
  visible: boolean;
  onClose: () => void;
  /** When set, modal opens in edit mode. Omit for create. */
  editing?: Category;
  /** Pre-select a kind when creating. Ignored when editing. */
  defaultKind?: CategoryKind;
}

/**
 * Create / edit a Category. Renders a name input, kind toggle, color
 * row, and a grouped icon grid — all driven by the constants in
 * `CategoryIcons.ts` so the picker stays curated.
 *
 * Save persists through `useCategoriesStore` then dismisses; delete
 * (only shown in edit mode) confirms and dismisses. We deliberately
 * keep the icon + color preview tied together so the user sees the
 * final circle before tapping Save.
 */
export const CategoryEditModal = ({
  visible,
  onClose,
  editing,
  defaultKind = 'expense',
}: CategoryEditModalProps) => {
  const themeColors = useThemeColors();
  const addCategory = useCategoriesStore(s => s.addCategory);
  const updateCategory = useCategoriesStore(s => s.updateCategory);
  const deleteCategory = useCategoriesStore(s => s.deleteCategory);

  const [name, setName] = useState('');
  const [kind, setKind] = useState<CategoryKind>(defaultKind);
  const [icon, setIcon] = useState<IoniconName>(DEFAULT_CATEGORY_ICON);
  const [color, setColor] = useState<string>(DEFAULT_CATEGORY_COLOR);
  const [nameFocused, setNameFocused] = useState(false);

  // Sync local form state whenever the modal opens or the editing target
  // changes. Avoids a stale form leaking across opens.
  useEffect(() => {
    if (!visible) return;
    if (editing) {
      setName(editing.name);
      setKind(editing.kind);
      setIcon(editing.icon);
      setColor(editing.color);
    } else {
      setName('');
      setKind(defaultKind);
      setIcon(DEFAULT_CATEGORY_ICON);
      setColor(DEFAULT_CATEGORY_COLOR);
    }
  }, [visible, editing, defaultKind]);

  const isEdit = !!editing;
  const isValid = name.trim().length > 0;

  const handleSave = () => {
    if (!isValid) return;
    if (isEdit && editing) {
      updateCategory(editing.id, { name: name.trim(), kind, icon, color });
    } else {
      addCategory({ name: name.trim(), kind, icon, color });
    }
    onClose();
  };

  const handleDelete = () => {
    if (!editing) return;
    Alert.alert(
      `Delete "${editing.name}"?`,
      'Existing transactions tagged with this category will become "Uncategorized". This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteCategory(editing.id);
            onClose();
          },
        },
      ],
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 justify-end bg-black/40">
        <View
          className="bg-surface-1 rounded-t-[40px] px-6 pt-6 pb-10"
          style={{ borderTopWidth: 1, borderTopColor: themeColors.hairline, maxHeight: '90%' }}>
          {/* Header */}
          <View className="flex-row justify-between items-center mb-6">
            <Text className="font-jakarta-bold text-text-high text-2xl">
              {isEdit ? 'Edit category' : 'New category'}
            </Text>
            <Pressable
              onPress={onClose}
              className="w-9 h-9 rounded-full bg-surface-2 border border-hairline justify-center items-center">
              <Ionicons name="close" size={18} color={themeColors.textMid} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Live preview — colored circle + name reflects the form state. */}
            <View className="items-center mb-6">
              <View
                className="w-16 h-16 rounded-full justify-center items-center mb-3"
                style={{ backgroundColor: color, boxShadow: `0 0 24px ${color}55` }}>
                <Ionicons name={icon} size={28} color="#fff" />
              </View>
              <Text className="font-jakarta-bold text-text-high text-base">
                {name.trim() || 'Untitled'}
              </Text>
              <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest mt-1">
                {kind === 'expense' ? 'Expense category' : 'Income category'}
              </Text>
            </View>

            {/* Name */}
            <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest mb-2">
              Name
            </Text>
            <TextInput
              className={`bg-surface-2 px-4 py-3.5 rounded-2xl text-text-high text-base font-jakarta-bold mb-6 border ${nameFocused ? 'border-accent-coral' : 'border-hairline'}`}
              placeholder="e.g. Coffee Runs"
              placeholderTextColor={themeColors.textDim}
              value={name}
              onChangeText={setName}
              onFocus={() => setNameFocused(true)}
              onBlur={() => setNameFocused(false)}
              autoFocus={!isEdit}
            />

            {/* Kind toggle */}
            <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest mb-2">
              Kind
            </Text>
            <View className="flex-row bg-surface-2 border border-hairline rounded-full p-1 mb-6">
              {(['expense', 'income'] as CategoryKind[]).map(k => {
                const selected = kind === k;
                return (
                  <Pressable
                    key={k}
                    onPress={() => setKind(k)}
                    className={`flex-1 py-2 rounded-full items-center ${selected ? 'bg-accent-coral' : ''}`}>
                    <Text
                      className={`font-jakarta-bold text-xs uppercase tracking-widest ${
                        selected ? 'text-white' : 'text-text-mid'
                      }`}>
                      {k === 'expense' ? 'Expense' : 'Income'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Color picker — 12 swatches in one wrap row. */}
            <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest mb-2">
              Color
            </Text>
            <View className="flex-row flex-wrap gap-3 mb-6">
              {CATEGORY_COLORS.map(c => {
                const selected = c === color;
                return (
                  <Pressable
                    key={c}
                    onPress={() => setColor(c)}
                    className="w-9 h-9 rounded-full justify-center items-center"
                    style={{
                      backgroundColor: c,
                      borderWidth: selected ? 3 : 0,
                      borderColor: themeColors.surface0,
                      boxShadow: selected ? `0 0 14px ${c}88` : undefined,
                    }}>
                    {selected && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </Pressable>
                );
              })}
            </View>

            {/* Icon picker grid — grouped, with the group label above each row. */}
            <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest mb-3">
              Icon
            </Text>
            <GradientCard padding="md" className="mb-6">
              {CATEGORY_ICON_GROUPS.map(group => (
                <View key={group.label} className="mb-4 last:mb-0">
                  <Text className="font-jakarta-bold text-text-low text-[9px] uppercase tracking-widest mb-2">
                    {group.label}
                  </Text>
                  <View className="flex-row flex-wrap gap-2.5">
                    {group.icons.map(ic => {
                      const selected = ic === icon;
                      return (
                        <Pressable
                          key={ic}
                          onPress={() => setIcon(ic)}
                          className="w-11 h-11 rounded-2xl justify-center items-center"
                          style={{
                            backgroundColor: selected ? color : themeColors.surface3,
                            borderWidth: selected ? 0 : 1,
                            borderColor: themeColors.hairline,
                          }}>
                          <Ionicons
                            name={ic}
                            size={18}
                            color={selected ? '#fff' : themeColors.textMid}
                          />
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
            </GradientCard>
          </ScrollView>

          {/* Footer actions */}
          <View className={`flex-row gap-3 ${isEdit ? '' : ''}`}>
            {isEdit && (
              <Pressable
                onPress={handleDelete}
                className="px-5 py-4 rounded-full bg-surface-2 border border-hairline active:scale-95">
                <Ionicons name="trash-outline" size={18} color="#FF5C7C" />
              </Pressable>
            )}
            <View className="flex-1">
              <NeonButton size="lg" block onPress={handleSave} disabled={!isValid}>
                {isEdit ? 'Save changes' : 'Create category'}
              </NeonButton>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
