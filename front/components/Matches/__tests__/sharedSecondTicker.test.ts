/**
 * Shared 1Hz ticker — N subscribers, one interval.
 */
import {
  getSharedSecondTickerListenerCount,
  getSharedSecondTickerStartCount,
  isSharedSecondTickerRunning,
  resetSharedSecondTickerForTests,
  subscribeSharedSecondTicker,
} from '../sharedSecondTicker';

describe('sharedSecondTicker', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetSharedSecondTickerForTests();
  });

  afterEach(() => {
    resetSharedSecondTickerForTests();
    jest.useRealTimers();
  });

  it('TEST 11 — 20 live fixtures share a single interval', () => {
    const unsubs = Array.from({ length: 20 }, () => subscribeSharedSecondTicker(() => undefined));
    expect(getSharedSecondTickerListenerCount()).toBe(20);
    expect(isSharedSecondTickerRunning()).toBe(true);
    expect(getSharedSecondTickerStartCount()).toBe(1);
    unsubs.forEach((u) => u());
    expect(getSharedSecondTickerListenerCount()).toBe(0);
    expect(isSharedSecondTickerRunning()).toBe(false);
  });

  it('TEST 12 — leaving and returning does not multiply timers', () => {
    const first = Array.from({ length: 5 }, () => subscribeSharedSecondTicker(() => undefined));
    expect(getSharedSecondTickerStartCount()).toBe(1);
    first.forEach((u) => u());
    expect(isSharedSecondTickerRunning()).toBe(false);

    const second = Array.from({ length: 5 }, () => subscribeSharedSecondTicker(() => undefined));
    expect(getSharedSecondTickerStartCount()).toBe(2);
    expect(isSharedSecondTickerRunning()).toBe(true);
    second.forEach((u) => u());
    expect(isSharedSecondTickerRunning()).toBe(false);
  });

  it('notifies all listeners once per second', () => {
    const a = jest.fn();
    const b = jest.fn();
    const ua = subscribeSharedSecondTicker(a);
    const ub = subscribeSharedSecondTicker(b);
    jest.advanceTimersByTime(3000);
    expect(a).toHaveBeenCalledTimes(3);
    expect(b).toHaveBeenCalledTimes(3);
    ua();
    ub();
  });
});
