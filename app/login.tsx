import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';


export default function LoginScreen() {
  const router = useRouter();
  const { login, unlockVault, logout } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: Login, 2: Passphrase
  const [isRegistering, setIsRegistering] = useState(false);


  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setIsLoading(true);
    try {
      const data = await authService.login(username, password);
      await login(data.access_token, username);
      setStep(2); // Move to passphrase step
    } catch (error: any) {

      Alert.alert('Login Failed', error.response?.data?.detail || 'Please check your connection');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!username || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setIsLoading(true);
    try {
      await authService.register(username, password);
      Alert.alert('Success', 'Account created! You can now log in.');
      setIsRegistering(false);
    } catch (error: any) {

      Alert.alert('Registration Failed', error.response?.data?.detail || 'Username might be taken');
    } finally {
      setIsLoading(false);
    }
  };


  const handleUnlock = async () => {
    if (!passphrase) {
      Alert.alert('Error', 'Master Passphrase is required');
      return;
    }

    const success = await unlockVault(passphrase);
    if (success) {
      router.replace('/(tabs)');
    }
  };

  return (
    <View className="flex-1 bg-white dark:bg-black">
      <BlurView intensity={100} tint="dark" className="absolute inset-0" />
      
      <SafeAreaView className="flex-1 px-8 justify-center">
        <View className="items-center mb-12">
          <View className="w-20 h-20 rounded-[24px] bg-brand-500 justify-center items-center shadow-2xl shadow-brand-500/50 mb-6">
            <Ionicons name="shield-checkmark" size={40} color="white" />
          </View>
          <Text className="font-jakarta text-white text-3xl font-jakarta-bold text-center">
            {step === 2 ? 'Unlock Vault' : (isRegistering ? 'Create Vault' : 'Liquid Glass')}
          </Text>
          <Text className="font-jakarta text-gray-400 text-center mt-2">
            {step === 2 ? 'Enter your Master Passphrase' : (isRegistering ? 'Join the privacy-first ecosystem' : 'Your privacy-first financial vault')}
          </Text>

        </View>

        <View className="bg-white/10 p-8 rounded-[32px] border border-white/10 shadow-2xl">
          {step === 1 ? (
            <>
              <View className="mb-6">
                <Text className="font-jakarta text-gray-400 font-jakarta-bold text-[10px] uppercase tracking-widest mb-2 px-1">Username</Text>
                <TextInput
                  value={username}
                  onChangeText={setUsername}
                  placeholder="e.g. Satoshi"
                  placeholderTextColor="#666"
                  className="bg-black/20 p-4 rounded-2xl text-white font-jakarta border border-white/5"
                  autoCapitalize="none"
                />
              </View>

              <View className="mb-8">
                <Text className="font-jakarta text-gray-400 font-jakarta-bold text-[10px] uppercase tracking-widest mb-2 px-1">Password</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  placeholder="••••••••"
                  placeholderTextColor="#666"
                  className="bg-black/20 p-4 rounded-2xl text-white font-jakarta border border-white/5"
                />
              </View>

              <TouchableOpacity 
                onPress={isRegistering ? handleRegister : handleLogin}
                disabled={isLoading}
                className="bg-brand-500 p-5 rounded-2xl items-center shadow-lg shadow-brand-500/30"
              >
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="font-jakarta text-white font-jakarta-bold text-lg">
                    {isRegistering ? 'Create Account' : 'Connect Vault'}
                  </Text>
                )}
              </TouchableOpacity>
            </>

          ) : (
            <>
              <View className="mb-8">
                <Text className="font-jakarta text-gray-400 font-jakarta-bold text-[10px] uppercase tracking-widest mb-2 px-1">Master Passphrase</Text>
                <TextInput
                  value={passphrase}
                  onChangeText={setPassphrase}
                  secureTextEntry
                  autoFocus
                  placeholder="Min. 16 characters"
                  placeholderTextColor="#666"
                  className="bg-black/20 p-4 rounded-2xl text-white font-jakarta border border-white/5"
                />
              </View>

              <TouchableOpacity 
                onPress={handleUnlock}
                className="bg-brand-500 p-5 rounded-2xl items-center shadow-lg shadow-brand-500/30"
              >
                <Text className="font-jakarta text-white font-jakarta-bold text-lg">Unlock Data</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <View className="mt-8 items-center">
          <TouchableOpacity 
            onPress={() => setIsRegistering(!isRegistering)}
          >
            <Text className="font-jakarta text-gray-500">
              {isRegistering ? 'Already have a vault?' : "Don't have a vault?"} 
              <Text className="text-brand-500 font-jakarta-bold"> {isRegistering ? 'Login' : 'Register'}</Text>
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            className="mt-6"
            onPress={async () => {
              await logout();
              Alert.alert('Reset', 'Vault and local data cleared.');
              setStep(1);
            }}
          >
            <Text className="font-jakarta text-gray-600 text-[10px] uppercase tracking-widest font-jakarta-bold">Reset Vault (Dev Only)</Text>
          </TouchableOpacity>
        </View>


      </SafeAreaView>
    </View>
  );
}
