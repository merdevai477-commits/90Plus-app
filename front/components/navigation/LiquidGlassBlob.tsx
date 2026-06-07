/**
 * Reusable liquid-glass droplet for the tab bar.
 * Supports variable width (pill) via parent animatedStyle.
 */

import React, { memo } from 'react';
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
  elevated = false,
  animatedStyle,
  children,
}: LiquidGlassBlobProps) {
  return (
    <Animated.View
      style={[s.shell, elevated && s.elevated, animatedStyle]}
      pointerEvents="none"
    >
      <View style={s.chromaWrap}>
        <View style={[s.chromaRing, s.chromaCyan]} />
        <View style={[s.chromaRing, s.chromaMagenta]} />
        <View style={[s.chromaRing, s.chromaGold]} />
      </View>

      <View style={s.bubbleClip}>
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
              intensity={Platform.OS === 'android' ? 72 : 48}
              tint="light"
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={[
                'rgba(255,255,255,0.18)',
                'rgba(255,255,255,0.06)',
                'rgba(255,255,255,0.02)',
              ]}
              start={{ x: 0.2, y: 0 }}
              end={{ x: 0.8, y: 1 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <View style={s.fallbackDistort} pointerEvents="none" />
          </>
        )}
        <View style={s.glassFill} pointerEvents="none" />
        <View style={s.bubbleSpecular} pointerEvents="none" />
        <View style={s.bubbleRim} pointerEvents="none" />
        <View style={s.refractionHighlight} pointerEvents="none" />
        {children ? <View style={s.contentRow}>{children}</View> : null}
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
      shadowColor: '#FFFFFF',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.35,
      shadowRadius: 16,
    },
    android: { zIndex: 30, elevation: 12 },
    default: { zIndex: 30 },
  }),
  chromaWrap: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: TAB_BUBBLE_HEIGHT / 2,
  },
  chromaRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: TAB_BUBBLE_HEIGHT / 2 + 4,
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
  bubbleClip: Platform.select({
    ios: {
      flex: 1,
      overflow: 'hidden',
      borderWidth: BUBBLE_BORDER_WIDTH,
      borderColor: BUBBLE_BORDER_COLOR,
      shadowColor: '#FFFFFF',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.2,
      shadowRadius: 10,
    },
    android: {
      flex: 1,
      overflow: 'hidden',
      borderWidth: BUBBLE_BORDER_WIDTH,
      borderColor: BUBBLE_BORDER_COLOR,
      elevation: 6,
    },
    default: {
      flex: 1,
      overflow: 'hidden',
      borderWidth: BUBBLE_BORDER_WIDTH,
      borderColor: BUBBLE_BORDER_COLOR,
    },
  }),
  glassFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BUBBLE_GLASS_TINT,
  },
  fallbackDistort: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.04)',
    transform: [{ scaleX: 1.04 }, { scaleY: 0.96 }],
  },
  bubbleSpecular: {
    position: 'absolute',
    top: 4,
    left: 10,
    right: 10,
    height: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.20)',
  },
  refractionHighlight: {
    position: 'absolute',
    bottom: 7,
    right: 12,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  bubbleRim: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: TAB_BUBBLE_HEIGHT / 2,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  contentRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    zIndex: 2,
  },
}) as Record<string, ViewStyle>;
