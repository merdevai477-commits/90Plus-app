/**
 * ErrorBanner.tsx — Native
 * Inline error banner with retry and dismiss actions.
 */

import React, { useCallback, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  FadeInDown,
  FadeOutUp,
  useSharedValue,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Line } from 'react-native-svg';
import { Colors, Radius, FontSize, Spacing, Gradients } from '../../../constants/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ErrorBannerProps {
  message: string;
  onRetry: () => void;
  onDismiss: () => void;
  /** إذا كان true بيعمل shake تلقائياً عند الظهور */
  autoShake?: boolean;
}

// ─── Hook: Press Scale ────────────────────────────────────────────────────────

function usePressScale(target = 0.95) {
  const scale = useSharedValue(1);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPressIn = useCallback(() => {
    scale.value = withSpring(target, { stiffness: 300, damping: 20 });
  }, [target]);

  const onPressOut = useCallback(() => {
    scale.value = withSpring(1, { stiffness: 300, damping: 20 });
  }, []);

  return { style, onPressIn, onPressOut };
}

// ─── Hook: Shake ─────────────────────────────────────────────────────────────

function useShake(autoShake = false) {
  const translateX = useSharedValue(0);

  const shake = useCallback(() => {
    translateX.value = withSequence(
      withTiming(-6, { duration: 60 }),
      withTiming(6,  { duration: 60 }),
      withTiming(-4, { duration: 60 }),
      withTiming(4,  { duration: 60 }),
      withTiming(-2, { duration: 60 }),
      withTiming(0,  { duration: 60 }),
    );
  }, []);

  useEffect(() => {
    if (autoShake) {
      // نأخر الـ shake شوية عشان الـ FadeInDown يخلص الأول
      const timer = setTimeout(shake, 350);
      return () => clearTimeout(timer);
    }
  }, [autoShake, shake]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return { style, shake };
}

// ─── Animated Pressable ───────────────────────────────────────────────────────

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ─── Component ────────────────────────────────────────────────────────────────

export const ErrorBanner = React.memo(({
  message,
  onRetry,
  onDismiss,
  autoShake = true,
}: ErrorBannerProps) => {
  const retryPress   = usePressScale(0.95);
  const dismissPress = usePressScale(0.9);
  const { style: shakeStyle, shake } = useShake(autoShake);

  const handleRetry = useCallback(() => {
    shake();
    onRetry();
  }, [onRetry, shake]);

  const handleDismiss = useCallback(() => {
    onDismiss();
  }, [onDismiss]);

  return (
    <Animated.View
      entering={FadeInDown.duration(300).springify().damping(18)}
      exiting={FadeOutUp.duration(200)}
      style={[styles.container, shakeStyle]}
    >
      <LinearGradient
        colors={Gradients.errorBanner}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {/* Icon + Message */}
        <View style={styles.left}>
          <View style={styles.iconCircle}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Circle
                cx={12} cy={12} r={10}
                stroke={Colors.error}
                strokeWidth={2}
              />
              <Line
                x1={12} y1={8} x2={12} y2={12}
                stroke={Colors.error}
                strokeWidth={2}
                strokeLinecap="round"
              />
              <Line
                x1={12} y1={16} x2={12.01} y2={16}
                stroke={Colors.error}
                strokeWidth={2}
                strokeLinecap="round"
              />
            </Svg>
          </View>
          <Text
            style={styles.message}
            numberOfLines={2}
            accessibilityRole="alert"
          >
            {message}
          </Text>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <AnimatedPressable
            style={[styles.retryButton, retryPress.style]}
            onPressIn={retryPress.onPressIn}
            onPressOut={retryPress.onPressOut}
            onPress={handleRetry}
            accessibilityRole="button"
            accessibilityLabel="Retry"
          >
            <LinearGradient
              colors={['#EF4444', '#DC2626']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.retryGradient}
            >
              <Text style={styles.retryText}>Retry</Text>
            </LinearGradient>
          </AnimatedPressable>

          <AnimatedPressable
            style={[styles.dismissButton, dismissPress.style]}
            onPressIn={dismissPress.onPressIn}
            onPressOut={dismissPress.onPressOut}
            onPress={handleDismiss}
            accessibilityRole="button"
            accessibilityLabel="Dismiss error"
          >
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <Line
                x1={18} y1={6} x2={6} y2={18}
                stroke={Colors.white60}
                strokeWidth={2}
                strokeLinecap="round"
              />
              <Line
                x1={6} y1={6} x2={18} y2={18}
                stroke={Colors.white60}
                strokeWidth={2}
                strokeLinecap="round"
              />
            </Svg>
          </AnimatedPressable>
        </View>
      </LinearGradient>
    </Animated.View>
  );
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.md,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    shadowColor: Colors.error,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md - 2,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(239,68,68,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  message: {
    flex: 1,
    fontSize: FontSize.base,
    color: 'rgba(254,202,202,0.9)',
    lineHeight: 20,
    textAlign: 'left',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexShrink: 0,
  },
  retryButton: {
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  retryGradient: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
  },
  retryText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.white,
  },
  dismissButton: {
    width: 28,
    height: 28,
    borderRadius: Radius.sm,
    backgroundColor: Colors.white08,
    borderWidth: 0.5,
    borderColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
});