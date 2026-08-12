/**
 * =============================================================================
 * SHARED MOTION — the Questions experience's animation language
 * =============================================================================
 *
 * ONE set of durations, curves and gestures for EVERY question mode: Football
 * Quiz, Football Grid, Player Connections, Guess The Club, Guess The Player,
 * Transfer Puzzle, Top 10 Challenge and Football Bingo. A mode does not get to
 * invent its own timing — it imports from here, so the whole flow feels like
 * one app rather than eight.
 *
 * ── THE RULES THIS FILE ENFORCES ─────────────────────────────────────────────
 *  1. Only `opacity` and `transform` are ever animated, always on the native
 *     driver. Nothing here can change a size, shift a layout, cause a reflow or
 *     make content overflow — the Figma layout is untouched by motion.
 *  2. Everything is SHORT (90–260ms). Motion acknowledges an action, it never
 *     makes the player wait, and no interaction is ever blocked while it runs.
 *  3. Movement is small: a few points of travel, ~2% of scale. No bouncing, no
 *     rotation, no springs that overshoot, nothing that keeps moving on its own.
 *  4. "Reduce Motion" is honoured — animations resolve to their end state.
 *
 * ── WHAT YOU CAN CHANGE ──────────────────────────────────────────────────────
 *   ALL TIMING / TRAVEL / SCALE ... MOTION below
 *   PRESS FEEDBACK ................ usePressScale · GamePressable
 *   QUESTION TRANSITION ........... useQuestionEntrance
 *   VALUE CHANGE (XP, counter) .... usePulse · useFadeOnChange
 * =============================================================================
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

/** The motion tokens. Every animated value in the Questions flow starts here. */
export const MOTION = {
  duration: {
    /** Press-in feedback — must feel instant. */
    press: 90,
    /** Press-out / release. */
    release: 140,
    /** A value changing in place (XP, question counter). */
    pulse: 130,
    /** A new question arriving. */
    enter: 240,
    /** Image cross-fade handed to expo-image's `transition`. */
    image: 180,
  },
  easing: {
    /** Decelerate — things arriving on screen. */
    out: Easing.out(Easing.cubic),
    /** Symmetric — things settling back. */
    inOut: Easing.inOut(Easing.quad),
  },
  /** How far a new question slides up as it fades in, in design units. */
  enterOffsetY: 8,
  scale: {
    /** Held-down state for any tappable answer surface. */
    press: 0.98,
    /** One-shot acknowledgement of a value change or a revealed answer. */
    pulse: 1.02,
  },
  opacity: {
    /** Held-down state, paired with `scale.press`. */
    press: 0.9,
  },
} as const;

/* -------------------------------------------------------------------------- */
/* Accessibility                                                              */
/* -------------------------------------------------------------------------- */

/**
 * True when the player has asked the OS to reduce motion. Every hook below
 * checks it and jumps straight to the final state instead of animating.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active) setReduced(value);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      active = false;
      sub.remove();
    };
  }, []);

  return reduced;
}

/* -------------------------------------------------------------------------- */
/* Question transition                                                        */
/* -------------------------------------------------------------------------- */

/**
 * The question card's arrival: an 8pt rise under a fade, replayed whenever
 * `questionKey` changes. This is what makes moving between questions read as a
 * transition rather than a hard swap — and it is the SAME transition in every
 * mode.
 *
 * Returns a style for an `Animated.View`. Because it only touches opacity and
 * translateY, the content occupies its final space from the first frame: no
 * jump, no reflow, no scroll shift.
 */
export function useQuestionEntrance(questionKey: string | number | undefined): {
  opacity: Animated.Value;
  transform: [{ translateY: Animated.Value }];
} {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(MOTION.enterOffsetY)).current;
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) {
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }

    opacity.setValue(0);
    translateY.setValue(MOTION.enterOffsetY);

    const animation = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: MOTION.duration.enter,
        easing: MOTION.easing.out,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: MOTION.duration.enter,
        easing: MOTION.easing.out,
        useNativeDriver: true,
      }),
    ]);

    animation.start();
    return () => animation.stop();
  }, [opacity, questionKey, reduced, translateY]);

  return { opacity, transform: [{ translateY }] };
}

