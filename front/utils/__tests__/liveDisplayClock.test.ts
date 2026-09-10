jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(), log: jest.fn() },
}));

import * as grouping from '../matchesGrouping';
import {
  formatMmSs,
  isLiveClockSecondsEnabled,
  liveDisplayClockIdentity,
  liveDisplayClockShouldTick,
  nextLiveDisplayAnchorMs,
  resolveLiveDisplayClock,
} from '../liveDisplayClock';

const T0 = Date.parse('2026-09-10T10:00:00.000Z');

function clock(partial: {
  fixtureId?: string;
  statusShort?: string;
  elapsed?: number | null;
  extra?: number | null;
  fallbackLabel?: string;
  nowMs: number;
  anchorMs: number;
}) {
  return resolveLiveDisplayClock({
    fixtureId: partial.fixtureId ?? '4812183',
    statusShort: partial.statusShort ?? '2H',
    elapsed: partial.elapsed ?? 51,
    extra: partial.extra ?? null,
    fallbackLabel: partial.fallbackLabel ?? "51'",
    nowMs: partial.nowMs,
    anchorMs: partial.anchorMs,
  });
}

describe('liveDisplayClock presentation', () => {
  it('TEST 1 — basic ticking 51:00 → 51:03', () => {
    expect(clock({ nowMs: T0, anchorMs: T0 }).label).toBe('51:00');
    expect(clock({ nowMs: T0 + 3_000, anchorMs: T0 }).label).toBe('51:03');
  });

  it('TEST 2 — 51:59 + 1s = 52:00, never 51:60', () => {
    expect(clock({ nowMs: T0 + 59_000, anchorMs: T0 }).label).toBe('51:59');
    expect(clock({ nowMs: T0 + 60_000, anchorMs: T0 }).label).toBe('52:00');
    expect(formatMmSs(51 * 60 + 60)).toBe('52:00');
    expect(formatMmSs(51 * 60 + 59)).not.toBe('51:60');
  });

  it('TEST 3 — server elapsed 52 re-anchors to 52:00', () => {
    const local = clock({ elapsed: 51, nowMs: T0 + 42_000, anchorMs: T0 });
    expect(local.label).toBe('51:42');
    const identityAfter = liveDisplayClockIdentity({
      fixtureId: '4812183',
      statusShort: '2H',
      elapsed: 52,
      extra: null,
    });
    const prevIdentity = liveDisplayClockIdentity({
      fixtureId: '4812183',
      statusShort: '2H',
      elapsed: 51,
      extra: null,
    });
    const next = nextLiveDisplayAnchorMs({
      identity: identityAfter,
      prevIdentity,
      prevAnchorMs: T0,
      nowMs: T0 + 42_000,
    });
    expect(next.reanchored).toBe(true);
    expect(clock({ elapsed: 52, nowMs: next.anchorMs, anchorMs: next.anchorMs }).label).toBe(
      '52:00',
    );
  });

  it('TEST 4 — server correction 57:30 → elapsed 56 becomes 56:00', () => {
    expect(clock({ elapsed: 57, nowMs: T0 + 30_000, anchorMs: T0 }).label).toBe('57:30');
    const next = nextLiveDisplayAnchorMs({
      identity: liveDisplayClockIdentity({
        fixtureId: '1',
        statusShort: '2H',
        elapsed: 56,
        extra: null,
      }),
      prevIdentity: liveDisplayClockIdentity({
        fixtureId: '1',
        statusShort: '2H',
        elapsed: 57,
        extra: null,
      }),
      prevAnchorMs: T0,
      nowMs: T0 + 30_000,
    });
    expect(clock({ elapsed: 56, nowMs: next.anchorMs, anchorMs: next.anchorMs }).label).toBe(
      '56:00',
    );
  });

  it('TEST 5 — HT 45 does not tick', () => {
    const a = clock({
      statusShort: 'HT',
      elapsed: 45,
      fallbackLabel: 'HT',
      nowMs: T0,
      anchorMs: T0,
    });
    const b = clock({
      statusShort: 'HT',
      elapsed: 45,
      fallbackLabel: 'HT',
      nowMs: T0 + 30_000,
      anchorMs: T0,
    });
    expect(a.label).toBe('HT');
    expect(b.label).toBe('HT');
    expect(a.ticking).toBe(false);
    expect(liveDisplayClockShouldTick({ statusShort: 'HT', elapsed: 45 })).toBe(false);
  });

  it('TEST A — 1H 44:59 → HT displays HT immediately', () => {
    expect(
      clock({
        statusShort: '1H',
        elapsed: 44,
        fallbackLabel: "44'",
        nowMs: T0 + 59_000,
        anchorMs: T0,
      }).label,
    ).toBe('44:59');
    const ht = clock({
      statusShort: 'HT',
      elapsed: 45,
      fallbackLabel: 'HT',
      nowMs: T0 + 60_000,
      anchorMs: T0,
    });
    expect(ht.label).toBe('HT');
    expect(ht.ticking).toBe(false);
    expect(ht.displaySeconds).toBeNull();
    expect(liveDisplayClockShouldTick({ statusShort: 'HT', elapsed: 45 })).toBe(false);
  });

  it('TEST B — LIVE 45:00 → HT is HT, not 45:00', () => {
    expect(
      clock({
        statusShort: 'LIVE',
        elapsed: 45,
        fallbackLabel: "45'",
        nowMs: T0,
        anchorMs: T0,
      }).label,
    ).toBe('45:00');
    const ht = clock({
      statusShort: 'HT',
      elapsed: 45,
      fallbackLabel: "45'",
      nowMs: T0 + 1_000,
      anchorMs: T0,
    });
    expect(ht.label).toBe('HT');
    expect(ht.label).not.toBe('45:00');
    expect(ht.ticking).toBe(false);
  });

  it('TEST C — 1H stoppage 45+N → HT displays HT', () => {
    const stoppage = clock({
      statusShort: '1H',
      elapsed: 49,
      extra: 4,
      fallbackLabel: "45+4'",
      nowMs: T0 + 12_000,
      anchorMs: T0,
    });
    expect(stoppage.label).toBe("45+4'");
    expect(stoppage.ticking).toBe(false);
    const ht = clock({
      statusShort: 'HT',
      elapsed: 49,
      extra: 4,
      fallbackLabel: "45+4'",
      nowMs: T0 + 15_000,
      anchorMs: T0,
    });
    expect(ht.label).toBe('HT');
    expect(ht.ticking).toBe(false);
    expect(liveDisplayClockShouldTick({ statusShort: 'HT', elapsed: 49, extra: 4 })).toBe(false);
  });

  it('TEST 6 — HT → 2H 46 re-anchors and ticks', () => {
    const ht = clock({
      statusShort: 'HT',
      elapsed: 45,
      fallbackLabel: 'HT',
      nowMs: T0,
      anchorMs: T0,
    });
    expect(ht.label).toBe('HT');
    expect(ht.ticking).toBe(false);
    const resumeAt = T0 + 60_000;
    const next = nextLiveDisplayAnchorMs({
      identity: liveDisplayClockIdentity({
        fixtureId: '4812183',
        statusShort: '2H',
        elapsed: 46,
        extra: null,
      }),
      prevIdentity: liveDisplayClockIdentity({
        fixtureId: '4812183',
        statusShort: 'HT',
        elapsed: 45,
        extra: null,
      }),
      prevAnchorMs: T0,
      nowMs: resumeAt,
    });
    expect(next.reanchored).toBe(true);
    expect(
      clock({
        statusShort: '2H',
        elapsed: 46,
        fallbackLabel: "46'",
        nowMs: next.anchorMs,
        anchorMs: next.anchorMs,
      }).label,
    ).toBe('46:00');
    expect(
      clock({
        statusShort: '2H',
        elapsed: 46,
        fallbackLabel: "46'",
        nowMs: next.anchorMs + 1_000,
        anchorMs: next.anchorMs,
      }).label,
    ).toBe('46:01');
    expect(
      clock({
        statusShort: '2H',
        elapsed: 46,
        fallbackLabel: "46'",
        nowMs: next.anchorMs + 3_000,
        anchorMs: next.anchorMs,
      }).label,
    ).toBe('46:03');
  });

  it('TEST 7 — FT does not tick', () => {
    const a = clock({
      statusShort: 'FT',
      elapsed: 90,
      fallbackLabel: "90'",
      nowMs: T0,
      anchorMs: T0,
    });
    const b = clock({
      statusShort: 'FT',
      elapsed: 90,
      fallbackLabel: "90'",
      nowMs: T0 + 20_000,
      anchorMs: T0,
    });
    expect(a.label).toBe("90'");
    expect(b.label).toBe("90'");
    expect(a.ticking).toBe(false);
  });

  it('TEST 8 — stoppage / extra time keeps 90+N formatting', () => {
    const stoppage = clock({
      statusShort: '2H',
      elapsed: 90,
      extra: 4,
      fallbackLabel: "90'",
      nowMs: T0 + 12_000,
      anchorMs: T0,
    });
    expect(stoppage.label).toBe("90+4'");
    expect(stoppage.ticking).toBe(false);

    const et = clock({
      statusShort: 'ET',
      elapsed: 105,
      extra: null,
      fallbackLabel: "105'",
      nowMs: T0 + 5_000,
      anchorMs: T0,
    });
    expect(et.label).toMatch(/ET/);
    expect(et.ticking).toBe(false);
  });

  it('TEST 9 — background gap is derived from timestamps, no replay', () => {
    const at10 = clock({ elapsed: 51, nowMs: T0 + 10_000, anchorMs: T0 });
    const at30 = clock({ elapsed: 51, nowMs: T0 + 30_000, anchorMs: T0 });
    expect(at10.label).toBe('51:10');
    expect(at30.label).toBe('51:30');
  });

  it('TEST 10 — FlashList recycle does not leak fixture A seconds into B', () => {
    const a = clock({
      fixtureId: 'A',
      elapsed: 51,
      nowMs: T0 + 20_000,
      anchorMs: T0,
    });
    expect(a.label).toBe('51:20');
    const recycle = nextLiveDisplayAnchorMs({
      identity: liveDisplayClockIdentity({
        fixtureId: 'B',
        statusShort: '2H',
        elapsed: 72,
        extra: null,
      }),
      prevIdentity: liveDisplayClockIdentity({
        fixtureId: 'A',
        statusShort: '2H',
        elapsed: 51,
        extra: null,
      }),
      prevAnchorMs: T0,
      nowMs: T0 + 20_000,
    });
    expect(recycle.reanchored).toBe(true);
    const bNow = recycle.anchorMs;
    expect(
      clock({
        fixtureId: 'B',
        elapsed: 72,
        nowMs: bNow + 10_000,
        anchorMs: bNow,
      }).label,
    ).toBe('72:10');
    expect(
      clock({
        fixtureId: 'B',
        elapsed: 72,
        nowMs: bNow,
        anchorMs: bNow,
      }).label,
    ).not.toBe('51:20');
  });

  it('TEST 13 — local clock does not mutate canonical match fields', () => {
    const match = Object.freeze({
      id: '1',
      elapsed: 51,
      statusShort: '2H',
      extra: null as number | null,
      score: Object.freeze({ home: 1, away: 0 }),
    });
    const copy = { ...match, score: { ...match.score } };
    clock({
      fixtureId: match.id,
      statusShort: match.statusShort,
      elapsed: match.elapsed,
      extra: match.extra,
      nowMs: T0 + 5_000,
      anchorMs: T0,
    });
    expect(match.elapsed).toBe(51);
    expect(match.statusShort).toBe('2H');
    expect(match.score.home).toBe(1);
    expect(copy.elapsed).toBe(51);

    const htMatch = Object.freeze({
      id: '2',
      elapsed: 45,
      statusShort: 'HT',
      extra: 4 as number | null,
    });
    clock({
      fixtureId: htMatch.id,
      statusShort: htMatch.statusShort,
      elapsed: htMatch.elapsed,
      extra: htMatch.extra,
      fallbackLabel: 'HT',
      nowMs: T0 + 5_000,
      anchorMs: T0,
    });
    expect(htMatch.elapsed).toBe(45);
    expect(htMatch.statusShort).toBe('HT');
    expect(htMatch.extra).toBe(4);
  });

  it('does not call incremental grouping while computing display time', () => {
    const spy = jest.spyOn(grouping, 'groupMatchesByCountryIncremental');
    clock({ nowMs: T0, anchorMs: T0 });
    clock({ nowMs: T0 + 1_000, anchorMs: T0 });
    clock({ nowMs: T0 + 2_000, anchorMs: T0 });
    clock({
      statusShort: 'HT',
      elapsed: 45,
      fallbackLabel: 'HT',
      nowMs: T0 + 3_000,
      anchorMs: T0,
    });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('P does not tick', () => {
    const a = clock({
      statusShort: 'P',
      elapsed: 120,
      fallbackLabel: 'P',
      nowMs: T0,
      anchorMs: T0,
    });
    expect(a.ticking).toBe(false);
    expect(a.label).toBe('P');
  });

  it('1H caps at 45:00', () => {
    const late = clock({
      statusShort: '1H',
      elapsed: 44,
      fallbackLabel: "44'",
      nowMs: T0 + 180_000,
      anchorMs: T0,
    });
    expect(late.label).toBe('45:00');
    expect(late.ticking).toBe(false);
  });

  it('flag defaults off', () => {
    const prev = process.env.EXPO_PUBLIC_LIVE_CLOCK_SECONDS;
    delete process.env.EXPO_PUBLIC_LIVE_CLOCK_SECONDS;
    expect(isLiveClockSecondsEnabled()).toBe(false);
    process.env.EXPO_PUBLIC_LIVE_CLOCK_SECONDS = '1';
    expect(isLiveClockSecondsEnabled()).toBe(true);
    process.env.EXPO_PUBLIC_LIVE_CLOCK_SECONDS = prev;
  });
});
