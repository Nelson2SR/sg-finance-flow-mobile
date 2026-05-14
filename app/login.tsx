import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { Surface, GradientCard, NeonButton } from '../components/ui';
import {
  DEV_PHONE_OTP_BYPASS,
  DEV_PHONE_OTP_CODE,
} from '../constants/Config';
import { useAuth } from '../context/AuthContext';
import { useThemeColors } from '../hooks/use-theme-colors';
import {
  loginWithWeChat,
  requestPhoneOtp,
  verifyPhoneOtp,
} from '../services/authService';

type Step = 'landing' | 'phone' | 'otp';

const E164_RE = /^\+[1-9]\d{6,14}$/;

export default function LoginScreen() {
  const router = useRouter();
  const themeColors = useThemeColors();
  const { login } = useAuth();

  const [step, setStep] = useState<Step>('landing');
  const [phone, setPhone] = useState('+65');
  const [otp, setOtp] = useState(DEV_PHONE_OTP_BYPASS ? DEV_PHONE_OTP_CODE : '');
  const [isBusy, setIsBusy] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  // ── WeChat ─────────────────────────────────────────────────────────────
  const handleWeChat = async () => {
    // Native WeChat SDK lands in PR-2b once Open Platform registration
    // is in flight and we move to an Expo dev build. Until then, we
    // hit the backend stub directly so the dev flow is unblocked.
    if (!__DEV__) {
      Alert.alert(
        'WeChat sign-in is coming soon',
        'This requires a dev build with the native WeChat SDK. Use phone OTP for now.',
      );
      return;
    }

    setIsBusy(true);
    try {
      const resp = await loginWithWeChat(`dev-${Date.now()}`);
      await login(resp);
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert(
        'WeChat sign-in failed',
        err.response?.data?.detail ?? 'Please try again or use phone OTP.',
      );
    } finally {
      setIsBusy(false);
    }
  };

  // ── Phone: step 1 — request OTP ────────────────────────────────────────
  const handleRequestOtp = async () => {
    if (!E164_RE.test(phone)) {
      Alert.alert(
        'Invalid number',
        'Use E.164 format with country code, e.g. +6591234567.',
      );
      return;
    }
    setIsBusy(true);
    try {
      await requestPhoneOtp(phone);
      setStep('otp');
    } catch (err: any) {
      Alert.alert(
        'Could not send code',
        err.response?.data?.detail ?? 'Please check the number and try again.',
      );
    } finally {
      setIsBusy(false);
    }
  };

  // ── Phone: step 2 — verify OTP ─────────────────────────────────────────
  const handleVerifyOtp = async () => {
    if (otp.length < 4) {
      Alert.alert('Enter the code', 'Please enter the verification code we sent.');
      return;
    }
    setIsBusy(true);
    try {
      const resp = await verifyPhoneOtp(phone, otp);
      await login(resp);
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert(
        'Verification failed',
        err.response?.data?.detail ?? 'The code may have expired. Send a fresh one.',
      );
    } finally {
      setIsBusy(false);
    }
  };

  const inputClass = (name: string) =>
    `bg-surface-3 px-4 py-4 rounded-2xl text-text-high font-jakarta text-base border ${
      focused === name ? 'border-accent-coral' : 'border-hairline'
    }`;

  const title =
    step === 'otp'
      ? 'Verify your phone'
      : step === 'phone'
        ? 'Sign in with phone'
        : 'Welcome';
  const subtitle =
    step === 'otp'
      ? `We sent a code to ${phone}.`
      : step === 'phone'
        ? "We'll text you a one-time code."
        : 'Sign in to your private vault.';

  return (
    <Surface halo>
      <SafeAreaView className="flex-1 px-6 justify-center">
        <View className="items-center mb-10">
          <View
            className="w-20 h-20 rounded-[24px] bg-accent-coral justify-center items-center mb-6"
            style={{ boxShadow: '0 0 32px rgba(255, 107, 74, 0.55)' }}>
            <Ionicons name="shield-checkmark" size={40} color="white" />
          </View>
          <Text className="font-jakarta-bold text-text-high text-[36px] tracking-tighter text-center">
            {title}
          </Text>
          <Text className="font-jakarta text-text-mid text-center mt-2 text-sm">
            {subtitle}
          </Text>
        </View>

        <GradientCard padding="lg" accent="coral">
          {step === 'landing' && (
            <View className="gap-3">
              <NeonButton
                size="lg"
                block
                loading={isBusy}
                onPress={handleWeChat}>
                <View className="flex-row items-center justify-center gap-2">
                  <Ionicons name="logo-wechat" size={20} color="white" />
                  <Text className="font-jakarta-bold text-white text-base">
                    Continue with WeChat
                  </Text>
                </View>
              </NeonButton>

              <Pressable
                onPress={() => setStep('phone')}
                className="bg-surface-3 px-5 py-4 rounded-2xl border border-hairline"
                disabled={isBusy}>
                <View className="flex-row items-center justify-center gap-2">
                  <Ionicons
                    name="phone-portrait-outline"
                    size={20}
                    color={themeColors.textHigh}
                  />
                  <Text className="font-jakarta-bold text-text-high text-base">
                    Continue with phone
                  </Text>
                </View>
              </Pressable>
            </View>
          )}

          {step === 'phone' && (
            <>
              <View className="mb-7">
                <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest mb-2 px-1">
                  Phone number
                </Text>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+6591234567"
                  placeholderTextColor={themeColors.textDim}
                  keyboardType="phone-pad"
                  autoFocus
                  className={inputClass('phone')}
                  onFocus={() => setFocused('phone')}
                  onBlur={() => setFocused(null)}
                />
              </View>

              <NeonButton
                size="lg"
                block
                loading={isBusy}
                onPress={handleRequestOtp}>
                Send code
              </NeonButton>
            </>
          )}

          {step === 'otp' && (
            <>
              <View className="mb-7">
                <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest mb-2 px-1">
                  6-digit code
                </Text>
                <TextInput
                  value={otp}
                  onChangeText={setOtp}
                  placeholder="123456"
                  placeholderTextColor={themeColors.textDim}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                  className={inputClass('otp')}
                  onFocus={() => setFocused('otp')}
                  onBlur={() => setFocused(null)}
                />
                {DEV_PHONE_OTP_BYPASS && (
                  <Text className="font-jakarta text-text-low text-[11px] mt-2 px-1">
                    Dev stub: any valid phone accepts code {DEV_PHONE_OTP_CODE}.
                  </Text>
                )}
              </View>

              <NeonButton
                size="lg"
                block
                loading={isBusy}
                onPress={handleVerifyOtp}>
                Verify
              </NeonButton>
            </>
          )}
        </GradientCard>

        {step !== 'landing' && (
          <View className="mt-8 items-center">
            <Pressable
              onPress={() => {
                setStep(step === 'otp' ? 'phone' : 'landing');
                setOtp(DEV_PHONE_OTP_BYPASS ? DEV_PHONE_OTP_CODE : '');
              }}>
              <Text className="font-jakarta-bold text-text-dim text-[10px] uppercase tracking-widest">
                {step === 'otp' ? '← Change phone' : '← Back'}
              </Text>
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    </Surface>
  );
}
