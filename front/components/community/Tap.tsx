import React, { useState } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  pressedStyle?: StyleProp<ViewStyle>;
};

const DEFAULT_PRESSED: ViewStyle = { opacity: 0.75 };

/**
 * Pressable with pressed feedback. NativeWind's JSX interop drops the
 * `style={({ pressed }) => …}` callback form, so pressed state is tracked here.
 */
export function Tap({ style, pressedStyle = DEFAULT_PRESSED, onPressIn, onPressOut, ...rest }: Props) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      {...rest}
      onPressIn={(e) => {
        setPressed(true);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressed(false);
        onPressOut?.(e);
      }}
      style={[style, pressed && pressedStyle]}
    />
  );
}
