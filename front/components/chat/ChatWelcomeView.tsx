import React, { useEffect, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { chatScreenStyles as styles } from './chatScreen.styles';
import { ChatIridescentBubble } from './ChatIridescentBubble';
import { ChatWelcomeSuggestions } from './ChatWelcomeSuggestions';
import { chatColors, chatSpacing } from './chatTheme';
import { useVoiceModeStore } from './voiceModeStore';
import { useAppFont } from '../../utils/fontSetup';

/** Voice mode: the bubble is pulled down into the composer, then floats back when it ends. */
const SUCK_DURATION = 560;
const RETURN_DURATION = 520;
/** Entrance: bubble settles first, then badge, greeting and subtitle drift up in sequence. */
const ENTER_EASING = Easing.out(Easing.cubic);
const BUBBLE_IN = 900;
const BADGE_DELAY = 220;
const TITLE_DELAY = 340;
const SUBTITLE_DELAY = 460;
const LINE_IN = 640;

export type ChatWelcomeViewProps = {
  greetingName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tChat: any;
  isAr: boolean;
  /** Height of the floating composer overlapping the bottom of the scroll. */
  bottomInset?: number;
  /** Omit to hide the suggestion cards (e.g. daily limit reached). */
  onSuggestion?: (prompt: string) => void;
};

function useRiseIn(delay: number, reduceMotion: boolean) {
  const progress = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) return;
    progress.value = withDelay(delay, withTiming(1, { duration: LINE_IN, easing: ENTER_EASING }));
  }, [delay, progress, reduceMotion]);
  return useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 12 }],
  }));
}

export const ChatWelcomeView = React.memo(function ChatWelcomeView({
  greetingName,
  tChat,
  isAr,
  bottomInset = 0,
  onSuggestion,
}: ChatWelcomeViewProps) {
  const { width } = useWindowDimensions();
  const badgeFont = useAppFont(500);
  const greeting = (tChat.welcomeGreeting as string).replace('{name}', greetingName);
  const bubbleSize = Math.min(width * 0.44, 176);
  const reduceMotion = useReducedMotion();

  const bubbleIn = useSharedValue(reduceMotion ? 1 : 0);
  const livePulse = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    bubbleIn.value = withTiming(1, { duration: BUBBLE_IN, easing: ENTER_EASING });
    livePulse.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [bubbleIn, livePulse, reduceMotion]);

  const badgeStyle = useRiseIn(BADGE_DELAY, reduceMotion);
  const titleStyle = useRiseIn(TITLE_DELAY, reduceMotion);
  const subtitleStyle = useRiseIn(SUBTITLE_DELAY, reduceMotion);

  const voiceActive = useVoiceModeStore((s) => s.active);
  const targetY = useVoiceModeStore((s) => s.targetY);
  const anchorRef = useRef<View>(null);
  const suck = useSharedValue(0);
  const dropY = useSharedValue(0);

  useEffect(() => {
    if (voiceActive && targetY != null) {
      anchorRef.current?.measureInWindow((_x, y, _w, h) => {
        dropY.value = targetY - (y + h / 2);
        suck.value = withTiming(1, { duration: SUCK_DURATION, easing: Easing.in(Easing.cubic) });
      });
    } else {
      suck.value = withTiming(0, { duration: RETURN_DURATION, easing: Easing.out(Easing.cubic) });
    }
  }, [voiceActive, targetY, suck, dropY]);

  const bubbleInStyle = useAnimatedStyle(() => ({
    opacity: bubbleIn.value,
    transform: [{ scale: 0.92 + bubbleIn.value * 0.08 }],
  }));
  const dropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(suck.value, [0, 0.75, 1], [1, 0.9, 0]),
    transform: [{ translateY: dropY.value * suck.value }],
  }));
  const pinchStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: interpolate(suck.value, [0, 0.35, 1], [1, 0.82, 0.14]) }],
  }));
  const stretchStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: interpolate(suck.value, [0, 0.35, 0.8, 1], [1, 1.18, 0.6, 0.12]) }],
  }));
  const contentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(suck.value, [0, 0.4], [1, 0], 'clamp'),
    transform: [{ translateY: interpolate(suck.value, [0, 0.4], [0, 18], 'clamp') }],
  }));
  const liveDotStyle = useAnimatedStyle(() => ({
    opacity: 0.45 + livePulse.value * 0.55,
    transform: [{ scale: 0.85 + livePulse.value * 0.15 }],
  }));

  return (
    <ScrollView
      style={styles.welcomeScroll}
      contentContainerStyle={[
        styles.welcomeContent,
        { paddingBottom: chatSpacing.welcomeBottom + bottomInset },
      ]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.welcomeHero}>
        <View ref={anchorRef} collapsable={false} style={styles.welcomeBubble}>
          <Animated.View style={bubbleInStyle}>
            <Animated.View style={dropStyle}>
              <Animated.View style={pinchStyle}>
                <Animated.View style={stretchStyle}>
                  <ChatIridescentBubble size={bubbleSize} />
                </Animated.View>
              </Animated.View>
            </Animated.View>
          </Animated.View>
        </View>

        <Animated.View style={[styles.welcomeText, contentStyle]}>
          <Animated.View style={[local.badge, isAr && local.badgeRtl, badgeStyle]}>
            <Animated.View style={[local.liveDot, liveDotStyle]} />
            <Text style={[local.badgeText, { fontFamily: badgeFont }]} numberOfLines={1}>
              {tChat.welcomeBrand}
            </Text>
          </Animated.View>
          <Animated.Text style={[styles.welcomeTitle, titleStyle]}>{greeting}</Animated.Text>
          <Animated.Text style={[styles.welcomeSubtitle, subtitleStyle]}>
            {tChat.welcomeSubtitle}
          </Animated.Text>

          {onSuggestion ? (
            <View style={local.suggestions}>
              <ChatWelcomeSuggestions tChat={tChat} isAr={isAr} onSelect={onSuggestion} />
            </View>
          ) : null}
        </Animated.View>
      </View>
    </ScrollView>
  );
});

const local = StyleSheet.create({
  badge: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(210,190,255,0.22)',
    marginBottom: 16,
  },
  badgeRtl: {
    flexDirection: 'row-reverse',
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#4ADE80',
    shadowColor: '#4ADE80',
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  badgeText: {
    color: chatColors.textSecondary,
    fontSize: 12,
    letterSpacing: 0.2,
  },
  suggestions: {
    marginTop: 28,
  },
});
