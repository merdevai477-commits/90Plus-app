/**
 * LiquidGlassWidget — premium liquid-glass surface for stat tiles & widgets.
 * Mirrors the app's nav-bar glass language: chroma rim, specular, accent glow.
 */

import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo } from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { isLiquidGlassSupported, LiquidGlassView } from '../../utils/liquidGlassSafe';
import { PG, PG_RADII } from './theme';

function accentGlassTint(accent: string, alpha = 0.14): string {
  const hex = accent.replace('#', '');
  if (hex.length !== 6) return `rgba(255,255,255,${alpha})`;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return `rgba(255,255,255,${alpha})`;
  }
  return `rgba(${r},${g},${b},${alpha})`;
}

const BAR_GLASS_FALLBACK = {
  intensity: Platform.OS === 'android' ? 36 : 28,
  tint: 'dark' as const,
};

export interface LiquidGlassWidgetProps {
  children: React.ReactNode;
  accentColor?: string;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  /** Subtle idle breathing animation — default on. */
  alive?: boolean;
}

export function LiquidGlassWidget({
  children,
  accentColor = PG.purpleSoft,
  radius = PG_RADII.lg,
  style,
  alive = true,
}: LiquidGlassWidgetProps) {
  const tint = useMemo(() => accentGlassTint(accentColor, 0.1), [accentColor]);
  const breathe = useSharedValue(1);
  const glow = useSharedValue(0.35);

  useEffect(() => {
    if (!alive) return;
    breathe.value = withRepeat(
      withSequence(
        withTiming(1.018, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    glow.value = withRepeat(
      withSequence(
        withTiming(0.65, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.35, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [alive, breathe, glow]);

  const shellStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breathe.value }],
    shadowOpacity: glow.value,
  }));

  const glowStyle = useMemo<ViewStyle>(
    () =>
      Platform.select<ViewStyle>({
        ios: {
          shadowColor: accentColor,
          shadowOffset: { width: 0, height: 0 },
          shadowRadius: 14,
          shadowOpacity: 0.4,
        },
        android: { elevation: 6 },
        default: {},
      }) ?? {},
    [accentColor],
  );

  return (
    <View style={[styles.outer, glowStyle, style]}>
      <Animated.View style={[styles.flex, shellStyle]}>
        <View
          style={[
            styles.chromaRing,
            styles.chromaCyan,
            { borderRadius: radius + 3, borderColor: `${accentColor}33` },
          ]}
        />
        <View style={[styles.chromaRing, styles.chromaMagenta, { borderRadius: radius + 3 }]} />

        <View style={[styles.clip, { borderRadius: radius, borderColor: `${accentColor}44` }]}>
          <View style={[StyleSheet.absoluteFillObject, { borderRadius: radius, overflow: 'hidden' }]}>
          {isLiquidGlassSupported ? (
            <LiquidGlassView
              effect="clear"
              interactive={false}
              tintColor={tint}
              colorScheme="dark"
              style={StyleSheet.absoluteFillObject}
            />
          ) : (
            <>
              <BlurView {...BAR_GLASS_FALLBACK} style={StyleSheet.absoluteFillObject} />
              <LinearGradient
                colors={[
                  'rgba(255,255,255,0.11)',
                  'rgba(255,255,255,0.03)',
                  'rgba(255,255,255,0)',
                ]}
                start={{ x: 0.12, y: 0 }}
                end={{ x: 0.88, y: 1 }}
                style={StyleSheet.absoluteFillObject}
                pointerEvents="none"
              />
              <View style={[StyleSheet.absoluteFillObject, { backgroundColor: PG.glass }]} />
            </>
          )}
        </View>

        <View style={[styles.accentWash, { backgroundColor: accentGlassTint(accentColor, 0.06) }]} />
        <View
          style={[
            styles.specular,
            { borderTopLeftRadius: radius, borderTopRightRadius: radius },
          ]}
        />
        <View style={[styles.innerRim, { borderRadius: radius, borderColor: `${accentColor}28` }]} />

        <View style={styles.content}>{children}</View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    overflow: 'visible',
  },
  flex: {
    flex: 1,
  },
  chromaRing: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 1,
  },
  chromaCyan: {
    transform: [{ translateX: -0.6 }, { translateY: 0.3 }],
  },
  chromaMagenta: {
    borderColor: 'rgba(255, 96, 180, 0.22)',
    transform: [{ translateX: 0.6 }, { translateY: -0.3 }],
  },
  clip: {
    flex: 1,
    overflow: 'hidden',
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  accentWash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
  specular: {
    position: 'absolute',
    top: 0,
    left: 12,
    right: 12,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.22)',
    pointerEvents: 'none',
  },
  innerRim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 0.5,
    pointerEvents: 'none',
  },
  content: {
    flex: 1,
    zIndex: 2,
  },
}) as Record<string, ViewStyle>;
