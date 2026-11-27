import { useCallback, useEffect, useRef, useState, type MutableRefObject, type RefObject } from 'react';
import { Keyboard, Platform, type KeyboardEvent } from 'react-native';
import type { FlashListRef } from '@shopify/flash-list';

import { isKeyboardControllerActive } from '@/utils/keyboardControllerSafe';
import { safeFlashListScrollToEnd } from '@/components/chat/safeFlashListScroll';

const KEYBOARD_OPEN_GAP = Platform.OS === 'android' ? 0 : 5;
/**
 * Manual composer lift is iOS-only. Android uses adjustResize in app.json and,
 * in dev/production builds, KeyboardStickyView on AI chat and match live chat.
 */
const USE_MANUAL_COMPOSER_LIFT = Platform.OS === 'ios';

/** Retries after show/focus — window resize + FlashList layout settle at different times. */
const SCROLL_RETRY_MS = Platform.OS === 'android' ? [0, 48, 120, 220, 360] : [0, 64, 160];

type UseChatKeyboardParams<TItem> = {
  listRef: RefObject<FlashListRef<TItem> | null>;
  hasMessages: boolean;
  messageCount: number;
  /** When the keyboard opens we pin the thread so the last reply stays above it. */
  isNearBottomRef?: MutableRefObject<boolean>;
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
  isNearBottomRef,
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
  const messageCountRef = useRef(messageCount);
  messageCountRef.current = messageCount;
  const hasMessagesRef = useRef(hasMessages);
  hasMessagesRef.current = hasMessages;
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

  const pinToBottom = useCallback(() => {
    if (isNearBottomRef) isNearBottomRef.current = true;
  }, [isNearBottomRef]);

  const scrollToEnd = useCallback(
    (animated = true) => {
      if (!hasMessagesRef.current || !mountedRef.current) return;
      pinToBottom();
      const run = () => {
        if (!mountedRef.current || !hasMessagesRef.current) return;
        safeFlashListScrollToEnd(listRef.current, animated, {
          itemCount: messageCountRef.current,
        });
      };
      const outer = requestAnimationFrame(() => {
        const inner = requestAnimationFrame(run);
        scrollRafRef.current.push(inner);
      });
      scrollRafRef.current.push(outer);
    },
    [listRef, pinToBottom],
  );

  const scrollToEndRef = useRef(scrollToEnd);
  scrollToEndRef.current = scrollToEnd;

  /** Keep the last reply visible above the keyboard while layout is still settling. */
  const scheduleScrollToEnd = useCallback(
    (animated = false) => {
      clearScrollTimers();
      pinToBottom();
      for (const ms of SCROLL_RETRY_MS) {
        if (ms === 0) {
          scrollToEndRef.current(animated);
          continue;
        }
        scrollTimersRef.current.push(
          setTimeout(() => {
            scrollToEndRef.current(false);
          }, ms),
        );
      }
    },
    [clearScrollTimers, pinToBottom],
  );

  const setHeightIfValid = useCallback((h: number) => {
    if (h <= 0) return;
    setKeyboardHeight((prev) => (Math.abs(prev - h) < 2 ? prev : h));
  }, []);

  const applyKeyboardOpen = useCallback(
    (e?: KeyboardEvent) => {
      keyboardVisibleRef.current = true;
      setKeyboardVisible(true);
      setLayoutEpoch((n) => n + 1);
      const fromEvent = heightFromEvent(e);
      if (fromEvent > 0) {
        setHeightIfValid(fromEvent);
      }
      // Always re-pin the last message above the keyboard — including Android with
      // KeyboardController. Native lift alone still leaves long replies clipped.
      scheduleScrollToEnd(false);
    },
    [scheduleScrollToEnd, setHeightIfValid],
  );

  const applyKeyboardClose = useCallback(() => {
    if (!keyboardVisibleRef.current) return;
    clearSyncTimers();
    clearScrollTimers();
    keyboardVisibleRef.current = false;
    setKeyboardVisible(false);
    setKeyboardHeight(0);
    setLayoutEpoch((n) => n + 1);
  }, [clearScrollTimers, clearSyncTimers]);

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
      clearScrollTimers();
    };
  }, [clearScrollTimers, clearSyncTimers]);

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
    scheduleScrollToEnd(true);
  }, [scheduleHeightSync, scheduleScrollToEnd]);

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
