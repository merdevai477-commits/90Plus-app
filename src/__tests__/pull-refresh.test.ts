import {
  resolvePullIntervalMs,
  wantsPullRefresh,
  fixtureUpdatedAtMs,
  PTR_INTERVAL_LIVE_ACTIVE_MS,
  PTR_INTERVAL_LIVE_IDLE_MS,
  PTR_INTERVAL_IDLE_MS,
} from '../utils/pull-refresh.util';
import type { Request } from 'express';

describe('pull-refresh intervals', () => {
  const now = 1_000_000;

  it('uses 12s for live matches with recent activity', () => {
    expect(resolvePullIntervalMs('1H', now - 10_000, now)).toBe(PTR_INTERVAL_LIVE_ACTIVE_MS);
  });

  it('uses 30s for live matches without recent activity', () => {
    expect(resolvePullIntervalMs('2H', now - 120_000, now)).toBe(PTR_INTERVAL_LIVE_IDLE_MS);
    expect(resolvePullIntervalMs('LIVE', null, now)).toBe(PTR_INTERVAL_LIVE_IDLE_MS);
  });

  it('treats SUSP as live', () => {
    expect(resolvePullIntervalMs('SUSP', now - 5_000, now)).toBe(PTR_INTERVAL_LIVE_ACTIVE_MS);
  });

  it('uses 60s for upcoming and finished', () => {
    expect(resolvePullIntervalMs('NS', now, now)).toBe(PTR_INTERVAL_IDLE_MS);
    expect(resolvePullIntervalMs('FT', now, now)).toBe(PTR_INTERVAL_IDLE_MS);
  });
});

describe('wantsPullRefresh', () => {
  it('reads pull=1 and ignores fresh', () => {
    expect(
      wantsPullRefresh({ query: { pull: '1', fresh: '1' } } as unknown as Request),
    ).toBe(true);
    expect(wantsPullRefresh({ query: { fresh: '1' } } as unknown as Request)).toBe(false);
  });
});

describe('fixtureUpdatedAtMs', () => {
  it('reads Date and ISO strings from cache payloads', () => {
    expect(fixtureUpdatedAtMs({ updatedAt: new Date(1_700_000_000_000) })).toBe(1_700_000_000_000);
    expect(fixtureUpdatedAtMs({ updatedAt: '2026-09-08T12:00:00.000Z' })).toBe(
      Date.parse('2026-09-08T12:00:00.000Z'),
    );
    expect(fixtureUpdatedAtMs(null)).toBeNull();
  });
});
