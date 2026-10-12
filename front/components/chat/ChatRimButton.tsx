import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { IridescentRim } from './IridescentRim';
import { chatColors } from './chatTheme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type ChatRimButtonProps = {
  onPress: () => void;
  accessibilityLabel: string;
  size?: number;
  children: React.ReactNode;
};

/** Round black-glass button with the welcome bubble's iridescent rim. */
export function ChatRimButton({ onPress, accessibilityLabel, size = 42, children }: ChatRimButtonProps) {
  const press = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));
  const radius = size / 2;

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => { press.value = withTiming(0.92, { duration: 90 }); }}
      onPressOut={() => { press.value = withTiming(1, { duration: 140 }); }}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[styles.button, { width: size, height: size, borderRadius: radius }, pressStyle]}
    >
      <IridescentRim radius={radius} />
      {children}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: chatColors.rimButtonCore,
  },
});
