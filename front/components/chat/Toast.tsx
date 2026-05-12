/**
 * Toast.tsx — Optimized Version
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  FadeInDown,
  FadeOutUp,
  useSharedValue,
  withTiming,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import Svg, { Polyline, Circle, Line } from 'react-native-svg';
import { Colors, Radius, FontSize, Spacing, BlurIntensity, Duration } from '../../../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─── Types ───────────────────────────────────────────────────────────────────

type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  onClose: () => void;
  duration?: number;
  type?: ToastType;
  actionLabel?: string;
  onAction?: () => void;
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function SuccessIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Polyline points="20 6 9 17 4 12" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ErrorIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={10} stroke="white" strokeWidth={2.5} />
      <Line x1={15} y1={9} x2={9} y2={15} stroke="white" strokeWidth={2.5} strokeLinecap="round" />
      <Line x1={9} y1={9} x2={15} y2={15} stroke="white" strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
  );
}

function InfoIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={10} stroke="white" strokeWidth={2.5} />
      <Line x1={12} y1={16} x2={12} y2={12} stroke="white" strokeWidth={2.5} strokeLinecap="round" />
      <Line x1={12} y1={8} x2={12.01} y2={8} stroke="white" strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
  );
}

// ─── Config ─────────────────────────────────────────────────────────────────

const TYPE_CONFIG = {
  success: { bg: 'rgba(16,185,129,0.95)', Icon: SuccessIcon },
  error: { bg: 'rgba(239,68,68,0.95)', Icon: ErrorIcon },
  info: { bg: 'rgba(59,130,246,0.95)', Icon: InfoIcon },
} as const;

// ─── Component ───────────────────────────────────────────────────────────────

export function Toast({
  message,
  onClose,
  duration = Duration.toast,
  type = 'success',
  actionLabel,
  onAction,
}: ToastProps) {
  const insets = useSafeAreaInsets();
  const config = TYPE_CONFIG[type];

  const progress = useSharedValue(1);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ─── Auto dismiss + progress bar ───────────────────────────────────────────

  useEffect(() => {
    progress.value = withTiming(0, { duration });

    timeoutRef.current = setTimeout(onClose, duration);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [duration]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handlePress = () => {
    // tap to dismiss
    onClose();
  };

  const handleAction = () => {
    onAction?.();
    onClose();
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <Animated.View
      entering={FadeInDown.springify().damping(18)}
      exiting={FadeOutUp.duration(200)}
      style={[styles.container, { top: insets.top + Spacing.base }]}
      pointerEvents="box-none"
    >
      <Pressable onPress={handlePress} style={({ pressed }) => [styles.toast, { opacity: pressed ? 0.9 : 1 }]}>
        <View style={[styles.bg, { backgroundColor: config.bg }]} />

        <BlurView intensity={BlurIntensity.glass} tint="dark" style={StyleSheet.absoluteFill} />

        {/* Progress bar */}
        <Animated.View style={[styles.progress, progressStyle]} />

        <View style={styles.toastContent}>
          <config.Icon />

          <Text style={styles.message} numberOfLines={2}>
            {message}
          </Text>

          {actionLabel && (
            <Pressable onPress={handleAction}>
              <Text style={styles.action}>{actionLabel}</Text>
            </Pressable>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: Spacing.base,
    right: Spacing.base,
    zIndex: 1000,
  },

  toast: {
    borderRadius: Radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },

  bg: {
    ...StyleSheet.absoluteFillObject,
  },

  progress: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },

  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.base,
  },

  message: {
    flex: 1,
    fontSize: FontSize.lg,
    color: Colors.white,
  },

  action: {
    color: Colors.white,
    fontWeight: '600',
  },
});