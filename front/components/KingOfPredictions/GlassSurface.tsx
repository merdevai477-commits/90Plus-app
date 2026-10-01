import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { BlurIntensity } from '../../constants/theme';
import { LiquidGlassView, isLiquidGlassSupported } from '../../utils/liquidGlassSafe';

export type GlassTone = 'neutral' | 'purple' | 'muted';

const TONES: Record<GlassTone, { tint: string; fallback: string; sheen: string; rim: string; rimTop: string }> = {
  neutral: {
    tint: 'rgba(48,48,48,0.2)',
    fallback: 'rgba(48,48,48,0.38)',
    sheen: 'rgba(255,255,255,0.18)',
    rim: 'rgba(255,255,255,0.1)',
    rimTop: 'rgba(255,255,255,0.28)',
  },
  purple: {
    tint: 'rgba(139,92,246,0.45)',
    fallback: 'rgba(124,77,232,0.62)',
    sheen: 'rgba(255,255,255,0.3)',
    rim: 'rgba(196,170,255,0.3)',
    rimTop: 'rgba(235,225,255,0.6)',
  },
  muted: {
    tint: 'rgba(23,19,33,0.55)',
    fallback: 'rgba(23,19,33,0.85)',
    sheen: 'rgba(255,255,255,0.06)',
    rim: 'rgba(255,255,255,0.04)',
    rimTop: 'rgba(255,255,255,0.1)',
  },
};

/**
 * Liquid-glass pill/card: native glass on iOS 26+, and a translucent fill with a
 * top sheen and light rim everywhere else (Android has no live backdrop blur here).
 */
export function GlassSurface({
  style,
  radius,
  tone = 'neutral',
  accessibilityLabel,
  children,
}: {
  style?: StyleProp<ViewStyle>;
  radius: number;
  tone?: GlassTone;
  accessibilityLabel?: string;
  children?: React.ReactNode;
}) {
  const palette = TONES[tone];

  if (isLiquidGlassSupported) {
    return (
      <LiquidGlassView
        {...({
          style: [{ borderRadius: radius, overflow: 'hidden' }, style],
          effect: 'regular',
          tint: palette.tint,
          colorScheme: 'dark',
          accessibilityLabel,
        } as object)}
      >
        {children}
      </LiquidGlassView>
    );
  }

  return (
    <View
      style={[
        { borderRadius: radius, overflow: 'hidden', backgroundColor: Platform.OS === 'ios' ? palette.tint : palette.fallback },
        style,
      ]}
      accessibilityLabel={accessibilityLabel}
    >
      {Platform.OS === 'ios' ? (
        <BlurView intensity={BlurIntensity.header} tint="dark" style={StyleSheet.absoluteFill} />
      ) : null}
      <LinearGradient
        pointerEvents="none"
        colors={[palette.sheen, 'rgba(255,255,255,0.03)', 'rgba(255,255,255,0.01)', 'rgba(255,255,255,0.07)']}
        locations={[0, 0.45, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: radius,
            borderWidth: 1,
            borderColor: palette.rim,
            borderTopColor: palette.rimTop,
          },
        ]}
      />
      {children}
    </View>
  );
}
