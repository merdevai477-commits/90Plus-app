/**
 * useHapticFeedback
 *
 * Small hook that wraps `expo-haptics` with a stable, semantic API used
 * across the app (selection, success, error, warning, light/medium/heavy
 * impact). Methods are safe to call on any platform — on web / unsupported
 * devices they become no-ops.
 */

import { useMemo } from 'react';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

export interface HapticFeedback {
  /** Subtle tap (menu/button selection). */
  selection: () => void;
  /** Light impact — similar to a single tap. */
  light: () => void;
  /** Medium impact — stronger confirmation feel. */
  medium: () => void;
  /** Heavy impact — reserved for destructive/long-press actions. */
  heavy: () => void;
  /** Success notification (e.g. after submitting a prediction). */
  success: () => void;
  /** Error notification (e.g. validation failure). */
  error: () => void;
  /** Warning notification. */
  warning: () => void;
  /** Alias: search-bar keystroke feel (light tap). */
  search: () => void;
  /** Alias: card/list-item tap (medium feel). */
  cardTap: () => void;
  /** Unified trigger matching the older useHaptic API. */
  trigger: (type?: 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'error' | 'warning') => void;
}

function safeCall(fn: () => Promise<unknown> | void): void {
  // expo-haptics returns a promise that can reject on unsupported platforms.
  // Swallow errors — haptics are cosmetic and must never crash the app.
  try {
    const result = fn();
    if (result && typeof (result as Promise<unknown>).catch === 'function') {
      (result as Promise<unknown>).catch(() => {});
    }
  } catch {
    /* ignore */
  }
}

export function useHapticFeedback(): HapticFeedback {
  return useMemo<HapticFeedback>(() => {
    // Haptics are a no-op on web
    const supported = Platform.OS === 'ios' || Platform.OS === 'android';

    if (!supported) {
      const noop = () => {};
      return {
        selection: noop,
        light: noop,
        medium: noop,
        heavy: noop,
        success: noop,
        error: noop,
        warning: noop,
        search: noop,
        cardTap: noop,
        trigger: noop,
      };
    }

    const selection = () => safeCall(() => Haptics.selectionAsync());
    const light = () => safeCall(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
    const medium = () => safeCall(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
    const heavy = () => safeCall(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
    const success = () =>
      safeCall(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
    const error = () =>
      safeCall(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
    const warning = () =>
      safeCall(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));

    const trigger: HapticFeedback['trigger'] = (type = 'light') => {
      switch (type) {
        case 'selection':
          selection();
          break;
        case 'medium':
          medium();
          break;
        case 'heavy':
          heavy();
          break;
        case 'success':
          success();
          break;
        case 'error':
          error();
          break;
        case 'warning':
          warning();
          break;
        case 'light':
        default:
          light();
          break;
      }
    };

    return { selection, light, medium, heavy, success, error, warning, trigger, search: light, cardTap: medium };
  }, []);
}

export default useHapticFeedback;
