/**
 * AnimatedCounter — a number that counts up on the UI thread.
 *
 * Uses Reanimated's `useAnimatedProps` to drive an (uncontrolled) `TextInput`'s
 * text directly from a shared value, so the tween runs entirely on the UI thread
 * (no JS-thread `setState` per frame). On mount it counts from 0 → value; when
 * `value` changes it tweens from the previous value to the new one.
 */

import React, { useEffect } from 'react';
import { StyleProp, TextInput, TextStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

export interface AnimatedCounterProps {
  value: number;
  style?: StyleProp<TextStyle>;
  duration?: number;
  /** Optional string appended after the number, e.g. " نقطة". */
  suffix?: string;
}

export function AnimatedCounter({
  value,
  style,
  duration = 850,
  suffix = '',
}: AnimatedCounterProps) {
  const sv = useSharedValue(0);

  useEffect(() => {
    sv.value = withTiming(value, {
      duration,
      easing: Easing.out(Easing.cubic),
    });
  }, [value, duration, sv]);

  const animatedProps = useAnimatedProps(() => {
    return {
      text: `${Math.round(sv.value)}${suffix}`,
      // `defaultValue` keeps types happy for the (web) DOM input.
      defaultValue: `${Math.round(sv.value)}${suffix}`,
    } as unknown as TextInput['props'];
  });

  return (
    <AnimatedTextInput
      editable={false}
      pointerEvents="none"
      underlineColorAndroid="transparent"
      defaultValue={`0${suffix}`}
      animatedProps={animatedProps}
      style={style}
    />
  );
}
