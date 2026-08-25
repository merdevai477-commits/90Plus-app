import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChatComposer, type ChatComposerProps } from './ChatComposer';

export type ChatComposerDockProps = ChatComposerProps & {
  dockPaddingBottom: number;
  /** Lifts composer above keyboard (all platforms). */
  keyboardLift?: number;
};

/**
 * Composer always in document flow — reliable across Expo Go, emulators, and devices.
 */
export function ChatComposerDock({
  dockPaddingBottom,
  keyboardLift = 0,
  bottomInset: _bottomInset,
  ...composerProps
}: ChatComposerDockProps) {
  const insets = useSafeAreaInsets();
  const safeBottom = Math.max(insets.bottom, 8);
  const lift = Math.max(0, keyboardLift);

  return (
    <View
      style={[
        styles.dock,
        {
          paddingBottom: dockPaddingBottom,
          marginBottom: lift,
        },
      ]}
    >
      <ChatComposer {...composerProps} bottomInset={lift > 0 ? 0 : safeBottom} />
    </View>
  );
}

const styles = StyleSheet.create({
  dock: {
    flexShrink: 0,
    zIndex: 40,
    backgroundColor: '#050208',
  },
});
