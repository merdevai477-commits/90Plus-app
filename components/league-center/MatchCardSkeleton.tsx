/**
 * Match Card Skeleton Component
 * Skeleton loading placeholder for match cards using react-native-reanimated
 * Supports both PredictionMatchCard and LiveScoreMatchCard layouts
 */

import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { FadeIn } from 'react-native-reanimated';

export type SkeletonType = 'prediction' | 'live';

interface MatchCardSkeletonProps {
  type?: SkeletonType;
  index?: number;
}

const MatchCardSkeleton: React.FC<MatchCardSkeletonProps> = ({
  type = 'live',
  index = 0,
}) => {
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, {
        duration: 1500,
        easing: Easing.linear,
      }),
      -1,
      false
    );
  }, [shimmer]);

  const shimmerStyle = useAnimatedStyle(() => {
    const opacity = interpolate(shimmer.value, [0, 0.5, 1], [0.3, 0.7, 0.3]);
    return {
      opacity,
    };
  });

  const SkeletonBox: React.FC<{
    width: number | string;
    height: number;
    borderRadius?: number;
    style?: any;
  }> = ({ width, height, borderRadius = 8, style }) => {
    return (
      <Animated.View
        style={[
          {
            width,
            height,
            borderRadius,
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
          },
          shimmerStyle,
          style,
        ]}
      />
    );
  };

  if (type === 'prediction') {
    return (
      <Animated.View
        entering={FadeIn.delay(index * 50).springify()}
        style={styles.container}
      >
        <BlurView intensity={25} tint="dark" style={styles.blurContainer}>
          <LinearGradient
            colors={['rgba(255,255,255,0.08)', 'transparent', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          {/* Top Row - Status & Time */}
          <View style={styles.topRow}>
            <View style={styles.statusContainer}>
              <SkeletonBox width={8} height={8} borderRadius={4} />
              <SkeletonBox width={60} height={12} style={styles.statusTextSkeleton} />
            </View>
            <SkeletonBox width={50} height={14} />
          </View>

          {/* Teams Row */}
          <View style={styles.teamsRow}>
            <View style={styles.teamContainer}>
              <SkeletonBox width={60} height={60} borderRadius={12} />
              <SkeletonBox width={80} height={14} style={styles.teamNameSkeleton} />
            </View>

            <SkeletonBox width={30} height={16} />

            <View style={styles.teamContainer}>
              <SkeletonBox width={60} height={60} borderRadius={12} />
              <SkeletonBox width={80} height={14} style={styles.teamNameSkeleton} />
            </View>
          </View>

          {/* Prediction Buttons Row */}
          <View style={styles.predictionButtonsRow}>
            {[1, 2, 3].map((i) => (
              <SkeletonBox
                key={i}
                width={90}
                height={50}
                borderRadius={12}
                style={styles.predictionButtonSkeleton}
              />
            ))}
          </View>

          {/* Bottom Row - League & View Details */}
          <View style={styles.bottomRow}>
            <SkeletonBox width={100} height={14} />
            <SkeletonBox width={100} height={32} borderRadius={16} />
          </View>
        </BlurView>
      </Animated.View>
    );
  }

  // Live/Finished match skeleton
  return (
    <Animated.View
      entering={FadeIn.delay(index * 50).springify()}
      style={styles.container}
    >
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.06)', 'rgba(255, 255, 255, 0.02)', 'rgba(255, 255, 255, 0.04)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.cardGradient}
      >
        <BlurView intensity={20} tint="dark" style={styles.blurContainer}>
          {/* League Header */}
          <View style={styles.leagueHeader}>
            <SkeletonBox width={16} height={16} borderRadius={8} />
            <SkeletonBox width={100} height={12} style={styles.leagueNameSkeleton} />
          </View>

          {/* Status Badge */}
          <View style={styles.statusBadgeContainer}>
            <SkeletonBox width={80} height={24} borderRadius={16} />
          </View>

          {/* Teams & Score */}
          <View style={styles.teamsRowLive}>
            {/* Home Team */}
            <View style={styles.teamSection}>
              <SkeletonBox width={72} height={72} borderRadius={36} />
              <SkeletonBox width={100} height={14} style={styles.teamNameSkeleton} />
            </View>

            {/* Score Container */}
            <View style={styles.scoreContainer}>
              <View style={styles.scoreRow}>
                <SkeletonBox width={32} height={32} borderRadius={8} />
                <SkeletonBox width={12} height={24} borderRadius={4} />
                <SkeletonBox width={32} height={32} borderRadius={8} />
              </View>
            </View>

            {/* Away Team */}
            <View style={styles.teamSection}>
              <SkeletonBox width={72} height={72} borderRadius={36} />
              <SkeletonBox width={100} height={14} style={styles.teamNameSkeleton} />
            </View>
          </View>
        </BlurView>
      </LinearGradient>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  blurContainer: {
    padding: 16,
    borderRadius: 16,
  },
  cardGradient: {
    borderRadius: 16,
  },
  // Prediction card styles
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusTextSkeleton: {
    marginLeft: 4,
  },
  teamsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  teamContainer: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  teamNameSkeleton: {
    marginTop: 8,
  },
  predictionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 16,
  },
  predictionButtonSkeleton: {
    flex: 1,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  // Live match card styles
  leagueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    gap: 6,
  },
  leagueNameSkeleton: {
    marginLeft: 4,
  },
  statusBadgeContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  teamsRowLive: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  teamSection: {
    flex: 1,
    alignItems: 'center',
    gap: 10,
  },
  scoreContainer: {
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});

export default MatchCardSkeleton;
