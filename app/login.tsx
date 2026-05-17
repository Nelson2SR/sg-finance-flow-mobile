import React, { useState } from 'react';
import {
  Alert,
  Image,
  Platform,
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
  API_CONFIG,
  DEV_PHONE_OTP_BYPASS,
  DEV_PHONE_OTP_CODE,
} from '../constants/Config';
import { useAuth } from '../context/AuthContext';
import { useThemeColors } from '../hooks/use-theme-colors';
import { updateProfileExtras } from '../lib/profileExtras';
import {
  loginWithWeChat,
  requestPhoneOtp,
  signupPhoneOtp,
  verifyPhoneOtp,
} from '../services/authService';

type Step = 'landing' | 'phone' | 'otp';

const E164_RE = /^\+[1-9]\d{6,14}$/;

/**
 * Translate an axios error into a human message. The most common failure
 * mode in dev is "backend is running but doesn't have the route yet"
 * (FastAPI default 404 body `{detail: "Not Found"}`), and the second
 * most common is "backend unreachable at all" — distinguishing them
 * saves real debugging time. Falls back to the generic fallback.
 */
function describeAuthError(err: any, fallback: string): string {
  // No HTTP response at all → network reachability.
  if (!err?.response) {
    return `Could not reach the API server at ${API_CONFIG.BASE_URL}. Check that it's running and on the same network as this device.`;
  }
  const status = err.response.status;
  const detail = err.response.data?.detail;
  if (status === 404 && (detail === 'Not Found' || detail === undefined)) {
    return `The API server is up but doesn't expose this endpoint yet. Restart the backend so it picks up the new auth routes, then try again.`;
  }
  if (typeof detail === 'string') return detail;
  if (detail && typeof detail === 'object' && detail.message) return String(detail.message);
  return fallback;
}

export default function LoginScreen() {
  const router = useRouter();
  const themeColors = useThemeColors();
  const { login } = useAuth();

  const [step, setStep] = useState<Step>('landing');
  const [phone, setPhone] = useState('+65');
  const [otp, setOtp] = useState('');
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
        describeAuthError(err, 'Please try again or use phone OTP.'),
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
        describeAuthError(err, 'Please check the number and try again.'),
      );
    } finally {
      setIsBusy(false);
    }
  };

  // Web doesn't render Alert.alert action buttons; fall back to confirm().
  // On native, Alert.alert is the standard prompt UX.
  const confirmCreateAccount = (): Promise<boolean> => {
    if (Platform.OS === 'web') {
      const ok = typeof window !== 'undefined'
        ? window.confirm(`No account exists for ${phone}. Create one?`)
        : false;
      return Promise.resolve(ok);
    }
    return new Promise((resolve) => {
      Alert.alert(
        'No account found',
        `No account exists for ${phone}. Create one with this number?`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Create account', style: 'default', onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) },
      );
    });
  };

  const completeSignup = async (signupToken: string) => {
    setIsBusy(true);
    try {
      const resp = await signupPhoneOtp(signupToken);
      await login(resp);
      // Same local-stash as the existing-user branch — the phone is
      // the OTP input we just verified.
      await updateProfileExtras(resp.user.id, { phone }).catch(() => {});
      router.replace('/new-profile');
    } catch (err: any) {
      Alert.alert(
        'Could not create account',
        describeAuthError(err, 'Please try again or use a different number.'),
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
      if (resp.user_exists) {
        await login({
          access_token: resp.access_token,
          refresh_token: resp.refresh_token,
          token_type: resp.token_type,
          user: resp.user,
        });
        // Stash the phone locally so the Profile screen can show it.
        // Backend doesn't expose it on the user object today, but the
        // user typed it 30s ago — capture it while we still have it.
        await updateProfileExtras(resp.user.id, { phone }).catch(() => {});
        router.replace('/(tabs)');
        return;
      }
      // The OTP was correct but no account exists for this phone yet.
      // Server has minted a signed signup_token (5 min TTL); confirm
      // with the user, then POST it to /auth/phone/signup. We do NOT
      // re-send the OTP — Twilio verifications are single-use.
      setIsBusy(false);
      const ok = await confirmCreateAccount();
      if (ok) await completeSignup(resp.signup_token);
    } catch (err: any) {
      Alert.alert(
        'Verification failed',
        describeAuthError(err, 'The code may have expired. Send a fresh one.'),
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

  // Web: constrain the form to a typical mobile-card width so the
  // layout doesn't stretch full-window on desktop browsers. On native,
  // these classes still resolve but the parent SafeAreaView is already
  // <420px so they have no visible effect.
  const innerContainerClass =
    Platform.OS === 'web'
      ? 'flex-1 px-6 justify-center w-full max-w-md mx-auto'
      : 'flex-1 px-6 justify-center';

  return (
    <Surface halo>
      <SafeAreaView className={innerContainerClass}>
        <View className="items-center mb-10">
          {/* App icon — same image used as the iOS app icon. The
              borderRadius matches Apple's squircle proportion
              (~22.37% of side length, so 18px on an 80px frame) so
              the rendered logo here previews the same shape the
              system uses on the home screen. overflow:hidden clips
              the PNG's white corners (the icon ships flattened for
              App Store Connect compliance). */}
          <View
            className="w-20 h-20 mb-6 overflow-hidden"
            style={{
              borderRadius: 18,
              boxShadow: '0 0 32px rgba(255, 107, 74, 0.55)',
            }}>
            <Image
              source={require('../assets/images/icon.png')}
              style={{ width: 80, height: 80 }}
              resizeMode="cover"
            />
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
              {/* WeChat login is hidden in production builds:
               *   1. The native SDK isn't wired yet — only the dev stub
               *      backend honours `dev-<timestamp>` codes.
               *   2. Offering WeChat AND another third-party login would
               *      trip Apple Guideline 4.8 (Sign in with Apple
               *      requirement). Phone OTP alone is exempt.
               *   3. App Review would see a button that doesn't work
               *      end-to-end, which is a guideline 2.1 rejection.
               * Re-enable here once WeChat SDK + Open Platform are live
               * AND Sign in with Apple is in place. */}
              {__DEV__ && (
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
              )}

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
                setOtp('');
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
