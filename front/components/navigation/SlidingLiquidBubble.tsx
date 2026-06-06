/**
 * Sliding liquid-glass droplet for the bottom tab bar.
 * iOS 26+ → native UIGlassEffect via @callstack/liquid-glass.
 * Android / older iOS → BlurView + chromatic ring simulation.
 */

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { isLiquidGlassSupported, LiquidGlassView } from '@/utils/liquidGlassSafe';

const BUBBLE_SIZE = 54;

interface SlidingLiquidBubbleProps {
  activeIndex: number;
  tabCount: number;
  navWidth: number;
  navHeight: number;
  paddingHorizontal?: number;
}

function bubbleLeftForIndex(
  index: number,
  tabCount: number,
  navWidth: number,
  paddingHorizontal: number,
): number {
  const tabWidth = (navWidth - paddingHorizontal * 2) / tabCount;
  return paddingHorizontal + index * tabWidth + (tabWidth - BUBBLE_SIZE) / 2;
}

export function SlidingLiquidBubble({
  activeIndex,
  tabCount,
  navWidth,
  navHeight,
  paddingHorizontal = 8,
}: SlidingLiquidBubbleProps) {
  const initialX = bubbleLeftForIndex(0, tabCount, navWidth, paddingHorizontal);
  const translateX = useRef(new Animated.Value(initialX)).current;

  useEffect(() => {
    const target = bubbleLeftForIndex(activeIndex, tabCount, navWidth, paddingHorizontal);
    Animated.spring(translateX, {
      toValue: target,
      useNativeDriver: true,
      friction: 8,
      tension: 140,
    }).start();
  }, [activeIndex, tabCount, navWidth, paddingHorizontal, translateX]);

  const top = (navHeight - BUBBLE_SIZE) / 2;
  const shellStyle: ViewStyle = {
    position: 'absolute',
    top,
    left: 0,
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    zIndex: 5,
    transform: [{ translateX }],
  };

  return (
    <Animated.View style={shellStyle} pointerEvents="none">
      {/* Chromatic aberration halo — mimics the WhatsApp liquid lens on all platforms */}
      <View style={[s.chromaRing, s.chromaCyan]} />
      <View style={[s.chromaRing, s.chromaMagenta]} />
      <View style={[s.chromaRing, s.chromaGold]} />

      <View style={s.bubbleClip}>
        {isLiquidGlassSupported ? (
          <LiquidGlassView
            effect="clear"
            interactive
            tintColor="rgba(255,255,255,0.14)"
            colorScheme="dark"
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <>
            <BlurView
              intensity={Platform.OS === 'android' ? 72 : 48}
              tint="light"
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)']}
              start={{ x: 0.2, y: 0 }}
              end={{ x: 0.8, y: 1 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
          </>
        )}
        <View style={s.bubbleSpecular} pointerEvents="none" />
        <View style={s.bubbleRim} pointerEvents="none" />
      </View>
    </Animated.View>
  );
}

export { BUBBLE_SIZE };

const s = StyleSheet.create({
  chromaRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BUBBLE_SIZE / 2 + 4,
    borderWidth: 1.5,
  },
  chromaCyan: {
    borderColor: 'rgba(96, 220, 255, 0.42)',
    transform: [{ translateX: -1.5 }, { translateY: 0.5 }],
  },
  chromaMagenta: {
    borderColor: 'rgba(255, 96, 180, 0.38)',
    transform: [{ translateX: 1.5 }, { translateY: -0.5 }],
  },
  chromaGold: {
    borderColor: 'rgba(255, 220, 120, 0.32)',
    transform: [{ translateX: 0 }, { translateY: 1 }],
  },
  bubbleClip: {
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    borderRadius: BUBBLE_SIZE / 2,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.35)',
    ...Platform.select({
      ios: {
        shadowColor: '#FFFFFF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
      },
      android: { elevation: 6 },
    }),
  },
  bubbleSpecular: {
    position: 'absolute',
    top: 3,
    left: 8,
    right: 8,
    height: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  bubbleRim: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BUBBLE_SIZE / 2,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.18)',
  },
});
