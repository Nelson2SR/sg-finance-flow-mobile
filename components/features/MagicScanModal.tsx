import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ActivityIndicator,
  FlatList,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { ScanResponse, ScannedTransaction } from '../../services/geminiService';
import { useCategoriesStore } from '../../store/useCategoriesStore';
import { useThemeColors } from '../../hooks/use-theme-colors';

interface MagicScanModalProps {
  visible: boolean;
  onClose: () => void;
  scanData: ScanResponse | null;
  loading: boolean;
  /**
   * Human-readable error message when the parse failed. Optional.
   * When set (and not loading), the modal renders the failure state
   * with this message inline so the user can tell whether it was a
   * network blip, an unsupported file, or a backend issue — not just
   * the generic "failed to extract data" they used to see.
   */
  errorMessage?: string | null;
  onConfirm: (data: ScannedTransaction[]) => void;
  /**
   * Apply an edit to one parsed row. Optional so legacy callers without
   * edit support still work — the row body just won't be interactive.
   * The Home + Chat scan flows wire this to a setScanResult mutator
   * that swaps the row in place.
   */
  onEditTransaction?: (index: number, patch: Partial<ScannedTransaction>) => void;
}

/** Props for MagicScanReviewBody — the bottom-sheet panel with no
 *  Modal wrapper. Mirrors MagicScanModalProps minus `visible`. */
interface MagicScanReviewBodyProps {
  onClose: () => void;
  scanData: ScanResponse | null;
  loading: boolean;
  errorMessage?: string | null;
  onConfirm: (data: ScannedTransaction[]) => void;
  onEditTransaction?: (index: number, patch: Partial<ScannedTransaction>) => void;
}

const getTransactionIcon = (category: string | undefined) => {
  const cat = category?.toLowerCase() || 'other';
  switch (cat) {
    case 'dining':
      return { name: 'restaurant', tint: '#FFB547' };
    case 'transport':
      return { name: 'car', tint: '#5BE0B0' };
    case 'shopping':
      return { name: 'cart', tint: '#A78BFA' };
    case 'salary':
      return { name: 'cash', tint: '#5BE0B0' };
    default:
      return { name: 'card', tint: '#FF6B4A' };
  }
};

/**
 * The bottom-sheet panel without the surrounding Modal — exported so a
 * caller that owns its own Modal (e.g. the unified Magic Scan flow on
 * Home, where the picker phase and the review phase must share one
 * Modal to avoid iOS Modal-stacking races) can render this panel
 * inline.
 *
 * Layout matches MagicScanReviewModal's body exactly: an 85%-height
 * surface-1 card with a coral close button and the three render
 * phases (loading → review list → error fallback).
 */
