/**
 * AI data-sharing consent sheet.
 *
 * Shown the first time a user invokes an AI feature (Magic Scan or
 * Copilot). Discloses exactly what data is sent and to whom (Google
 * Gemini), per App Review Guideline 5.1.1(i) / 5.1.2(i). The parent
 * persists the grant via lib/aiConsent on "Agree"; "Not now" cancels
 * the pending action without sending anything.
 */

import React from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

import { useThemeColors } from '../../hooks/use-theme-colors';

interface AiConsentModalProps {
  visible: boolean;
  /** Called when the user agrees — parent should persist + proceed. */
  onAgree: () => void;
  /** Called on "Not now" / backdrop dismiss — parent cancels the action. */
  onDecline: () => void;
}

const BULLETS: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
  {
    icon: 'document-text-outline',
    text: 'Statement PDFs and receipt photos you choose to scan',
  },
  {
    icon: 'pricetags-outline',
    text: 'The transaction details extracted from them (merchant, amount, date, category)',
  },
  {
    icon: 'chatbubbles-outline',
    text: 'Messages you send to the Copilot, plus a short summary of your recent activity for context',
  },
];

export const AiConsentModal = ({ visible, onAgree, onDecline }: AiConsentModalProps) => {
  const themeColors = useThemeColors();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDecline}>
      <Pressable
        style={{ flex: 1, justifyContent: 'flex-end' }}
        onPress={onDecline}>
        <BlurView intensity={90} tint="dark" className="absolute inset-0" />
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="bg-surface-1 rounded-t-[40px] px-6 pt-8 pb-12"
          style={{ borderTopWidth: 1, borderTopColor: themeColors.hairline, maxHeight: '88%' }}>
          <View className="items-center mb-5">
            <View
              className="w-14 h-14 rounded-2xl justify-center items-center mb-4"
              style={{ backgroundColor: 'rgba(255, 107, 74, 0.15)' }}>
              <Ionicons name="sparkles" size={26} color="#FF6B4A" />
            </View>
            <Text className="font-jakarta-bold text-text-high text-2xl text-center">
              Use AI to read your finances?
            </Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ flexShrink: 1 }}>
            <Text className="font-jakarta text-text-mid text-sm leading-relaxed text-center mb-6">
              Magic Scan and the Copilot use{' '}
              <Text className="font-jakarta-bold text-text-high">Google Gemini</Text>, a
              third-party AI service, to read documents and answer questions. With your
              permission, we send the following to Google over an encrypted connection:
            </Text>

            <View className="gap-3 mb-6">
              {BULLETS.map((b) => (
                <View key={b.text} className="flex-row items-start gap-3">
                  <View
                    className="w-8 h-8 rounded-xl justify-center items-center mt-0.5"
                    style={{ backgroundColor: 'rgba(255, 107, 74, 0.12)' }}>
                    <Ionicons name={b.icon} size={15} color="#FF6B4A" />
                  </View>
                  <Text className="flex-1 font-jakarta text-text-mid text-[13px] leading-relaxed">
                    {b.text}
                  </Text>
                </View>
              ))}
            </View>

            <View
              className="rounded-2xl p-4 mb-2"
              style={{ backgroundColor: themeColors.surface2, borderWidth: 1, borderColor: themeColors.hairline }}>
              <Text className="font-jakarta text-text-low text-[12px] leading-relaxed">
                Google does not use this data to train its models on our paid API tier. We
                never sell your data. Bank PDF passwords stay on your device and are never
                sent to the AI. You can review the full details any time in our Privacy
                Policy, and revoke this in Settings.
              </Text>
            </View>
          </ScrollView>

          <View className="gap-3 mt-5">
            <Pressable
              onPress={onAgree}
              className="bg-accent-coral py-4 rounded-full items-center"
              style={{ boxShadow: '0 0 24px rgba(255, 107, 74, 0.45)' }}>
              <Text className="font-jakarta-bold text-white tracking-widest uppercase text-xs">
                Agree & Continue
              </Text>
            </Pressable>
            <Pressable onPress={onDecline} className="py-3 items-center">
              <Text className="font-jakarta-bold text-text-mid text-xs uppercase tracking-widest">
                Not now
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};
