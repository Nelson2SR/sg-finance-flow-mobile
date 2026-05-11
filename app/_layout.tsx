import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';

import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  useFonts,
  PlusJakartaSans_300Light,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import '../global.css';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';



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
  const colorScheme = useColorScheme();
  const { isAuthenticated, isVaultUnlocked, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  const [loaded, error] = useFonts({
    PlusJakartaSans_300Light,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_700Bold,
  });

  useEffect(() => {
    if (isLoading || !loaded) return;

    const inAuthGroup = segments[0] === 'login';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/login');
    } else if (isAuthenticated && !isVaultUnlocked && !inAuthGroup) {
      router.replace('/login'); // We handle the step logic inside login.tsx
    } else if (isAuthenticated && isVaultUnlocked && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isVaultUnlocked, isLoading, segments, loaded]);

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }


  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}


