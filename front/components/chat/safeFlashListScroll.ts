import type { FlashListRef } from '@shopify/flash-list';

const FLASH_LIST_SCROLL_RACE =
  /cannot read property 'scrolltoend' of null|scrolltoend.*null|null.*scrolltoend/i;

/** FlashList 2.x can throw asynchronously when the inner scroller unmounts mid-scroll. */
export function isFlashListScrollRaceError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? '');
  return FLASH_LIST_SCROLL_RACE.test(msg);
}

/**
 * Scroll chat lists to the bottom without tripping FlashList's async scrollToEnd race.
 * Prefer scrollToOffset — scrollToEnd schedules an internal timeout that can NPE after unmount.
 */
export function safeFlashListScrollToEnd<T>(
  list: FlashListRef<T> | null | undefined,
  animated = false,
): void {
  if (!list) return;

  try {
    if (typeof list.scrollToOffset === 'function') {
      list.scrollToOffset({ offset: Number.MAX_SAFE_INTEGER, animated });
      return;
    }
    list.scrollToEnd?.({ animated });
  } catch (error) {
    if (!isFlashListScrollRaceError(error)) {
      // Best-effort scroll — never crash chat on list teardown races.
    }
  }
}
