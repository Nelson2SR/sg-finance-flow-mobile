import { Tabs as ExpoTabs } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import { View, Platform } from 'react-native';
import { BlurView } from 'expo-blur';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <ExpoTabs
      screenOptions={{
        tabBarActiveTintColor: '#E0533D',
        tabBarInactiveTintColor: isDark ? '#8E8E93' : '#AEAEB2',
        tabBarLabelStyle: {
          fontFamily: 'PlusJakartaSans_700Bold',
          fontSize: 10,
          marginTop: -5,
          marginBottom: Platform.OS === 'ios' ? 0 : 5,
        },
        tabBarStyle: {
          position: 'absolute',
          borderTopWidth: 0,
          elevation: 0,
          height: Platform.OS === 'ios' ? 88 : 70,
          backgroundColor: 'transparent',
        },
        tabBarBackground: () => (
          <BlurView 
            intensity={isDark ? 80 : 95} 
            tint={isDark ? 'dark' : 'light'} 
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} 
          />
        ),
        headerShown: false,
      }}>
      <ExpoTabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "grid" : "grid-outline"} size={22} color={color} />
          ),
        }}
      />
      
      <ExpoTabs.Screen
        name="analytics"
        options={{
          title: 'Insights',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "analytics" : "analytics-outline"} size={22} color={color} />
          ),
        }}
      />

      <ExpoTabs.Screen
        name="chat"
        options={{
          title: 'Copilot',
          tabBarIcon: ({ focused }) => (
            <View 
              style={{
                width: 58,
                height: 58,
                backgroundColor: '#E0533D',
                borderRadius: 20,
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: Platform.OS === 'ios' ? 45 : 35,
                shadowColor: '#E0533D',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.4,
                shadowRadius: 12,
                elevation: 8,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.2)',
              }}
            >
              <Ionicons name="sparkles-sharp" size={28} color="#ffffff" />
            </View>
          ),
        }}
      />

      <ExpoTabs.Screen
        name="transactions"
        options={{
          title: 'Activity',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "swap-horizontal" : "swap-horizontal-outline"} size={24} color={color} />
          ),
        }}
      />

      <ExpoTabs.Screen
        name="settings"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "person" : "person-outline"} size={22} color={color} />
          ),
        }}
      />
    </ExpoTabs>
  );
}
