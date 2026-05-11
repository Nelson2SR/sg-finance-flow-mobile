import React from 'react';
import { View, Text, TouchableOpacity, Modal, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';

interface MagicScanWindowProps {
  visible: boolean;
  onClose: () => void;
  onSelectFile: (uri: string, mimeType: string) => void;
}

export const MagicScanWindow = ({ visible, onClose, onSelectFile }: MagicScanWindowProps) => {
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

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });

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
    // In a real device, we might need to bundle this or use a specific dev path
    // For now, we attempt to load the file from the project structure if in dev
    try {
      const testFilePath = `${FileSystem.documentDirectory}test-statement.pdf`;
      // This is a placeholder logic for the demo/dev purposes
      // In a real dev env, we might use a hardcoded URI that points to the local tests folder
      // or a pre-downloaded asset.
      onSelectFile(testFilePath, 'application/pdf');
    } catch (e) {
      Alert.alert('Dev Error', 'Test file not found in document directory.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 justify-center items-center px-6">
        <BlurView intensity={90} tint="dark" className="absolute inset-0" />
        
        <View className="bg-white dark:bg-[#111116] w-full rounded-[32px] p-8 border border-white/20 shadow-2xl">
          <View className="flex-row justify-between items-center mb-8">
            <View>
              <Text className="font-jakarta text-gray-400 font-jakarta-bold text-[10px] uppercase tracking-widest mb-1">Upload Flow</Text>
              <Text className="font-jakarta text-gray-900 dark:text-white text-2xl font-jakarta-bold">Magic Scan</Text>
            </View>
            <TouchableOpacity onPress={onClose} className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 justify-center items-center">
              <Ionicons name="close" size={24} color="#E0533D" />
            </TouchableOpacity>
          </View>

          <Text className="font-jakarta text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
            Select your source. We primarily support PDF e-statements from all major SG banks.
          </Text>

          <View className="gap-4">
            <TouchableOpacity 
              onPress={handleImportStatement}
              className="bg-brand-500 p-6 rounded-[24px] flex-row items-center gap-4 shadow-xl shadow-brand-500/30"
            >
              <View className="w-12 h-12 bg-white/20 rounded-full justify-center items-center">
                <Ionicons name="document-text" size={24} color="#fff" />
              </View>
              <View>
                <Text className="font-jakarta text-white font-jakarta-bold text-lg">Import E-Statement</Text>
                <Text className="font-jakarta text-white/70 text-xs">PDF Files • Batch Processing</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={handleScanReceipt}
              className="bg-gray-50 dark:bg-white/5 p-6 rounded-[24px] flex-row items-center gap-4 border border-white/10"
            >
              <View className="w-12 h-12 bg-brand-500/10 rounded-full justify-center items-center">
                <Ionicons name="camera" size={24} color="#E0533D" />
              </View>
              <View>
                <Text className="font-jakarta text-gray-900 dark:text-white font-jakarta-bold text-lg">Scan Receipt</Text>
                <Text className="font-jakarta text-gray-400 text-xs">Camera • Instant Capture</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={handleUploadPhoto}
              className="bg-gray-50 dark:bg-white/5 p-6 rounded-[24px] flex-row items-center gap-4 border border-white/10"
            >
              <View className="w-12 h-12 bg-brand-500/10 rounded-full justify-center items-center">
                <Ionicons name="image" size={24} color="#E0533D" />
              </View>
              <View>
                <Text className="font-jakarta text-gray-900 dark:text-white font-jakarta-bold text-lg">Upload Photo</Text>
                <Text className="font-jakarta text-gray-400 text-xs">Gallery • PNG/JPEG</Text>
              </View>
            </TouchableOpacity>

            {__DEV__ && (
              <TouchableOpacity 
                onPress={handleLoadTestData}
                className="mt-4 p-4 rounded-[20px] border border-dashed border-gray-300 dark:border-gray-700 items-center"
              >
                <Text className="font-jakarta text-gray-400 font-jakarta-bold text-[10px] uppercase tracking-widest">Dev: Load Test Data</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};
