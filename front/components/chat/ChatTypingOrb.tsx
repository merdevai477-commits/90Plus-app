/**
 * Replaces the thinking card. On the first message of a chat the welcome
 * 90 PLUS orb is swallowed by a small black hole that opens on the
 * assistant's side: it spirals in, stretches towards the core, and the hole
 * collapses leaving the orb resting beside a glass "typing" pill. Later
 * messages skip the flight and just pop the resting orb in.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeOut,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Stop } from 'react-native-svg';
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
/** How small the orb gets at the bottom of the well before it bounces back to rest size. */
const SWALLOWED_SCALE = REST_SCALE * 0.45;
const OPEN_MS = 300;
const FALL_MS = 1000;
const SETTLE_MS = 420;
const LANDED_MS = FALL_MS + SETTLE_MS;
/** Just over one full turn while falling in. */
const SPIRAL = -Math.PI * 2.3;
const HOLE = 150;
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

function BlackHoleGlow() {
  return (
    <Svg width={HOLE} height={HOLE} viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id="bhGlow" cx="50" cy="50" r="50" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#000" stopOpacity="1" />
          <Stop offset="0.3" stopColor="#000" stopOpacity="1" />
          <Stop offset="0.4" stopColor="#7C4DFF" stopOpacity="0.7" />
          <Stop offset="0.55" stopColor="#38BDF8" stopOpacity="0.22" />
          <Stop offset="0.75" stopColor="#A855F7" stopOpacity="0.08" />
          <Stop offset="1" stopColor="#000" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx="50" cy="50" r="50" fill="url(#bhGlow)" />
    </Svg>
  );
}

/** Streaks of matter on the accretion disk; the layer is rotated to make them swirl. */
function AccretionRings() {
  return (
    <Svg width={HOLE} height={HOLE} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="bhRing" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#C4B5FD" />
          <Stop offset="0.35" stopColor="#38BDF8" />
          <Stop offset="0.7" stopColor="#F472B6" />
          <Stop offset="1" stopColor="#7C4DFF" />
        </LinearGradient>
      </Defs>
      <Circle
        cx="50" cy="50" r="22"
        stroke="url(#bhRing)" strokeWidth="3.2" fill="none"
        strokeDasharray="22 8 9 12" strokeLinecap="round" opacity={0.95}
      />
      <Circle
        cx="50" cy="50" r="29"
        stroke="url(#bhRing)" strokeWidth="1.6" fill="none"
        strokeDasharray="5 13 14 9" strokeLinecap="round" opacity={0.55}
      />
      <Circle
        cx="50" cy="50" r="36"
        stroke="url(#bhRing)" strokeWidth="0.9" fill="none"
        strokeDasharray="2 16" strokeLinecap="round" opacity={0.35}
      />
    </Svg>
  );
}

