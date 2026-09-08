import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChatComposer, type ChatComposerProps } from './ChatComposer';
import {
  ChatKeyboardStickyView,
  isKeyboardControllerActive,
} from '@/utils/keyboardControllerSafe';

export type ChatComposerDockProps = ChatComposerProps & {
  dockPaddingBottom: number;
  /** iOS Expo Go fallback when KeyboardStickyView is unavailable. */
  keyboardLift?: number;
  keyboardVisible?: boolean;
  stickyOpenedOffset?: number;
};

/**
 * Same keyboard dock as match live chat: KeyboardStickyView when linked,
 * iOS manual lift as fallback. Composer stays in document flow otherwise.
 */
export function ChatComposerDock({
  dockPaddingBottom,
  keyboardLift = 0,
  keyboardVisible = false,
  stickyOpenedOffset = 0,
  bottomInset: _bottomInset,
  ...composerProps
}: ChatComposerDockProps) {
  const insets = useSafeAreaInsets();
  const safeBottom = Math.max(insets.bottom, 8);
  const useStickyKeyboard = isKeyboardControllerActive;
  const lift = useStickyKeyboard ? 0 : Math.max(0, keyboardLift);
  const keyboardOpen = keyboardVisible || lift > 0;

  const node = (
    <View
      collapsable={false}
      style={[
        styles.dock,
        {
          paddingBottom: keyboardOpen ? dockPaddingBottom : 0,
          marginBottom: lift,
        },
      ]}
    >
      <ChatComposer
        {...composerProps}
        bottomInset={keyboardOpen ? 0 : safeBottom}
        keyboardVisible={keyboardOpen}
      />
    </View>
  );

  if (!useStickyKeyboard) return node;

  return (
    <ChatKeyboardStickyView
      offset={{ closed: 0, opened: stickyOpenedOffset }}
      style={styles.sticky}
    >
      {node}
    </ChatKeyboardStickyView>
  );
}

const styles = StyleSheet.create({
  sticky: {
    flexShrink: 0,
    width: '100%',
    zIndex: 40,
  },
  dock: {
    flexShrink: 0,
    zIndex: 40,
    backgroundColor: '#07040D',
  },
});
