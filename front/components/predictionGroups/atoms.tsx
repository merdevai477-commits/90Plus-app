/**
 * Small shared presentational atoms for the prediction-groups feature:
 *   - GlassCard      → glassmorphism surface (expo-blur intensity 40 + border)
 *   - Crest          → neutral two-tone team crest placeholder
 *   - PressableScale → Reanimated press-in scale wrapper (UI-thread, no Moti)
 */

import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import type { Team } from './data';
import { PG, PG_RADII, usePGFonts } from './theme';

// ─── GlassCard ────────────────────────────────────────────────────────────────

export interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  radius?: number;
}

export function GlassCard({ children, style, intensity = 40, radius = PG_RADII.lg }: GlassCardProps) {
  return (
    <View style={[styles.glassWrap, { borderRadius: radius }, style]}>
      <BlurView intensity={intensity} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: PG.glass }]} />
      {children}
    </View>
  );
}

// ─── Crest ──────────────────────────────────────────────────────────────────

export interface CrestProps {
  team: Team;
  size?: number;
}

export function Crest({ team, size = 44 }: CrestProps) {
  const { bold } = usePGFonts();
  return (
    <View style={{ width: size, height: size }}>
      <LinearGradient
        colors={team.crest}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.crest, { width: size, height: size, borderRadius: size / 2 }]}
      >
        <Text
          style={{ color: '#fff', fontSize: size * 0.28, fontFamily: bold }}
          numberOfLines={1}
        >
          {team.short}
        </Text>
      </LinearGradient>
    </View>
  );
}

// ─── PressableScale ─────────────────────────────────────────────────────────

export interface PressableScaleProps extends PressableProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Scale value while pressed. Defaults to 0.92. */
  activeScale?: number;
}

export function PressableScale({
  children,
  style,
  activeScale = 0.92,
  onPressIn,
  onPressOut,
  ...rest
}: PressableScaleProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPressIn={(e) => {
        scale.value = withTiming(activeScale, { duration: 90 });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withTiming(1, { duration: 130 });
        onPressOut?.(e);
      }}
      {...rest}
    >
      <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
    </Pressable>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────

export interface StatCardProps {
  value: string;
  label: string;
  color: string;
  icon: React.ReactNode;
}

export function StatCard({ value, label, color, icon }: StatCardProps) {
  const { medium, extra } = usePGFonts();
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: `${color}22` }]}>{icon}</View>
      <Text style={[styles.statValue, { fontFamily: extra, color }]}>{value}</Text>
      <Text style={[styles.statLabel, { fontFamily: medium }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  glassWrap: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: PG.border,
  },
  crest: { alignItems: 'center', justifyContent: 'center' },

  statCard: {
    flex: 1,
    backgroundColor: PG.glass,
    borderRadius: PG_RADII.lg,
    borderWidth: 1,
    borderColor: PG.borderSoft,
    padding: 14,
    alignItems: 'center',
    gap: 6,
  },
  statIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: { fontSize: 22 },
  statLabel: { color: PG.textSecondary, fontSize: 12, textAlign: 'center' },
});
