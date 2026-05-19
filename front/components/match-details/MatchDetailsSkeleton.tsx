/**
 * MatchDetailsSkeleton — animated shimmer placeholders for match-details tabs.
 * Replaces ActivityIndicator for a polished loading experience.
 */

import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');
const CARD_W = width - 40;

// ── Shimmer bar ───────────────────────────────────────────────────────────────
const ShimmerBar = ({
  width: w = '100%',
  height = 16,
  borderRadius = 8,
  style,
  shimmerX,
}: {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
  shimmerX: Animated.AnimatedInterpolation<string | number>;
}) => (
  <View
    style={[
      { width: w as any, height, borderRadius, backgroundColor: '#1e1b4b', overflow: 'hidden' },
      style,
    ]}
  >
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        {
          transform: [{ translateX: shimmerX }],
          backgroundColor: 'transparent',
          borderRadius,
        },
      ]}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(168,85,247,0.12)',
        }}
      >
        <LinearGradient
          colors={['transparent', 'rgba(168,85,247,0.15)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
    </Animated.View>
  </View>
);

// ── Skeleton for Events tab ───────────────────────────────────────────────────
export const EventsSkeleton = ({ shimmerX }: { shimmerX: Animated.AnimatedInterpolation<string | number> }) => (
  <View style={s.container}>
    {[...Array(6)].map((_, i) => (
      <View key={i} style={s.eventRow}>
        <ShimmerBar width={40} height={40} borderRadius={20} shimmerX={shimmerX} />
        <View style={s.eventMid}>
          <ShimmerBar width="70%" height={14} shimmerX={shimmerX} style={{ marginBottom: 6 }} />
          <ShimmerBar width="40%" height={10} shimmerX={shimmerX} />
        </View>
        <ShimmerBar width={30} height={30} borderRadius={15} shimmerX={shimmerX} />
      </View>
    ))}
  </View>
);

// ── Skeleton for Lineups tab ──────────────────────────────────────────────────
export const LineupsSkeleton = ({ shimmerX }: { shimmerX: Animated.AnimatedInterpolation<string | number> }) => (
  <View style={s.container}>
    {/* Team header */}
    <View style={s.teamHeaderRow}>
      <ShimmerBar width={60} height={60} borderRadius={30} shimmerX={shimmerX} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <ShimmerBar width="60%" height={16} shimmerX={shimmerX} style={{ marginBottom: 8 }} />
        <ShimmerBar width="40%" height={12} shimmerX={shimmerX} />
      </View>
    </View>
    {/* Field placeholder */}
    <ShimmerBar width={CARD_W} height={CARD_W * 1.5} borderRadius={24} shimmerX={shimmerX} style={{ marginVertical: 12 }} />
    {/* Substitutes */}
    <ShimmerBar width="40%" height={14} shimmerX={shimmerX} style={{ marginBottom: 10 }} />
    <View style={s.subRow}>
      {[...Array(4)].map((_, i) => (
        <ShimmerBar key={i} width={80} height={36} borderRadius={12} shimmerX={shimmerX} />
      ))}
    </View>
  </View>
);

// ── Skeleton for Stats tab ────────────────────────────────────────────────────
export const StatsSkeleton = ({ shimmerX }: { shimmerX: Animated.AnimatedInterpolation<string | number> }) => (
  <View style={s.container}>
    <ShimmerBar width="50%" height={16} shimmerX={shimmerX} style={{ marginBottom: 16, alignSelf: 'center' }} />
    {[...Array(8)].map((_, i) => (
      <View key={i} style={s.statRow}>
        <ShimmerBar width={36} height={14} shimmerX={shimmerX} />
        <View style={s.statCenter}>
          <ShimmerBar width="80%" height={8} borderRadius={4} shimmerX={shimmerX} />
        </View>
        <ShimmerBar width={36} height={14} shimmerX={shimmerX} />
      </View>
    ))}
  </View>
);

// ── Skeleton for Form tab ─────────────────────────────────────────────────────
export const FormSkeleton = ({ shimmerX }: { shimmerX: Animated.AnimatedInterpolation<string | number> }) => (
  <View style={s.container}>
    {[...Array(5)].map((_, i) => (
      <View key={i} style={s.eventRow}>
        <ShimmerBar width={40} height={40} borderRadius={20} shimmerX={shimmerX} />
        <View style={s.eventMid}>
          <ShimmerBar width="60%" height={14} shimmerX={shimmerX} style={{ marginBottom: 6 }} />
          <ShimmerBar width="35%" height={10} shimmerX={shimmerX} />
        </View>
        <ShimmerBar width={50} height={28} borderRadius={8} shimmerX={shimmerX} />
      </View>
    ))}
  </View>
);

// ── Skeleton for Standings tab ────────────────────────────────────────────────
export const StandingsSkeleton = ({ shimmerX }: { shimmerX: Animated.AnimatedInterpolation<string | number> }) => (
  <View style={s.container}>
    <View style={s.standingsHeader}>
      {[30, 120, 30, 30, 30].map((w, i) => (
        <ShimmerBar key={i} width={w} height={12} shimmerX={shimmerX} />
      ))}
    </View>
    {[...Array(10)].map((_, i) => (
      <View key={i} style={s.standingsRow}>
        <ShimmerBar width={24} height={12} shimmerX={shimmerX} />
        <ShimmerBar width={20} height={20} borderRadius={10} shimmerX={shimmerX} />
        <ShimmerBar width={100} height={12} shimmerX={shimmerX} style={{ flex: 1 }} />
        <ShimmerBar width={24} height={12} shimmerX={shimmerX} />
        <ShimmerBar width={24} height={12} shimmerX={shimmerX} />
        <ShimmerBar width={24} height={12} shimmerX={shimmerX} />
      </View>
    ))}
  </View>
);

// ── Main hook: shared shimmer animation ──────────────────────────────────────
export const useShimmer = () => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const shimmerX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-(width + 100), width + 100],
  });

  return shimmerX;
};

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { paddingBottom: 20 },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    gap: 12,
  },
  eventMid: { flex: 1 },
  teamHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
  },
  subRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  statCenter: { flex: 1, alignItems: 'center' },
  standingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    marginBottom: 8,
    gap: 8,
  },
  standingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 8,
  },
});
