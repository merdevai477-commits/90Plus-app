import React, { useCallback } from 'react';
import { View, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChatComposer, type ChatComposerProps } from './ChatComposer';
import {
  ChatKeyboardStickyView,
  isKeyboardControllerActive,
} from '@/utils/keyboardControllerSafe';

const KEYBOARD_GAP = 8;

export type ChatComposerDockProps = ChatComposerProps & {
  dockPaddingBottom: number;
  /** iOS Expo Go fallback when KeyboardStickyView is unavailable. */
  keyboardLift?: number;
  keyboardVisible?: boolean;
  stickyOpenedOffset?: number;
  /** Reports the floating dock height so content can scroll beneath it. */
  onHeightChange?: (height: number) => void;
};

/**
 * Floats the composer over the bottom of the chat body. KeyboardStickyView
 * moves it with the keyboard when linked; iOS Expo Go lifts it manually.
 */
export function ChatComposerDock({
  dockPaddingBottom,
  keyboardLift = 0,
  keyboardVisible = false,
  stickyOpenedOffset = 0,
  onHeightChange,
  bottomInset: _bottomInset,
  ...composerProps
}: ChatComposerDockProps) {
  const insets = useSafeAreaInsets();
  const floatBottom = Math.max(insets.bottom, 16);
  const useStickyKeyboard = isKeyboardControllerActive;
  const lift = useStickyKeyboard ? 0 : Math.max(0, keyboardLift);
  const keyboardOpen = keyboardVisible || lift > 0;

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      onHeightChange?.(Math.round(e.nativeEvent.layout.height));
    },
    [onHeightChange],
  );

  const node = (
    <View
      collapsable={false}
      pointerEvents="box-none"
      onLayout={handleLayout}
      style={[
        !useStickyKeyboard && [styles.overlay, { bottom: lift }],
        { paddingBottom: keyboardOpen ? dockPaddingBottom : 0 },
      ]}
    >
      <ChatComposer
        {...composerProps}
        bottomInset={keyboardOpen ? KEYBOARD_GAP : floatBottom}
        keyboardVisible={keyboardOpen}
      />
    </View>
  );

  if (!useStickyKeyboard) return node;

  return (
    <ChatKeyboardStickyView
      offset={{ closed: 0, opened: stickyOpenedOffset }}
      pointerEvents="box-none"
      style={styles.overlay}
    >
      {node}
    </ChatKeyboardStickyView>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 40,
  },
});
