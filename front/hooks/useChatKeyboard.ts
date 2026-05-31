import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, type KeyboardEvent } from 'react-native';
import type { FlashListRef } from '@shopify/flash-list';

import type { Message } from './useAIChatNative';
import { isKeyboardControllerActive } from '@/utils/keyboardControllerSafe';

const KEYBOARD_OPEN_GAP = 4;
/** Manual composer lift on iOS and Android (keyboard-controller handles scroll). */
const USE_MANUAL_COMPOSER_LIFT = Platform.OS === 'ios' || Platform.OS === 'android';

type UseChatKeyboardParams = {
  listRef: React.RefObject<FlashListRef<Message> | null>;
  hasMessages: boolean;
  messageCount: number;
};

/** Only trust event coordinates — metrics() on Android focus is often stale/too large. */
function heightFromEvent(e?: KeyboardEvent): number {
  const h = e?.endCoordinates?.height ?? 0;
  return h > 0 ? h : 0;
}

function heightFromMetrics(): number {
  const h = Keyboard.metrics()?.height ?? 0;
  return h > 0 ? h : 0;
}

export function useChatKeyboard({ listRef, hasMessages, messageCount }: UseChatKeyboardParams) {
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const syncTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const useExpoKeyboardPath = !isKeyboardControllerActive;
  const useKeyboardAvoiding = false;
  const useNativeKeyboardScroll = isKeyboardControllerActive;

  const clearSyncTimers = useCallback(() => {
    syncTimersRef.current.forEach(clearTimeout);
    syncTimersRef.current = [];
  }, []);

  const scrollToEnd = useCallback(
    (animated = true) => {
      if (!hasMessages) return;
      const run = () => listRef.current?.scrollToEnd({ animated });
      requestAnimationFrame(() => requestAnimationFrame(run));
      if (Platform.OS === 'android') {
        setTimeout(() => listRef.current?.scrollToEnd({ animated }), 120);
        setTimeout(() => listRef.current?.scrollToEnd({ animated }), 280);
      }
    },
    [hasMessages, listRef],
  );

  const setHeightIfValid = useCallback((h: number) => {
    if (h <= 0) return;
    setKeyboardHeight((prev) => (Math.abs(prev - h) < 2 ? prev : h));
  }, []);

  const applyKeyboardOpen = useCallback(
    (e?: KeyboardEvent) => {
      setKeyboardVisible(true);
      const fromEvent = heightFromEvent(e);
      if (fromEvent > 0) {
        setHeightIfValid(fromEvent);
        scrollToEnd(false);
      }
    },
    [scrollToEnd, setHeightIfValid],
  );

  const applyKeyboardClose = useCallback(() => {
    clearSyncTimers();
    setKeyboardVisible(false);
    setKeyboardHeight(0);
  }, [clearSyncTimers]);

  /** iOS only: poll metrics until keyboard animation finishes. */
  const scheduleHeightSync = useCallback(() => {
    if (!USE_MANUAL_COMPOSER_LIFT) return;
    clearSyncTimers();
    const trySync = () => {
      const h = heightFromMetrics();
      if (h > 0) setHeightIfValid(h);
    };
    requestAnimationFrame(trySync);
    [50, 120, 220, 360].forEach((ms) => {
      syncTimersRef.current.push(setTimeout(trySync, ms));
    });
  }, [clearSyncTimers, setHeightIfValid]);

  useEffect(() => {
    const subs: { remove: () => void }[] = [];

    if (Platform.OS === 'ios') {
      subs.push(Keyboard.addListener('keyboardWillShow', applyKeyboardOpen));
      subs.push(Keyboard.addListener('keyboardWillHide', applyKeyboardClose));
    } else {
      subs.push(Keyboard.addListener('keyboardDidShow', applyKeyboardOpen));
      subs.push(Keyboard.addListener('keyboardDidHide', applyKeyboardClose));
    }

    return () => {
      subs.forEach((s) => s.remove());
      clearSyncTimers();
    };
  }, [applyKeyboardOpen, applyKeyboardClose, clearSyncTimers]);

  useEffect(() => {
    if (!hasMessages) return;
    scrollToEnd(false);
  }, [hasMessages, messageCount, scrollToEnd]);

  const onInputFocus = useCallback(() => {
    setKeyboardVisible(true);
    scheduleHeightSync();
    scrollToEnd(true);
  }, [scheduleHeightSync, scrollToEnd]);

  const syncKeyboardHeight = useCallback(() => {
    if (!USE_MANUAL_COMPOSER_LIFT) return;
    const h = heightFromMetrics();
    if (h > 0) setHeightIfValid(h);
  }, [setHeightIfValid]);

  const composerDockPadding = keyboardVisible ? KEYBOARD_OPEN_GAP : 0;

  const composerKeyboardLift =
    USE_MANUAL_COMPOSER_LIFT && keyboardVisible && keyboardHeight > 0
      ? keyboardHeight
      : 0;

  return {
    keyboardVisible,
    keyboardHeight,
    onInputFocus,
    syncKeyboardHeight,
    scrollToEnd,
    useExpoKeyboardPath,
    useKeyboardAvoiding,
    useNativeKeyboardScroll,
    composerDockPadding,
    composerKeyboardLift,
    KEYBOARD_OPEN_GAP,
  };
}