export const MagicScanReviewBody = ({
  onClose,
  scanData,
  loading,
  errorMessage,
  onConfirm,
  onEditTransaction,
}: MagicScanReviewBodyProps) => {
  const themeColors = useThemeColors();
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  /** Open a per-row edit sheet when this is non-null. */
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  useEffect(() => {
    if (scanData?.transactions) {
      setSelectedIndices(scanData.transactions.map((_, i) => i));
    }
  }, [scanData]);

  // Reset edit-sheet state whenever the loaded scan changes so a
  // stale index can't survive into the next scan.
  useEffect(() => {
    setEditingIndex(null);
  }, [scanData]);

  const toggleSelect = (index: number) => {
    setSelectedIndices(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index],
    );
  };

  const handleConfirm = () => {
    if (scanData) {
      const selected = scanData.transactions.filter((_, i) => selectedIndices.includes(i));
      onConfirm(selected);
    }
  };

  const allSelected = scanData ? selectedIndices.length === scanData.transactions.length : false;

  return (
    <View
      className="bg-surface-1 h-[85%] rounded-t-[40px] px-6 pt-8 pb-12"
      style={{ borderTopWidth: 1, borderTopColor: themeColors.hairline }}>
      <View className="flex-row justify-between items-center mb-8">
        <View>
          <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest mb-1">
            {scanData?.sourceType === 'ESTATEMENT' ? 'E-Statement Analysis' : 'Receipt Analysis'}
          </Text>
          <Text className="font-jakarta-bold text-text-high text-2xl">Review Entries</Text>
        </View>
        <Pressable
          onPress={onClose}
          className="w-10 h-10 rounded-full bg-surface-2 border border-hairline justify-center items-center">
          <Ionicons name="close" size={20} color="#FF6B4A" />
        </Pressable>
      </View>

      {loading ? (
            <View className="flex-1 justify-center items-center">
              <ActivityIndicator size="large" color="#FF6B4A" />
              <View className="mt-8 items-center">
                <Text className="font-jakarta-bold text-text-high text-base">
                  Analyzing your document
                </Text>
                <Text className="font-jakarta-bold text-text-low text-[10px] mt-1 uppercase tracking-widest">
                  Extracting transactions...
                </Text>
              </View>
            </View>
          ) : scanData ? (
            <View className="flex-1">
              <View className="flex-row justify-between items-center mb-5">
                <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest">
                  {scanData.transactions.length} Transactions Found
                </Text>
                <Pressable
                  onPress={() =>
                    setSelectedIndices(
                      allSelected ? [] : scanData.transactions.map((_, i) => i),
                    )
                  }>
                  <Text className="font-jakarta-bold text-accent-coral text-xs">Toggle All</Text>
                </Pressable>
              </View>

              <FlatList
                data={scanData.transactions}
                keyExtractor={(_, i) => i.toString()}
                showsVerticalScrollIndicator={false}
                renderItem={({ item, index }) => {
                  const isSelected = selectedIndices.includes(index);
                  const icon = getTransactionIcon(item.category);
                  // Outer Pressable opens edit sheet; the icon-circle
                  // has its own Pressable so a tap there toggles
                  // selection without firing the outer onPress (RN
                  // gesture system fires the deeper Pressable first
                  // and swallows the event).
                  return (
                    <Pressable
                      onPress={() => onEditTransaction && setEditingIndex(index)}
                      className={`mb-3 flex-row items-center p-4 rounded-2xl border ${
                        isSelected
                          ? 'bg-surface-2 border-accent-coral'
                          : 'bg-surface-2/60 border-hairline opacity-60'
                      }`}>
                      <Pressable
                        onPress={() => toggleSelect(index)}
                        hitSlop={8}
                        className={`w-11 h-11 rounded-2xl justify-center items-center mr-3 ${isSelected ? 'bg-accent-coral' : 'bg-surface-3'}`}>
                        <Ionicons
                          name={isSelected ? (icon.name as any) : 'ellipse-outline'}
                          size={18}
                          color={isSelected ? '#fff' : themeColors.textLow}
                        />
                      </Pressable>

                      <View className="flex-1">
                        <Text
                          className={`font-jakarta-bold text-sm ${isSelected ? 'text-text-high' : 'text-text-low'}`}>
                          {item.merchant}
                        </Text>
                        <View className="flex-row gap-2 items-center mt-1 flex-wrap">
                          <View className="bg-surface-3 border border-hairline px-2 py-0.5 rounded-md">
                            <Text className="font-jakarta-bold text-[8px] uppercase tracking-widest text-text-mid">
                              {item.category}
                            </Text>
                          </View>
                          {/* LLM-suggested labels — rendered as compact
                              mint-tinted chips next to the category badge
                              so the user can see (and dismiss the whole
                              row if wrong) the auto-tagging before commit. */}
                          {(item.labels ?? []).map(lbl => (
                            <View
                              key={lbl}
                              className="px-2 py-0.5 rounded-md"
                              style={{
                                backgroundColor: 'rgba(91, 224, 176, 0.18)',
                                borderWidth: 1,
                                borderColor: 'rgba(91, 224, 176, 0.35)',
                              }}>
                              <Text className="font-jakarta-bold text-[8px] uppercase tracking-widest text-accent-mint">
                                {lbl}
                              </Text>
                            </View>
                          ))}
                          <Text className="font-jakarta text-text-low text-[10px]">{item.date}</Text>
                        </View>
                      </View>

                      <Text
                        className={`font-jakarta-bold text-sm ${
                          item.type === 'INCOME'
                            ? 'text-accent-mint'
                            : isSelected
                              ? 'text-text-high'
                              : 'text-text-low'
                        }`}>
                        {item.type === 'INCOME' ? '+' : '-'}
                        {item.currency} {item.amount.toFixed(2)}
                      </Text>
                    </Pressable>
                  );
                }}
              />

              <View
                className="pt-5"
                style={{ borderTopWidth: 1, borderTopColor: themeColors.hairline }}>
                <Pressable
                  onPress={handleConfirm}
                  disabled={selectedIndices.length === 0}
                  style={
                    selectedIndices.length > 0
                      ? { boxShadow: '0 0 24px rgba(255, 107, 74, 0.45)' }
                      : null
                  }
                  className={`bg-accent-coral py-4 rounded-full items-center ${selectedIndices.length === 0 ? 'opacity-50' : ''}`}>
                  <Text className="font-jakarta-bold text-white tracking-widest uppercase text-xs">
                    Commit {selectedIndices.length} to Wallet
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View className="flex-1 justify-center items-center px-6">
              <Ionicons name="alert-circle" size={56} color="#FF6B4A" />
              <Text className="font-jakarta-bold text-text-low mt-6 tracking-widest uppercase text-xs">
                Couldn't read this file
              </Text>
              {errorMessage ? (
                <Text className="font-jakarta text-text-mid text-xs text-center mt-3 leading-relaxed">
                  {errorMessage}
                </Text>
              ) : (
                <Text className="font-jakarta text-text-mid text-xs text-center mt-3 leading-relaxed">
                  The scanner didn't find any transactions. Try a clearer photo, or check your connection.
                </Text>
              )}
              <Pressable onPress={onClose} className="mt-6">
                <Text className="font-jakarta-bold text-accent-coral text-sm">
                  Return to Manual Entry
                </Text>
              </Pressable>
            </View>
          )}

      {/* Inline edit overlay — rendered on top of the review sheet
          (absolute positioning, no nested Modal) when the user taps
          a row body. Lets them fix LLM mistakes (wrong amount,
          merchant, category, etc.) before committing. */}
      {editingIndex !== null &&
        scanData &&
        scanData.transactions[editingIndex] &&
        onEditTransaction && (
          <ScanRowEditSheet
            tx={scanData.transactions[editingIndex]}
            onCancel={() => setEditingIndex(null)}
            onSave={patch => {
              onEditTransaction(editingIndex, patch);
              setEditingIndex(null);
            }}
          />
        )}
    </View>
  );
};


