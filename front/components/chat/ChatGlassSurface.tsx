import React from 'react';
import { View, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { LiquidGlassView, isLiquidGlassSupported } from '@/utils/liquidGlassSafe';
import { BlurIntensity } from '../../constants/theme';
import { useChatTheme } from '../../hooks/useChatTheme';

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
  tint,
  effect = 'regular',
  interactive = false,
}: ChatGlassSurfaceProps) {
  const { colors, blurTint } = useChatTheme();
  const resolvedTint = tint ?? colors.glassTint;

  if (isLiquidGlassSupported) {
    return (
      <LiquidGlassView
        {...({
          style: [{ overflow: 'hidden' }, style],
          tint: resolvedTint,
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
      <BlurView intensity={BlurIntensity.header} tint={blurTint} style={StyleSheet.absoluteFill} />
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: resolvedTint }]}
      />
      {children}
    </View>
  );
}
