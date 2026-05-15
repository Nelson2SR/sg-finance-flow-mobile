/**
 * Skeleton — animated placeholder rectangle for loading states.
 *
 * Per CLAUDE.md: "Never use blocking spinners. Always use Skeleton
 * Screens during fetching." This is the primitive every other
 * skeleton on the app composes — wallet-card skeleton, transaction-
 * row skeleton, etc.
 *
 * Animation: opacity pulses from 0.4 → 1.0 → 0.4 over ~1.4s using
 * the native driver so it stays buttery while the JS thread is
 * busy doing the actual fetch we're masking.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, View, ViewStyle } from 'react-native';

interface Props {
  width?: number | string;
  height?: number;
  radius?: number;
  /** Extra Tailwind / inline style overrides. */
  style?: ViewStyle;
  className?: string;
}

export function Skeleton({
  width = '100%',
  height = 16,
  radius = 8,
  style,
  className,
}: Props) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      className={className}
      style={[
        {
          width: width as any,
          height,
          borderRadius: radius,
          backgroundColor: 'rgba(255, 107, 74, 0.15)',
          opacity,
        },
        style,
      ]}
    />
  );
}

/**
 * SkeletonRow — convenience for the typical "two stacked lines"
 * placeholder used in transaction rows.
 */
export function SkeletonRow({ lines = 2, gap = 8 }: { lines?: number; gap?: number }) {
  return (
    <View style={{ gap }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={i === 0 ? 16 : 12}
          width={i === lines - 1 ? '60%' : '100%'}
        />
      ))}
    </View>
  );
}
