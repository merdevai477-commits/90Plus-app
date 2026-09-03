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
 * Prefer scrollToOffset (avoids FlashList scrollToEnd async NPE races).
 */
export function safeFlashListScrollToEnd<T>(
  list: FlashListRef<T> | null | undefined,
  animated = false,
  opts?: { itemCount?: number },
): void {
  if (!list) return;

  const itemCount = opts?.itemCount;
  const lastIndex =
    typeof itemCount === 'number' && Number.isFinite(itemCount) && itemCount > 0
      ? itemCount - 1
      : null;

  try {
    if (typeof list.scrollToOffset === 'function') {
      list.scrollToOffset({ offset: Number.MAX_SAFE_INTEGER, animated });
      return;
    }

    if (typeof list.scrollToIndex === 'function' && lastIndex != null) {
      list.scrollToIndex({ index: lastIndex, animated });
      return;
    }

    list.scrollToEnd?.({ animated });
  } catch (error) {
    if (!isFlashListScrollRaceError(error)) {
      // Best-effort scroll — never crash chat on list teardown races.
    }
  }
}
