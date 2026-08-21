import type { FlashListRef } from '@shopify/flash-list';

/** FlashList 2.0.2 can throw if the inner scroller is null after unmount. */
export function safeFlashListScrollToEnd<T>(
  list: FlashListRef<T> | null | undefined,
  animated = false,
): void {
  try {
    list?.scrollToEnd?.({ animated });
  } catch {
    // Inner scrollViewRef is null — ignore.
  }
}
