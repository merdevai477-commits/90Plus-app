import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useChatTheme } from '../../hooks/useChatTheme';

/** Chat-only ambient background — ink + violet glow (dark) or soft lavender wash (light). */
export function ChatScreenBackground() {
  const { colors } = useChatTheme();
  const gradientId = colors.statusBar === 'dark' ? 'chatBgGlowLight' : 'chatBgGlowDark';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={[...colors.bgGradient]}
        locations={[0, 0.55, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 100" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id={gradientId} cx="50%" cy="38%" r="58%">
            <Stop offset="0" stopColor={colors.glowStop} stopOpacity={String(colors.glowOpacity)} />
            <Stop offset="0.4" stopColor={colors.glowMid} stopOpacity={String(colors.glowOpacity * 0.5)} />
            <Stop offset="1" stopColor={colors.glowFade} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill={`url(#${gradientId})`} />
      </Svg>
    </View>
  );
}
