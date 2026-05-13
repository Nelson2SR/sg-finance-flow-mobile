import React from 'react';
import { View, Text } from 'react-native';

interface ScreenHeaderProps {
  /** Uppercase caption shown above the title (e.g. "Insights Hub"). */
  eyebrow?: string;
  /** Main screen title. */
  title: string;
  /** Optional right-aligned slot for a primary action button. */
  action?: React.ReactNode;
}

/**
 * Standardized screen header used at the top of every tab screen.
 *
 * - `eyebrow` renders as a tiny uppercase caption (10/700, +0.18em tracking).
 * - `title` is the screen title (22/700).
 * - `action` accepts a single right-aligned node (typically a NeonButton).
 *
 * Lives directly inside <Surface>'s SafeArea header zone. The header itself
 * carries no background — the screen's ambient coral halo from <Surface>
 * shows through.
 */
export const ScreenHeader = ({ eyebrow, title, action }: ScreenHeaderProps) => (
  <View className="flex-row justify-between items-end px-6 pt-3 pb-6">
    <View>
      {eyebrow && (
        <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest mb-1.5">
          {eyebrow}
        </Text>
      )}
      <Text className="font-jakarta-bold text-text-high text-2xl">{title}</Text>
    </View>
    {action && <View>{action}</View>}
  </View>
);
