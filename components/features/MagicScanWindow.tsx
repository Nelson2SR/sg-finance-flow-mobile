/**
 * Unified Magic Scan modal — single Modal, four phases.
 *
 * Replaces the previous picker-Modal + review-Modal stacking pattern.
 * That pattern hit iOS modal-presentation races: when the picker
 * dismissed and the review modal tried to present, iOS queued the
 * new modal behind the dismissing one and the review modal silently
 * never appeared. Symptom was "tap Upload Photo → nothing happens".
 *
 * Now one Modal stays mounted through every phase:
 *   • `picker`  → the three import buttons (PDF, camera, gallery)
 *   • `loading` → spinner with "Analyzing your document"
 *   • `review`  → list of parsed transactions with select/edit/commit
 *   • `error`   → diagnostic message + close button
 *
 * The phase is owned by the parent; this component renders the right
 * content for the current phase inside a single iOS-native Modal.
 * Switching phases just re-renders the body — no Modal mount/unmount,
 * no native presentation race.
 */

import React from 'react';
import { View, Text, Pressable, Modal, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useThemeColors } from '../../hooks/use-theme-colors';
import {
  MagicScanReviewBody,
} from './MagicScanModal';
import type { ScanResponse, ScannedTransaction } from '../../services/geminiService';

export type MagicScanPhase = 'closed' | 'picker' | 'loading' | 'review' | 'error';

interface MagicScanWindowProps {
  phase: MagicScanPhase;
  /** Picker phase callbacks. */
  onSelectFile: (uri: string, mimeType: string) => void;
  /** Tear-down the whole flow (also called from the review body's close button). */
  onClose: () => void;
  /** Review-phase data + handlers. Required when phase !== 'picker'. */
  scanData: ScanResponse | null;
  errorMessage?: string | null;
  onConfirm: (data: ScannedTransaction[]) => void;
  onEditTransaction?: (index: number, patch: Partial<ScannedTransaction>) => void;
}

