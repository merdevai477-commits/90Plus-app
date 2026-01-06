/**
 * Skeleton Loading Component
 * Material Design 3 style skeleton screens
 */

import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { Colors, BorderRadius, Spacing } from '../../src/designSystem/designSystem';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 20,
  borderRadius = BorderRadius.sm,
  style,
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
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(shimmer.value, [0, 0.5, 1], [0.3, 0.6, 0.3]),
    };
  });

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: Colors.surface.container,
        },
        animatedStyle,
        style,
      ]}
    />
  );
};

interface SkeletonCardProps {
  width?: number;
  height?: number;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({
  width = 300,
  height = 200,
}) => {
  return (
    <View style={[styles.card, { width, height }]}>
      <Skeleton width="100%" height={120} borderRadius={BorderRadius.md} />
      <View style={styles.content}>
        <Skeleton width="70%" height={16} style={styles.title} />
        <Skeleton width="50%" height={14} style={styles.subtitle} />
      </View>
    </View>
  );
};

interface SkeletonListProps {
  count?: number;
  itemHeight?: number;
  spacing?: number;
}

export const SkeletonList: React.FC<SkeletonListProps> = ({
  count = 3,
  itemHeight = 60,
  spacing = Spacing.md,
}) => {
  return (
    <View>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={[styles.listItem, { marginBottom: spacing }]}>
          <Skeleton width={40} height={40} borderRadius={BorderRadius.round} />
          <View style={styles.listContent}>
            <Skeleton width="60%" height={16} />
            <Skeleton width="40%" height={14} style={styles.listSubtitle} />
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface.container,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.glass.border,
  },
  content: {
    marginTop: Spacing.md,
  },
  title: {
    marginBottom: Spacing.sm,
  },
  subtitle: {
    marginTop: Spacing.xs,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  listSubtitle: {
    marginTop: Spacing.xs,
  },
});

