import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { BlurIntensity } from '../../constants/theme';
import { LiquidGlassView, isLiquidGlassSupported } from '../../utils/liquidGlassSafe';

export type GlassTone = 'neutral' | 'purple' | 'muted' | 'yellow' | 'green' | 'red';

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
  yellow: {
    tint: 'rgba(250,204,21,0.32)',
    fallback: 'rgba(202,138,4,0.42)',
    sheen: 'rgba(255,248,200,0.3)',
    rim: 'rgba(253,224,71,0.35)',
    rimTop: 'rgba(254,240,138,0.75)',
  },
  green: {
    tint: 'rgba(34,197,94,0.32)',
    fallback: 'rgba(22,163,74,0.45)',
    sheen: 'rgba(220,252,231,0.28)',
    rim: 'rgba(134,239,172,0.35)',
    rimTop: 'rgba(187,247,208,0.75)',
  },
  red: {
    tint: 'rgba(239,68,68,0.32)',
    fallback: 'rgba(220,38,38,0.45)',
    sheen: 'rgba(254,226,226,0.26)',
    rim: 'rgba(252,165,165,0.35)',
    rimTop: 'rgba(254,202,202,0.75)',
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