export const MagicScanWindow = ({
  phase,
  onSelectFile,
  onClose,
  scanData,
  errorMessage,
  onConfirm,
  onEditTransaction,
}: MagicScanWindowProps) => {
  const themeColors = useThemeColors();

  const inferMime = (asset: ImagePicker.ImagePickerAsset): string => {
    if (asset.mimeType) return asset.mimeType;
    const uri = asset.uri.toLowerCase();
    if (uri.endsWith('.png')) return 'image/png';
    if (uri.endsWith('.heic')) return 'image/heic';
    if (uri.endsWith('.heif')) return 'image/heif';
    if (uri.endsWith('.webp')) return 'image/webp';
    return 'image/jpeg';
  };

  const handleImportStatement = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets[0].uri) {
      onSelectFile(result.assets[0].uri, 'application/pdf');
    }
  };

  const handleScanReceipt = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need camera access to scan your receipts.');
      return;
    }
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]?.uri) {
        onSelectFile(result.assets[0].uri, inferMime(result.assets[0]));
      }
    } catch (err: any) {
      // iOS Simulator has no camera and throws "Camera not available
      // on simulator" — without this catch the rejection surfaces as
      // the dev-mode red error overlay. Real devices never hit this.
      const msg = String(err?.message ?? err ?? '');
      if (/simulator/i.test(msg)) {
        Alert.alert(
          'No camera on simulator',
          'The iOS Simulator has no camera. Use "Upload Photo" to pick from the photo library, or test on a real device.',
        );
      } else {
        Alert.alert('Could not open camera', msg || 'Please try again.');
      }
    }
  };

  const handleUploadPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need gallery access to upload photos.');
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]?.uri) {
        onSelectFile(result.assets[0].uri, inferMime(result.assets[0]));
      }
    } catch (err: any) {
      Alert.alert(
        'Could not open photo library',
        String(err?.message ?? err ?? '') || 'Please try again.',
      );
    }
  };

  const handleLoadTestData = async () => {
    try {
      const testFilePath = `${FileSystem.documentDirectory}test-statement.pdf`;
      onSelectFile(testFilePath, 'application/pdf');
    } catch {
      Alert.alert('Dev Error', 'Test file not found in document directory.');
    }
  };

  const visible = phase !== 'closed';
  const isPicker = phase === 'picker';

  return (
    <Modal
      visible={visible}
      transparent
      animationType={isPicker ? 'fade' : 'slide'}
      onRequestClose={onClose}>
      <View className={isPicker ? 'flex-1 justify-center items-center px-6' : 'flex-1 justify-end'}>
        <BlurView intensity={90} tint="dark" className="absolute inset-0" />

        {isPicker ? (
          // ── Picker panel — centered card with the three import buttons ──
          <View
            className="bg-surface-1 w-full rounded-[32px] p-7 border border-hairline"
            style={{ boxShadow: '0 12px 36px rgba(0, 0, 0, 0.4)' }}>
            <View className="flex-row justify-between items-center mb-7">
              <View>
                <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest mb-1">
                  Upload Flow
                </Text>
                <Text className="font-jakarta-bold text-text-high text-2xl">Magic Scan</Text>
              </View>
              <Pressable
                onPress={onClose}
                className="w-10 h-10 rounded-full bg-surface-2 border border-hairline justify-center items-center">
                <Ionicons name="close" size={20} color="#FF6B4A" />
              </Pressable>
            </View>

            <Text className="font-jakarta text-text-mid mb-7 leading-relaxed text-sm">
              Select your source. We support PDF e-statements and receipt photos.
            </Text>

            <View className="gap-3">
              <Pressable
                onPress={handleImportStatement}
                className="bg-accent-coral p-5 rounded-[24px] flex-row items-center gap-4"
                style={{ boxShadow: '0 0 24px rgba(255, 107, 74, 0.45)' }}>
                <View className="w-12 h-12 bg-white/20 rounded-full justify-center items-center">
                  <Ionicons name="document-text" size={22} color="#fff" />
                </View>
                <View>
                  <Text className="font-jakarta-bold text-white text-base">
                    Import E-Statement
                  </Text>
                  <Text className="font-jakarta text-white/70 text-xs">
                    PDF Files • Batch Processing
                  </Text>
                </View>
              </Pressable>

              <Pressable
                onPress={handleScanReceipt}
                className="bg-surface-2 p-5 rounded-[24px] flex-row items-center gap-4 border border-hairline">
                <View
                  className="w-12 h-12 rounded-full justify-center items-center"
                  style={{ backgroundColor: 'rgba(255, 107, 74, 0.15)' }}>
                  <Ionicons name="camera" size={22} color="#FF6B4A" />
                </View>
                <View>
                  <Text className="font-jakarta-bold text-text-high text-base">Scan Receipt</Text>
                  <Text className="font-jakarta text-text-low text-xs">
                    Camera • Instant Capture
                  </Text>
                </View>
              </Pressable>

              <Pressable
                onPress={handleUploadPhoto}
                className="bg-surface-2 p-5 rounded-[24px] flex-row items-center gap-4 border border-hairline">
                <View
                  className="w-12 h-12 rounded-full justify-center items-center"
                  style={{ backgroundColor: 'rgba(255, 107, 74, 0.15)' }}>
                  <Ionicons name="image" size={22} color="#FF6B4A" />
                </View>
                <View>
                  <Text className="font-jakarta-bold text-text-high text-base">Upload Photo</Text>
                  <Text className="font-jakarta text-text-low text-xs">Gallery • PNG/JPEG</Text>
                </View>
              </Pressable>

              {__DEV__ && (
                <Pressable
                  onPress={handleLoadTestData}
                  className="mt-3 p-4 rounded-[20px] items-center"
                  style={{
                    borderStyle: 'dashed',
                    borderWidth: 1.5,
                    borderColor: themeColors.textDim,
                  }}>
                  <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest">
                    Dev: Load Test Data
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        ) : (
          // ── Review / loading / error panel — identical bottom sheet to
          //    the standalone MagicScanReviewModal used by chat. ────────
          <MagicScanReviewBody
            scanData={scanData}
            loading={phase === 'loading'}
            errorMessage={errorMessage}
            onClose={onClose}
            onConfirm={onConfirm}
            onEditTransaction={onEditTransaction}
          />
        )}
      </View>
    </Modal>
  );
};
