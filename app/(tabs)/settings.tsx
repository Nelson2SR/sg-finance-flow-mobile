import React, { useState } from 'react';
import { View, Text, Switch, TouchableOpacity, ScrollView, TextInput, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { BlurView } from 'expo-blur';

export default function SettingsScreen() {
  const { colorScheme, setColorScheme } = useColorScheme();
  const [profile, setProfile] = useState({
     name: "Surong",
     gender: "Female",
     birthday: "1994-11-22"
  });
  
  return (
    <View className="flex-1 bg-white dark:bg-black">
      <SafeAreaView edges={['top']} className="z-20">
        <BlurView intensity={95} tint="light" className="px-6 pb-6 pt-2 border-b border-white/20">
          <View className="flex-row justify-between items-center">
             <View>
                <Text className="font-jakarta text-gray-400 font-jakarta-bold text-[10px] uppercase tracking-widest mb-1">Profile & Identity</Text>
                <Text className="font-jakarta text-gray-900 dark:text-white text-2xl font-jakarta-bold">Settings</Text>
             </View>
             <TouchableOpacity className="w-10 h-10 rounded-full bg-white dark:bg-gray-800 border border-white/20 justify-center items-center shadow-sm">
                <Ionicons name="log-out-outline" size={20} color="#E0533D" />
             </TouchableOpacity>
          </View>
        </BlurView>
      </SafeAreaView>

      <ScrollView 
        className="flex-1" 
        contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 120 : 100, paddingTop: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-6 mb-8">
            <View className="flex-row items-center gap-6 bg-white/90 dark:bg-gray-900/40 p-6 rounded-[24px] border border-white/20 shadow-xl">
               <View className="w-20 h-20 rounded-full bg-brand-500 justify-center items-center shadow-lg shadow-brand-500/40">
                  <Text className="font-jakarta text-white text-2xl font-jakarta-bold tracking-widest uppercase">{profile.name.substring(0, 2)}</Text>
               </View>
               <View className="flex-1">
                  <Text className="font-jakarta text-gray-900 dark:text-white text-2xl font-jakarta-bold mb-2">{profile.name}</Text>
                  <View className="bg-amber-100/50 dark:bg-amber-500/20 px-3 py-1.5 rounded-full flex-row items-center gap-2 self-start border border-amber-200/50">
                     <Ionicons name="flame" size={14} color="#ea580c" />
                     <Text className="font-jakarta text-amber-700 dark:text-amber-500 text-[10px] font-jakarta-bold uppercase tracking-widest">30 Day Streak</Text>
                  </View>
               </View>
            </View>

            <View className="mt-8 bg-white/90 dark:bg-gray-900/40 rounded-[20px] border border-white/20 overflow-hidden shadow-xl">
               <View className="flex-row justify-between items-center p-5 border-b border-gray-50 dark:border-white/5">
                  <Text className="font-jakarta text-gray-400 font-jakarta-bold text-[10px] uppercase tracking-widest">Display Name</Text>
                  <TextInput 
                     className="text-gray-900 dark:text-white font-jakarta-bold text-sm text-right" 
                     value={profile.name} onChangeText={t => setProfile({...profile, name: t})} 
                  />
               </View>
               <View className="flex-row justify-between items-center p-5 border-b border-gray-50 dark:border-white/5">
                  <Text className="font-jakarta text-gray-400 font-jakarta-bold text-[10px] uppercase tracking-widest">Gender</Text>
                  <Text className="font-jakarta text-gray-900 dark:text-white font-jakarta-bold text-sm">{profile.gender}</Text>
               </View>
               <View className="flex-row justify-between items-center p-5">
                  <Text className="font-jakarta text-gray-400 font-jakarta-bold text-[10px] uppercase tracking-widest">Birthday</Text>
                  <Text className="font-jakarta text-gray-900 dark:text-white font-jakarta-bold text-sm">{profile.birthday}</Text>
               </View>
            </View>
        </View>

        <View className="px-6 mb-10">
           <Text className="font-jakarta text-gray-900 dark:text-white text-xl font-jakarta-bold mb-6">Trophy Room</Text>
           <View className="flex-row gap-4">
              <View className="bg-white/90 dark:bg-gray-900/40 w-24 h-28 rounded-[20px] border border-white/20 items-center justify-center shadow-xl">
                 <Ionicons name="trophy" size={32} color="#f59e0b" />
                 <Text className="font-jakarta text-amber-700 dark:text-amber-500 font-jakarta-bold text-[9px] text-center mt-3 uppercase tracking-widest">Savings Elite</Text>
              </View>
              <View className="bg-white/50 dark:bg-white/5 w-24 h-28 rounded-[20px] border border-dashed border-gray-200 dark:border-gray-800 items-center justify-center opacity-60">
                 <Ionicons name="lock-closed-outline" size={28} color="#9ca3af" />
                 <Text className="font-jakarta text-gray-400 font-jakarta-bold text-[9px] text-center mt-3 uppercase tracking-widest">Locked</Text>
              </View>
           </View>
        </View>

        <View className="px-6 mb-10">
           <Text className="font-jakarta text-gray-900 dark:text-white text-xl font-jakarta-bold mb-6">Preferences</Text>
           <View className="bg-white/90 dark:bg-gray-900/40 rounded-[20px] border border-white/20 overflow-hidden shadow-xl">
               <View className="flex-row justify-between items-center p-5 border-b border-gray-50 dark:border-white/5">
                  <View className="flex-row items-center gap-4">
                     <Ionicons name="moon-outline" size={20} color="#E0533D" />
                     <Text className="font-jakarta text-gray-900 dark:text-white font-jakarta-bold text-sm">Dark Mode</Text>
                  </View>
                  <Switch 
                    value={colorScheme === 'dark'} 
                    onValueChange={(val) => setColorScheme(val ? 'dark' : 'light')} 
                    trackColor={{ true: '#E0533D', false: '#e5e7eb' }} 
                  />
               </View>
               <View className="flex-row justify-between items-center p-5 border-b border-gray-50 dark:border-white/5">
                  <View className="flex-row items-center gap-4">
                     <Ionicons name="finger-print-outline" size={20} color="#E0533D" />
                     <Text className="font-jakarta text-gray-900 dark:text-white font-jakarta-bold text-sm">Biometrics</Text>
                  </View>
                  <Switch value={true} trackColor={{ true: '#E0533D', false: '#e5e7eb' }} />
               </View>
               <View className="flex-row justify-between items-center p-5">
                  <View className="flex-row items-center gap-4">
                     <Ionicons name="cash-outline" size={20} color="#E0533D" />
                     <Text className="font-jakarta text-gray-900 dark:text-white font-jakarta-bold text-sm">Currency</Text>
                  </View>
                  <Text className="font-jakarta text-gray-400 font-jakarta-bold text-xs uppercase tracking-widest">SGD <Ionicons name="chevron-forward" size={12} /></Text>
               </View>
           </View>
        </View>

        <View className="px-6 mb-12">
           <Text className="font-jakarta text-gray-900 dark:text-white text-xl font-jakarta-bold mb-6">Security Zone</Text>
           <TouchableOpacity className="bg-rose-50/50 dark:bg-rose-950/20 p-6 rounded-[24px] border border-rose-100 dark:border-rose-900/50 flex-row justify-between items-center shadow-sm">
               <View className="flex-1 pr-4">
                  <Text className="font-jakarta text-rose-600 dark:text-rose-500 font-jakarta-bold text-base mb-1">Purge Local Keychain</Text>
                  <Text className="font-jakarta text-rose-500/80 dark:text-rose-500/60 font-medium text-xs leading-relaxed">Flush all cryptographic parameters and reset the local storage.</Text>
               </View>
               <Ionicons name="skull-outline" size={24} color="#e11d48" />
           </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
}
