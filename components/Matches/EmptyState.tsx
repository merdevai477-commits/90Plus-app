/**
 * Empty State Component
 * Enhanced with animations
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
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
  onRetry?: () => void | Promise<void>;
  retryLabel?: string;
}

const EmptyState: React.FC<EmptyStateProps> = React.memo(({
  icon = 'information-circle-outline',
  title,
  message,
  iconColor = MATCH_DETAILS_COLORS.textSecondary,
  onRetry,
  retryLabel = 'Retry',
}) => {
  const [isRetrying, setIsRetrying] = useState(false);
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

  const handleRetry = async () => {
    if (!onRetry) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsRetrying(true);
    try {
      await onRetry();
    } catch (err) {
      // Error is handled by the caller
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <Animated.View style={iconStyle}>
        <Ionicons name={icon} size={64} color={iconColor} />
      </Animated.View>
      <Text style={styles.title}>{title}</Text>
      {message && <Text style={styles.message}>{message}</Text>}
      {onRetry && (
        <TouchableOpacity
          style={styles.retryButton}
          onPress={handleRetry}
          disabled={isRetrying}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={retryLabel}
          accessibilityHint="Retry loading data"
        >
          {isRetrying ? (
            <ActivityIndicator size="small" color={MATCH_DETAILS_COLORS.accent} />
          ) : (
            <>
              <Ionicons name="refresh" size={18} color={MATCH_DETAILS_COLORS.accent} />
              <Text style={styles.retryText}>{retryLabel}</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.title === nextProps.title &&
    prevProps.message === nextProps.message &&
    prevProps.icon === nextProps.icon &&
    prevProps.onRetry === nextProps.onRetry
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
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: MATCH_DETAILS_COLORS.accent + '20',
    gap: 8,
  },
  retryText: {
    fontSize: 16,
    fontWeight: '600',
    color: MATCH_DETAILS_COLORS.accent,
  },
});

export default EmptyState;

