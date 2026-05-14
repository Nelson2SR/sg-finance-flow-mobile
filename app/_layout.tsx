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



SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

export default function RootLayout() {
  return (

    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </GestureHandlerRootView>
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
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        {/* Vault Config CRUD — pushed from Settings. Headerless because
            each screen renders its own back arrow + title row. */}
        <Stack.Screen name="categories" options={{ headerShown: false }} />
        <Stack.Screen name="labels" options={{ headerShown: false }} />
      </Stack>
      <AuthGuard />
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}



