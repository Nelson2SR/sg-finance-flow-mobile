import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { useCopilotStore, WidgetPayload, CopilotPersona } from '../../store/useCopilotStore';
import { useFinanceStore } from '../../store/useFinanceStore';
import { scanDocumentWithGemini, ScanResponse, ScannedTransaction } from '../../services/geminiService';
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

// Quick canned reply pools — original generic phrasing. Real RAG lives in
// services/geminiService once we wire it up.
const RESPONSES: Record<CopilotPersona, { transfer: string; scan: string; default: string[] }> = {
  advisor: {
    transfer: 'Got it — please verify the transfer details before I move funds:',
    scan: 'Sure. Pick a statement or receipt and I will extract the line items for your vault.',
    default: [
      'Your Dining category is trending high this month. Consider a 2-week cap to stay inside your Safe-to-Spend.',
      'Cashflow looks healthy — income outpaces spend by ~24%. A quick win: route the surplus into the Japan Trip vault.',
      'Heads up: a subscription renewal is due in 3 days. Want me to forecast its impact on this month?',
    ],
  },
  friend: {
    transfer: 'No pressure either way — sit with it for a minute. I will keep the details below in case you want to come back to them.',
    scan: 'Of course. Drop the receipt in whenever you are ready. No rush.',
    default: [
      'You are doing better than you think. Small steps add up — proud of you for checking in today.',
      'Money stuff can feel heavy. Want to talk about what is on your mind, or should we just look at the numbers together?',
      'Pause and breathe. Whatever the balance says, your worth is not the number. What feels most overwhelming right now?',
    ],
  },
};

const pickReply = (persona: CopilotPersona, text: string) => {
  const raw = text.toLowerCase();
  if (raw.includes('scan') || raw.includes('receipt')) {
    return { text: RESPONSES[persona].scan };
  }
  if (raw.includes('transfer') || raw.includes('move')) {
    return {
      text: RESPONSES[persona].transfer,
      widget: {
        type: 'TRANSFER_CONFIRM' as const,
        amount: 50,
        sourceWallet: 'Personal',
        targetWallet: 'Trip',
      },
    };
  }
  const pool = RESPONSES[persona].default;
  return { text: pool[Math.floor(Math.random() * pool.length)] };
};

export default function ChatCopilotScreen() {
  const themeColors = useThemeColors();
  const scrollRef = useRef<ScrollView>(null);
  const [inputText, setInputText] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const messages = useCopilotStore(s => s.messages);
  const addMessage = useCopilotStore(s => s.addMessage);
  const enabledPersonas = useCopilotStore(s => s.enabledPersonas);

  const addTransactionsBatch = useFinanceStore(s => s.addTransactionsBatch);
  const activeWalletId = useFinanceStore(s => s.activeWalletId);

  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResponse | null>(null);
  const [scanModalVisible, setScanModalVisible] = useState(false);

  // Send the user message, then every enabled persona replies in sequence
  // with a small stagger so the bubbles don't all land at the same frame.
  const handleSend = () => {
    if (!inputText.trim()) return;
    const userText = inputText;
    addMessage({ sender: 'user', text: userText });
    setInputText('');

    enabledPersonas.forEach((persona, idx) => {
      const { text, widget } = pickReply(persona, userText);
      setTimeout(
        () => addMessage({ sender: 'bot', text, persona, widget }),
        650 + idx * 900,
      );
    });

    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  };

  const handleVoice = () => {
    Alert.alert(
      'Voice Input',
      'Voice capture is wired into the UI but the recorder lands in a follow-up. Press and hold here to speak once the recorder ships.',
    );
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
      const data = await scanDocumentWithGemini(result.assets[0].uri, 'image/jpeg');
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
