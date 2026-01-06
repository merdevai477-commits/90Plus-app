/**
 * Quick Indicators Row
 * Enhanced with animations and unified colors
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  useAnimatedReaction,
} from 'react-native-reanimated';
import { MATCH_DETAILS_COLORS, ANIMATION_CONFIG } from '../../constants/matchDetailsColors';

interface QuickIndicatorsProps {
  matchesCount: number;
  leaguesCount: number;
}

const QuickIndicators: React.FC<QuickIndicatorsProps> = React.memo(({
  matchesCount,
  leaguesCount,
}) => {
  const matchesOpacity = useSharedValue(0);
  const leaguesOpacity = useSharedValue(0);
  const matchesScale = useSharedValue(0.8);
  const leaguesScale = useSharedValue(0.8);
  const prevMatchesCount = useSharedValue(matchesCount);
  const prevLeaguesCount = useSharedValue(leaguesCount);

  // Entrance animation
  useEffect(() => {
    matchesOpacity.value = withTiming(1, { duration: ANIMATION_CONFIG.fadeInDuration });
    leaguesOpacity.value = withDelay(
      100,
      withTiming(1, { duration: ANIMATION_CONFIG.fadeInDuration })
    );
    matchesScale.value = withSpring(1, ANIMATION_CONFIG.spring);
    leaguesScale.value = withDelay(
      100,
      withSpring(1, ANIMATION_CONFIG.spring)
    );
  }, []);

  // Animate count changes
  useAnimatedReaction(
    () => matchesCount,
    (current, previous) => {
      if (previous !== null && current !== previous) {
        matchesScale.value = withSpring(1.2, ANIMATION_CONFIG.spring, () => {
          matchesScale.value = withSpring(1, ANIMATION_CONFIG.spring);
        });
        prevMatchesCount.value = current;
      }
    }
  );

  useAnimatedReaction(
    () => leaguesCount,
    (current, previous) => {
      if (previous !== null && current !== previous) {
        leaguesScale.value = withSpring(1.2, ANIMATION_CONFIG.spring, () => {
          leaguesScale.value = withSpring(1, ANIMATION_CONFIG.spring);
        });
        prevLeaguesCount.value = current;
      }
    }
  );

  const matchesStyle = useAnimatedStyle(() => ({
    opacity: matchesOpacity.value,
    transform: [{ scale: matchesScale.value }],
  }));

  const leaguesStyle = useAnimatedStyle(() => ({
    opacity: leaguesOpacity.value,
    transform: [{ scale: leaguesScale.value }],
  }));

  return (
    <View style={styles.container}>
      {/* Matches Count */}
      <Animated.View style={[styles.indicator, matchesStyle]}>
        <View style={styles.redDot} />
        <Animated.Text style={styles.countText}>{matchesCount}</Animated.Text>
        <Text style={styles.labelText}>Matches</Text>
      </Animated.View>

      {/* Leagues Count */}
      <Animated.View style={[styles.indicator, leaguesStyle]}>
        <View style={styles.greenDot} />
        <Animated.Text style={styles.countText}>{leaguesCount}</Animated.Text>
        <Text style={styles.labelText}>Leagues</Text>
      </Animated.View>
    </View>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.matchesCount === nextProps.matchesCount &&
    prevProps.leaguesCount === nextProps.leaguesCount
  );
});

QuickIndicators.displayName = 'QuickIndicators';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 24,
  },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  redDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: MATCH_DETAILS_COLORS.error,
  },
  greenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: MATCH_DETAILS_COLORS.accent,
  },
  countText: {
    fontSize: 16,
    fontWeight: '700',
    color: MATCH_DETAILS_COLORS.text,
  },
  labelText: {
    fontSize: 12,
    fontWeight: '500',
    color: MATCH_DETAILS_COLORS.textSecondary,
  },
});

export default QuickIndicators;
