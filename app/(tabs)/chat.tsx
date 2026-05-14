import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { useCopilotStore, WidgetPayload, CopilotPersona } from '../../store/useCopilotStore';
import { useFinanceStore } from '../../store/useFinanceStore';
import { scanDocumentWithGemini, ScanResponse, ScannedTransaction, ScanTaxonomy } from '../../services/geminiService';
import { useCategoriesStore } from '../../store/useCategoriesStore';
import {
  chatWithCopilot,
  FinanceTaxonomy,
  executeCopilotAction,
  rollbackCopilotAction,
  FinanceSnapshot,
} from '../../services/copilotService';
import { ToolCallCard } from '../../components/features/ToolCallCard';
import { MagicScanReviewModal } from '../../components/features/MagicScanModal';
import { Surface, SurfaceHeaderArea, GradientCard, ScreenHeader } from '../../components/ui';
import { useThemeColors } from '../../hooks/use-theme-colors';

// Per-persona visual + tonal config. Generic product pattern (advisor vs.
// empathetic friend). Bubble + avatar tints come from the existing accent
// palette so they read on both light and dark themes.
export const PERSONA_CONFIG: Record<
  CopilotPersona,
  {
    label: string;
    eyebrow: string;
    icon: keyof typeof Ionicons.glyphMap;
    avatarIcon: keyof typeof Ionicons.glyphMap;
    tint: string;
    glow: string;
    cardAccent: 'coral' | 'mint';
  }
> = {
  advisor: {
    label: 'Advisor',
    eyebrow: 'Financial Copilot',
    icon: 'briefcase-outline',
    avatarIcon: 'analytics',
    tint: '#FF6B4A',
    glow: '0 0 18px rgba(255, 107, 74, 0.45)',
    cardAccent: 'coral',
  },
  friend: {
    label: 'Friend',
    eyebrow: 'Cheerleader & Sounding Board',
    icon: 'happy-outline',
    avatarIcon: 'heart',
    tint: '#5BE0B0',
    glow: '0 0 18px rgba(91, 224, 176, 0.45)',
    cardAccent: 'mint',
  },
};


