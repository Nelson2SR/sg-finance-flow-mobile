/**
 * EditBudgetModal — tap an active budget card on Insights to open
 * this sheet. The user can:
 *
 *   • Change the budget amount. Saving creates a new version
 *     `effectiveFrom = first of current month`. Past months keep
 *     whatever version was active back then — matches the YNAB /
 *     Monarch convention of "this is what I think the cap should
 *     be going forward, not retroactively".
 *   • Delete the budget entirely (with a confirm dialog).
 *
 * Version history is surfaced as a small footer caption when the
 * budget has more than one version, so the user has a window into
 * "I changed this in March from $3,500 to $3,000".
 *
 * Out of scope here (intentionally, for v1.0): editing the budget
 * name, recurrence, category list, or wallet scope. Those touch the
 * fundamental shape of the budget and are better addressed by
 * deleting and recreating until usage tells us otherwise.
 */

import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import {
  type Budget,
  currentMonthCode,
  getBudgetAmountForMonth,
  useFinanceStore,
} from '../../store/useFinanceStore';
import { useThemeColors } from '../../hooks/use-theme-colors';

interface Props {
  visible: boolean;
  /** The budget being edited. `null` is allowed so the parent can
   *  pass state directly without conditional rendering. */
  budget: Budget | null;
  onClose: () => void;
}

export const EditBudgetModal = ({ visible, budget, onClose }: Props) => {
  const themeColors = useThemeColors();
  const updateBudgetAmount = useFinanceStore((s) => s.updateBudgetAmount);
  const deleteBudget = useFinanceStore((s) => s.deleteBudget);

  const thisMonth = currentMonthCode();
  // Seed the input with the current month's effective amount whenever
  // the modal opens for a new budget — without this the input would
  // sticky-keep the previous budget's value across opens.
  const [amount, setAmount] = useState('');
  useEffect(() => {
    if (visible && budget) {
      setAmount(String(getBudgetAmountForMonth(budget, thisMonth)));
    }
  }, [visible, budget, thisMonth]);

  if (!budget) return null;

  const parsed = parseFloat(amount);
  const isValid = !isNaN(parsed) && parsed > 0;
  const currentValue = getBudgetAmountForMonth(budget, thisMonth);
  const isUnchanged = isValid && parsed === currentValue;

  const handleSave = () => {
    if (!isValid || isUnchanged) {
      onClose();
      return;
    }
    updateBudgetAmount(budget.id, parsed);
    onClose();
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete budget?',
      `“${budget.name}” will be removed. Past months will lose their cap reference.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteBudget(budget.id);
            onClose();
          },
        },
      ],
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 justify-end bg-black/40">
        <View
          className="bg-surface-1 rounded-t-[40px] px-6 pt-6 pb-12"
          style={{ borderTopWidth: 1, borderTopColor: themeColors.hairline }}>
          <View className="flex-row justify-between items-center mb-6">
            <View style={{ flex: 1 }}>
              <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest">
                Edit budget
              </Text>
              <Text className="font-jakarta-bold text-text-high text-2xl mt-1" numberOfLines={1}>
                {budget.name}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              className="w-9 h-9 rounded-full bg-surface-2 border border-hairline justify-center items-center">
              <Ionicons name="close" size={18} color={themeColors.textMid} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
            <View className="items-center mb-6 mt-2">
              <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest mb-2">
                New monthly cap ({budget.currency})
              </Text>
              <View
                className="flex-row items-center pb-2"
                style={{ borderBottomWidth: 2, borderBottomColor: themeColors.hairline }}>
                <Text className="font-jakarta-light text-text-low text-4xl mr-1">$</Text>
                <TextInput
                  className="text-text-high text-6xl font-jakarta-bold"
                  placeholder="0"
                  placeholderTextColor={themeColors.textDim}
                  keyboardType="decimal-pad"
                  value={amount}
                  onChangeText={setAmount}
                  autoFocus
                />
              </View>
              <Text className="font-jakarta text-text-low text-[11px] mt-3 text-center px-4">
                Effective from the 1st of this month. Past months keep their
                original amount.
              </Text>
            </View>

            {budget.versions.length > 1 && (
              <View className="bg-surface-2 border border-hairline rounded-2xl p-4 mb-6">
                <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest mb-2">
                  Version history
                </Text>
                {[...budget.versions]
                  .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))
                  .slice(0, 5)
                  .map((v) => {
                    const [y, m] = v.effectiveFrom.split('-').map(Number);
                    const label = new Date(y, m - 1, 1).toLocaleDateString('en-US', {
                      month: 'short',
                      year: 'numeric',
                    });
                    return (
                      <View
                        key={v.effectiveFrom}
                        className="flex-row justify-between items-center py-1.5">
                        <Text className="font-jakarta text-text-mid text-sm">{label}</Text>
                        <Text className="font-jakarta-bold text-text-high text-sm">
                          ${v.amount.toLocaleString()}
                        </Text>
                      </View>
                    );
                  })}
                {budget.versions.length > 5 && (
                  <Text className="font-jakarta text-text-low text-[10px] mt-1">
                    + {budget.versions.length - 5} older versions
                  </Text>
                )}
              </View>
            )}

            <Pressable
              onPress={handleSave}
              disabled={!isValid}
              style={isValid ? { boxShadow: '0 0 24px rgba(255, 107, 74, 0.45)' } : null}
              className={`py-4 rounded-full items-center active:scale-95 mb-3 ${
                isValid ? 'bg-accent-coral' : 'bg-surface-3'
              }`}>
              <Text
                className={`font-jakarta-bold text-base ${
                  isValid ? 'text-white' : 'text-text-low'
                }`}>
                {isUnchanged ? 'No change' : 'Save'}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleDelete}
              className="py-4 rounded-full items-center bg-surface-2 border border-hairline active:bg-surface-3">
              <Text className="font-jakarta-bold text-accent-rose text-base">
                Delete budget
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