export function ChatTypingOrb() {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const [swallow] = useState(() => hasWelcomeOrbOrigin() && !reduceMotion);
  const anchorRef = useRef<View>(null);
  const launched = useRef(false);

  const fall = useSharedValue(0);
  const settle = useSharedValue(0);
  const hole = useSharedValue(0);
  const swirl = useSharedValue(0);
  const shock = useSharedValue(0);
  const breathe = useSharedValue(0);
  const fromX = useSharedValue(0);
  const fromY = useSharedValue(0);
  const fromScale = useSharedValue(SWALLOWED_SCALE);
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
      const origin = swallow ? takeWelcomeOrbOrigin() : null;
      visible.value = 1;

      if (!origin) {
        fall.value = 1;
        if (reduceMotion) {
          settle.value = 1;
          return;
        }
        settle.value = withTiming(1, { duration: SETTLE_MS, easing: Easing.out(Easing.back(2.2)) });
        startBreathing(SETTLE_MS);
        return;
      }

      fromX.value = origin.x - (x + w / 2);
      fromY.value = origin.y - (y + h / 2);
      fromScale.value = origin.size / ORB_RENDER;
      holdTypingUntil(Date.now() + LANDED_MS);

      hole.value = withSequence(
        withTiming(1, { duration: OPEN_MS, easing: Easing.out(Easing.cubic) }),
        withDelay(FALL_MS - OPEN_MS - 60, withTiming(0, { duration: 320, easing: Easing.in(Easing.back(1.6)) })),
      );
      swirl.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.linear }), -1, false);
      fall.value = withTiming(1, { duration: FALL_MS, easing: Easing.in(Easing.quad) });
      shock.value = withDelay(FALL_MS - 40, withTiming(1, { duration: 560, easing: Easing.out(Easing.cubic) }));
      settle.value = withDelay(
        FALL_MS,
        withTiming(1, { duration: SETTLE_MS, easing: Easing.out(Easing.back(2.2)) }),
      );
      startBreathing(LANDED_MS);
    });
  }, [breathe, fall, fromScale, fromX, fromY, hole, reduceMotion, settle, shock, startBreathing, swallow, swirl, visible]);

  useEffect(() => () => {
    cancelAnimation(swirl);
    cancelAnimation(breathe);
  }, [breathe, swirl]);

  const orbStyle = useAnimatedStyle((): ViewStyle => {
    const p = fall.value;
    const r0 = Math.hypot(fromX.value, fromY.value);
    const a0 = Math.atan2(fromY.value, fromX.value);
    const radius = r0 * Math.pow(1 - p, 1.25);
    const angle = a0 + SPIRAL * Math.pow(p, 1.3);
    const size =
      interpolate(p, [0, 1], [fromScale.value, SWALLOWED_SCALE]) +
      settle.value * (REST_SCALE - SWALLOWED_SCALE);
    // Spaghettified along the pull: long towards the core, thin across it.
    const stretch = 1 + 0.6 * Math.sin(Math.PI * p);
    const s = size * (1 + breathe.value * 0.06);
    return {
      opacity: visible.value,
      transform: [
        { translateX: radius * Math.cos(angle) },
        { translateY: radius * Math.sin(angle) },
        { rotate: `${angle}rad` },
        { scaleX: s * stretch },
        { scaleY: s / Math.sqrt(stretch) },
        // Two whole turns of its own, so the wordmark lands upright.
        { rotate: `${-angle + p * Math.PI * 4}rad` },
      ],
    };
  });

  const holeStyle = useAnimatedStyle((): ViewStyle => ({
    opacity: hole.value,
    transform: [{ scale: 0.2 + hole.value * 0.8 }],
  }));
  const swirlStyle = useAnimatedStyle((): ViewStyle => ({
    transform: [{ rotate: `${-swirl.value * 360}deg` }],
  }));
  const shockStyle = useAnimatedStyle((): ViewStyle => ({
    opacity: shock.value > 0 ? (1 - shock.value) * 0.85 : 0,
    transform: [{ scale: 0.4 + shock.value * 1.9 }],
  }));

  return (
    <Animated.View
      exiting={FadeOut.duration(180)}
      style={styles.row}
      accessibilityRole="progressbar"
      accessibilityLabel={t.chat.thinking.thinkingLabel}
    >
      <View ref={anchorRef} collapsable={false} onLayout={launch} style={styles.orbSlot}>
        {swallow ? (
          <>
            <Animated.View style={[styles.hole, holeStyle]} pointerEvents="none">
              <BlackHoleGlow />
              <Animated.View style={[StyleSheet.absoluteFill, swirlStyle]}>
                <AccretionRings />
              </Animated.View>
              <View style={styles.horizon} />
            </Animated.View>
            <Animated.View style={[styles.shock, shockStyle]} pointerEvents="none" />
          </>
        ) : null}
        <Animated.View style={[styles.orbRender, orbStyle]} pointerEvents="none">
          <ChatIridescentBubble size={ORB_RENDER} />
        </Animated.View>
      </View>

      <Animated.View entering={FadeIn.delay(swallow ? LANDED_MS - 200 : 120).duration(260)}>
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

const HORIZON = HOLE * 0.28;
const SHOCK = 64;

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
  hole: {
    position: 'absolute',
    width: HOLE,
    height: HOLE,
    left: (ORB - HOLE) / 2,
    top: (ORB - HOLE) / 2,
  },
  horizon: {
    position: 'absolute',
    width: HORIZON,
    height: HORIZON,
    borderRadius: HORIZON / 2,
    left: (HOLE - HORIZON) / 2,
    top: (HOLE - HORIZON) / 2,
    backgroundColor: '#000',
  },
  shock: {
    position: 'absolute',
    width: SHOCK,
    height: SHOCK,
    borderRadius: SHOCK / 2,
    left: (ORB - SHOCK) / 2,
    top: (ORB - SHOCK) / 2,
    borderWidth: 1.5,
    borderColor: 'rgba(196,181,253,0.9)',
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
