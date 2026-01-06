/**
 * Match Card Skeleton Loader
 * Enhanced shimmer effect with staggered animations
 */

import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
  withDelay,
} from 'react-native-reanimated';
import { MATCH_DETAILS_COLORS, ANIMATION_CONFIG } from '../../constants/matchDetailsColors';

interface MatchCardSkeletonProps {
  index?: number;
}

const MatchCardSkeleton: React.FC<MatchCardSkeletonProps> = React.memo(({ index = 0 }) => {
  const shimmer = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const delay = index * ANIMATION_CONFIG.staggerDelay;
    
    // Fade in animation
    opacity.value = withDelay(
      delay,
      withTiming(1, { duration: ANIMATION_CONFIG.fadeInDuration })
    );

    // Shimmer animation
    shimmer.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration: 1500 }),
        -1,
        false
      )
    );
  }, []);

  const shimmerStyle = useAnimatedStyle(() => {
    const opacityValue = interpolate(shimmer.value, [0, 0.5, 1], [0.3, 0.6, 0.3]);
    return {
      opacity: opacityValue * opacity.value,
    };
  });

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.container, containerStyle, { marginTop: index > 0 ? 12 : 0 }]}>
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
    </Animated.View>
  );
});

MatchCardSkeleton.displayName = 'MatchCardSkeleton';

const styles = StyleSheet.create({
  container: {
    marginBottom: 0,
  },
  card: {
    backgroundColor: MATCH_DETAILS_COLORS.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: MATCH_DETAILS_COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
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
    backgroundColor: MATCH_DETAILS_COLORS.cardSecondary,
  },
  leagueNameSkeleton: {
    width: 80,
    height: 12,
    borderRadius: 6,
    backgroundColor: MATCH_DETAILS_COLORS.cardSecondary,
  },
  statusSkeleton: {
    width: 60,
    height: 24,
    borderRadius: 12,
    backgroundColor: MATCH_DETAILS_COLORS.cardSecondary,
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
    gap: 12,
  },
  teamLogoSkeleton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: MATCH_DETAILS_COLORS.cardSecondary,
  },
  teamNameSkeleton: {
    width: 70,
    height: 14,
    borderRadius: 7,
    backgroundColor: MATCH_DETAILS_COLORS.cardSecondary,
  },
  scoreSkeleton: {
    width: 60,
    height: 32,
    borderRadius: 8,
    backgroundColor: MATCH_DETAILS_COLORS.cardSecondary,
    marginHorizontal: 20,
  },
});

export default MatchCardSkeleton;
