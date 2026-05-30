import React from 'react';
import { View, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { LiquidGlassView, isLiquidGlassSupported } from '@/utils/liquidGlassSafe';
import { BlurIntensity } from '../../constants/theme';

export type ChatGlassSurfaceProps = {
  style?: object;
  children?: React.ReactNode;
  tint?: string;
  effect?: 'regular' | 'clear';
  interactive?: boolean;
};

export function ChatGlassSurface({
  style,
  children,
  tint = 'rgba(14,10,22,0.72)',
  effect = 'regular',
  interactive = false,
}: ChatGlassSurfaceProps) {
  if (isLiquidGlassSupported) {
    return (
      <LiquidGlassView
        {...({
          style: [{ overflow: 'hidden' }, style],
          tint,
          effect,
          interactive,
        } as object)}
      >
        {children}
      </LiquidGlassView>
    );
  }
  return (
    <View style={[{ overflow: 'hidden' }, style]}>
      <BlurView intensity={BlurIntensity.header} tint="dark" style={StyleSheet.absoluteFill} />
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: tint }]}
      />
      {children}
    </View>
  );
}
