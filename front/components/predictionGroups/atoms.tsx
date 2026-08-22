/**
 * Shared presentational atoms for prediction-groups (Figma Prediction feature).
 */

import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  ActivityIndicator,
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
import { PG, PG_GRADIENTS, PG_GLOW_PURPLE, PG_RADII, usePGFonts } from './theme';

// ─── GlassCard (Figma solid dark card) ────────────────────────────────────────

export interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  radius?: number;
}

export function GlassCard({ children, style, radius = PG_RADII.xl }: GlassCardProps) {
  return (
    <View style={[styles.glassWrap, { borderRadius: radius }, style]}>
      {children}
    </View>
  );
}

export function FigmaPrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  fontFamily,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  fontFamily?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        pressed && { opacity: 0.92 },
        (disabled || loading) && { opacity: 0.7 },
      ]}
      accessibilityRole="button"
    >
      <LinearGradient
        colors={[...PG_GRADIENTS.purple]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.primaryBtn}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={[styles.primaryTxt, { fontFamily }]}>{label}</Text>
        )}
      </LinearGradient>
    </Pressable>
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

// ─── SimpleStatCard ─────────────────────────────────────────────────────────

export interface SimpleStatCardProps {
  value: string;
  label: string;
  color: string;
  icon: React.ReactNode;
}

export function SimpleStatCard({ value, label, color, icon }: SimpleStatCardProps) {
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
    backgroundColor: PG.card,
    borderWidth: 1,
    borderColor: PG.border,
  },
  primaryBtn: {
    borderRadius: PG_RADII.lg,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    ...PG_GLOW_PURPLE,
  },
  primaryTxt: { color: '#fff', fontSize: 16 },
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
