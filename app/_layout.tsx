import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';

import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform, useColorScheme as useRNColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useColorScheme } from 'nativewind';
import {
  useFonts,
  PlusJakartaSans_300Light,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import '../global.css';
import { AuthProvider } from '../context/AuthContext';
import { AuthGuard } from '../components/AuthGuard';
import { BiometricGate } from '../components/BiometricGate';
import { RootErrorBoundary } from '../components/RootErrorBoundary';
import * as Linking from 'expo-linking';
import { useVaultGroupsStore } from '../store/useVaultGroupsStore';
import { useBiometricStore } from '../lib/biometricLock';



SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

/**
 * Parse an incoming deep link and, if it carries a Vault Group invite
 * code, stash it in the store so the next successful sign-in (or
 * already-authed user) auto-consumes it.
 *
 * Accepted shapes:
 *   sgff://invite/<code>
 *   https://sgff.app/invite/<code>
 */
function extractInviteCode(url: string): string | null {
  try {
    const parsed = Linking.parse(url);
    // Two parse outcomes we care about:
    //   { hostname: 'invite', path: '<code>' }                       (sgff://invite/<code>)
    //   { hostname: 'sgff.app', path: 'invite/<code>' }              (universal link)
    if (parsed.hostname === 'invite' && parsed.path) {
      return decodeURIComponent(parsed.path).split('/')[0] || null;
    }
    if (parsed.path && parsed.path.startsWith('invite/')) {
      return decodeURIComponent(parsed.path.slice('invite/'.length)).split('/')[0] || null;
    }
  } catch {
    // Malformed URL — silently ignore. Deep links are best-effort.
  }
  return null;
}

function useDeepLinkInviteCapture() {
  useEffect(() => {
    const setPendingInvite = useVaultGroupsStore.getState().setPendingInvite;
    const consumeInvite = useVaultGroupsStore.getState().consumeInvite;
    const handle = (url: string) => {
      const code = extractInviteCode(url);
      if (!code) return;
      setPendingInvite(code);
      // If the user is already signed in, fire the consume immediately
      // — the AuthContext bootstrap only runs on sign-in transitions,
      // not on warm-app deep-link opens.
      consumeInvite(code).catch(() => {
        // Failure is fine — code stays cached for retry.
      });
    };

    // Cold-launch case: app was opened by tapping a link.
    Linking.getInitialURL().then((url) => {
      if (url) handle(url);
    });

    const sub = Linking.addEventListener('url', (evt) => handle(evt.url));
    return () => sub.remove();
  }, []);
}

export default function RootLayout() {
  useDeepLinkInviteCapture();

  // Read the persisted biometric-lock preference once at startup so
  // the gate has a definitive enabled/locked answer before the first
  // tab renders. This sets the lock to engaged-if-enabled — the gate
  // overlay then runs the FaceID/TouchID prompt automatically.
  useEffect(() => {
    void useBiometricStore.getState().hydrate();
  }, []);

  return (
    <RootErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AuthProvider>
          <RootLayoutNav />
        </AuthProvider>
      </GestureHandlerRootView>
    </RootErrorBoundary>
  );
}

function RootLayoutNav() {
  // OS-preference scheme — auto-updates if the user flips Dark Mode in
  // iOS/Android Settings. CSS variables in global.css under
  // `@media (prefers-color-scheme: dark)` flip from this signal alone, so
  // dark mode works without us wrapping any tree node in a `.dark` class
  // (an earlier attempt did that and severed React Navigation's context
  // chain on iOS new arch, causing a "missing navigation context" crash).
  const rnScheme = useRNColorScheme();
  const { colorScheme, setColorScheme } = useColorScheme();

  // Sync nativewind's scheme to the OS so Tailwind `dark:` variants resolve
  // correctly. The Settings → Dark Mode toggle still calls setColorScheme()
  // — we only push the OS scheme when nativewind hasn't been told otherwise.
  useEffect(() => {
    if (rnScheme && rnScheme !== colorScheme) {
      setColorScheme(rnScheme);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rnScheme]);

  // On web, also toggle the `dark` class on documentElement so manual
  // Settings overrides flip the CSS-var `.dark` selector. Native handles
  // this via the @media query in global.css; no DOM equivalent needed.
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      if (colorScheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [colorScheme]);

  const isDark = colorScheme === 'dark';

  const [loaded, error] = useFonts({
    PlusJakartaSans_300Light,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_700Bold,
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }


  return (
    <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen
          name="new-profile"
          options={{ headerShown: false, gestureEnabled: false }}
        />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        {/* Vault Config CRUD — pushed from Settings. Headerless because
            each screen renders its own back arrow + title row. */}
        <Stack.Screen name="categories" options={{ headerShown: false }} />
        <Stack.Screen name="labels" options={{ headerShown: false }} />
        <Stack.Screen name="privacy" options={{ headerShown: false }} />
        <Stack.Screen name="profile" options={{ headerShown: false }} />
        <Stack.Screen name="groups" options={{ headerShown: false }} />
      </Stack>
      <AuthGuard />
      <BiometricGate />
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}