/* -------------------------------------------------------------------------- */
/* Press feedback                                                             */
/* -------------------------------------------------------------------------- */

/**
 * The held-down state for a tappable surface: a 2% squeeze under a slight dim,
 * in on press and out on release. Deliberately smaller than the usual "app
 * bounce" — an answer row is a large target, and a big scale on a large object
 * reads as sloppy.
 */
export function usePressScale(): {
  style: { opacity: Animated.Value; transform: [{ scale: Animated.Value }] };
  onPressIn: () => void;
  onPressOut: () => void;
} {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const reduced = useReducedMotion();

  const animateTo = useCallback(
    (toScale: number, toOpacity: number, duration: number) => {
      if (reduced) {
        scale.setValue(toScale);
        opacity.setValue(toOpacity);
        return;
      }
      Animated.parallel([
        Animated.timing(scale, {
          toValue: toScale,
          duration,
          easing: MOTION.easing.out,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: toOpacity,
          duration,
          easing: MOTION.easing.out,
          useNativeDriver: true,
        }),
      ]).start();
    },
    [opacity, reduced, scale],
  );

  const onPressIn = useCallback(
    () => animateTo(MOTION.scale.press, MOTION.opacity.press, MOTION.duration.press),
    [animateTo],
  );
  const onPressOut = useCallback(
    () => animateTo(1, 1, MOTION.duration.release),
    [animateTo],
  );

  return { style: { opacity, transform: [{ scale }] }, onPressIn, onPressOut };
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface GamePressableProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

/**
 * A Pressable with the shared press feedback baked in — the single component
 * every tappable answer surface uses (option rows, bingo cells, grid cells,
 * crest cards, ranking rows), so pressing anything anywhere feels the same.
 *
 * The transform lives on the pressable itself, which is the layout box, so the
 * squeeze is purely visual: sizes, gaps and hit areas are unchanged.
 */
export function GamePressable({ style, children, onPressIn, onPressOut, ...rest }: GamePressableProps) {
  const press = usePressScale();

  return (
    <AnimatedPressable
      {...rest}
      style={[style, press.style]}
      onPressIn={(event) => {
        press.onPressIn();
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        press.onPressOut();
        onPressOut?.(event);
      }}
    >
      {children}
    </AnimatedPressable>
  );
}

/* -------------------------------------------------------------------------- */
/* Value changes                                                              */
/* -------------------------------------------------------------------------- */

/**
 * A single 2% beat when `trigger` changes — for a number that updates in place
 * (the XP value, a revealed answer). Never fires on first render, so a screen
 * does not pulse just because it mounted.
 */
export function usePulse(
  trigger: unknown,
  options?: { scale?: number; enabled?: boolean },
): { transform: [{ scale: Animated.Value }] } {
  const scale = useRef(new Animated.Value(1)).current;
  const isFirstRun = useRef(true);
  const reduced = useReducedMotion();
  const peak = options?.scale ?? MOTION.scale.pulse;
  const enabled = options?.enabled ?? true;

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    if (reduced || !enabled) return;

    const animation = Animated.sequence([
      Animated.timing(scale, {
        toValue: peak,
        duration: MOTION.duration.pulse,
        easing: MOTION.easing.out,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: MOTION.duration.pulse,
        easing: MOTION.easing.inOut,
        useNativeDriver: true,
      }),
    ]);

    animation.start();
    return () => animation.stop();
    // `peak`/`enabled` are config, not triggers — only `trigger` replays this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger, reduced]);

  return { transform: [{ scale }] };
}

/**
 * A quick fade-through when `trigger` changes — for text that is replaced
 * rather than nudged ("Question 2 of 6" becoming "Question 3 of 6").
 */
export function useFadeOnChange(trigger: unknown): { opacity: Animated.Value } {
  const opacity = useRef(new Animated.Value(1)).current;
  const isFirstRun = useRef(true);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    if (reduced) return;

    opacity.setValue(0.35);
    const animation = Animated.timing(opacity, {
      toValue: 1,
      duration: MOTION.duration.enter,
      easing: MOTION.easing.out,
      useNativeDriver: true,
    });

    animation.start();
    return () => animation.stop();
  }, [opacity, reduced, trigger]);

  return { opacity };
}
