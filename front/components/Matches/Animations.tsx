/**
 * Simple reusable animation hooks built on React Native's Animated API.
 *
 * These replace the previous inline implementations scattered across the
 * codebase. All of them use the native driver so they run off the JS
 * thread.
 */

import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

/**
 * Fade an element from 0 to 1 on mount.
 * Returns the Animated.Value to bind to `opacity`.
 */
export function useFadeIn(duration = 300, delay = 0): Animated.Value {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.timing(opacity, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    });
    anim.start();
    return () => {
      anim.stop();
    };
  }, [opacity, duration, delay]);

  return opacity;
}

export type SlideDirection = 'up' | 'down' | 'left' | 'right';

/**
 * Slide an element from an offset to its resting position on mount.
 * Returns the Animated.Value to bind to the matching `translateX` / `translateY`
 * transform, depending on direction.
 */
export function useSlideIn(
  direction: SlideDirection = 'up',
  duration = 300,
  distance = 40,
  delay = 0,
): Animated.Value {
  const initialValue = direction === 'down' || direction === 'right' ? -distance : distance;
  const animated = useRef(new Animated.Value(initialValue)).current;

  useEffect(() => {
    const anim = Animated.timing(animated, {
      toValue: 0,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    return () => {
      anim.stop();
    };
  }, [animated, duration, delay]);

  return animated;
}

/**
 * Continuous pulse between `from` and `to` scale values.
 * Returns the Animated.Value to bind to a `scale` transform.
 */
export function usePulse(from = 1, to = 1.05, duration = 1000): Animated.Value {
  const pulse = useRef(new Animated.Value(from)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: to,
          duration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: from,
          duration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [pulse, from, to, duration]);

  return pulse;
}

export default { useFadeIn, useSlideIn, usePulse };
