/**
 * ScrollToBottomButton.tsx — Native
 * Floating button that appears when user scrolls up in chat.
 * Shows unread message count badge.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { Colors, Radius, FontSize, Spacing } from '../../constants/theme';
import { ChatRimButton } from './ChatRimButton';

const BADGE_MAX = 99;
const SIZE = 44;

interface ScrollToBottomButtonProps {
  onPress: () => void;
  newMessagesCount?: number;
}

export function ScrollToBottomButton({
  onPress,
  newMessagesCount = 0,
}: ScrollToBottomButtonProps) {
  const badgeLabel = useMemo(() => {
    if (newMessagesCount <= 0) return null;
    return newMessagesCount > BADGE_MAX
      ? `${BADGE_MAX}+`
      : String(newMessagesCount);
  }, [newMessagesCount]);

  const a11yLabel = badgeLabel
    ? `Scroll to bottom, ${newMessagesCount} new messages`
    : 'Scroll to bottom';

  return (
    <Animated.View
      entering={SlideInDown.duration(400).springify().stiffness(500).damping(20).mass(0.8)}
      style={styles.container}
    >
      <ChatRimButton onPress={onPress} accessibilityLabel={a11yLabel} size={SIZE}>
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.2}>
          <Path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </ChatRimButton>

      {badgeLabel && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={styles.badge}
          pointerEvents="none"
        >
          <Text style={styles.badgeText}>{badgeLabel}</Text>
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    pointerEvents: 'box-none',
  },

  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    paddingHorizontal: Spacing.xs,
    borderRadius: Radius.full,
    backgroundColor: Colors.purplePrimary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#050308',
  },

  badgeText: {
    fontSize: FontSize['2xs'],
    fontWeight: '700',
    color: Colors.white,
    includeFontPadding: false,
  },
});
