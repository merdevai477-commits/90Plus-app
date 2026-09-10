jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(), log: jest.fn() },
}));

import { act, renderHook } from '@testing-library/react-hooks';
import * as grouping from '../../utils/matchesGrouping';
import { useLiveDisplayClock } from '../useLiveDisplayClock';
import {
  getSharedSecondTickerListenerCount,
  resetSharedSecondTickerForTests,
} from '../../components/Matches/sharedSecondTicker';

const T0 = Date.parse('2026-09-10T10:00:00.000Z');

const liveInput = {
  fixtureId: '4812183',
  statusShort: '1H' as string | null,
  elapsed: 44 as number | null,
  extra: null as number | null,
  fallbackLabel: "44'",
};

describe('useLiveDisplayClock HT lifecycle', () => {
  const prevFlag = process.env.EXPO_PUBLIC_LIVE_CLOCK_SECONDS;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_LIVE_CLOCK_SECONDS = '1';
    jest.useFakeTimers();
    jest.setSystemTime(T0);
    resetSharedSecondTickerForTests();
  });

  afterEach(() => {
    resetSharedSecondTickerForTests();
    jest.useRealTimers();
    process.env.EXPO_PUBLIC_LIVE_CLOCK_SECONDS = prevFlag;
  });

  it('TEST A — 44:59 → HT unsubscribes the shared ticker and shows HT', () => {
    const { result, rerender } = renderHook(
      (props: typeof liveInput) => useLiveDisplayClock(props),
      { initialProps: liveInput },
    );
    expect(result.current).toBe('44:00');
    expect(getSharedSecondTickerListenerCount()).toBe(1);

    act(() => {
      jest.advanceTimersByTime(59_000);
    });
    expect(result.current).toBe('44:59');

    rerender({
      ...liveInput,
      statusShort: 'HT',
      elapsed: 45,
      fallbackLabel: 'HT',
    });
    expect(result.current).toBe('HT');
    expect(getSharedSecondTickerListenerCount()).toBe(0);

    expect(result.current).toBe('HT');
    expect(getSharedSecondTickerListenerCount()).toBe(0);

    act(() => {
      jest.advanceTimersByTime(31_000);
    });
    rerender({
      ...liveInput,
      statusShort: 'HT',
      elapsed: 45,
      fallbackLabel: 'HT',
    });
    expect(result.current).toBe('HT');
    expect(result.current).not.toBe('45:01');
    expect(getSharedSecondTickerListenerCount()).toBe(0);
  });

  it('TEST B — LIVE 45:00 → HT is HT, not 45:00', () => {
    const { result, rerender } = renderHook(
      (props: typeof liveInput) => useLiveDisplayClock(props),
      {
        initialProps: {
          ...liveInput,
          statusShort: 'LIVE',
          elapsed: 45,
          fallbackLabel: "45'",
        },
      },
    );
    expect(result.current).toBe('45:00');
    rerender({
      ...liveInput,
      statusShort: 'HT',
      elapsed: 45,
      fallbackLabel: "45'",
    });
    expect(result.current).toBe('HT');
    expect(result.current).not.toBe('45:00');
    expect(getSharedSecondTickerListenerCount()).toBe(0);
  });

  it('TEST C — 45+ stoppage → HT', () => {
    const { result, rerender } = renderHook(
      (props: typeof liveInput) => useLiveDisplayClock(props),
      {
        initialProps: {
          ...liveInput,
          statusShort: '1H',
          elapsed: 49,
          extra: 4,
          fallbackLabel: "45+4'",
        },
      },
    );
    expect(result.current).toBe("45+4'");
    expect(getSharedSecondTickerListenerCount()).toBe(0);
    rerender({
      ...liveInput,
      statusShort: 'HT',
      elapsed: 49,
      extra: 4,
      fallbackLabel: "45+4'",
    });
    expect(result.current).toBe('HT');
    expect(getSharedSecondTickerListenerCount()).toBe(0);
  });

  it('TEST D — HT → 2H re-anchors from server elapsed and resumes 1Hz', () => {
    const { result, rerender } = renderHook(
      (props: typeof liveInput) => useLiveDisplayClock(props),
      {
        initialProps: {
          ...liveInput,
          statusShort: 'HT',
          elapsed: 45,
          fallbackLabel: 'HT',
        },
      },
    );
    expect(result.current).toBe('HT');
    expect(getSharedSecondTickerListenerCount()).toBe(0);

    rerender({
      ...liveInput,
      statusShort: '2H',
      elapsed: 46,
      fallbackLabel: "46'",
    });
    expect(result.current).toBe('46:00');
    expect(getSharedSecondTickerListenerCount()).toBe(1);

    act(() => {
      jest.advanceTimersByTime(1_000);
    });
    expect(result.current).toBe('46:01');
  });

  it('TEST F — HT resolve does not mutate the Match object', () => {
    const match = Object.freeze({
      id: '4812183',
      statusShort: 'HT',
      elapsed: 45,
      extra: null as number | null,
    });
    const { result } = renderHook(() =>
      useLiveDisplayClock({
        fixtureId: match.id,
        statusShort: match.statusShort,
        elapsed: match.elapsed,
        extra: match.extra,
        fallbackLabel: 'HT',
      }),
    );
    expect(result.current).toBe('HT');
    expect(match.statusShort).toBe('HT');
    expect(match.elapsed).toBe(45);
  });

  it('TEST G — HT display does not invoke grouping', () => {
    const spy = jest.spyOn(grouping, 'groupMatchesByCountryIncremental');
    const { rerender } = renderHook(
      (props: typeof liveInput) => useLiveDisplayClock(props),
      { initialProps: liveInput },
    );
    rerender({
      ...liveInput,
      statusShort: 'HT',
      elapsed: 45,
      fallbackLabel: 'HT',
    });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
