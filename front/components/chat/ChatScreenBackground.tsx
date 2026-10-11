import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

/** Chat-only ambient background — the 90 PLUS logo palette: ink-black base with a violet glow. */
export function ChatScreenBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={['#0D0A1A', '#08070F', '#060509']}
        locations={[0, 0.55, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 100" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id="chatBgGlow" cx="50%" cy="38%" r="58%">
            <Stop offset="0" stopColor="#6F24FB" stopOpacity="0.34" />
            <Stop offset="0.4" stopColor="#4A16B0" stopOpacity="0.16" />
            <Stop offset="1" stopColor="#1B0C33" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill="url(#chatBgGlow)" />
      </Svg>
    </View>
  );
}
