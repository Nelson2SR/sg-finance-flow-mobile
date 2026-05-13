import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';
import { DEV_DISABLE_VAULT } from '../constants/Config';
import { Surface, GradientCard, NeonButton } from '../components/ui';
import { useThemeColors } from '../hooks/use-theme-colors';


export default function LoginScreen() {
  const router = useRouter();
  const themeColors = useThemeColors();
  const { login, unlockVault, logout } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: Login, 2: Passphrase
  const [isRegistering, setIsRegistering] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);


  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setIsLoading(true);
    try {
      const data = await authService.login(username, password);
      await login(data.access_token, username);
      if (DEV_DISABLE_VAULT) {
        router.replace('/(tabs)');
      } else {
        setStep(2);
      }
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

  const titleCopy = step === 2 ? 'Unlock Vault' : isRegistering ? 'Create Vault' : 'Liquid Glass';
  const subtitleCopy =
    step === 2
      ? 'Enter your Master Passphrase'
      : isRegistering
        ? 'Join the privacy-first ecosystem'
        : 'Your privacy-first financial vault';

  // Input recipe pulled out so all three fields stay visually identical.
  const inputClass = (name: string) =>
    `bg-surface-3 px-4 py-4 rounded-2xl text-text-high font-jakarta text-base border ${focused === name ? 'border-accent-coral' : 'border-hairline'}`;

  return (
    <Surface halo>
      <SafeAreaView className="flex-1 px-6 justify-center">
        <View className="items-center mb-12">
          <View
            className="w-20 h-20 rounded-[24px] bg-accent-coral justify-center items-center mb-6"
            style={{ boxShadow: '0 0 32px rgba(255, 107, 74, 0.55)' }}>
            <Ionicons name="shield-checkmark" size={40} color="white" />
          </View>
          <Text className="font-jakarta-bold text-text-high text-[40px] tracking-tighter text-center">
            {titleCopy}
          </Text>
          <Text className="font-jakarta text-text-mid text-center mt-2 text-sm">
            {subtitleCopy}
          </Text>
        </View>

        <GradientCard padding="lg" accent="coral">
          {step === 1 ? (
            <>
              <View className="mb-5">
                <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest mb-2 px-1">
                  Username
                </Text>
                <TextInput
                  value={username}
                  onChangeText={setUsername}
                  placeholder="e.g. Satoshi"
                  placeholderTextColor={themeColors.textDim}
                  className={inputClass('username')}
                  onFocus={() => setFocused('username')}
                  onBlur={() => setFocused(null)}
                  autoCapitalize="none"
                />
              </View>

              <View className="mb-7">
                <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest mb-2 px-1">
                  Password
                </Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  placeholder="••••••••"
                  placeholderTextColor={themeColors.textDim}
                  className={inputClass('password')}
                  onFocus={() => setFocused('password')}
                  onBlur={() => setFocused(null)}
                />
              </View>

              <NeonButton
                size="lg"
                block
                loading={isLoading}
                onPress={isRegistering ? handleRegister : handleLogin}>
                {isRegistering ? 'Create Account' : 'Connect Vault'}
              </NeonButton>
            </>
          ) : (
            <>
              <View className="mb-7">
                <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest mb-2 px-1">
                  Master Passphrase
                </Text>
                <TextInput
                  value={passphrase}
                  onChangeText={setPassphrase}
                  secureTextEntry
                  autoFocus
                  placeholder="Min. 16 characters"
                  placeholderTextColor={themeColors.textDim}
                  className={inputClass('passphrase')}
                  onFocus={() => setFocused('passphrase')}
                  onBlur={() => setFocused(null)}
                />
              </View>

              <NeonButton size="lg" block onPress={handleUnlock}>
                Unlock Data
              </NeonButton>
            </>
          )}
        </GradientCard>

        <View className="mt-8 items-center">
          <Pressable onPress={() => setIsRegistering(!isRegistering)}>
            <Text className="font-jakarta text-text-mid text-sm">
              {isRegistering ? 'Already have a vault?' : "Don't have a vault?"}{' '}
              <Text className="text-accent-coral font-jakarta-bold">
                {isRegistering ? 'Login' : 'Register'}
              </Text>
            </Text>
          </Pressable>

          <Pressable
            className="mt-6"
            onPress={async () => {
              await logout();
              Alert.alert('Reset', 'Vault and local data cleared.');
              setStep(1);
            }}>
            <Text className="font-jakarta-bold text-text-dim text-[10px] uppercase tracking-widest">
              Reset Vault (Dev Only)
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Surface>
  );
}
