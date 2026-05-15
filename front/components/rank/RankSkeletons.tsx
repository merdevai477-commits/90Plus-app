/**
 * RankSkeletons
 *
 * Shimmer placeholders for the Rank screen while the top-players
 * query is in flight. Mirrors the visual rhythm of `PodiumCard` and the
 * lower leaderboard rows so the layout doesn't jump on data arrival.
 */

import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type AnimatedStyle,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

const SHIMMER_RATIO = 0.4;

type ShimmerAnimatedStyle = AnimatedStyle<ViewStyle>;

function useShimmer(): {
  style: ShimmerAnimatedStyle;
  width: number;
} {
  const screenWidth = useWindowDimensions().width;
  const shimmerWidth = useMemo(() => screenWidth * SHIMMER_RATIO, [screenWidth]);
  const x = useSharedValue(-shimmerWidth);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;
    x.value = withRepeat(
      withTiming(screenWidth, { duration: 1200, easing: Easing.linear }),
      -1,
    );
  }, [screenWidth, shimmerWidth, reduceMotion, x]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
  }));

  return { style, width: shimmerWidth };
}

interface ShimmerLayerProps {
  width: number;
  style: ShimmerAnimatedStyle;
}

function ShimmerLayer({ width, style }: ShimmerLayerProps): React.ReactElement {
  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}
    >
      <Animated.View style={[{ position: 'absolute', top: 0, bottom: 0, width }, style]}>
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.09)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </Animated.View>
  );
}

export function PodiumSkeleton(): React.ReactElement {
  const shimmer = useShimmer();
  const heights = [160, 200, 160] as const;

  return (
    <View style={s.podiumRow}>
      {heights.map((h, i) => (
        <View key={i} style={[s.podiumBlock, { height: h }]}>
          <ShimmerLayer width={shimmer.width} style={shimmer.style} />
        </View>
      ))}
    </View>
  );
}

export function BoardRowSkeleton(): React.ReactElement {
  const shimmer = useShimmer();
  return (
    <View style={s.boardRow}>
      <View style={s.rankBadge} />
      <View style={s.avatar} />
      <View style={s.boardText}>
        <View style={[s.line, { width: '60%' }]} />
        <View style={[s.line, { width: '40%', marginTop: 6, height: 8 }]} />
      </View>
      <View style={s.xp} />
      <ShimmerLayer width={shimmer.width} style={shimmer.style} />
    </View>
  );
}

const s = StyleSheet.create({
  podiumRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    marginTop: 10,
    marginBottom: 20,
  },
  podiumBlock: {
    flex: 1,
    maxWidth: 120,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  boardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 12,
    marginBottom: 8,
    overflow: 'hidden',
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  boardText: { flex: 1, justifyContent: 'center' },
  line: {
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  xp: {
    width: 50,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
});
