import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { ChatKeyboardStickyView, isKeyboardControllerActive } from '../../utils/keyboardControllerSafe';
import { useKeyboardHeight } from '../../hooks/community/useKeyboardHeight';

/**
 * Pins its children above the keyboard: keyboard-controller's sticky view in
 * dev/prod builds, a keyboard-height spacer where the native module is absent.
 */
export function KeyboardDock({
  children,
  style,
  bottomInset = 0,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  bottomInset?: number;
}) {
  const fallbackHeight = useKeyboardHeight(!isKeyboardControllerActive);
  if (isKeyboardControllerActive) {
    return (
      <ChatKeyboardStickyView style={style} offset={{ closed: 0, opened: bottomInset }}>
        {children}
      </ChatKeyboardStickyView>
    );
  }
  return <View style={[style, { marginBottom: fallbackHeight > 0 ? fallbackHeight - bottomInset : 0 }]}>{children}</View>;
}
