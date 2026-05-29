/**
 * AI data-sharing consent sheet.
 *
 * Shown the first time a user invokes an AI feature (Magic Scan or
 * Copilot). Discloses exactly what data is sent and to whom, per App
 * Review Guideline 5.1.1(i) / 5.1.2(i). The recipient is named via the
 * AI_PROVIDER_* constants so swapping LLM providers is a one-line edit.
 * The parent persists the grant via lib/aiConsent on "Agree"; "Not now"
 * cancels the pending action without sending anything.
 */

import React from 'react';
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

import { AI_PROVIDER_NAME, AI_PROVIDER_SHORT, PRIVACY_POLICY_URL } from '../../constants/Config';
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
  // iPad / wide-window detection. On iPad Air 11" (834pt wide) Apple
  // reviewers rejected the previous bottom-sheet layout as "obscured /
  // cropped": the disclaimer card inside the ScrollView clipped against
  // the CTA row because the sheet's `maxHeight: 88%` left just enough
  // room for everything *except* the last paragraph. Switching to a
  // centered, content-sized card on iPad sidesteps the layout math
  // entirely and matches the iPad pattern already used by the
  // TransactionAdderModal cap (480pt).
  const { width: screenWidth } = useWindowDimensions();
  const isWide = screenWidth >= 600;

  return (
    <Modal
      visible={visible}
      transparent
      animationType={isWide ? 'fade' : 'slide'}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={onDecline}>
      <Pressable
        style={{
          flex: 1,
          justifyContent: isWide ? 'center' : 'flex-end',
          // 'stretch' on iPhone keeps the bottom sheet edge-to-edge;
          // 'center' on iPad pairs with the 480pt maxWidth on the card.
          alignItems: isWide ? 'center' : 'stretch',
          paddingHorizontal: isWide ? 24 : 0,
        }}
        onPress={onDecline}>
        <BlurView intensity={90} tint="dark" className="absolute inset-0" />
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className={
            isWide
              ? 'bg-surface-1 rounded-[32px] px-6 pt-8 pb-8'
              : 'bg-surface-1 rounded-t-[40px] px-6 pt-8 pb-12'
          }
          style={{
            // iPhone: hairline only on the top edge (bottom-sheet seam).
            // iPad:   hairline on all sides since the card floats.
            borderTopWidth: 1,
            borderTopColor: themeColors.hairline,
            ...(isWide && {
              borderLeftWidth: 1,
              borderRightWidth: 1,
              borderBottomWidth: 1,
              borderColor: themeColors.hairline,
              width: '100%',
              maxWidth: 480,
            }),
            // 88% works on iPhone; on iPad we let the card size to
            // content so the disclaimer can never clip. The cap is just
            // a safety net for absurdly large dynamic-type settings.
            maxHeight: isWide ? '92%' : '88%',
          }}>
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

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 4 }}
            style={{ flexShrink: 1 }}>
            <Text className="font-jakarta text-text-mid text-sm leading-relaxed text-center mb-6">
              Magic Scan and the Copilot use{' '}
              <Text className="font-jakarta-bold text-text-high">{AI_PROVIDER_NAME}</Text>, a
              third-party AI service, to read documents and answer questions. With your
              permission, we send the following to {AI_PROVIDER_SHORT} over an encrypted
              connection:
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
                We only work with AI providers that don't use your data to train their
                models. We never sell your data. Bank PDF passwords stay on your device and
                are never sent to the AI. You can review the full details any time in our{' '}
                <Text
                  className="font-jakarta-bold text-accent-coral"
                  onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}>
                  Privacy Policy
                </Text>
                , and revoke this any time in Profile → Privacy.
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