export default function ChatCopilotScreen() {
  const themeColors = useThemeColors();
  const scrollRef = useRef<ScrollView>(null);
  const [inputText, setInputText] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const messages = useCopilotStore(s => s.messages);
  const addMessage = useCopilotStore(s => s.addMessage);
  const updateToolCall = useCopilotStore(s => s.updateToolCall);
  const enabledPersonas = useCopilotStore(s => s.enabledPersonas);
  const typingPersonas = useCopilotStore(s => s.typingPersonas);
  const setPersonaTyping = useCopilotStore(s => s.setPersonaTyping);

  const wallets = useFinanceStore(s => s.wallets);
  const transactions = useFinanceStore(s => s.transactions);
  const addTransactionsBatch = useFinanceStore(s => s.addTransactionsBatch);
  // Build the scan taxonomy from the user's Vault Config so Gemini
  // tags new rows with their configured categories + labels. The same
  // shape is used by the Copilot chat call so the LLM grounds its
  // CREATE_TRANSACTION proposals in the user's actual vocabulary too.
  const allCategories = useCategoriesStore(s => s.categories);
  const allLabels = useCategoriesStore(s => s.labels);
  const buildTaxonomy = (): FinanceTaxonomy & ScanTaxonomy => ({
    expenseCategories: allCategories.filter(c => c.kind === 'expense').map(c => c.name),
    incomeCategories: allCategories.filter(c => c.kind === 'income').map(c => c.name),
    labels: allLabels.map(l => l.name),
  });
  const activeWalletId = useFinanceStore(s => s.activeWalletId);
  const syncData = useFinanceStore(s => s.syncData);
  const updateTransactionLabels = useFinanceStore(s => s.updateTransactionLabels);

  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResponse | null>(null);
  const [scanModalVisible, setScanModalVisible] = useState(false);

  // Build the per-call snapshot at send time so the LLM sees the latest
  // vaults + transactions even after the user just scanned a receipt.
  const buildSnapshot = (): FinanceSnapshot => ({
    wallets: wallets.map(w => ({
      name: w.name,
      type: w.type,
      currency: w.currency,
      balance: w.balance,
    })),
    recentTransactions: [...transactions]
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 10)
      .map(t => {
        // The local store keeps `id` as a string. After syncData() it's
        // the stringified backend id (e.g. "135"); for seed/local-only
        // rows it's a non-numeric tag like "t1" or "tx_<ts>_1". Coerce
        // to int when possible and drop otherwise — the LLM is told to
        // refuse UPDATE/DELETE proposals for rows that lack an id.
        const numericId = Number(t.id);
        return {
          id: Number.isFinite(numericId) && /^\d+$/.test(t.id) ? numericId : undefined,
          merchant: t.merchant,
          category: t.category,
          amount: t.amount,
          type: (t.type === 'INCOME' ? 'INCOME' : 'EXPENSE') as 'INCOME' | 'EXPENSE',
          date: t.date.toISOString().slice(0, 10),
        };
      }),
  });

  // Send the user message, then every enabled persona calls Gemini in
  // parallel. Each persona maintains its own typing indicator so the user
  // sees who is composing when both are on. Failures fall back to a
  // canned phrase inside copilotService.chatWithCopilot.
  const handleSend = () => {
    if (!inputText.trim()) return;
    const userText = inputText;
    addMessage({ sender: 'user', text: userText });
    setInputText('');

    const snapshot = buildSnapshot();
    // Capture history *before* the user message lands in the store so the
    // LLM sees the prior turns, with the new user message as the latest
    // prompt passed in directly.
    const history = messages;

    enabledPersonas.forEach(persona => {
      setPersonaTyping(persona, true);
      // Hold the typing bubble for a random 1–2s window even if the LLM
      // returns sooner. This is the WeChat-style "feels human" beat —
      // instant replies break the friend illusion, and on real network
      // round-trips the LLM is usually slower than the floor anyway.
      const minTypingMs = 1000 + Math.random() * 1000;
      const minTyping = new Promise<void>(resolve => setTimeout(resolve, minTypingMs));
      Promise.all([
        chatWithCopilot({ persona, message: userText, history, snapshot, taxonomy: buildTaxonomy() }),
        minTyping,
      ])
        .then(([reply]) => {
          addMessage({
            sender: 'bot',
            text: reply.text,
            persona,
            // Hand the proposed action to the message so the bubble can
            // render an inline confirmation card. Friend persona never
            // proposes actions (server defensively drops them too).
            toolCall: reply.toolCall
              ? {
                  type: reply.toolCall.type,
                  payload: reply.toolCall.payload ?? {},
                  summary: reply.toolCall.summary ?? '',
                  status: 'proposed',
                }
              : undefined,
          });
        })
        .finally(() => setPersonaTyping(persona, false));
    });

    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  };

  const handleVoice = () => {
    Alert.alert(
      'Voice Input',
      'Voice capture is wired into the UI but the recorder lands in a follow-up. Press and hold here to speak once the recorder ships.',
    );
  };

  // ── Tool-call lifecycle ────────────────────────────────────────────
  // The confirmation card on each bot bubble drives these three:
  //   Confirm → executeCopilotAction → mark message's toolCall as executed
  //   Dismiss → just flip status to dismissed (no server call)
  //   Undo    → rollbackCopilotAction → mark as rolled_back
  // The server enforces the 3-day retention window and returns 409/410
  // if the user tries to undo a stale action — we surface that as an alert.

  const handleConfirmAction = async (messageId: string) => {
    const msg = messages.find(m => m.id === messageId);
    if (!msg?.toolCall) return;
    updateToolCall(messageId, { status: 'executing' });

    // ROLLBACK_ACTION is a special case — it goes to the rollback API
    // rather than executeAction, using action_id from the payload.
    try {
      let createdLabelsFor: { txId: number; labels: string[] } | null = null;

      if (msg.toolCall.type === 'ROLLBACK_ACTION') {
        const targetId = Number(msg.toolCall.payload?.action_id);
        if (!Number.isFinite(targetId)) {
          throw new Error('Copilot did not specify a valid action_id');
        }
        await rollbackCopilotAction(targetId);
        updateToolCall(messageId, { status: 'rolled_back', executedActionId: targetId });
      } else {
        const result = await executeCopilotAction({
          type: msg.toolCall.type,
          payload: msg.toolCall.payload,
          summary: msg.toolCall.summary,
        });
        updateToolCall(messageId, {
          status: 'executed',
          executedActionId: result.id,
        });
        // If the LLM proposed labels alongside CREATE_TRANSACTION, the
        // backend ignores them today (no column). Capture the new tx's
        // backend id from reversal_payload so we can patch labels into
        // the local store after syncData refreshes from the backend.
        if (msg.toolCall.type === 'CREATE_TRANSACTION') {
          const proposedLabels = Array.isArray(msg.toolCall.payload?.labels)
            ? (msg.toolCall.payload.labels as string[])
            : [];
          const newTxId = Number(result.reversal_payload?.transaction_id);
          if (proposedLabels.length > 0 && Number.isFinite(newTxId)) {
            createdLabelsFor = { txId: newTxId, labels: proposedLabels };
          }
        }
      }

      // Refresh the local store from the backend so Home + Activity
      // reflect the change immediately. We await this (not fire-and-
      // forget) when we need to patch labels afterwards, so the local
      // row is in place before we touch it.
      if (createdLabelsFor) {
        await syncData();
        // After syncData, transactions in the local store carry their
        // backend id as a stringified field. Match by that id and
        // patch the labels — the backend has no column for them so
        // this is the only place they live (Phase 1 invariant).
        updateTransactionLabels(String(createdLabelsFor.txId), createdLabelsFor.labels);
      } else {
        void syncData();
      }
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail || err?.message || 'Action failed. Please try again.';
      updateToolCall(messageId, { status: 'failed', error: String(detail) });
    }
  };

  const handleDismissAction = (messageId: string) => {
    updateToolCall(messageId, { status: 'dismissed' });
  };

  const handleUndoAction = async (messageId: string) => {
    const msg = messages.find(m => m.id === messageId);
    const actionId = msg?.toolCall?.executedActionId;
    if (!actionId) return;
    updateToolCall(messageId, { status: 'rolling_back' });
    try {
      await rollbackCopilotAction(actionId);
      updateToolCall(messageId, { status: 'rolled_back' });
      // Refresh local store so the rolled-back transaction disappears
      // from Home / Activity immediately.
      void syncData();
    } catch (err: any) {
      const status = err?.response?.status;
      // 409 = already rolled back, 410 = past retention. Both are
      // "this is no longer undoable" — treat as terminal rolled_back so
      // the UI stops offering the button.
      if (status === 409 || status === 410) {
        updateToolCall(messageId, { status: 'rolled_back' });
      } else {
        const detail =
          err?.response?.data?.detail || err?.message || 'Undo failed. Please try again.';
        updateToolCall(messageId, { status: 'executed', error: String(detail) });
        Alert.alert('Undo failed', String(detail));
      }
    }
  };

  const handleMagicScan = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0].uri) {
      setScanModalVisible(true);
      setIsScanning(true);
      const data = await scanDocumentWithGemini(
        result.assets[0].uri,
        'image/jpeg',
        buildTaxonomy(),
      );
      setIsScanning(false);
      setScanResult(data);
    }
  };

  const confirmScan = (data: ScannedTransaction[]) => {
    const { added, skipped } = addTransactionsBatch(
      data.map(item => ({
        walletId: activeWalletId,
        merchant: item.merchant,
        amount: item.amount,
        category: item.category,
        date: new Date(item.date),
        type: item.type,
        // Carry LLM-suggested labels through to the store.
        labels: item.labels,
      })),
    );
    setScanModalVisible(false);
    let text: string;
    if (added.length === 0) {
      text = `Looks like all ${skipped} ${skipped === 1 ? 'entry was' : 'entries were'} already in your vault — nothing new to add.`;
    } else if (skipped > 0) {
      text = `Parsed ${added.length} new ${added.length === 1 ? 'entry' : 'entries'} and skipped ${skipped} duplicates already in your vault. Safe-to-Spend updated.`;
    } else {
      text = `Done — added ${added.length} ${added.length === 1 ? 'entry' : 'entries'} to your vault. Safe-to-Spend updated.`;
    }
    // Speaker for scan confirmation: advisor if present, otherwise first
    // enabled persona.
    const speaker: CopilotPersona = enabledPersonas.includes('advisor')
      ? 'advisor'
      : enabledPersonas[0] ?? 'advisor';
    addMessage({ sender: 'bot', text, persona: speaker });
  };

  // The Copilot tab icon collapses to a flat icon when this screen is
  // focused (see app/(tabs)/_layout.tsx), so the input only needs to
  // clear the tab bar itself — no FAB bleed allowance required.
  const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 88 : 70;

  return (
    <Surface>
      <SurfaceHeaderArea>
        <ScreenHeader
          eyebrow="Agentic AI"
          title="Copilot"
          action={
            <View className="flex-row -space-x-2">
              {enabledPersonas.map((p, i) => {
                const c = PERSONA_CONFIG[p];
                return (
                  <View
                    key={p}
                    className="w-9 h-9 rounded-full justify-center items-center"
                    style={{
                      backgroundColor: c.tint,
                      boxShadow: c.glow,
                      borderWidth: 2,
                      borderColor: themeColors.surface0,
                      zIndex: enabledPersonas.length - i,
                    }}>
                    <Ionicons name={c.avatarIcon} size={14} color="#fff" />
                  </View>
                );
              })}
            </View>
          }
        />

      </SurfaceHeaderArea>

      <ScrollView
        ref={scrollRef}
        className="flex-1 px-6"
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}>
        {messages.map(msg => {
          const isUser = msg.sender === 'user';
          const msgCfg = PERSONA_CONFIG[msg.persona];
          return (
            <View
              key={msg.id}
              className={`mb-5 flex-row ${isUser ? 'justify-end' : 'justify-start'}`}>
              {!isUser && (
                <View
                  className="w-7 h-7 rounded-full justify-center items-center mr-2.5 mt-1"
                  style={{ backgroundColor: msgCfg.tint }}>
                  <Ionicons name={msgCfg.avatarIcon} size={12} color="#fff" />
                </View>
              )}
              <View className="max-w-[80%]">
                {!isUser && (
                  <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest mb-1 ml-1">
                    {msgCfg.label}
                  </Text>
                )}
                {isUser ? (
                  <View
                    className="p-4 rounded-[20px] bg-accent-coral"
                    style={{ boxShadow: '0 0 18px rgba(255, 107, 74, 0.35)' }}>
                    <Text className="font-jakarta text-white text-base leading-relaxed">
                      {msg.text}
                    </Text>
                  </View>
                ) : (
                  <GradientCard padding="md" radius="row" accent={msgCfg.cardAccent}>
                    <Text className="font-jakarta text-text-high text-base leading-relaxed">
                      {msg.text}
                    </Text>
                  </GradientCard>
                )}
                {msg.widget && <ActionWidget payload={msg.widget} />}
                {msg.toolCall && (
                  <ToolCallCard
                    toolCall={msg.toolCall}
                    onConfirm={() => handleConfirmAction(msg.id)}
                    onDismiss={() => handleDismissAction(msg.id)}
                    onUndo={() => handleUndoAction(msg.id)}
                  />
                )}
              </View>
            </View>
          );
        })}

        {typingPersonas.map(p => {
          const cfg = PERSONA_CONFIG[p];
          return (
            <View key={`typing:${p}`} className="mb-5 flex-row justify-start">
              <View
                className="w-7 h-7 rounded-full justify-center items-center mr-2.5 mt-1"
                style={{ backgroundColor: cfg.tint }}>
                <Ionicons name={cfg.avatarIcon} size={12} color="#fff" />
              </View>
              <View className="max-w-[80%]">
                <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest mb-1 ml-1">
                  {cfg.label} is typing…
                </Text>
                <GradientCard padding="md" radius="row" accent={cfg.cardAccent}>
                  <TypingDots color={themeColors.textMid} />
                </GradientCard>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}>
        <View
          className="px-4 pt-3 bg-surface-0"
          style={{
            paddingBottom: 12 + TAB_BAR_HEIGHT,
            borderTopWidth: 1,
            borderTopColor: themeColors.hairline,
          }}>
          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={handleMagicScan}
              className="w-11 h-11 bg-surface-2 border border-hairline rounded-full justify-center items-center active:scale-90">
              <Ionicons name="camera-outline" size={20} color="#FF6B4A" />
            </Pressable>

            <View
              className={`flex-1 flex-row items-center bg-surface-2 rounded-full border ${
                isFocused ? 'border-accent-coral' : 'border-hairline'
              }`}>
              <TextInput
                placeholder="Send a message…"
                placeholderTextColor={themeColors.textLow}
                className="flex-1 text-text-high px-5 py-3 font-jakarta-bold text-sm"
                value={inputText}
                onChangeText={setInputText}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                onSubmitEditing={handleSend}
                returnKeyType="send"
              />
              <Pressable
                onPress={handleVoice}
                className="w-10 h-10 justify-center items-center active:opacity-70"
                hitSlop={6}>
                <Ionicons name="mic-outline" size={20} color={themeColors.textMid} />
              </Pressable>
            </View>

            <Pressable
              onPress={handleSend}
              disabled={!inputText.trim()}
              className={`w-11 h-11 rounded-full justify-center items-center active:scale-95 ${
                inputText.trim() ? '' : 'opacity-50'
              }`}
              style={{
                backgroundColor: '#FF6B4A',
                boxShadow: inputText.trim()
                  ? '0 0 18px rgba(255, 107, 74, 0.45)'
                  : undefined,
              }}>
              <Ionicons name="arrow-up" size={18} color="#fff" />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      <MagicScanReviewModal
        visible={scanModalVisible}
        onClose={() => setScanModalVisible(false)}
        loading={isScanning}
        scanData={scanResult}
        onConfirm={confirmScan}
        onEditTransaction={(index, patch) =>
          setScanResult(prev =>
            prev
              ? {
                  ...prev,
                  transactions: prev.transactions.map((t, i) =>
                    i === index ? { ...t, ...patch } : t,
                  ),
                }
              : prev,
          )
        }
      />
    </Surface>
  );
}

function ActionWidget({ payload }: { payload: WidgetPayload }) {
  const themeColors = useThemeColors();
  if (payload.type === 'TRANSFER_CONFIRM') {
    return (
      <View className="mt-3">
        <GradientCard padding="lg" accent="coral">
          <View
            className="flex-row items-center justify-between mb-5 pb-4"
            style={{ borderBottomWidth: 1, borderBottomColor: themeColors.hairline }}>
            <Text className="font-jakarta-bold text-text-low uppercase tracking-widest text-[10px]">
              Verify Transaction
            </Text>
            <Ionicons name="swap-horizontal" size={18} color="#FF6B4A" />
          </View>
          <View className="flex-row justify-between mb-3">
            <Text className="font-jakarta-bold text-text-low text-xs uppercase tracking-widest">
              Amount
            </Text>
            <Text className="font-jakarta-bold text-text-high text-xl">${payload.amount}</Text>
          </View>
          <View className="flex-row justify-between mb-5">
            <Text className="font-jakarta-bold text-text-low text-xs uppercase tracking-widest">
              Path
            </Text>
            <Text className="font-jakarta-bold text-text-high text-sm">
              {payload.sourceWallet} ➝ {payload.targetWallet}
            </Text>
          </View>
          <Pressable
            className="bg-accent-coral py-3 rounded-full items-center active:scale-95"
            style={{ boxShadow: '0 0 18px rgba(255, 107, 74, 0.4)' }}>
            <Text className="font-jakarta-bold text-white text-sm uppercase tracking-widest">
              Execute Command
            </Text>
          </Pressable>
        </GradientCard>
      </View>
    );
  }
  return null;
}

/**
 * Three dots that pulse 0.3 → 1 → 0.3 in a staggered wave — the
 * "someone is typing" idiom from every chat app. Uses the RN Animated
 * API (useNativeDriver: true) so the tween runs on the UI thread and
 * doesn't compete with the LLM call landing on the JS thread.
 */
function TypingDots({ color }: { color: string }) {
  const dots = useRef([
    new Animated.Value(0.3),
    new Animated.Value(0.3),
    new Animated.Value(0.3),
  ]).current;

  useEffect(() => {
    const loops = dots.map(dot =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(dot, { toValue: 1, duration: 260, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 540, useNativeDriver: true }),
        ]),
      ),
    );
    // Stagger the start of each loop so the dots run as a wave instead
    // of all pulsing in unison.
    const timeouts = loops.map((loop, i) => setTimeout(() => loop.start(), i * 180));
    return () => {
      timeouts.forEach(clearTimeout);
      loops.forEach(l => l.stop());
    };
  }, [dots]);

  return (
    <View className="flex-row items-center gap-1.5 py-1">
      {dots.map((opacity, i) => (
        <Animated.View
          key={i}
          style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color, opacity }}
        />
      ))}
    </View>
  );
}
