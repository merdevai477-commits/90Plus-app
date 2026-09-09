import type { FlashListRef } from '@shopify/flash-list';

const FLASH_LIST_SCROLL_RACE =
  /cannot read property 'scrolltoend' of null|scrolltoend.*null|null.*scrolltoend/i;

/** FlashList 2.x can throw asynchronously when the inner scroller unmounts mid-scroll. */
export function isFlashListScrollRaceError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? '');
  return FLASH_LIST_SCROLL_RACE.test(msg);
}

export type StickToBottomOpts = {
  itemCount?: number;
  contentHeight?: number;
  viewportHeight?: number;
};

/** Offset that pins the last pixel of content to the bottom without overscrolling. */
export function chatStickToBottomOffset(contentHeight: number, viewportHeight: number): number {
  if (!Number.isFinite(contentHeight) || !Number.isFinite(viewportHeight) || viewportHeight <= 0) {
    return 0;
  }
  return Math.max(0, contentHeight - viewportHeight);
}

/**
 * Scroll chat lists to the bottom without tripping FlashList's async scrollToEnd race.
 * Use the measured content size when we have it — `MAX_SAFE_INTEGER` overshoots, then
 * the list clamps and the thread jumps upward.
 */
export function safeFlashListScrollToEnd<T>(
  list: FlashListRef<T> | null | undefined,
  animated = false,
  opts?: StickToBottomOpts,
): void {
  if (!list) return;

  const itemCount = opts?.itemCount;
  const lastIndex =
    typeof itemCount === 'number' && Number.isFinite(itemCount) && itemCount > 0
      ? itemCount - 1
      : null;
  const contentHeight = opts?.contentHeight;
  const viewportHeight = opts?.viewportHeight;
  const hasMeasuredSize =
    typeof contentHeight === 'number' &&
    Number.isFinite(contentHeight) &&
    typeof viewportHeight === 'number' &&
    Number.isFinite(viewportHeight) &&
    viewportHeight > 0;

  try {
    if (hasMeasuredSize && typeof list.scrollToOffset === 'function') {
      list.scrollToOffset({
        offset: chatStickToBottomOffset(contentHeight, viewportHeight),
        animated,
      });
      return;
    }

    if (typeof list.scrollToIndex === 'function' && lastIndex != null) {
      list.scrollToIndex({ index: lastIndex, animated, viewPosition: 1 });
      return;
    }

    list.scrollToEnd?.({ animated });
  } catch (error) {
    if (!isFlashListScrollRaceError(error)) {
      // Best-effort scroll — never crash chat on list teardown races.
    }
  }
}
