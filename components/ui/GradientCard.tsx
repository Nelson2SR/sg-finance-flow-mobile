import React from 'react';
import { View, ViewProps, StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColors } from '../../hooks/use-theme-colors';

type Accent = 'coral' | 'mint' | 'rose' | 'amber' | undefined;

interface GradientCardProps extends ViewProps {
  /**
   * Color of the top-edge hairline glow. Omit for a neutral white wash on
   * surface-2 (the default card look). Set to one of the accents for an
   * "elevated/active" feel on hero cards (vault selected, safe-to-spend).
   */
  accent?: Accent;
  /**
   * Card padding preset. `lg` = 24px (hero cards), `md` = 20px (rows).
   * Override by passing your own className padding if you need something else.
   */
  padding?: 'lg' | 'md' | 'sm' | 'none';
  /**
   * Border radius preset. Defaults to 'card' = 24px. Use 'row' for slim
   * 16px transaction rows.
   */
  radius?: 'card' | 'row' | 'chip';
  className?: string;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

const ACCENT_STOPS: Record<NonNullable<Accent>, [string, string]> = {
  coral: ['rgba(255, 107, 74, 0.22)', 'rgba(255, 107, 74, 0)'],
  mint: ['rgba(91, 224, 176, 0.22)', 'rgba(91, 224, 176, 0)'],
  rose: ['rgba(255, 92, 124, 0.22)', 'rgba(255, 92, 124, 0)'],
  amber: ['rgba(255, 181, 71, 0.22)', 'rgba(255, 181, 71, 0)'],
};

// Neutral stops are theme-aware — resolved inside the component via the
// hook so the white-wash isn't invisible on light backgrounds.
const TRANSPARENT = 'rgba(0,0,0,0)';

const PADDING_CLASS: Record<NonNullable<GradientCardProps['padding']>, string> = {
  lg: 'p-6',
  md: 'p-5',
  sm: 'p-4',
  none: '',
};

const RADIUS_STYLE: Record<NonNullable<GradientCardProps['radius']>, ViewStyle> = {
  card: { borderRadius: 24 },
  row: { borderRadius: 16 },
  chip: { borderRadius: 999 },
};

/**
 * Elevated dark card surface used everywhere a section needs to feel
 * "raised" above the surface-0 background.
 *
 * Layered structure (back to front):
 *   1. surface-2 base color
 *   2. LinearGradient overlay on the top 50% — accent-tinted when `accent`
 *      is set, otherwise a faint white wash
 *   3. 1px hairline border
 *   4. Card shadow for elevation
 *   5. Children
 */
export const GradientCard = ({
  accent,
  padding = 'md',
  radius = 'card',
  className = '',
  style,
  children,
  ...rest
}: GradientCardProps) => {
  const themeColors = useThemeColors();
  const stops: [string, string] = accent
    ? ACCENT_STOPS[accent]
    : [themeColors.cardGradientStop, TRANSPARENT];
  const radiusStyle = RADIUS_STYLE[radius];
  // Shadow color tracks the theme: dark theme uses the existing
  // near-black drop; light theme uses a softer slate so cards still feel
  // elevated without bruising the surrounding canvas.
  const shadow = themeColors.surface0 === '#05060A'
    ? '0 8px 24px rgba(0, 0, 0, 0.6)'
    : '0 8px 24px rgba(15, 23, 42, 0.08)';

  // Children are rendered directly inside the outer View (no wrapping
  // <View>) so a child's `flex-1` inherits the card's defined height. The
  // earlier wrapper collapsed to content height, which made `flex-1`
  // children resolve to zero — empty vault cards on the home screen.
  // The LinearGradient is positioned absolute and `pointerEvents=none`, so
  // it stays behind content and out of touch handling.
  return (
    <View
      className={`bg-surface-2 border border-hairline overflow-hidden ${PADDING_CLASS[padding]} ${className}`}
      style={[radiusStyle, { boxShadow: shadow }, style]}
      {...rest}>
      <LinearGradient
        colors={stops}
        locations={[0, 1]}
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '60%',
        }}
      />
      {children}
    </View>
  );
};
