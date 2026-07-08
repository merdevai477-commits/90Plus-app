/**
 * Ultra-transparent liquid-glass pill capsule for the active tab.
 */

import React, { memo, useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import { isLiquidGlassSupported, LiquidGlassView } from '@/utils/liquidGlassSafe';

import {
  BUBBLE_BORDER_COLOR,
  BUBBLE_BORDER_WIDTH,
  BUBBLE_GLASS_TINT,
  TAB_BUBBLE_HEIGHT,
} from './liquidGlassTabBar.constants';
import type { LiquidGlassBlobProps } from './liquidGlassTabBar.types';
import type { ViewStyle } from 'react-native';

export const LiquidGlassBlob = memo(function LiquidGlassBlob({
  tint = BUBBLE_GLASS_TINT,
  glowColor = '#FFFFFF',
  elevated = false,
  animatedStyle,
  specularStyle,
  children,
}: LiquidGlassBlobProps) {
  const pillRadius = TAB_BUBBLE_HEIGHT / 2;

  const glowStyle = useMemo(
    () =>
      Platform.select({
        ios: {
          shadowColor: glowColor,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.55,
          shadowRadius: 10,
        },
        android: {
          elevation: elevated ? 10 : 6,
        },
        default: {},
      }),
    [elevated, glowColor],
  );

  return (
    <Animated.View
      style={[s.shell, elevated && s.elevated, glowStyle, animatedStyle]}
      pointerEvents="none"
    >
      <View
        style={[
          s.chromaRing,
          s.chromaCyan,
          { borderRadius: pillRadius + 3, borderColor: `${glowColor}44` },
        ]}
      />
      <View
        style={[
          s.chromaRing,
          s.chromaMagenta,
          { borderRadius: pillRadius + 3 },
        ]}
      />

      <View style={[s.bubbleClip, { borderRadius: pillRadius }]}>
        <View
          style={[s.borderGlow, { borderRadius: pillRadius, borderColor: `${glowColor}55` }]}
          pointerEvents="none"
        />
        {isLiquidGlassSupported ? (
          <LiquidGlassView
            effect="clear"
            interactive
            tintColor={tint}
            colorScheme="dark"
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <>
            <BlurView
              intensity={Platform.OS === 'android' ? 36 : 24}
              tint="light"
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={[
                'rgba(255,255,255,0.10)',
                'rgba(255,255,255,0.02)',
                'rgba(255,255,255,0)',
              ]}
              start={{ x: 0.15, y: 0 }}
              end={{ x: 0.85, y: 1 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
          </>
        )}
        {children ? <View style={s.content}>{children}</View> : null}
        <Animated.View
          style={[s.bubbleSpecular, { borderRadius: pillRadius }, specularStyle]}
          pointerEvents="none"
        />
        <View
          style={[
            s.bubbleRim,
            { borderRadius: pillRadius, borderColor: `${glowColor}33` },
          ]}
          pointerEvents="none"
        />
      </View>
    </Animated.View>
  );
});

const s = StyleSheet.create({
  shell: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 8,
    minHeight: TAB_BUBBLE_HEIGHT,
  },
  elevated: Platform.select({
    ios: {
      zIndex: 30,
    },
    android: { zIndex: 30 },
    default: { zIndex: 30 },
  }),
  chromaRing: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
  },
  chromaCyan: {
    transform: [{ translateX: -0.75 }, { translateY: 0.25 }],
  },
  chromaMagenta: {
    borderColor: 'rgba(255, 96, 180, 0.28)',
    transform: [{ translateX: 0.75 }, { translateY: -0.25 }],
  },
  bubbleClip: Platform.select({
    ios: {
      flex: 1,
      overflow: 'hidden',
      borderWidth: BUBBLE_BORDER_WIDTH,
      borderColor: BUBBLE_BORDER_COLOR,
      backgroundColor: 'transparent',
    },
    android: {
      flex: 1,
      overflow: 'hidden',
      borderWidth: BUBBLE_BORDER_WIDTH,
      borderColor: BUBBLE_BORDER_COLOR,
      backgroundColor: 'transparent',
    },
    default: {
      flex: 1,
      overflow: 'hidden',
      borderWidth: BUBBLE_BORDER_WIDTH,
      borderColor: BUBBLE_BORDER_COLOR,
      backgroundColor: 'transparent',
    },
  }),
  borderGlow: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    zIndex: 1,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    gap: 5,
    zIndex: 2,
  },
  bubbleSpecular: {
    position: 'absolute',
    top: 4,
    left: 10,
    right: 10,
    height: 10,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  bubbleRim: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
  },
}) as Record<string, ViewStyle>;
