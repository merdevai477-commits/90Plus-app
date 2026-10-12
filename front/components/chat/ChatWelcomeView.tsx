import React, { useCallback, useEffect, useRef } from 'react';
import { View, ScrollView, useWindowDimensions, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { chatScreenStyles as styles } from './chatScreen.styles';
import { ChatIridescentBubble } from './ChatIridescentBubble';
import { chatSpacing } from './chatTheme';
import { useVoiceModeStore, VOICE_PULL_MS, VOICE_SETTLE_MS } from './voiceModeStore';
import { markWelcomeOrbLeft, setWelcomeOrbOrigin } from './welcomeOrbOrigin';

/** Voice mode: after being pulled into the composer, the bubble floats back up when it ends. */
const RETURN_DURATION = 520;
/** Entrance: bubble settles first, then the greeting and subtitle drift up in sequence. */
const ENTER_EASING = Easing.out(Easing.cubic);
const BUBBLE_IN = 900;
const TITLE_DELAY = 260;
const SUBTITLE_DELAY = 380;
const LINE_IN = 640;

export type ChatWelcomeViewProps = {
  greetingName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tChat: any;
  /** Height of the floating composer overlapping the bottom of the scroll. */
  bottomInset?: number;
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
  bottomInset = 0,
}: ChatWelcomeViewProps) {
  const { width } = useWindowDimensions();
  const greeting = (tChat.welcomeGreeting as string).replace('{name}', greetingName);
  const bubbleSize = Math.min(width * 0.5, 200);
  const reduceMotion = useReducedMotion();

  const bubbleIn = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) return;
    bubbleIn.value = withTiming(1, { duration: BUBBLE_IN, easing: ENTER_EASING });
  }, [bubbleIn, reduceMotion]);

  const titleStyle = useRiseIn(TITLE_DELAY, reduceMotion);
  const subtitleStyle = useRiseIn(SUBTITLE_DELAY, reduceMotion);

  const voiceActive = useVoiceModeStore((s) => s.active);
  const targetY = useVoiceModeStore((s) => s.targetY);
  const targetSize = useVoiceModeStore((s) => s.targetSize);
  const setWelcomeShown = useVoiceModeStore((s) => s.setWelcomeShown);
  const anchorRef = useRef<View>(null);
  const pull = useSharedValue(0);
  const settle = useSharedValue(0);
  const dropY = useSharedValue(0);
  const endScale = useSharedValue(1);

  useEffect(() => {
    setWelcomeShown(true);
    return () => setWelcomeShown(false);
  }, [setWelcomeShown]);

  const recordOrigin = useCallback(() => {
    anchorRef.current?.measureInWindow((x, y, w, h) => {
      if (w > 0) setWelcomeOrbOrigin({ x: x + w / 2, y: y + h / 2, size: bubbleSize });
    });
  }, [bubbleSize]);
  useEffect(() => markWelcomeOrbLeft, []);

  useEffect(() => {
    if (voiceActive && targetY != null) {
      anchorRef.current?.measureInWindow((_x, y, _w, h) => {
        dropY.value = targetY - (y + h / 2);
        endScale.value = targetSize > 0 ? targetSize / bubbleSize : 0.35;
        if (reduceMotion) {
          pull.value = 1;
          settle.value = 1;
          return;
        }
        pull.value = withTiming(1, { duration: VOICE_PULL_MS, easing: Easing.in(Easing.cubic) });
        settle.value = withDelay(
          VOICE_PULL_MS,
          withTiming(1, { duration: VOICE_SETTLE_MS, easing: Easing.out(Easing.cubic) }),
        );
      });
    } else {
      settle.value = 0;
      pull.value = withTiming(0, { duration: RETURN_DURATION, easing: Easing.out(Easing.cubic) });
    }
  }, [voiceActive, targetY, targetSize, bubbleSize, reduceMotion, pull, settle, dropY, endScale]);

  const bubbleInStyle = useAnimatedStyle(() => ({
    opacity: bubbleIn.value,
    transform: [{ scale: 0.92 + bubbleIn.value * 0.08 }],
  }));
  // Same liquid pull as the typing orb: shrinks early, drawn out downwards, lands with a wobble.
  const pullStyle = useAnimatedStyle((): ViewStyle => {
    const p = pull.value;
    const q = settle.value;
    const arrive = endScale.value * 0.75;
    const shrink = 1 - Math.pow(1 - p, 2.5);
    const size = 1 + (arrive - 1) * shrink + (endScale.value - arrive) * q;
    const stretch = 1 + 1.1 * Math.sin(Math.PI * p) * p;
    const wobble = 0.16 * Math.sin(q * Math.PI * 3) * (1 - q);
    return {
      // Hands over to the composer's voice orb as it settles.
      opacity: interpolate(q, [0, 0.5, 1], [1, 1, 0]),
      transform: [
        { translateY: dropY.value * p },
        { scaleX: (size / Math.pow(stretch, 0.7)) * (1 - wobble) },
        { scaleY: size * stretch * (1 + wobble) },
      ],
    };
  });
  const textStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pull.value, [0, 0.4], [1, 0], 'clamp'),
    transform: [{ translateY: interpolate(pull.value, [0, 0.4], [0, 18], 'clamp') }],
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
      <View style={styles.welcomeHero} onLayout={recordOrigin}>
        <View ref={anchorRef} collapsable={false} style={styles.welcomeBubble}>
          <Animated.View style={bubbleInStyle}>
            <Animated.View style={pullStyle}>
              <ChatIridescentBubble size={bubbleSize} />
            </Animated.View>
          </Animated.View>
        </View>
        <Animated.View style={[styles.welcomeText, textStyle]}>
          <Animated.Text style={[styles.welcomeTitle, titleStyle]}>{greeting}</Animated.Text>
          <Animated.Text style={[styles.welcomeSubtitle, subtitleStyle]}>
            {tChat.welcomeSubtitle}
          </Animated.Text>
        </Animated.View>
      </View>
    </ScrollView>
  );
});
