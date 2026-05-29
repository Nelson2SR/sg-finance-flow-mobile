/**
 * Invite-ready sheet — replaces the previous iOS Alert that showed the
 * code + URL as raw text.
 *
 * The Alert had two problems flagged by users:
 *  1. UX: a plain Alert is jarring next to the rest of the app's UI.
 *  2. WeChat: when the share text led with the URL, WeChat's preview
 *     truncated to `https://sgff.ap…` and the recipient never saw the
 *     code. The link is also not auto-clickable in WeChat chats.
 *
 * Code-only sheet (deliberate) — the `sgff.app` universal-link domain
 * is a placeholder until DNS + AASA are set up (`app.json`
 * `associatedDomains` is empty today), so the link/QR have no working
 * destination. Until then the CODE is the ground truth and the sheet
 * surfaces it as the single hero. When the domain is live we'll add a
 * link/QR section back in.
 *
 * iPad-aware: bottom-sheet on iPhone, centered 480pt card on iPad,
 * same pattern as AiConsentModal post-b4649e6.
 */

import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Share,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Clipboard from 'expo-clipboard';

import { useThemeColors } from '../../hooks/use-theme-colors';

interface InviteSheetProps {
  visible: boolean;
  /** Display name of the group the invite is for ("Family Group"). */
  groupName: string;
  /** Raw invite code ("IYJ6NLb...TURw") — the only thing recipients can use today. */
  code: string;
  onClose: () => void;
}

/**
 * Pure helper — exported so the format is testable in isolation. WeChat
 * is the load-bearing case: lead with the human hook, then put the
 * raw code on its own labelled line so a truncated preview still exposes
 * it, then a clear instruction so the recipient knows exactly where to
 * paste it. No URL — the universal-link domain isn't live yet (see
 * file header).
 */
export function buildShareMessage(groupName: string, code: string): string {
  return (
    `You're invited to "${groupName}" on VaultWise!\n\n` +
    `Invite code: ${code}\n\n` +
    `Open VaultWise → Vault Groups → "Have an invite code?" to join.`
  );
}

export const InviteSheet = ({ visible, groupName, code, onClose }: InviteSheetProps) => {
  const themeColors = useThemeColors();
  const { width: screenWidth } = useWindowDimensions();
  const isWide = screenWidth >= 600;

  // Inline "Copied!" pulse beats a global toast — no extra plumbing
  // and the affordance is exactly where the user just tapped.
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const share = () => {
    void Share.share({ message: buildShareMessage(groupName, code) });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType={isWide ? 'fade' : 'slide'}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={onClose}>
      <Pressable
        style={{
          flex: 1,
          justifyContent: isWide ? 'center' : 'flex-end',
          alignItems: isWide ? 'center' : 'stretch',
          paddingHorizontal: isWide ? 24 : 0,
        }}
        onPress={onClose}>
        <BlurView intensity={90} tint="dark" className="absolute inset-0" />
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className={
            isWide
              ? 'bg-surface-1 rounded-[32px] px-6 pt-6 pb-8'
              : 'bg-surface-1 rounded-t-[40px] px-6 pt-6 pb-12'
          }
          style={{
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
            maxHeight: isWide ? '92%' : '88%',
          }}>
          {/* Header — group name as the visual subject, close button right */}
          <View className="flex-row items-center justify-between mb-6">
            <View className="flex-1 pr-3">
              <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest mb-1">
                Invite ready
              </Text>
              <Text
                numberOfLines={1}
                className="font-jakarta-bold text-text-high text-xl">
                {groupName}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              className="w-9 h-9 rounded-full bg-surface-2 border border-hairline justify-center items-center">
              <Ionicons name="close" size={18} color={themeColors.textMid} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 4 }}
            style={{ flexShrink: 1 }}>
            {/* Code hero — large, monospace, tap-to-copy. The whole
                pill is pressable so a thumb-friendly target wins over a
                tiny "Copy" affordance. */}
            <Pressable
              onPress={copyCode}
              className="rounded-3xl border border-hairline px-5 py-6 items-center"
              style={{
                backgroundColor: themeColors.surface2,
                ...(copied && { borderColor: 'rgba(91, 224, 176, 0.6)' }),
              }}>
              <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest mb-3">
                Invite code
              </Text>
              <Text
                selectable
                style={{
                  fontFamily: 'Menlo',
                  fontSize: 18,
                  letterSpacing: 1.5,
                  color: themeColors.textHigh,
                  textAlign: 'center',
                }}>
                {code}
              </Text>
              <View className="flex-row items-center mt-4">
                <Ionicons
                  name={copied ? 'checkmark-circle' : 'copy-outline'}
                  size={14}
                  color={copied ? '#5BE0B0' : themeColors.textMid}
                />
                <Text
                  className={
                    copied
                      ? 'font-jakarta-bold text-accent-mint text-[11px] uppercase tracking-widest ml-1.5'
                      : 'font-jakarta-bold text-text-mid text-[11px] uppercase tracking-widest ml-1.5'
                  }>
                  {copied ? 'Copied' : 'Tap to copy'}
                </Text>
              </View>
            </Pressable>

            {/* How-to — recipients need to know that the code is pasted
                into the "Have an invite code?" row, since there's no
                clickable link yet. */}
            <View
              className="rounded-2xl p-4 mt-4"
              style={{
                backgroundColor: themeColors.surface2,
                borderWidth: 1,
                borderColor: themeColors.hairline,
              }}>
              <Text className="font-jakarta text-text-low text-[12px] leading-relaxed">
                Share the code with whoever you want to add. They open VaultWise → Vault
                Groups →{' '}
                <Text className="font-jakarta-bold text-text-mid">"Have an invite code?"</Text>{' '}
                and paste it in.
              </Text>
            </View>
          </ScrollView>

          <View className="gap-3 mt-5">
            <Pressable
              onPress={share}
              className="bg-accent-coral py-4 rounded-full items-center flex-row justify-center"
              style={{ boxShadow: '0 0 24px rgba(255, 107, 74, 0.45)' }}>
              <Ionicons name="share-outline" size={16} color="#FFFFFF" />
              <Text className="font-jakarta-bold text-white tracking-widest uppercase text-xs ml-2">
                Share invite
              </Text>
            </Pressable>
            <Pressable onPress={onClose} className="py-3 items-center">
              <Text className="font-jakarta-bold text-text-mid text-xs uppercase tracking-widest">
                Done
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};
