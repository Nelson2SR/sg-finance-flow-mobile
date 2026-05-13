import React from 'react';
import { View, Text, Pressable, Modal, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useThemeColors } from '../../hooks/use-theme-colors';

interface MagicScanWindowProps {
  visible: boolean;
  onClose: () => void;
  onSelectFile: (uri: string, mimeType: string) => void;
}

export const MagicScanWindow = ({ visible, onClose, onSelectFile }: MagicScanWindowProps) => {
  const themeColors = useThemeColors();

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
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8 });
    if (!result.canceled && result.assets[0].uri) {
      onSelectFile(result.assets[0].uri, 'image/jpeg');
    }
  };

  const handleUploadPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need gallery access to upload photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0].uri) {
      onSelectFile(result.assets[0].uri, 'image/jpeg');
    }
  };

  const handleLoadTestData = async () => {
    try {
      const testFilePath = `${FileSystem.documentDirectory}test-statement.pdf`;
      onSelectFile(testFilePath, 'application/pdf');
    } catch (e) {
      Alert.alert('Dev Error', 'Test file not found in document directory.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 justify-center items-center px-6">
        <BlurView intensity={90} tint="dark" className="absolute inset-0" />

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
            Select your source. We primarily support PDF e-statements from all major SG banks.
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
      </View>
    </Modal>
  );
};
