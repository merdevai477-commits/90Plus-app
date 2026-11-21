/**
 * Frosted CTA shell — LiquidGlass on supported iOS, BlurView elsewhere,
 * plus a colour tint and a top specular. Shared by the add-prize pill and
 * the prize-card prediction button.
 */

import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { isLiquidGlassSupported, LiquidGlassView } from '../../utils/liquidGlassSafe';

const GlassSurface = isLiquidGlassSupported ? LiquidGlassView : BlurView;

const glassPropsFor = (colorScheme: 'light' | 'dark') =>
  isLiquidGlassSupported
    ? { effect: 'clear' as const, interactive: true, colorScheme }
    : {
        intensity: Platform.OS === 'android' ? 36 : 28,
        tint: colorScheme,
      };

export function GlassCtaShell({
  tint,
  width,
  height,
  radius,
  children,
  colorScheme = 'dark',
}: {
  tint: readonly [string, string];
  width?: number;
  height?: number;
  radius: number;
  children: React.ReactNode;
  colorScheme?: 'light' | 'dark';
}) {
  const borderColor =
    colorScheme === 'light' ? 'rgba(106,43,217,0.18)' : 'rgba(255,255,255,0.38)';
  return (
    <View
      style={{
        width,
        height,
        flex: width == null ? 1 : undefined,
        borderRadius: radius,
        overflow: 'hidden',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor,
      }}
    >
      <GlassSurface {...(glassPropsFor(colorScheme) as object)} style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={[...tint]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(255,255,255,0.42)', 'rgba(255,255,255,0.08)', 'transparent']}
        locations={[0, 0.38, 1]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}