/**
 * Backwards-compatible wrapper — keeps the standalone Modal+Blur for
 * callers that own their flow (e.g. the chat tab's Magic Scan, which
 * has no picker phase to coordinate with). Home goes through
 * MagicScanWindow with the unified-phase Modal instead.
 */
export const MagicScanReviewModal = ({
  visible,
  ...bodyProps
}: MagicScanModalProps) => {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View className="flex-1 justify-end">
        <BlurView intensity={90} tint="dark" className="absolute inset-0" />
        <MagicScanReviewBody {...bodyProps} />
      </View>
    </Modal>
  );
};


// ── Edit sheet ───────────────────────────────────────────────────────────


interface ScanRowEditSheetProps {
  tx: ScannedTransaction;
  onCancel: () => void;
  onSave: (patch: Partial<ScannedTransaction>) => void;
}

/**
 * Per-row edit form rendered as an absolute-positioned overlay on top
 * of the review sheet. Picks for category + labels are sourced from the
 * user's Vault Config so the edits stay grounded in their vocabulary.
 *
 * Saves a partial patch (only the fields the user actually changed)
 * back to the parent through ``onSave``; the parent applies it to the
 * scanData transactions array in place.
 */
function ScanRowEditSheet({ tx, onCancel, onSave }: ScanRowEditSheetProps) {
  const themeColors = useThemeColors();
  const allCategories = useCategoriesStore(s => s.categories);
  const allLabels = useCategoriesStore(s => s.labels);

  const [merchant, setMerchant] = useState(tx.merchant);
  const [amount, setAmount] = useState(String(tx.amount));
  const [date, setDate] = useState(tx.date);
  const [currency, setCurrency] = useState(tx.currency || 'SGD');
  const [type, setType] = useState<'EXPENSE' | 'INCOME'>(tx.type);
  const [category, setCategory] = useState(tx.category);
  const [labels, setLabels] = useState<string[]>(tx.labels ?? []);

  // Categories filtered by the currently-selected kind. When the user
  // flips the toggle, also reset the category to the first matching
  // option so we never have an INCOME row tagged with an EXPENSE category.
  const kindCategories = React.useMemo(
    () =>
      allCategories.filter(c => c.kind === (type === 'EXPENSE' ? 'expense' : 'income')),
    [allCategories, type],
  );

  useEffect(() => {
    const stillValid = kindCategories.some(
      c => c.name.toLowerCase() === category.toLowerCase(),
    );
    if (!stillValid && kindCategories.length > 0) {
      setCategory(kindCategories[0].name);
    }
  }, [type, kindCategories, category]);

  const toggleLabel = (name: string) =>
    setLabels(prev => (prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]));

  const isValid = merchant.trim().length > 0 && Number(amount) > 0;

  const handleSave = () => {
    if (!isValid) return;
    onSave({
      merchant: merchant.trim(),
      amount: Math.abs(Number(amount)) || 0,
      date,
      currency: currency.trim() || 'SGD',
      type,
      category,
      labels: labels.length > 0 ? labels : undefined,
    });
  };

  return (
    <View
      className="absolute inset-0 bg-surface-0/95"
      style={{ borderRadius: 40 }}
      pointerEvents="auto">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1">
        <View className="px-6 pt-8 pb-4 flex-row items-center justify-between">
          <Pressable
            onPress={onCancel}
            className="w-9 h-9 rounded-full bg-surface-2 border border-hairline justify-center items-center">
            <Ionicons name="close" size={18} color={themeColors.textMid} />
          </Pressable>
          <Text className="font-jakarta-bold text-text-high text-base">Edit transaction</Text>
          <View className="w-9" />
        </View>

        <ScrollView
          className="flex-1 px-6"
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}>
          {/* Type toggle — drives which category list is shown. */}
          <View className="flex-row bg-surface-2 border border-hairline rounded-full p-1 mb-5">
            {(['EXPENSE', 'INCOME'] as const).map(t => {
              const selected = type === t;
              return (
                <Pressable
                  key={t}
                  onPress={() => setType(t)}
                  className={`flex-1 py-2 rounded-full items-center ${selected ? (t === 'EXPENSE' ? 'bg-accent-rose' : 'bg-accent-mint') : ''}`}>
                  <Text
                    className={`font-jakarta-bold text-xs uppercase tracking-widest ${
                      selected ? 'text-white' : 'text-text-mid'
                    }`}>
                    {t === 'EXPENSE' ? 'Expense' : 'Income'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <EditField label="Merchant">
            <TextInput
              value={merchant}
              onChangeText={setMerchant}
              placeholderTextColor={themeColors.textDim}
              placeholder="e.g. Starbucks"
              className="bg-surface-2 px-4 py-3 rounded-2xl text-text-high text-base font-jakarta-bold border border-hairline"
            />
          </EditField>

          <View className="flex-row gap-3">
            <View className="flex-1">
              <EditField label="Amount">
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  placeholderTextColor={themeColors.textDim}
                  placeholder="0.00"
                  className="bg-surface-2 px-4 py-3 rounded-2xl text-text-high text-base font-jakarta-bold border border-hairline"
                />
              </EditField>
            </View>
            <View style={{ width: 110 }}>
              <EditField label="Currency">
                <TextInput
                  value={currency}
                  onChangeText={t => setCurrency(t.toUpperCase().slice(0, 4))}
                  autoCapitalize="characters"
                  className="bg-surface-2 px-4 py-3 rounded-2xl text-text-high text-base font-jakarta-bold border border-hairline"
                />
              </EditField>
            </View>
          </View>

          <EditField label="Date (YYYY-MM-DD)">
            <TextInput
              value={date}
              onChangeText={setDate}
              placeholderTextColor={themeColors.textDim}
              placeholder="2026-05-14"
              className="bg-surface-2 px-4 py-3 rounded-2xl text-text-high text-base font-jakarta-bold border border-hairline"
            />
          </EditField>

          <EditField label="Category">
            {kindCategories.length === 0 ? (
              <Text className="font-jakarta text-text-low text-xs leading-relaxed">
                No {type === 'EXPENSE' ? 'expense' : 'income'} categories yet. Add one in Settings → Vault Config.
              </Text>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}>
                {kindCategories.map(c => {
                  const selected = c.name.toLowerCase() === category.toLowerCase();
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => setCategory(c.name)}
                      className="px-3 py-2 rounded-full flex-row items-center gap-2"
                      style={{
                        backgroundColor: selected ? c.color : themeColors.surface2,
                        borderWidth: 1,
                        borderColor: selected ? c.color : themeColors.hairline,
                      }}>
                      <Ionicons
                        name={c.icon}
                        size={14}
                        color={selected ? '#fff' : c.color}
                      />
                      <Text
                        className={`font-jakarta-bold text-xs ${selected ? 'text-white' : 'text-text-mid'}`}>
                        {c.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </EditField>

          <EditField
            label={`Labels${labels.length > 0 ? ` · ${labels.length} selected` : ''}`}>
            {allLabels.length === 0 ? (
              <Text className="font-jakarta text-text-low text-xs leading-relaxed">
                No labels yet. Add some in Settings → Vault Config.
              </Text>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}>
                {allLabels.map(lbl => {
                  const selected = labels.includes(lbl.name);
                  return (
                    <Pressable
                      key={lbl.id}
                      onPress={() => toggleLabel(lbl.name)}
                      className="px-3 py-2 rounded-full flex-row items-center gap-1.5"
                      style={{
                        backgroundColor: selected ? '#5BE0B0' : themeColors.surface2,
                        borderWidth: 1,
                        borderColor: selected ? '#5BE0B0' : themeColors.hairline,
                      }}>
                      <Ionicons
                        name={selected ? 'checkmark' : 'pricetag-outline'}
                        size={12}
                        color={selected ? '#fff' : themeColors.textMid}
                      />
                      <Text
                        className={`font-jakarta-bold text-xs ${selected ? 'text-white' : 'text-text-mid'}`}>
                        {lbl.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </EditField>
        </ScrollView>

        <View
          className="px-6 pb-8 pt-3 flex-row gap-3"
          style={{ borderTopWidth: 1, borderTopColor: themeColors.hairline }}>
          <Pressable
            onPress={onCancel}
            className="flex-1 py-4 rounded-full items-center bg-surface-3 border border-hairline">
            <Text className="font-jakarta-bold text-text-mid text-xs uppercase tracking-widest">
              Cancel
            </Text>
          </Pressable>
          <Pressable
            onPress={handleSave}
            disabled={!isValid}
            className={`flex-1 py-4 rounded-full items-center bg-accent-coral ${isValid ? '' : 'opacity-50'}`}
            style={isValid ? { boxShadow: '0 0 18px rgba(255, 107, 74, 0.45)' } : null}>
            <Text className="font-jakarta-bold text-white text-xs uppercase tracking-widest">
              Save changes
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}


function EditField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="mb-4">
      <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest mb-2 px-1">
        {label}
      </Text>
      {children}
    </View>
  );
}
