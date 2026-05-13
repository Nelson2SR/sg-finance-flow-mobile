import { useColorScheme } from 'nativewind';

/**
 * Returns the current theme's surface/text/hairline colors as static values
 * suitable for props that don't accept Tailwind classes — Ionicons `color`,
 * TextInput `placeholderTextColor`, BottomTabs `tabBarStyle`, SVG `stroke`,
 * etc.
 *
 * For everything else, prefer the Tailwind classes (`bg-surface-2`,
 * `text-text-high`, `border-hairline`) — those resolve via the CSS
 * variables in global.css and flip automatically with the theme.
 *
 * Pair with nativewind's setColorScheme() (called from the Dark Mode toggle
 * in Settings) to flip themes app-wide.
 */
export type ThemeColors = {
  surface0: string;
  surface1: string;
  surface2: string;
  surface3: string;
  textHigh: string;
  textMid: string;
  textLow: string;
  textDim: string;
  hairline: string;
  /** Per-theme gradient stop used on the top edge of GradientCard. */
  cardGradientStop: string;
};

const LIGHT: ThemeColors = {
  surface0: '#FAFBFC',
  surface1: '#F4F6F9',
  surface2: '#FFFFFF',
  surface3: '#EEF0F5',
  textHigh: 'rgba(15, 23, 42, 0.96)',
  textMid: 'rgba(15, 23, 42, 0.62)',
  textLow: 'rgba(15, 23, 42, 0.38)',
  textDim: 'rgba(15, 23, 42, 0.18)',
  hairline: 'rgba(15, 23, 42, 0.08)',
  cardGradientStop: 'rgba(15, 23, 42, 0.04)',
};

const DARK: ThemeColors = {
  surface0: '#05060A',
  surface1: '#0B0C12',
  surface2: '#15171F',
  surface3: '#1E212B',
  textHigh: 'rgba(245, 246, 248, 0.96)',
  textMid: 'rgba(158, 168, 184, 0.96)',
  textLow: 'rgba(97, 109, 125, 0.96)',
  textDim: 'rgba(56, 64, 78, 0.96)',
  hairline: 'rgba(255, 255, 255, 0.06)',
  cardGradientStop: 'rgba(255, 255, 255, 0.06)',
};

export function useThemeColors(): ThemeColors {
  const { colorScheme } = useColorScheme();
  return colorScheme === 'dark' ? DARK : LIGHT;
}
