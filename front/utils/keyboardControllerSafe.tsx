/**
 * Lazy bridge — avoids crashing Expo Go on import of react-native-keyboard-controller.
 * No custom keyboard logic; passes through to the library when native module is linked.
 */

import React, { forwardRef } from 'react';
import {
  View,
  ScrollView,
  TurboModuleRegistry,
  Platform,
  type ScrollViewProps,
  type ViewProps,
} from 'react-native';
import type Reanimated from 'react-native-reanimated';
import Constants from 'expo-constants';

function isKeyboardControllerLinked(): boolean {
  if (Constants.appOwnership === 'expo') {
    return false;
  }
  try {
    return TurboModuleRegistry.get('KeyboardController') != null;
  } catch {
    return false;
  }
}

const linked = isKeyboardControllerLinked();

export { isKeyboardControllerLinked };
export const isKeyboardControllerActive = linked;

type ProviderProps = {
  children: React.ReactNode;
};

export function AppKeyboardProvider({ children }: ProviderProps) {
  if (!linked) {
    return <>{children}</>;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { KeyboardProvider } =
      require('react-native-keyboard-controller') as typeof import('react-native-keyboard-controller');
    return <KeyboardProvider>{children}</KeyboardProvider>;
  } catch {
    return <>{children}</>;
  }
}

type StickyProps = ViewProps & {
  children?: React.ReactNode;
  enabled?: boolean;
  offset?: { closed?: number; opened?: number };
};

/** Pass-through KeyboardStickyView when native module is linked, else plain View. */
export function ChatKeyboardStickyView({ children, ...props }: StickyProps) {
  if (!linked) {
    return <View {...props}>{children}</View>;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { KeyboardStickyView } =
      require('react-native-keyboard-controller') as typeof import('react-native-keyboard-controller');
    return <KeyboardStickyView {...props}>{children}</KeyboardStickyView>;
  } catch {
    return <View {...props}>{children}</View>;
  }
}

type ChatScrollProps = ScrollViewProps & {
  inverted?: boolean;
  keyboardLiftBehavior?: 'always' | 'whenAtEnd' | 'persistent' | 'never';
  offset?: number;
  extraContentPadding?: import('react-native-reanimated').SharedValue<number>;
  applyWorkaroundForContentInsetHitTestBug?: boolean;
};

/** Pass-through KeyboardChatScrollView, or ScrollView in Expo Go. */
export const ChatKeyboardScrollView = forwardRef<
  Reanimated.ScrollView,
  ChatScrollProps
>((props, ref) => {
  if (!linked) {
    return <ScrollView ref={ref as React.Ref<ScrollView>} {...props} />;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { KeyboardChatScrollView } =
      require('react-native-keyboard-controller') as typeof import('react-native-keyboard-controller');
    return <KeyboardChatScrollView ref={ref} {...props} />;
  } catch {
    return <ScrollView ref={ref as React.Ref<ScrollView>} {...props} />;
  }
});

ChatKeyboardScrollView.displayName = 'ChatKeyboardScrollView';
