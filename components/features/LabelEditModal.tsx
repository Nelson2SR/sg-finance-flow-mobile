import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useCategoriesStore, Label } from '../../store/useCategoriesStore';
import { NeonButton } from '../ui';
import { useThemeColors } from '../../hooks/use-theme-colors';

interface LabelEditModalProps {
  visible: boolean;
  onClose: () => void;
  /** When set, opens in edit mode. Omit for create. */
  editing?: Label;
}

/**
 * Create / edit a Label. Labels are free-form text tags — no icon, no
 * color, no kind — so the modal is intentionally minimal. Matches the
 * reference's "Add new label" modal pattern but rendered in our Liquid
 * Glass design system.
 */
export const LabelEditModal = ({ visible, onClose, editing }: LabelEditModalProps) => {
  const themeColors = useThemeColors();
  const addLabel = useCategoriesStore(s => s.addLabel);
  const updateLabel = useCategoriesStore(s => s.updateLabel);
  const deleteLabel = useCategoriesStore(s => s.deleteLabel);

  const [name, setName] = useState('');
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(editing?.name ?? '');
  }, [visible, editing]);

  const isEdit = !!editing;
  const isValid = name.trim().length > 0;

  const handleSave = () => {
    if (!isValid) return;
    if (isEdit && editing) {
      updateLabel(editing.id, name.trim());
    } else {
      addLabel(name.trim());
    }
    onClose();
  };

  const handleDelete = () => {
    if (!editing) return;
    Alert.alert(
      `Delete "${editing.name}"?`,
      'Existing transactions tagged with this label will lose the tag. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteLabel(editing.id);
            onClose();
          },
        },
      ],
    );
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 justify-center items-center px-6 bg-black/40">
        <View
          className="bg-surface-1 w-full rounded-[28px] px-6 pt-6 pb-6"
          style={{
            borderWidth: 1,
            borderColor: themeColors.hairline,
            boxShadow: '0 12px 36px rgba(0,0,0,0.4)',
          }}>
          <View className="flex-row justify-between items-center mb-5">
            <Text className="font-jakarta-bold text-text-high text-xl">
              {isEdit ? 'Edit label' : 'New label'}
            </Text>
            <Pressable
              onPress={onClose}
              className="w-9 h-9 rounded-full bg-surface-2 border border-hairline justify-center items-center">
              <Ionicons name="close" size={18} color={themeColors.textMid} />
            </Pressable>
          </View>

          <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest mb-2">
            Label name
          </Text>
          <TextInput
            className={`bg-surface-2 px-4 py-3.5 rounded-2xl text-text-high text-base font-jakarta-bold mb-6 border ${focused ? 'border-accent-coral' : 'border-hairline'}`}
            placeholder="e.g. Wants, Reimbursable, Trip-2026"
            placeholderTextColor={themeColors.textDim}
            value={name}
            onChangeText={setName}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />

          <View className="flex-row gap-3">
            {isEdit && (
              <Pressable
                onPress={handleDelete}
                className="px-5 py-4 rounded-full bg-surface-2 border border-hairline active:scale-95">
                <Ionicons name="trash-outline" size={18} color="#FF5C7C" />
              </Pressable>
            )}
            <View className="flex-1">
              <NeonButton size="lg" block onPress={handleSave} disabled={!isValid}>
                {isEdit ? 'Save' : 'Add'}
              </NeonButton>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
