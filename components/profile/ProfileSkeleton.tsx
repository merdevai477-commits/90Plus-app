/**
 * Profile Skeleton Loading Components
 * 
 * Displays placeholder UI elements while profile content is loading.
 * Used when no cached data exists and data is being fetched.
 * 
 * Requirements: 2.4 - Display skeleton loading placeholders when no cached data exists
 */

import React, { useRef, useEffect, memo } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';
import { ProfileTheme } from '../../constants/ProfileTheme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SkeletonProps {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: object;
}

/**
 * Base skeleton component with shimmer animation
 */
const Skeleton: React.FC<SkeletonProps> = memo(({ width, height, borderRadius = 8, style }) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.6],
  });

  return (
    <Animated.View
      style={[
        {
          width: typeof width === 'string' ? width : width,
          height,
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
});

Skeleton.displayName = 'Skeleton';

/**
 * Skeleton for the profile cover image
 */
export const ProfileCoverSkeleton: React.FC = memo(() => (
  <View style={styles.coverContainer}>
    <Skeleton width="100%" height={200} borderRadius={0} />
  </View>
));

ProfileCoverSkeleton.displayName = 'ProfileCoverSkeleton';

/**
 * Skeleton for the FIFA-style profile card
 */
export const ProfileCardSkeleton: React.FC = memo(() => (
  <View style={styles.cardContainer}>
    <View style={styles.cardFrame}>
      {/* Card background */}
      <Skeleton width={180} height={260} borderRadius={12} />
      
      {/* Avatar placeholder */}
      <View style={styles.avatarOverlay}>
        <Skeleton width={80} height={80} borderRadius={40} />
      </View>
      
      {/* Stats placeholders */}
      <View style={styles.cardStatsOverlay}>
        <Skeleton width={40} height={16} borderRadius={4} />
        <Skeleton width={40} height={16} borderRadius={4} style={{ marginTop: 8 }} />
      </View>
    </View>
  </View>
));

ProfileCardSkeleton.displayName = 'ProfileCardSkeleton';

/**
 * Skeleton for user info section (name, username, bio)
 */
export const UserInfoSkeleton: React.FC = memo(() => (
  <View style={styles.userInfoContainer}>
    {/* Display name */}
    <Skeleton width={150} height={24} borderRadius={4} style={styles.centerSelf} />
    
    {/* Username */}
    <Skeleton width={100} height={16} borderRadius={4} style={[styles.centerSelf, { marginTop: 8 }]} />
    
    {/* Bio */}
    <View style={styles.bioContainer}>
      <Skeleton width="90%" height={14} borderRadius={4} style={styles.centerSelf} />
      <Skeleton width="70%" height={14} borderRadius={4} style={[styles.centerSelf, { marginTop: 6 }]} />
    </View>
    
    {/* Location and team */}
    <View style={styles.locationRow}>
      <Skeleton width={80} height={14} borderRadius={4} />
      <Skeleton width={80} height={14} borderRadius={4} />
    </View>
  </View>
));

UserInfoSkeleton.displayName = 'UserInfoSkeleton';

/**
 * Skeleton for stats row (followers, following, videos)
 */
export const StatsRowSkeleton: React.FC = memo(() => (
  <View style={styles.statsContainer}>
    <View style={styles.statItem}>
      <Skeleton width={50} height={24} borderRadius={4} />
      <Skeleton width={60} height={12} borderRadius={4} style={{ marginTop: 4 }} />
    </View>
    <View style={styles.statDivider} />
    <View style={styles.statItem}>
      <Skeleton width={50} height={24} borderRadius={4} />
      <Skeleton width={60} height={12} borderRadius={4} style={{ marginTop: 4 }} />
    </View>
    <View style={styles.statDivider} />
    <View style={styles.statItem}>
      <Skeleton width={50} height={24} borderRadius={4} />
      <Skeleton width={60} height={12} borderRadius={4} style={{ marginTop: 4 }} />
    </View>
  </View>
));

StatsRowSkeleton.displayName = 'StatsRowSkeleton';

/**
 * Skeleton for action buttons (Edit, Share)
 */
export const ActionButtonsSkeleton: React.FC = memo(() => (
  <View style={styles.actionsContainer}>
    <Skeleton width={140} height={40} borderRadius={20} />
    <Skeleton width={140} height={40} borderRadius={20} />
  </View>
));

ActionButtonsSkeleton.displayName = 'ActionButtonsSkeleton';

/**
 * Skeleton for content tabs
 */
export const ContentTabsSkeleton: React.FC = memo(() => (
  <View style={styles.tabsContainer}>
    <Skeleton width={80} height={36} borderRadius={18} />
    <Skeleton width={80} height={36} borderRadius={18} />
  </View>
));

ContentTabsSkeleton.displayName = 'ContentTabsSkeleton';

/**
 * Skeleton for video grid
 */
export const VideoGridSkeleton: React.FC<{ count?: number }> = memo(({ count = 6 }) => {
  const videoWidth = (SCREEN_WIDTH - 48) / 3;
  
  return (
    <View style={styles.videoGridContainer}>
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton
          key={index}
          width={videoWidth}
          height={videoWidth * 1.5}
          borderRadius={8}
          style={styles.videoItem}
        />
      ))}
    </View>
  );
});

VideoGridSkeleton.displayName = 'VideoGridSkeleton';

/**
 * Complete profile skeleton - combines all skeleton components
 */
export const ProfileSkeleton: React.FC = memo(() => (
  <View style={styles.container}>
    <ProfileCoverSkeleton />
    <ProfileCardSkeleton />
    <UserInfoSkeleton />
    <ActionButtonsSkeleton />
    <StatsRowSkeleton />
    <ContentTabsSkeleton />
    <VideoGridSkeleton count={6} />
  </View>
));

ProfileSkeleton.displayName = 'ProfileSkeleton';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ProfileTheme.colors.deepBlack,
  },
  coverContainer: {
    width: '100%',
    height: 200,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  cardContainer: {
    alignItems: 'center',
    marginTop: -130,
    marginBottom: 20,
    zIndex: 10,
  },
  cardFrame: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOverlay: {
    position: 'absolute',
    top: 40,
  },
  cardStatsOverlay: {
    position: 'absolute',
    bottom: 40,
    alignItems: 'center',
  },
  userInfoContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  centerSelf: {
    alignSelf: 'center',
  },
  bioContainer: {
    marginTop: 12,
    alignItems: 'center',
  },
  locationRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 12,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    marginHorizontal: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  tabsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  videoGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 4,
  },
  videoItem: {
    marginBottom: 4,
  },
});

export default ProfileSkeleton;
