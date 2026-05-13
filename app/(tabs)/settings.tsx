import React, { useState } from 'react';
import { View, Text, Switch, ScrollView, TextInput, Platform, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { Surface, SurfaceHeaderArea, GradientCard, ScreenHeader, NeonButton } from '../../components/ui';
import { useThemeColors } from '../../hooks/use-theme-colors';
import { useCopilotStore, CopilotPersona } from '../../store/useCopilotStore';

const PERSONA_OPTIONS: {
  id: CopilotPersona;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
}[] = [
  {
    id: 'advisor',
    label: 'Financial Advisor',
    description: 'Data-driven insights from your recent vault activity.',
    icon: 'analytics',
    tint: '#FF6B4A',
  },
  {
    id: 'friend',
    label: 'Emotional Friend',
    description: 'A WeChat-style cheerleader for the days that need it.',
    icon: 'heart',
    tint: '#5BE0B0',
  },
];

export default function SettingsScreen() {
  const themeColors = useThemeColors();
  const { colorScheme, setColorScheme } = useColorScheme();
  const enabledPersonas = useCopilotStore(s => s.enabledPersonas);
  const togglePersona = useCopilotStore(s => s.togglePersona);
  const [profile, setProfile] = useState({
    name: 'Surong',
    gender: 'Female',
    birthday: '1994-11-22',
  });

  // Row used inside the profile + preferences cards. Keeps spacing and
  // border-bottom consistent across both.
  const Row = ({
    icon,
    label,
    right,
    last,
  }: {
    icon?: keyof typeof Ionicons.glyphMap;
    label: string;
    right: React.ReactNode;
    last?: boolean;
  }) => (
    <View
      className="flex-row justify-between items-center p-5"
      style={!last ? { borderBottomWidth: 1, borderBottomColor: themeColors.hairline } : undefined}>
      <View className="flex-row items-center gap-4">
        {icon && <Ionicons name={icon} size={18} color="#FF6B4A" />}
        <Text
          className={
            icon
              ? 'font-jakarta-bold text-text-high text-sm'
              : 'font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest'
          }>
          {label}
        </Text>
      </View>
      {right}
    </View>
  );

  return (
    <Surface>
      <SurfaceHeaderArea>
        <ScreenHeader
          eyebrow="Profile & Identity"
          title="Settings"
          action={
            <NeonButton variant="secondary" size="sm" icon="log-out-outline">
              Sign out
            </NeonButton>
          }
        />
      </SurfaceHeaderArea>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingBottom: Platform.OS === 'ios' ? 120 : 100,
          paddingTop: 12,
          paddingHorizontal: 24,
        }}
        showsVerticalScrollIndicator={false}>
        <GradientCard padding="lg" accent="coral" className="mb-6">
          <View className="flex-row items-center gap-5">
            <View
              className="w-20 h-20 rounded-full bg-accent-coral justify-center items-center"
              style={{ boxShadow: '0 0 24px rgba(255, 107, 74, 0.5)' }}>
              <Text className="font-jakarta-bold text-white text-2xl tracking-widest uppercase">
                {profile.name.substring(0, 2)}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="font-jakarta-bold text-text-high text-2xl mb-2">
                {profile.name}
              </Text>
              <View
                className="px-3 py-1.5 rounded-full flex-row items-center gap-2 self-start"
                style={{ backgroundColor: 'rgba(255, 181, 71, 0.16)', borderWidth: 1, borderColor: 'rgba(255, 181, 71, 0.35)' }}>
                <Ionicons name="flame" size={12} color="#FFB547" />
                <Text className="font-jakarta-bold text-accent-amber text-[10px] uppercase tracking-widest">
                  30 Day Streak
                </Text>
              </View>
            </View>
          </View>
        </GradientCard>

        <GradientCard padding="none" className="mb-8 overflow-hidden">
          <Row
            label="Display Name"
            right={
              <TextInput
                className="text-text-high font-jakarta-bold text-sm text-right"
                value={profile.name}
                onChangeText={t => setProfile({ ...profile, name: t })}
                placeholderTextColor={themeColors.textDim}
              />
            }
          />
          <Row
            label="Gender"
            right={
              <Text className="font-jakarta-bold text-text-high text-sm">{profile.gender}</Text>
            }
          />
          <Row
            label="Birthday"
            right={
              <Text className="font-jakarta-bold text-text-high text-sm">{profile.birthday}</Text>
            }
            last
          />
        </GradientCard>

        <Text className="font-jakarta-bold text-text-high text-xl mb-5">Trophy Room</Text>
        <View className="flex-row gap-3 mb-8">
          <GradientCard padding="none" radius="row" style={{ width: 100, height: 116 }}>
            <View className="flex-1 items-center justify-center">
              <Ionicons name="trophy" size={28} color="#FFB547" />
              <Text className="font-jakarta-bold text-accent-amber text-[9px] text-center mt-3 uppercase tracking-widest px-2">
                Savings Elite
              </Text>
            </View>
          </GradientCard>
          <View
            className="items-center justify-center opacity-60"
            style={{
              width: 100,
              height: 116,
              borderStyle: 'dashed',
              borderWidth: 1.5,
              borderColor: themeColors.textDim,
              borderRadius: 16,
            }}>
            <Ionicons name="lock-closed-outline" size={24} color={themeColors.textLow} />
            <Text className="font-jakarta-bold text-text-low text-[9px] text-center mt-3 uppercase tracking-widest">
              Locked
            </Text>
          </View>
        </View>

        <Text className="font-jakarta-bold text-text-high text-xl mb-5">Preferences</Text>
        <GradientCard padding="none" className="mb-8 overflow-hidden">
          <Row
            icon="moon-outline"
            label="Dark Mode"
            right={
              <Switch
                value={colorScheme === 'dark'}
                onValueChange={val => setColorScheme(val ? 'dark' : 'light')}
                trackColor={{ true: '#FF6B4A', false: '#1E212B' }}
                thumbColor="#fff"
              />
            }
          />
          <Row
            icon="finger-print-outline"
            label="Biometrics"
            right={
              <Switch
                value={true}
                trackColor={{ true: '#FF6B4A', false: '#1E212B' }}
                thumbColor="#fff"
              />
            }
          />
          <Row
            icon="cash-outline"
            label="Currency"
            right={
              <View className="flex-row items-center gap-1">
                <Text className="font-jakarta-bold text-text-low text-xs uppercase tracking-widest">
                  SGD
                </Text>
                <Ionicons name="chevron-forward" size={12} color={themeColors.textLow} />
              </View>
            }
            last
          />
        </GradientCard>

        <Text className="font-jakarta-bold text-text-high text-xl mb-1">Copilot Personas</Text>
        <Text className="font-jakarta text-text-low text-xs mb-5 leading-relaxed">
          Enable the voices that join your chat. Selected personas reply in the same thread —
          this isn't a switcher, it's a group conversation.
        </Text>
        <GradientCard padding="none" className="mb-8 overflow-hidden">
          {PERSONA_OPTIONS.map((opt, idx) => {
            const enabled = enabledPersonas.includes(opt.id);
            const onlyEnabled = enabled && enabledPersonas.length === 1;
            return (
              <View
                key={opt.id}
                className="flex-row items-start gap-4 p-5"
                style={
                  idx < PERSONA_OPTIONS.length - 1
                    ? { borderBottomWidth: 1, borderBottomColor: themeColors.hairline }
                    : undefined
                }>
                <View
                  className="w-10 h-10 rounded-full justify-center items-center mt-0.5"
                  style={{
                    backgroundColor: opt.tint,
                    boxShadow: enabled ? `0 0 16px ${opt.tint}55` : undefined,
                    opacity: enabled ? 1 : 0.5,
                  }}>
                  <Ionicons name={opt.icon} size={16} color="#fff" />
                </View>
                <View className="flex-1">
                  <Text className="font-jakarta-bold text-text-high text-sm">{opt.label}</Text>
                  <Text className="font-jakarta text-text-low text-xs mt-1 leading-relaxed">
                    {opt.description}
                  </Text>
                  {onlyEnabled && (
                    <Text className="font-jakarta-bold text-accent-amber text-[10px] uppercase tracking-widest mt-2">
                      Last persona — keep at least one
                    </Text>
                  )}
                </View>
                <Switch
                  value={enabled}
                  onValueChange={() => togglePersona(opt.id)}
                  disabled={onlyEnabled}
                  trackColor={{ true: opt.tint, false: themeColors.surface3 }}
                  thumbColor="#fff"
                />
              </View>
            );
          })}
        </GradientCard>

        <Text className="font-jakarta-bold text-text-high text-xl mb-5">Security Zone</Text>
        <Pressable>
          <GradientCard padding="lg" accent="rose" radius="card" className="mb-8">
            <View className="flex-row justify-between items-center">
              <View className="flex-1 pr-4">
                <Text className="font-jakarta-bold text-accent-rose text-base mb-1">
                  Purge Local Keychain
                </Text>
                <Text className="font-jakarta text-text-mid text-xs leading-relaxed">
                  Flush all cryptographic parameters and reset the local storage.
                </Text>
              </View>
              <Ionicons name="skull-outline" size={22} color="#FF5C7C" />
            </View>
          </GradientCard>
        </Pressable>
      </ScrollView>
    </Surface>
  );
}
