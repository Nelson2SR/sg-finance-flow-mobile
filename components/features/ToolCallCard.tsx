import React from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ToolCall } from '../../store/useCopilotStore';
import { GradientCard } from '../ui';
import { useThemeColors } from '../../hooks/use-theme-colors';

interface ToolCallCardProps {
  toolCall: ToolCall;
  onConfirm: () => void;
  onDismiss: () => void;
  onUndo: () => void;
}

/**
 * Inline confirmation card the Advisor persona attaches to a chat
 * message when it proposes a record-manipulating action. Walks the
 * user through the lifecycle:
 *
 *   proposed   → [Confirm] [Dismiss] buttons
 *   executing  → spinner, both buttons disabled
 *   executed   → "Done" pill + [Undo within 3 days] button
 *   rolling_back → spinner on Undo
 *   rolled_back → "Undone" pill
 *   dismissed  → quiet "Dismissed" stub
 *   failed     → "Couldn't run" + [Try again]
 */
export function ToolCallCard({ toolCall, onConfirm, onDismiss, onUndo }: ToolCallCardProps) {
  const themeColors = useThemeColors();
  const isRollback = toolCall.type === 'ROLLBACK_ACTION';
  const accent: 'coral' | 'rose' = isRollback ? 'rose' : 'coral';

  // Tiny title above the summary — disambiguates action type at a glance.
  const typeLabel = (() => {
    switch (toolCall.type) {
      case 'CREATE_TRANSACTION':
        return 'Create transaction';
      case 'DELETE_TRANSACTION':
        return 'Delete transaction';
      case 'UPDATE_TRANSACTION':
        return 'Update transaction';
      case 'UPDATE_TRANSACTION_CATEGORY':
        return 'Recategorize';
      case 'TRANSFER':
        return 'Transfer';
      case 'ROLLBACK_ACTION':
        return 'Undo previous action';
      default:
        return toolCall.type;
    }
  })();

  return (
    <View className="mt-3">
      <GradientCard padding="md" accent={accent}>
        <View
          className="flex-row items-center justify-between mb-3 pb-3"
          style={{ borderBottomWidth: 1, borderBottomColor: themeColors.hairline }}>
          <Text className="font-jakarta-bold text-text-low uppercase tracking-widest text-[10px]">
            {typeLabel}
          </Text>
          <Ionicons
            name={isRollback ? 'arrow-undo-outline' : 'flash-outline'}
            size={16}
            color={isRollback ? '#FF5C7C' : '#FF6B4A'}
          />
        </View>

        <Text className="font-jakarta text-text-high text-sm leading-relaxed mb-4">
          {toolCall.summary || 'Confirm to apply this change.'}
        </Text>

        <PayloadSummary toolCall={toolCall} />

        <Footer
          toolCall={toolCall}
          onConfirm={onConfirm}
          onDismiss={onDismiss}
          onUndo={onUndo}
        />
      </GradientCard>
    </View>
  );
}

// ── Subcomponents ─────────────────────────────────────────────────────

/**
 * Render a few key fields from the payload so the user knows what they
 * are confirming. Kept compact; the full payload is in the audit log.
 */
