jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(), log: jest.fn() },
}));

import { act, renderHook } from '@testing-library/react-hooks';
import {
  resetSharedSecondTickerForTests,
  subscribeSharedSecondTicker,
} from '../../components/Matches/sharedSecondTicker';
import { useLiveDisplayClock } from '../../hooks/useLiveDisplayClock';
import { resolveLiveDisplayClock } from '../liveDisplayClock';
import {
  CLOCK_BASELINE_CAPACITY,
  computePresentationDrift,
  computeTickJitter,
  exportClockBaselineJsonl,
  isClockBaselineEnabled,
  noteAppState,
  noteDetailsHeaderRender,
  noteListMinute,
  noteLiveRowMounted,
  parseDisplayedMinute,
  recordTickerSample,
  resetClockBaselineForTests,
  setClockBaselineFocusedFixtureForTests,
} from '../clockBaseline';

const T0 = Date.parse('2026-09-10T10:00:00.000Z');

function events(): Array<Record<string, unknown>> {
  const raw = exportClockBaselineJsonl();
  if (!raw) return [];
  return raw.split('\n').map((line) => JSON.parse(line) as Record<string, unknown>);
}

describe('clockBaseline', () => {
  const previous = process.env.EXPO_PUBLIC_CLOCK_BASELINE;

  beforeEach(() => {
    delete process.env.EXPO_PUBLIC_CLOCK_BASELINE;
    resetClockBaselineForTests();
    resetSharedSecondTickerForTests();
  });

  afterEach(() => {
    resetClockBaselineForTests();
    resetSharedSecondTickerForTests();
    if (previous == null) delete process.env.EXPO_PUBLIC_CLOCK_BASELINE;
    else process.env.EXPO_PUBLIC_CLOCK_BASELINE = previous;
    jest.restoreAllMocks();
  });

  it('stays disabled unless the flag is 1 or true', () => {
    expect(isClockBaselineEnabled()).toBe(false);
    process.env.EXPO_PUBLIC_CLOCK_BASELINE = '0';
    expect(isClockBaselineEnabled()).toBe(false);
    process.env.EXPO_PUBLIC_CLOCK_BASELINE = '1';
    expect(isClockBaselineEnabled()).toBe(true);
    process.env.EXPO_PUBLIC_CLOCK_BASELINE = 'true';
    expect(isClockBaselineEnabled()).toBe(true);
  });

  it('records nothing while the flag is off', () => {
    recordTickerSample(4);
    noteDetailsHeaderRender();
    noteListMinute('9', "67'", 67);
    noteAppState('background');
    expect(exportClockBaselineJsonl()).toBe('');
    expect((globalThis as { __dumpClockBaseline?: () => string }).__dumpClockBaseline).toBeUndefined();
  });

  it('computes tick jitter and missed gaps from monotonic timestamps', () => {
    expect(computeTickJitter(null, 5_000)).toEqual({
      expectedMono: 5_000,
      jitterMs: 0,
      missedTicks: 0,
      gapMs: null,
    });
    expect(computeTickJitter(1_000, 2_000)).toMatchObject({ jitterMs: 0, missedTicks: 0, gapMs: 1000 });
    expect(computeTickJitter(1_000, 2_080)).toMatchObject({
      expectedMono: 2_000,
      jitterMs: 80,
      missedTicks: 0,
    });
    expect(computeTickJitter(1_000, 2_500)).toMatchObject({ missedTicks: 1, jitterMs: 500 });
    expect(computeTickJitter(0, 3_500).missedTicks).toBe(3);
  });

  it('computes presentation drift against resolveLiveDisplayClock and does not change that result', () => {
    const input = {
      fixtureId: '4812183',
      statusShort: '2H',
      elapsed: 51,
      extra: null,
      fallbackLabel: "51'",
    };
    const resolved = resolveLiveDisplayClock({ ...input, nowMs: T0 + 3_000, anchorMs: T0 });
    expect(resolved.label).toBe('50:03');
    expect(resolved.displaySeconds).toBe(50 * 60 + 3);
    const matched = computePresentationDrift({
      nowMs: T0 + 3_000,
      anchorMs: T0,
      actualDisplaySeconds: resolved.displaySeconds,
      input,
    });
    expect(matched.expectedDisplaySeconds).toBe(resolved.displaySeconds);
    expect(matched.driftMs).toBe(0);
    const ahead = computePresentationDrift({
      nowMs: T0 + 3_000,
      anchorMs: T0,
      actualDisplaySeconds: (resolved.displaySeconds ?? 0) + 2,
      input,
    });
    expect(ahead.driftMs).toBe(2_000);
    expect(resolveLiveDisplayClock({ ...input, nowMs: T0 + 3_000, anchorMs: T0 }).label).toBe('50:03');
  });

  it('keeps at most 2000 events', () => {
    process.env.EXPO_PUBLIC_CLOCK_BASELINE = '1';
    for (let i = 0; i < CLOCK_BASELINE_CAPACITY + 25; i += 1) {
      recordTickerSample(1);
    }
    const lines = exportClockBaselineJsonl().split('\n');
    expect(lines).toHaveLength(CLOCK_BASELINE_CAPACITY);
    expect(JSON.parse(lines[lines.length - 1]).type).toBe('tick');
    expect(JSON.parse(lines[0]).type).not.toBe('session');
  });

  it('records one tick for many subscribers and flushes render counters on the existing cadence', () => {
    jest.useFakeTimers();
    process.env.EXPO_PUBLIC_CLOCK_BASELINE = '1';
    const unsubs = [subscribeSharedSecondTicker(() => undefined), subscribeSharedSecondTicker(() => undefined)];
    act(() => {
      jest.advanceTimersByTime(2_000);
    });
    const ticks = events().filter((event) => event.type === 'tick');
    expect(ticks).toHaveLength(2);
    expect(ticks[0].subscribers).toBe(2);
    expect(ticks[1].subscribers).toBe(2);
    unsubs.forEach((unsubscribe) => unsubscribe());
    jest.useRealTimers();

    resetClockBaselineForTests();
    process.env.EXPO_PUBLIC_CLOCK_BASELINE = '1';
    let mono = 10_000;
    jest.spyOn(performance, 'now').mockImplementation(() => mono);
    noteLiveRowMounted('11');
    noteListMinute('11', '64\'', 67);
    noteListMinute('12', 'HT', null);
    expect(parseDisplayedMinute('90+3\'')).toBe(90);
    expect(parseDisplayedMinute('HT')).toBeNull();
    mono = 40_000;
    noteDetailsHeaderRender();
    const flush = events().filter((event) => event.type === 'render_counters').pop();
    expect(flush).toMatchObject({
      detailsHeader: 1,
      visibleLiveFixtures: 1,
      listCompared: 1,
      listMismatch: 1,
      listMaxAbsDeltaMin: 3,
    });
    expect(flush?.listSamples).toEqual([
      { fixtureId: '11', displayedMinute: 64, serverElapsed: 67, deltaMin: -3 },
    ]);
  });

  it('records background and the first post-foreground sample without counting the gap as jitter', () => {
    process.env.EXPO_PUBLIC_CLOCK_BASELINE = '1';
    let mono = 1_000;
    jest.spyOn(performance, 'now').mockImplementation(() => mono);
    recordTickerSample(1);
    mono = 2_000;
    noteAppState('background');
    mono = 62_000;
    noteAppState('active');
    mono = 62_040;
    recordTickerSample(1);
    const rows = events();
    const background = rows.find((event) => event.type === 'app_state' && event.next === 'background');
    const resume = rows.find((event) => event.type === 'tick' && event.resumedFromBackground === true);
    expect(background?.lastTickBeforeBackgroundMono).toBe(1_000);
    expect(resume).toMatchObject({
      missedTicks: 0,
      jitterMs: 0,
      foregroundRecoveryMs: 40,
      subscribers: 1,
    });
    expect(resume?.rawJitterMs).toBe(60_040);
  });

  it('does not change the hook label when baseline recording is on', () => {
    process.env.EXPO_PUBLIC_CLOCK_BASELINE = '1';
    process.env.EXPO_PUBLIC_LIVE_CLOCK_SECONDS = '1';
    jest.useFakeTimers();
    jest.setSystemTime(T0);
    setClockBaselineFocusedFixtureForTests('4812183');
    const { result } = renderHook(() =>
      useLiveDisplayClock({
        fixtureId: '4812183',
        statusShort: '2H',
        elapsed: 46,
        extra: null,
        fallbackLabel: "46'",
      }),
    );
    expect(result.current).toBe('45:00');
    const clock = events().find((event) => event.type === 'clock');
    expect(clock).toMatchObject({
      fixtureId: '4812183',
      actualDisplaySeconds: 45 * 60,
      expectedDisplaySeconds: 45 * 60,
      driftMs: 0,
      serverElapsed: 46,
    });
    setClockBaselineFocusedFixtureForTests(undefined);
    jest.useRealTimers();
  });
});
