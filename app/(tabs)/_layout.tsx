import { Tabs as ExpoTabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Platform } from 'react-native';
import { useThemeColors } from '../../hooks/use-theme-colors';

const ACCENT = '#FF6B4A';

export default function TabLayout() {
  const colors = useThemeColors();

  return (
    <ExpoTabs
      screenOptions={{
        tabBarActiveTintColor: ACCENT,
        tabBarInactiveTintColor: colors.textLow,
        tabBarLabelStyle: {
          fontFamily: 'PlusJakartaSans_700Bold',
          fontSize: 10,
          marginTop: -5,
          marginBottom: Platform.OS === 'ios' ? 0 : 5,
        },
        tabBarStyle: {
          position: 'absolute',
          borderTopWidth: 1,
          borderTopColor: colors.hairline,
          elevation: 0,
          height: Platform.OS === 'ios' ? 88 : 70,
          backgroundColor: colors.surface0,
        },
        headerShown: false,
      }}>
      <ExpoTabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'grid' : 'grid-outline'} size={22} color={color} />
          ),
        }}
      />

      <ExpoTabs.Screen
        name="analytics"
        options={{
          title: 'Insights',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'analytics' : 'analytics-outline'} size={22} color={color} />
          ),
        }}
      />

      <ExpoTabs.Screen
        name="chat"
        options={{
          title: 'Copilot',
          // Flat icon matching the other tabs — the previous floating FAB
          // looked great on its own but read as inconsistent next to the
          // small flat icons on every other tab.
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'sparkles' : 'sparkles-outline'} size={22} color={color} />
          ),
        }}
      />

      <ExpoTabs.Screen
        name="transactions"
        options={{
          title: 'Activity',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'swap-horizontal' : 'swap-horizontal-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />

      <ExpoTabs.Screen
        name="settings"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={22} color={color} />
          ),
        }}
      />
    </ExpoTabs>
  );
}
