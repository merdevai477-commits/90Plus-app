import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

export type GlassTone = 'neutral' | 'purple' | 'muted' | 'yellow' | 'green' | 'red';

const TONES: Record<GlassTone, { fallback: string; sheen: string; rim: string; rimTop: string }> = {
  neutral: {
    fallback: 'rgba(48,48,48,0.38)',
    sheen: 'rgba(255,255,255,0.18)',
    rim: 'rgba(255,255,255,0.1)',
    rimTop: 'rgba(255,255,255,0.28)',
  },
  purple: {
    fallback: 'rgba(124,77,232,0.62)',
    sheen: 'rgba(255,255,255,0.3)',
    rim: 'rgba(196,170,255,0.3)',
    rimTop: 'rgba(235,225,255,0.6)',
  },
  muted: {
    fallback: 'rgba(23,19,33,0.85)',
    sheen: 'rgba(255,255,255,0.06)',
    rim: 'rgba(255,255,255,0.04)',
    rimTop: 'rgba(255,255,255,0.1)',
  },
  yellow: {
    fallback: 'rgba(202,138,4,0.42)',
    sheen: 'rgba(255,248,200,0.3)',
    rim: 'rgba(253,224,71,0.35)',
    rimTop: 'rgba(254,240,138,0.75)',
  },
  green: {
    fallback: 'rgba(22,163,74,0.45)',
    sheen: 'rgba(220,252,231,0.28)',
    rim: 'rgba(134,239,172,0.35)',
    rimTop: 'rgba(187,247,208,0.75)',
  },
  red: {
    fallback: 'rgba(220,38,38,0.45)',
    sheen: 'rgba(254,226,226,0.26)',
    rim: 'rgba(252,165,165,0.35)',
    rimTop: 'rgba(254,202,202,0.75)',
  },
};

/**
 * Glass-look pill/card: translucent fill with a top sheen and light rim.
 * Drawn the same on every platform — iOS 26 native glass and the iOS blur both
 * washed out the text and clipped content compared with the approved Android look.
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

  return (
    <View
      style={[{ borderRadius: radius, overflow: 'hidden', backgroundColor: palette.fallback }, style]}
      accessibilityLabel={accessibilityLabel}
    >
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
