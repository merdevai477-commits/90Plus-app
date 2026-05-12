/**
 * SkeletonLoader.tsx — Native
 * Shimmer skeleton loaders for conversation list and user profile.
 */

import React, { useEffect } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  withRepeat,
  withTiming,
  useAnimatedStyle,
  useReducedMotion,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import type { StyleProp, ViewStyle } from 'react-native';
import { Colors, Radius, Spacing } from '../../../constants/theme';

// ─── Constants ────────────────────────────────────────────────────────────────

/** عرض الـ shimmer highlight نسبة للشاشة */
const SHIMMER_WIDTH_RATIO = 0.4;

/** عدد عناصر skeleton المحادثات */
const CONVERSATION_ITEMS = [0, 1, 2, 3] as const;

/** نسب عرض bars المحادثات — ثابتة بدل حساب في كل render */
const CONVERSATION_BAR_WIDTHS = ['67%', '74%', '60%', '81%'] as const;

// ─── Shimmer Hook ─────────────────────────────────────────────────────────────

/**
 * ✅ Hook منفصل — نشارك نفس shimmerX بين كل الـ bars
 * بدل إنشاء animation لكل ShimmerBar
 */
function useShimmerAnimation(screenWidth: number) {
  const shimmerX = useSharedValue(-screenWidth * SHIMMER_WIDTH_RATIO);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return; // ✅ احترام accessibility

    shimmerX.value = withRepeat(
      withTiming(screenWidth, {
        duration: 1200,
        easing: Easing.linear,
      }),
      -1,
    );
  // ✅ shimmerX مستقر — لا يحتاج في dependency array
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenWidth, reduceMotion]);

  return shimmerX;
}

// ─── Shimmer Bar ──────────────────────────────────────────────────────────────

interface ShimmerBarProps {
  width: string | number;
  height?: number;
  style?: StyleProp<ViewStyle>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  shimmerStyle: any;
}

function ShimmerBar({
  width,
  height = 12,
  style,
  shimmerStyle,
}: ShimmerBarProps) {
  const shimmerWidth = useWindowDimensions().width * SHIMMER_WIDTH_RATIO;

  return (
    <View
      style={[
        styles.shimmerBar,
        { width: width as import('react-native').DimensionValue, height, borderRadius: height / 2 },
        style,
      ]}
    >
      {/* ✅ shimmerStyle مشترك — لا animation منفصلة لكل bar */}
      <Animated.View
        style={[styles.shimmerOverlay, { width: shimmerWidth }, shimmerStyle]}
      >
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.09)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

// ─── Conversation Skeleton ────────────────────────────────────────────────────

export function ConversationSkeleton() {
  const { width: screenWidth } = useWindowDimensions();

  // ✅ animation واحدة مشتركة لكل الـ bars
  const shimmerX = useShimmerAnimation(screenWidth);
  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerX.value }],
  }));

  return (
    <View style={styles.conversationContainer}>
      {CONVERSATION_ITEMS.map((i) => (
        <View key={i} style={styles.conversationItem}>
          {/* Icon skeleton */}
          <View style={styles.iconSkeleton} />

          <View style={styles.conversationText}>
            {/* Title — عرض ثابت من المصفوفة */}
            <ShimmerBar
              width={CONVERSATION_BAR_WIDTHS[i]}
              height={14}
              shimmerStyle={shimmerStyle}
            />
            {/* Date */}
            <ShimmerBar
              width="40%"
              height={10}
              style={styles.barMarginTop}
              shimmerStyle={shimmerStyle}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── User Profile Skeleton ────────────────────────────────────────────────────

export function UserProfileSkeleton() {
  const { width: screenWidth } = useWindowDimensions();

  // ✅ animation واحدة مشتركة
  const shimmerX = useShimmerAnimation(screenWidth);
  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerX.value }],
  }));

  return (
    <View style={styles.profileContainer}>
      <View style={styles.profileInner}>
        {/* Avatar */}
        <View style={styles.avatarSkeleton} />

        <View style={styles.profileText}>
          {/* Name */}
          <ShimmerBar width="60%" height={16} shimmerStyle={shimmerStyle} />
          {/* Status */}
          <ShimmerBar
            width="40%"
            height={12}
            style={styles.barMarginTop}
            shimmerStyle={shimmerStyle}
          />
        </View>

        {/* Counter */}
        <View style={styles.counterSkeleton} />
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Shimmer Bar ──
  shimmerBar: {
    backgroundColor: Colors.white08,
    overflow: 'hidden',
  },
  shimmerOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    overflow: 'hidden',           // ✅ يقطع الـ gradient بشكل نظيف
  },

  // ── Shared ──
  barMarginTop: {
    marginTop: Spacing.xs,
  },

  // ── Conversation Skeleton ──
  conversationContainer: {
    gap: Spacing.md - 2,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md - 2,
    padding: Spacing.md - 2,
    borderRadius: Radius.xl,
    backgroundColor: Colors.white04,
    borderWidth: 0.5,
    borderColor: Colors.borderSubtle,
    overflow: 'hidden',
  },
  iconSkeleton: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: Colors.white06,
    flexShrink: 0,
  },
  conversationText: {
    flex: 1,
    justifyContent: 'center',
  },

  // ── Profile Skeleton ──
  profileContainer: {
    marginBottom: Spacing.xl,
    padding: Spacing.base,
    borderRadius: Radius.xl,
    backgroundColor: Colors.white04,
    borderWidth: 0.5,
    borderColor: Colors.borderLight,
  },
  profileInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatarSkeleton: {
    width: 48,
    height: 48,
    borderRadius: Radius.full,
    backgroundColor: Colors.white10,
    flexShrink: 0,
  },
  profileText: {
    flex: 1,
  },
  counterSkeleton: {
    width: 64,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: Colors.white08,
  },
});