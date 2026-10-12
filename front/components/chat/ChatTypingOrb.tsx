/**
 * Replaces the thinking card. On the first message of a chat the welcome
 * 90 PLUS glass orb gets pulled to the assistant's side: it shrinks and
 * stretches out along the pull like liquid being sucked through, then lands
 * with a jelly wobble beside a glass "typing" pill. Later messages skip the
 * flight and just pop the resting orb in.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { ChatIridescentBubble } from './ChatIridescentBubble';
import { LiquidWaterSurface } from './LiquidWaterSurface';
import { IridescentRim } from './IridescentRim';
import { hasWelcomeOrbOrigin, takeWelcomeOrbOrigin } from './welcomeOrbOrigin';
import { holdTypingUntil } from '../../utils/chatTypingHold';
import { useTranslation } from '../../src/i18n';

const ORB = 40;
/** Rendered large and scaled down, so the orb stays crisp while it is still big mid-flight. */
const ORB_RENDER = 200;
const REST_SCALE = ORB / ORB_RENDER;
/** Arrives a little small and wobbles back up to rest size. */
const ARRIVE_SCALE = REST_SCALE * 0.75;
const PULL_MS = 760;
const SETTLE_MS = 520;
const LANDED_MS = PULL_MS + SETTLE_MS;
const PILL_HEIGHT = 34;
const PILL_RADIUS = PILL_HEIGHT / 2;
const DOT = 7;

function TypingDot({ delay, reduceMotion }: { delay: number; reduceMotion: boolean }) {
  const lift = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    lift.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 360, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 360, easing: Easing.in(Easing.quad) }),
          withTiming(0, { duration: 420 }),
        ),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(lift);
  }, [delay, lift, reduceMotion]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.4 + lift.value * 0.6,
    transform: [{ translateY: -lift.value * 4 }],
  }));
  return <Animated.View style={[styles.dot, style]} />;
}

export function ChatTypingOrb() {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const [pulled] = useState(() => hasWelcomeOrbOrigin() && !reduceMotion);
  const anchorRef = useRef<View>(null);
  const launched = useRef(false);

  const pull = useSharedValue(0);
  const settle = useSharedValue(0);
  const breathe = useSharedValue(0);
  const fromX = useSharedValue(0);
  const fromY = useSharedValue(0);
  const fromScale = useSharedValue(ARRIVE_SCALE);
  const visible = useSharedValue(0);

  const startBreathing = useCallback((delay: number) => {
    breathe.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.sin) }), -1, true),
    );
  }, [breathe]);

  const launch = useCallback(() => {
    if (launched.current) return;
    anchorRef.current?.measureInWindow((x, y, w, h) => {
      if (launched.current || w === 0) return;
      launched.current = true;
      const origin = pulled ? takeWelcomeOrbOrigin() : null;
      visible.value = 1;

      if (!origin) {
        pull.value = 1;
        if (reduceMotion) {
          settle.value = 1;
          return;
        }
        settle.value = withTiming(1, { duration: SETTLE_MS, easing: Easing.out(Easing.cubic) });
        startBreathing(SETTLE_MS);
        return;
      }

      fromX.value = origin.x - (x + w / 2);
      fromY.value = origin.y - (y + h / 2);
      fromScale.value = origin.size / ORB_RENDER;
      holdTypingUntil(Date.now() + LANDED_MS);

      pull.value = withTiming(1, { duration: PULL_MS, easing: Easing.in(Easing.cubic) });
      settle.value = withDelay(
        PULL_MS,
        withTiming(1, { duration: SETTLE_MS, easing: Easing.out(Easing.cubic) }),
      );
      startBreathing(LANDED_MS);
    });
  }, [fromScale, fromX, fromY, pull, pulled, reduceMotion, settle, startBreathing, visible]);

  useEffect(() => () => cancelAnimation(breathe), [breathe]);

  const orbStyle = useAnimatedStyle((): ViewStyle => {
    const p = pull.value;
    const q = settle.value;
    // Shrinks early (so it is small before it nears the screen edge) while it is still slow.
    const shrink = 1 - Math.pow(1 - p, 2.5);
    const size =
      fromScale.value + (ARRIVE_SCALE - fromScale.value) * shrink + (REST_SCALE - ARRIVE_SCALE) * q;
    // Drawn out along the pull, thinnest just before it lands.
    const stretch = 1 + 1.1 * Math.sin(Math.PI * p) * p;
    // Jelly wobble on landing, fading out.
    const wobble = 0.16 * Math.sin(q * Math.PI * 3) * (1 - q);
    const angle = Math.atan2(-fromY.value, -fromX.value);
    const s = size * (1 + breathe.value * 0.06);
    return {
      opacity: visible.value,
      transform: [
        { translateX: fromX.value * (1 - p) },
        // Falls a little faster than it slides so the path curves towards the side.
        { translateY: fromY.value * (1 - p) * (1 - p * 0.35) },
        // Deform along the direction of travel, then turn back so the wordmark stays upright.
        { rotate: `${angle}rad` },
        { scaleX: s * stretch * (1 + wobble) },
        { scaleY: (s / Math.pow(stretch, 0.7)) * (1 - wobble) },
        { rotate: `${-angle}rad` },
      ],
    };
  });

  return (
    <Animated.View
      exiting={FadeOut.duration(180)}
      style={styles.row}
      accessibilityRole="progressbar"
      accessibilityLabel={t.chat.thinking.thinkingLabel}
    >
      <View ref={anchorRef} collapsable={false} onLayout={launch} style={styles.orbSlot}>
        <Animated.View style={[styles.orbRender, orbStyle]} pointerEvents="none">
          <ChatIridescentBubble size={ORB_RENDER} />
        </Animated.View>
      </View>

      <Animated.View entering={FadeIn.delay(pulled ? PULL_MS + 120 : 120).duration(260)}>
        <LiquidWaterSurface
          radius={PILL_RADIUS}
          tint="rgba(3,2,8,0.92)"
          glow={[0.6, 0.75, 1]}
          strength={0.12}
          sheen={0.1}
          style={styles.pill}
        >
          {[0, 160, 320].map((d) => (
            <TypingDot key={d} delay={d} reduceMotion={reduceMotion} />
          ))}
        </LiquidWaterSurface>
        <IridescentRim radius={PILL_RADIUS} filmDepth={6} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 10,
    paddingLeft: 2,
    zIndex: 10,
  },
  orbSlot: {
    width: ORB,
    height: ORB,
    overflow: 'visible',
  },
  orbRender: {
    position: 'absolute',
    width: ORB_RENDER,
    height: ORB_RENDER,
    left: (ORB - ORB_RENDER) / 2,
    top: (ORB - ORB_RENDER) / 2,
  },
  pill: {
    height: PILL_HEIGHT,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: '#D9CCFF',
  },
});
