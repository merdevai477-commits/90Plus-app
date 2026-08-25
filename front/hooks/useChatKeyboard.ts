import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { Keyboard, Platform, type KeyboardEvent } from 'react-native';
import type { FlashListRef } from '@shopify/flash-list';

import { isKeyboardControllerActive } from '@/utils/keyboardControllerSafe';
import { safeFlashListScrollToEnd } from '@/components/chat/safeFlashListScroll';

const KEYBOARD_OPEN_GAP = Platform.OS === 'android' ? 0 : 5;
/**
 * Manual composer lift is iOS-only. Android uses adjustResize in app.json and,
 * in dev/production builds, KeyboardStickyView on match live chat.
 */
const USE_MANUAL_COMPOSER_LIFT = Platform.OS === 'ios';

type UseChatKeyboardParams<TItem> = {
  listRef: RefObject<FlashListRef<TItem> | null>;
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

export function useChatKeyboard<TItem>({
  listRef,
  hasMessages,
  messageCount,
}: UseChatKeyboardParams<TItem>) {
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  /** Bumped on every native keyboard show/hide so consumers relayout with the pan. */
  const [layoutEpoch, setLayoutEpoch] = useState(0);
  const syncTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const scrollTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const scrollRafRef = useRef<number[]>([]);
  const mountedRef = useRef(true);
  const keyboardVisibleRef = useRef(false);
  const lastScrolledCountRef = useRef(0);
  const useExpoKeyboardPath = !isKeyboardControllerActive;
  const useKeyboardAvoiding = false;
  const useNativeKeyboardScroll = isKeyboardControllerActive;

  const clearSyncTimers = useCallback(() => {
    syncTimersRef.current.forEach(clearTimeout);
    syncTimersRef.current = [];
  }, []);

  const clearScrollTimers = useCallback(() => {
    scrollTimersRef.current.forEach(clearTimeout);
    scrollTimersRef.current = [];
    scrollRafRef.current.forEach((id) => cancelAnimationFrame(id));
    scrollRafRef.current = [];
  }, []);

  const scrollToEnd = useCallback(
    (animated = true) => {
      if (!hasMessages || !mountedRef.current) return;
      const run = () => {
        if (!mountedRef.current) return;
        safeFlashListScrollToEnd(listRef.current, animated);
      };
      const outer = requestAnimationFrame(() => {
        const inner = requestAnimationFrame(run);
        scrollRafRef.current.push(inner);
      });
      scrollRafRef.current.push(outer);
      if (Platform.OS === 'android') {
        scrollTimersRef.current.push(setTimeout(run, 120));
        scrollTimersRef.current.push(setTimeout(run, 280));
      }
    },
    [hasMessages, listRef],
  );

  const scrollToEndRef = useRef(scrollToEnd);
  scrollToEndRef.current = scrollToEnd;

  const setHeightIfValid = useCallback((h: number) => {
    if (h <= 0) return;
    setKeyboardHeight((prev) => (Math.abs(prev - h) < 2 ? prev : h));
  }, []);

  const applyKeyboardOpen = useCallback(
    (e?: KeyboardEvent) => {
      keyboardVisibleRef.current = true;
      setKeyboardVisible(true);
      // Always tick — native pan/resize can happen with an unchanged height,
      // and Yoga will not relayout until some React state changes.
      setLayoutEpoch((n) => n + 1);
      const fromEvent = heightFromEvent(e);
      if (fromEvent > 0) {
        setHeightIfValid(fromEvent);
      }
      scrollToEndRef.current(false);
    },
    [setHeightIfValid],
  );

  const applyKeyboardClose = useCallback(() => {
    if (!keyboardVisibleRef.current) return;
    clearSyncTimers();
    keyboardVisibleRef.current = false;
    setKeyboardVisible(false);
    setKeyboardHeight(0);
    setLayoutEpoch((n) => n + 1);
  }, [clearSyncTimers]);

  const applyKeyboardOpenRef = useRef(applyKeyboardOpen);
  const applyKeyboardCloseRef = useRef(applyKeyboardClose);
  applyKeyboardOpenRef.current = applyKeyboardOpen;
  applyKeyboardCloseRef.current = applyKeyboardClose;

  /** iOS only: poll metrics until keyboard animation finishes. Android metrics() on focus is stale/too large. */
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
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearScrollTimers();
    };
  }, [clearScrollTimers]);

  useEffect(() => {
    const subs: { remove: () => void }[] = [];

    const onShow = (e: KeyboardEvent) => applyKeyboardOpenRef.current(e);
    const onHide = () => applyKeyboardCloseRef.current();

    if (Platform.OS === 'ios') {
      subs.push(Keyboard.addListener('keyboardWillShow', onShow));
      subs.push(Keyboard.addListener('keyboardWillHide', onHide));
    } else {
      subs.push(Keyboard.addListener('keyboardDidShow', onShow));
      subs.push(Keyboard.addListener('keyboardDidHide', onHide));
    }

    return () => {
      subs.forEach((s) => s.remove());
      clearSyncTimers();
    };
  }, [clearSyncTimers]);

  useEffect(() => {
    if (!hasMessages) return;
    if (messageCount === lastScrolledCountRef.current) return;
    lastScrolledCountRef.current = messageCount;
    scrollToEndRef.current(false);
  }, [hasMessages, messageCount]);

  const onInputFocus = useCallback(() => {
    // Apply composer padding immediately on focus so Android pan + padding stay
    // in sync (avoids a jump on the first keystroke). Do not read metrics() or
    // set keyboardHeight on Android — lift is iOS-only.
    keyboardVisibleRef.current = true;
    setKeyboardVisible(true);
    setLayoutEpoch((n) => n + 1);
    if (Platform.OS === 'ios') {
      scheduleHeightSync();
    }
    scrollToEndRef.current(true);
  }, [scheduleHeightSync]);

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
    layoutEpoch,
    KEYBOARD_OPEN_GAP,
  };
}
