/**
 * Empty State Component
 * Enhanced with animations
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { MATCH_DETAILS_COLORS, ANIMATION_CONFIG } from '../../constants/matchDetailsColors';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  iconColor?: string;
}

const EmptyState: React.FC<EmptyStateProps> = React.memo(({
  icon = 'information-circle-outline',
  title,
  message,
  iconColor = MATCH_DETAILS_COLORS.textSecondary,
}) => {
  const scale = useSharedValue(0.8);
  const opacity = useSharedValue(0);
  const iconPulse = useSharedValue(1);

  useEffect(() => {
    // Entrance animation
    opacity.value = withDelay(
      100,
      withTiming(1, { duration: ANIMATION_CONFIG.fadeInDuration })
    );
    scale.value = withDelay(
      100,
      withTiming(1, ANIMATION_CONFIG.spring)
    );

    // Pulse animation for icon
    iconPulse.value = withDelay(
      500,
      withRepeat(
        withTiming(1.1, { duration: ANIMATION_CONFIG.pulseDuration / 2 }),
        -1,
        true
      )
    );
  }, []);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconPulse.value }],
  }));

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <Animated.View style={iconStyle}>
        <Ionicons name={icon} size={64} color={iconColor} />
      </Animated.View>
      <Text style={styles.title}>{title}</Text>
      {message && <Text style={styles.message}>{message}</Text>}
    </Animated.View>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.title === nextProps.title &&
    prevProps.message === nextProps.message &&
    prevProps.icon === nextProps.icon
  );
});

EmptyState.displayName = 'EmptyState';

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: MATCH_DETAILS_COLORS.text,
    marginTop: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    fontWeight: '400',
    color: MATCH_DETAILS_COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});

export default EmptyState;

