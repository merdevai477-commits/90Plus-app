import React, { useCallback } from 'react';
import { View, StyleSheet, Platform, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';

import { ChatComposer, type ChatComposerProps } from './ChatComposer';
import {
  ChatKeyboardStickyView,
  isKeyboardControllerActive,
} from '@/utils/keyboardControllerSafe';

const KEYBOARD_GAP = 8;
/** Extra height above the safe area so the capsule visibly hovers off the screen edge. */
const FLOAT_LIFT = 46;
/** Height above the dock over which the frost fades in, so messages don't hit a hard edge. */
const BACKDROP_FEATHER = 28;
/** The chat background's bottom colour, laid over the frost so scrolled text stays unreadable. */
const BACKDROP_TINT = 'rgba(6,5,9,0.55)';
const BACKDROP_TINT_CLEAR = 'rgba(6,5,9,0)';

/** Frosts the messages that scroll beneath the composer. */
function ComposerBackdrop({ blurTarget }: { blurTarget?: React.RefObject<View | null> }) {
  const frost = (
    <>
      <BlurView
        intensity={Platform.OS === 'ios' ? 24 : 32}
        tint="dark"
        blurMethod="dimezisBlurViewSdk31Plus"
        blurTarget={blurTarget}
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: BACKDROP_TINT }]} />
    </>
  );

  if (Platform.OS === 'ios') {
    return (
      <MaskedView
        pointerEvents="none"
        style={styles.backdrop}
        maskElement={
          <View style={styles.maskColumn}>
            <LinearGradient colors={['transparent', 'black']} style={styles.feather} />
            <View style={styles.maskSolid} />
          </View>
        }
      >
        {frost}
      </MaskedView>
    );
  }

  // Android's target-based blur can't render inside a mask, so only the tint feathers.
  return (
    <View pointerEvents="none" style={styles.backdrop}>
      <LinearGradient colors={[BACKDROP_TINT_CLEAR, BACKDROP_TINT]} style={styles.feather} />
      <View style={styles.maskColumn}>{frost}</View>
    </View>
  );
}

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
  const floatBottom = Math.max(insets.bottom, 16) + FLOAT_LIFT;
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
      <ComposerBackdrop blurTarget={composerProps.blurTarget} />
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
  backdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -BACKDROP_FEATHER,
    bottom: 0,
  },
  maskColumn: {
    flex: 1,
  },
  feather: {
    height: BACKDROP_FEATHER,
  },
  maskSolid: {
    flex: 1,
    backgroundColor: 'black',
  },
});
