import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface SkeletonLoaderProps {
  /** Show skeleton for reels feed */
  variant?: 'reel' | 'list';
  /** Number of skeleton items to show */
  count?: number;
}

/**
 * Skeleton Loader Component with Shimmer Effect
 * Requirement: Medium Priority #7 - Add Skeleton Loading
 * Provides better UX during loading states
 */
export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  variant = 'reel',
  count = 1,
}) => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Shimmer animation loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [shimmerAnim]);

  const translateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-SCREEN_WIDTH, SCREEN_WIDTH],
  });

  if (variant === 'reel') {
    return (
      <View style={styles.reelContainer}>
        {/* Background skeleton */}
        <View style={styles.videoSkeleton}>
          <Animated.View
            style={[
              styles.shimmer,
              {
                transform: [{ translateX }],
              },
            ]}
          >
            <LinearGradient
              colors={[
                'rgba(255, 255, 255, 0.03)',
                'rgba(255, 255, 255, 0.08)',
                'rgba(255, 255, 255, 0.03)',
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.shimmerGradient}
            />
          </Animated.View>

          {/* User info skeleton */}
          <View style={styles.userInfoSkeleton}>
            <View style={styles.avatarSkeleton} />
            <View style={styles.userDetailsSkeleton}>
              <View style={styles.userNameSkeleton} />
              <View style={styles.userFollowersSkeleton} />
            </View>
          </View>

          {/* Description skeleton */}
          <View style={styles.descriptionSkeleton}>
            <View style={styles.descriptionLine1} />
            <View style={styles.descriptionLine2} />
          </View>

          {/* Actions skeleton */}
          <View style={styles.actionsSkeleton}>
            {[1, 2, 3, 4].map((i) => (
              <View key={i} style={styles.actionButtonSkeleton} />
            ))}
          </View>
        </View>
      </View>
    );
  }

  // List variant
  return (
    <View style={styles.listContainer}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={styles.listItem}>
          <View style={styles.listAvatarSkeleton} />
          <View style={styles.listContentSkeleton}>
            <View style={styles.listTitleSkeleton} />
            <View style={styles.listSubtitleSkeleton} />
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  reelContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#000000',
  },
  videoSkeleton: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    position: 'relative',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  shimmerGradient: {
    flex: 1,
    width: SCREEN_WIDTH * 2,
  },
  userInfoSkeleton: {
    position: 'absolute',
    top: 60,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 2,
  },
  avatarSkeleton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  userDetailsSkeleton: {
    gap: 6,
  },
  userNameSkeleton: {
    width: 120,
    height: 16,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  userFollowersSkeleton: {
    width: 80,
    height: 12,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  descriptionSkeleton: {
    position: 'absolute',
    bottom: 140,
    left: 16,
    right: 80,
    gap: 8,
    zIndex: 2,
  },
  descriptionLine1: {
    width: '100%',
    height: 14,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  descriptionLine2: {
    width: '70%',
    height: 14,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  actionsSkeleton: {
    position: 'absolute',
    right: 12,
    bottom: 140,
    gap: 20,
    alignItems: 'center',
    zIndex: 2,
  },
  actionButtonSkeleton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  listContainer: {
    padding: 16,
    gap: 16,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  listAvatarSkeleton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  listContentSkeleton: {
    flex: 1,
    gap: 6,
  },
  listTitleSkeleton: {
    width: '60%',
    height: 14,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  listSubtitleSkeleton: {
    width: '40%',
    height: 12,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
});
