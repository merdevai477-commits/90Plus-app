/**
 * Match Card Skeleton Loader
 * Lightweight skeleton for loading states
 * 365Scores style
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, interpolate } from 'react-native-reanimated';
import { COLORS } from '../reels/constants';

interface MatchCardSkeletonProps {
  index?: number;
}

const MatchCardSkeleton: React.FC<MatchCardSkeletonProps> = ({ index = 0 }) => {
  const shimmer = useSharedValue(0);

  React.useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1500 }),
      -1,
      false
    );
  }, []);

  const shimmerStyle = useAnimatedStyle(() => {
    const opacity = interpolate(shimmer.value, [0, 1], [0.3, 0.6]);
    return { opacity };
  });

  return (
    <View style={[styles.container, { marginTop: index > 0 ? 12 : 0 }]}>
      <Animated.View style={[styles.card, shimmerStyle]}>
        {/* League header skeleton */}
        <View style={styles.leagueHeader}>
          <View style={styles.leagueLogoSkeleton} />
          <View style={styles.leagueNameSkeleton} />
        </View>

        {/* Status skeleton */}
        <View style={styles.statusSkeleton} />

        {/* Teams and score skeleton */}
        <View style={styles.teamsRow}>
          <View style={styles.teamSection}>
            <View style={styles.teamLogoSkeleton} />
            <View style={styles.teamNameSkeleton} />
          </View>
          <View style={styles.scoreSkeleton} />
          <View style={styles.teamSection}>
            <View style={styles.teamLogoSkeleton} />
            <View style={styles.teamNameSkeleton} />
          </View>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 0,
  },
  card: {
    backgroundColor: COLORS.darkGray,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  leagueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    gap: 8,
  },
  leagueLogoSkeleton: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  leagueNameSkeleton: {
    width: 80,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  statusSkeleton: {
    width: 60,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  teamsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  teamSection: {
    flex: 1,
    alignItems: 'center',
    gap: 10,
  },
  teamLogoSkeleton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  teamNameSkeleton: {
    width: 70,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  scoreSkeleton: {
    width: 60,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: 20,
  },
});

export default MatchCardSkeleton;

