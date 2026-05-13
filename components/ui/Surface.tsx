import React from 'react';
import { View, ViewProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, SafeAreaViewProps } from 'react-native-safe-area-context';

interface SurfaceProps extends ViewProps {
  /**
   * When true, renders a soft coral halo behind the top edge of the screen.
   * The signature "ambient glow" from the design system. Default true.
   */
  halo?: boolean;
}

/**
 * Root background wrapper for every screen. Reads from surface-0 and lays
 * down a faint coral radial behind the header so each screen has the same
 * top-edge ambient glow. See docs/UI_DESIGN.md.
 */
export const Surface = ({ halo = true, style, children, ...rest }: SurfaceProps) => (
  <View className="flex-1 bg-surface-0" style={style} {...rest}>
    {halo && (
      <LinearGradient
        // Faint coral-to-transparent fade across the top 40% of the screen.
        // RGB matches accent-coral with descending alpha.
        colors={['rgba(255, 107, 74, 0.18)', 'rgba(255, 107, 74, 0.06)', 'rgba(5, 6, 10, 0)']}
        locations={[0, 0.5, 1]}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 320,
          pointerEvents: 'none',
        }}
      />
    )}
    {children}
  </View>
);

interface SurfaceSafeAreaProps extends SafeAreaViewProps {
  children: React.ReactNode;
}

/**
 * SafeArea wrapper to use inside <Surface> for header rows. Pre-configured
 * to only inset on top (so cards below can bleed under the bottom tab bar).
 */
export const SurfaceHeaderArea = ({ children, ...rest }: SurfaceSafeAreaProps) => (
  <SafeAreaView edges={['top']} {...rest}>
    {children}
  </SafeAreaView>
);
