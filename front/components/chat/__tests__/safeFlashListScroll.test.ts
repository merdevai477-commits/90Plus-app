import {
  chatStickToBottomOffset,
  safeFlashListScrollToEnd,
} from '../safeFlashListScroll';

describe('chatStickToBottomOffset', () => {
  it('is 0 when the thread still fits on screen', () => {
    expect(chatStickToBottomOffset(400, 600)).toBe(0);
  });

  it('is the overflow when the thread is taller than the viewport', () => {
    expect(chatStickToBottomOffset(1000, 600)).toBe(400);
  });

  it('never goes negative', () => {
    expect(chatStickToBottomOffset(-10, 600)).toBe(0);
  });
});

describe('safeFlashListScrollToEnd', () => {
  it('scrolls to the measured bottom instead of overshooting', () => {
    const scrollToOffset = jest.fn();
    const scrollToIndex = jest.fn();
    const scrollToEnd = jest.fn();
    safeFlashListScrollToEnd(
      { scrollToOffset, scrollToIndex, scrollToEnd } as never,
      false,
      { contentHeight: 1000, viewportHeight: 600, itemCount: 4 },
    );
    expect(scrollToOffset).toHaveBeenCalledWith({ offset: 400, animated: false });
    expect(scrollToIndex).not.toHaveBeenCalled();
    expect(scrollToEnd).not.toHaveBeenCalled();
  });

  it('stays at 0 when the first reply is shorter than the screen', () => {
    const scrollToOffset = jest.fn();
    safeFlashListScrollToEnd({ scrollToOffset } as never, false, {
      contentHeight: 280,
      viewportHeight: 640,
    });
    expect(scrollToOffset).toHaveBeenCalledWith({ offset: 0, animated: false });
  });

  it('falls back to the last item when size is unknown', () => {
    const scrollToIndex = jest.fn();
    const scrollToEnd = jest.fn();
    safeFlashListScrollToEnd({ scrollToIndex, scrollToEnd } as never, false, { itemCount: 3 });
    expect(scrollToIndex).toHaveBeenCalledWith({ index: 2, animated: false, viewPosition: 1 });
    expect(scrollToEnd).not.toHaveBeenCalled();
  });
});
