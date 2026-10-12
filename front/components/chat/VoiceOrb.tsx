/**
 * Voice orb — the welcome bubble shrunk into the composer while recording.
 * It swells, wobbles and spins faster with the live mic level, and breathes
 * slowly while the recording is being transcribed.
 */

import React, { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import Animated, {
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const BUBBLE_IMAGE = require('../../assets/images/chat/iridescent-bubble.png');
const DEG = 180 / Math.PI;

export type VoiceOrbProps = {
  size: number;
  /** Latest mic level, 0…1. */
  level: number;
  mode: 'listening' | 'thinking';
  /** Centre caption, e.g. the recording timer. */
  label?: string;
};

export function VoiceOrb({ size, level, mode, label }: VoiceOrbProps) {
  const lvl = useSharedValue(0);
  const thinking = useSharedValue(mode === 'thinking' ? 1 : 0);
  const angle = useSharedValue(0);
  const phase = useSharedValue(0);

  useEffect(() => {
    lvl.value = withTiming(mode === 'thinking' ? 0 : level, { duration: 120 });
  }, [level, mode, lvl]);

  useEffect(() => {
    thinking.value = withTiming(mode === 'thinking' ? 1 : 0, { duration: 300 });
  }, [mode, thinking]);

  useFrameCallback((frame) => {
    const dt = Math.min(frame.timeSincePreviousFrame ?? 16, 64) / 1000;
    const spin = 0.7 + lvl.value * 5 - thinking.value * 0.3;
    angle.value += dt * spin * DEG;
    phase.value += dt * (2.2 + lvl.value * 7 - thinking.value * 1.2);
  });

  const blobX = useAnimatedStyle(() => {
    const swing = 0.03 + lvl.value * 0.12 + thinking.value * 0.02;
    return { transform: [{ scaleX: 1 + lvl.value * 0.22 + Math.sin(phase.value) * swing }] };
  });
  const blobY = useAnimatedStyle(() => {
    const swing = 0.03 + lvl.value * 0.12 + thinking.value * 0.02;
    return { transform: [{ scaleY: 1 + lvl.value * 0.22 + Math.cos(phase.value * 1.3) * swing }] };
  });
  const filmA = useAnimatedStyle(() => ({
    opacity: 0.25 + lvl.value * 0.6,
    transform: [{ rotate: `${angle.value}deg` }],
  }));
  const filmB = useAnimatedStyle(() => ({
    opacity: 0.45 - lvl.value * 0.25,
    transform: [{ rotate: `${-angle.value * 0.7 + 140}deg` }],
  }));
  const glow = useAnimatedStyle(() => ({
    opacity: 0.45 + lvl.value * 0.55 + Math.sin(phase.value * 0.5) * 0.08 * thinking.value,
    transform: [{ scale: 0.9 + lvl.value * 0.45 }],
  }));

  const glowSize = size * 2;
  const glowOffset = (glowSize - size) / 2;
  const imageStyle = { width: size, height: size };

  return (
    <View style={{ width: size, height: size }} accessibilityRole="image">
      <Animated.View
        pointerEvents="none"
        style={[
          styles.layer,
          { width: glowSize, height: glowSize, left: -glowOffset, top: -glowOffset },
          glow,
        ]}
      >
        <Svg width={glowSize} height={glowSize} viewBox="0 0 100 100">
          <Defs>
            <RadialGradient id="voiceOrbGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0.3" stopColor="#36A2FB" stopOpacity="0.4" />
              <Stop offset="0.55" stopColor="#6F24FB" stopOpacity="0.22" />
              <Stop offset="1" stopColor="#DD7EBB" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx="50" cy="50" r="50" fill="url(#voiceOrbGlow)" />
        </Svg>
      </Animated.View>

      <Animated.View style={[styles.layer, imageStyle, blobX]}>
        <Animated.View style={[imageStyle, blobY]}>
          <Image source={BUBBLE_IMAGE} style={[styles.layer, imageStyle]} />
          <Animated.Image source={BUBBLE_IMAGE} style={[styles.layer, imageStyle, filmA]} />
          <Animated.Image source={BUBBLE_IMAGE} style={[styles.layer, imageStyle, filmB]} />
        </Animated.View>
      </Animated.View>

      {label ? (
        <View pointerEvents="none" style={[styles.layer, imageStyle, styles.center]}>
          <Text style={[styles.label, { fontSize: Math.max(11, size * 0.17) }]}>{label}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
