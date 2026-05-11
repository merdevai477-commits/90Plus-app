/**
 * ScrollToBottomButton.tsx — Native
 * Floating button that appears when user scrolls up in chat.
 * Shows unread message count badge.
 */

import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  useSharedValue,
  withSpring,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Polyline } from 'react-native-svg';
import {
  Colors,
  Radius,
  FontSize,
  Spacing,
  Gradients,
  Layout,
} from '../../../constants/theme';

// ─── Constants ────────────────────────────────────────────────────────────────

const BADGE_MAX = 99;
const SPRING_CONFIG = { stiffness: 300, damping: 20 } as const;

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScrollToBottomButtonProps {
  onPress: () => void;
  newMessagesCount?: number;
}

// ─── Animated Components ──────────────────────────────────────────────────────

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ─── Component ────────────────────────────────────────────────────────────────

export function ScrollToBottomButton({
  onPress,
  newMessagesCount = 0,
}: ScrollToBottomButtonProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // ✅ بدون useCallback — scale مستقر ولا يحتاجها
  const handlePressIn = () => {
    scale.value = withSpring(0.9, SPRING_CONFIG);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, SPRING_CONFIG);
  };

  // ✅ نص الـ badge محسوب مرة واحدة
  const badgeLabel = useMemo(() => {
    if (newMessagesCount <= 0) return null;
    return newMessagesCount > BADGE_MAX
      ? `${BADGE_MAX}+`
      : String(newMessagesCount);
  }, [newMessagesCount]);

  // ✅ accessibility label ديناميكي
  const a11yLabel = badgeLabel
    ? `Scroll to bottom, ${newMessagesCount} new messages`
    : 'Scroll to bottom';

  return (
    // ✅ shadow wrapper منفصل — لا overflow يقطعه
    <Animated.View
      entering={
        SlideInDown           // ✅ أوضح من FadeIn + withInitialValues
          .duration(400)
          .springify()
          .stiffness(500)
          .damping(20)
          .mass(0.8)
      }
      style={styles.container}  // ✅ pointerEvents في style بدل prop مهجور
    >
      <View style={styles.shadowWrapper}>
        <AnimatedPressable
          style={animatedStyle}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={onPress}
          accessible
          accessibilityRole="button"
          accessibilityLabel={a11yLabel}
        >
          <LinearGradient
            colors={Gradients.purpleCTA}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.button}
          >
            {/* ✅ Badge بـ FadeIn/FadeOut بدل ظهور مفاجئ */}
            {badgeLabel && (
              <Animated.View
                entering={FadeIn.duration(200).springify()}
                exiting={FadeOut.duration(150)}
                style={styles.badge}
              >
                <Text style={styles.badgeText}>{badgeLabel}</Text>
              </Animated.View>
            )}

            {/* Down arrow */}
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Polyline
                points="6 9 12 15 18 9"
                stroke={Colors.white}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </LinearGradient>
        </AnimatedPressable>
      </View>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Layout.scrollButtonBottom,
    alignSelf: 'center',
    zIndex: 30,
    pointerEvents: 'box-none',    // ✅ هنا بدل prop مهجور
  },

  // ✅ shadow wrapper — منفصل عن LinearGradient
  shadowWrapper: {
    borderRadius: Radius.full,
    shadowColor: Colors.purplePrimary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 12,
  },

  button: {
    width: 48,
    height: 48,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',           // ✅ لقطع gradient فقط، الـ shadow على wrapper
  },

  // ✅ Badge shadow على View مستقل — overflow:hidden على button لا يقطعه
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 20,
    height: 20,
    paddingHorizontal: Spacing.xs,
    borderRadius: Radius.full,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,             // ✅ حد أبيض يفصل Badge عن الزر
    borderColor: Colors.white,
    shadowColor: Colors.error,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 4,
  },

  badgeText: {
    fontSize: FontSize['2xs'],
    fontWeight: '700',
    color: Colors.white,
    includeFontPadding: false,    // ✅ يمنع padding زيادة على Android
  },
});