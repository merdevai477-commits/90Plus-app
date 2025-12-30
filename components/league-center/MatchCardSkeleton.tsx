/**
 * Skeleton loading placeholder for GradientMatchCard
 * Maintains layout stability during loading
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface MatchCardSkeletonProps {
  gradientIndex?: number;
}

const SKELETON_GRADIENTS: [string, string][] = [
  ['#1a1a3e', '#0d4f4f'],
  ['#2d1b4e', '#1a4a3a'],
  ['#1a2a4a', '#2a4a3a'],
];

const MatchCardSkeleton: React.FC<MatchCardSkeletonProps> = ({ gradientIndex = 0 }) => {
  const pulseAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.6,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulseAnim]);

  const gradientColors = SKELETON_GRADIENTS[gradientIndex % SKELETON_GRADIENTS.length];

  return (
    <LinearGradient
      colors={gradientColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <View style={styles.matchContent}>
        {/* Home Team Skeleton */}
        <View style={styles.team}>
          <Animated.View style={[styles.teamLogo, { opacity: pulseAnim }]} />
          <Animated.View style={[styles.teamName, { opacity: pulseAnim }]} />
        </View>

        {/* Center Skeleton */}
        <View style={styles.centerArea}>
          <Animated.View style={[styles.liveBadge, { opacity: pulseAnim }]} />
          <Animated.View style={[styles.score, { opacity: pulseAnim }]} />
          <Animated.View style={[styles.minute, { opacity: pulseAnim }]} />
        </View>

        {/* Away Team Skeleton */}
        <View style={styles.team}>
          <Animated.View style={[styles.teamLogo, { opacity: pulseAnim }]} />
          <Animated.View style={[styles.teamName, { opacity: pulseAnim }]} />
        </View>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },
  matchContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  team: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  teamLogo: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  teamName: {
    width: 60,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  centerArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  liveBadge: {
    width: 50,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  score: {
    width: 60,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  minute: {
    width: 40,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
});

export default MatchCardSkeleton;

