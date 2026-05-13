import React from 'react';
import { Pressable, PressableProps, Text, View, ActivityIndicator, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'lg' | 'md' | 'sm';

interface NeonButtonProps extends Omit<PressableProps, 'children'> {
  children: React.ReactNode;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  /** Optional Ionicons icon name rendered to the left of the label. */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Pass true to stretch to parent width. */
  block?: boolean;
}

const SIZE: Record<Size, { py: string; px: string; text: string; icon: number }> = {
  lg: { py: 'py-5', px: 'px-6', text: 'text-base', icon: 20 },
  md: { py: 'py-4', px: 'px-5', text: 'text-sm', icon: 18 },
  sm: { py: 'py-2.5', px: 'px-4', text: 'text-xs', icon: 14 },
};

const PRIMARY_GLOW: ViewStyle = {
  boxShadow: '0 0 24px rgba(255, 107, 74, 0.45)',
};

/**
 * Primary CTA for the dark design system. See docs/UI_DESIGN.md.
 *
 * - `primary` (default): coral fill, coral glow, scale-down press.
 * - `secondary`: transparent fill, hairline border, no glow.
 * - `ghost`: no border, just a press-state tint.
 */
export const NeonButton = ({
  children,
  variant = 'primary',
  size = 'md',
  loading,
  icon,
  block,
  disabled,
  style,
  ...rest
}: NeonButtonProps) => {
  const s = SIZE[size];
  const widthClass = block ? 'self-stretch' : 'self-start';
  const disabledClass = disabled || loading ? 'opacity-60' : '';

  const variantClass = (() => {
    switch (variant) {
      case 'primary':
        return 'bg-accent-coral';
      case 'secondary':
        return 'bg-transparent border border-hairline';
      case 'ghost':
        return 'bg-transparent';
    }
  })();

  const labelClass = variant === 'primary' ? 'text-white' : 'text-text-high';

  return (
    <Pressable
      disabled={disabled || loading}
      style={[variant === 'primary' && !disabled && !loading ? PRIMARY_GLOW : null, style]}
      className={`flex-row items-center justify-center gap-2 rounded-full active:scale-95 transition-all ${variantClass} ${s.py} ${s.px} ${widthClass} ${disabledClass}`}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#fff' : '#FF6B4A'} />
      ) : (
        <>
          {icon && (
            <Ionicons
              name={icon}
              size={s.icon}
              color={variant === 'primary' ? '#fff' : '#FF6B4A'}
            />
          )}
          {typeof children === 'string' ? (
            <Text className={`font-jakarta-bold tracking-wide ${s.text} ${labelClass}`}>
              {children}
            </Text>
          ) : (
            <View>{children}</View>
          )}
        </>
      )}
    </Pressable>
  );
};