function PayloadSummary({ toolCall }: { toolCall: ToolCall }) {
  const rows: { label: string; value: string }[] = [];
  const p = toolCall.payload || {};

  switch (toolCall.type) {
    case 'CREATE_TRANSACTION': {
      if (p.merchant) rows.push({ label: 'Merchant', value: String(p.merchant) });
      if (p.amount != null)
        rows.push({
          label: 'Amount',
          value: `${p.direction === 'INCOME' ? '+' : '-'}${p.currency || ''} ${Number(p.amount).toFixed(2)}`,
        });
      if (p.category) rows.push({ label: 'Category', value: String(p.category) });
      if (p.tx_date) rows.push({ label: 'Date', value: String(p.tx_date) });
      break;
    }
    case 'DELETE_TRANSACTION':
      if (p.transaction_id != null)
        rows.push({ label: 'Transaction', value: `#${p.transaction_id}` });
      break;
    case 'UPDATE_TRANSACTION': {
      if (p.transaction_id != null)
        rows.push({ label: 'Transaction', value: `#${p.transaction_id}` });
      const changes = (p.changes || {}) as Record<string, any>;
      // Render each changed field on its own row so the user sees
      // exactly what will move. Order: category → amount → merchant → date
      // so the most common edits appear first.
      if (changes.category != null)
        rows.push({ label: 'New category', value: String(changes.category) });
      if (changes.amount != null)
        rows.push({ label: 'New amount', value: Number(changes.amount).toFixed(2) });
      if (changes.merchant != null)
        rows.push({ label: 'New merchant', value: String(changes.merchant) });
      if (changes.tx_date != null)
        rows.push({ label: 'New date', value: String(changes.tx_date) });
      break;
    }
    case 'UPDATE_TRANSACTION_CATEGORY':
      if (p.transaction_id != null)
        rows.push({ label: 'Transaction', value: `#${p.transaction_id}` });
      if (p.new_category) rows.push({ label: 'New category', value: String(p.new_category) });
      break;
    case 'TRANSFER':
      if (p.source && p.target)
        rows.push({ label: 'Path', value: `${p.source} → ${p.target}` });
      if (p.amount != null)
        rows.push({ label: 'Amount', value: `${p.currency || ''} ${Number(p.amount).toFixed(2)}` });
      break;
    case 'ROLLBACK_ACTION':
      if (p.action_id != null)
        rows.push({ label: 'Action', value: `#${p.action_id}` });
      break;
  }

  if (rows.length === 0) return null;
  return (
    <View className="mb-4 gap-1.5">
      {rows.map(r => (
        <View key={r.label} className="flex-row justify-between">
          <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest">
            {r.label}
          </Text>
          <Text className="font-jakarta-bold text-text-high text-xs">{r.value}</Text>
        </View>
      ))}
    </View>
  );
}

function Footer({
  toolCall,
  onConfirm,
  onDismiss,
  onUndo,
}: {
  toolCall: ToolCall;
  onConfirm: () => void;
  onDismiss: () => void;
  onUndo: () => void;
}) {
  switch (toolCall.status) {
    case 'proposed':
      return (
        <View className="flex-row gap-2">
          <Pressable
            onPress={onDismiss}
            className="flex-1 py-3 rounded-full items-center bg-surface-3 border border-hairline active:scale-95">
            <Text className="font-jakarta-bold text-text-mid text-xs uppercase tracking-widest">
              Dismiss
            </Text>
          </Pressable>
          <Pressable
            onPress={onConfirm}
            className="flex-1 py-3 rounded-full items-center bg-accent-coral active:scale-95"
            style={{ boxShadow: '0 0 18px rgba(255, 107, 74, 0.4)' }}>
            <Text className="font-jakarta-bold text-white text-xs uppercase tracking-widest">
              Confirm
            </Text>
          </Pressable>
        </View>
      );

    case 'executing':
      return (
        <View className="flex-row items-center justify-center py-3 gap-3">
          <ActivityIndicator size="small" color="#FF6B4A" />
          <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest">
            Applying…
          </Text>
        </View>
      );

    case 'executed':
      return (
        <View className="flex-row gap-2 items-center">
          <View className="flex-row items-center gap-1.5 flex-1">
            <Ionicons name="checkmark-circle" size={16} color="#5BE0B0" />
            <Text className="font-jakarta-bold text-accent-mint text-[10px] uppercase tracking-widest">
              Done · Undo within 3 days
            </Text>
          </View>
          <Pressable
            onPress={onUndo}
            className="py-2 px-4 rounded-full bg-surface-3 border border-hairline active:scale-95">
            <Text className="font-jakarta-bold text-text-high text-[10px] uppercase tracking-widest">
              Undo
            </Text>
          </Pressable>
        </View>
      );

    case 'rolling_back':
      return (
        <View className="flex-row items-center justify-center py-3 gap-3">
          <ActivityIndicator size="small" color="#FF5C7C" />
          <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest">
            Rolling back…
          </Text>
        </View>
      );

    case 'rolled_back':
      return (
        <View className="flex-row items-center gap-1.5">
          <Ionicons name="arrow-undo" size={16} color="#FF5C7C" />
          <Text className="font-jakarta-bold text-accent-rose text-[10px] uppercase tracking-widest">
            Undone
          </Text>
        </View>
      );

    case 'dismissed':
      return (
        <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest">
          Dismissed
        </Text>
      );

    case 'failed':
      return (
        <View className="gap-3">
          <Text className="font-jakarta text-accent-rose text-xs">
            {toolCall.error || "Couldn't run that action."}
          </Text>
          <Pressable
            onPress={onConfirm}
            className="py-3 rounded-full items-center bg-accent-coral active:scale-95">
            <Text className="font-jakarta-bold text-white text-xs uppercase tracking-widest">
              Try again
            </Text>
          </Pressable>
        </View>
      );

    default:
      return null;
  }
}
