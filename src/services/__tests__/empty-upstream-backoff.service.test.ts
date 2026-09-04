import { getRedisClient } from '../../lib/redis';
import {
  EMPTY_UPSTREAM_BASE_BACKOFF_MS,
  EMPTY_UPSTREAM_MAX_BACKOFF_MS,
  computeEmptyUpstreamBackoffMs,
  recordEmptyUpstreamResult,
  recordNonEmptyUpstreamResult,
  shouldSkipEmptyUpstreamPoll,
  clearEmptyUpstreamBackoff,
  emptyUpstreamStreakKey,
} from '../empty-upstream-backoff.service';

const mockedGetRedisClient = getRedisClient as jest.MockedFunction<typeof getRedisClient>;

function createRedisFake(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial));
  const ttls = new Map<string, number>();
  return {
    store,
    ttls,
    get: jest.fn(async (key: string) => store.get(key) ?? null),
    set: jest.fn(async (key: string, value: string, ...args: unknown[]) => {
      store.set(key, value);
      const exIdx = args.indexOf('EX');
      if (exIdx >= 0 && typeof args[exIdx + 1] === 'number') {
        ttls.set(key, args[exIdx + 1] as number);
      }
      return 'OK';
    }),
    del: jest.fn(async (key: string) => {
      store.delete(key);
      ttls.delete(key);
      return 1;
    }),
  };
}

describe('empty-upstream-backoff.service (P1-7)', () => {
  const fixtureId = 4_778_474;

  beforeEach(() => {
    jest.useRealTimers();
    mockedGetRedisClient.mockReset();
  });

  it('computes stepped backoff: 60s → 120s → 240s → cap 300s', () => {
    expect(computeEmptyUpstreamBackoffMs(0)).toBe(60_000);
    expect(computeEmptyUpstreamBackoffMs(1)).toBe(60_000);
    expect(computeEmptyUpstreamBackoffMs(2)).toBe(120_000);
    expect(computeEmptyUpstreamBackoffMs(3)).toBe(240_000);
    expect(computeEmptyUpstreamBackoffMs(4)).toBe(300_000);
    expect(computeEmptyUpstreamBackoffMs(10)).toBe(EMPTY_UPSTREAM_MAX_BACKOFF_MS);
  });

  it('3 consecutive empty results produce increasing backoff intervals', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-04T12:00:00.000Z'));
    const redis = createRedisFake();
    mockedGetRedisClient.mockReturnValue(redis as any);

    const first = await recordEmptyUpstreamResult(fixtureId);
    expect(first.streak).toBe(1);
    expect(first.nextBackoffMs).toBe(60_000);

    jest.setSystemTime(new Date('2026-09-04T12:00:30.000Z'));
    await expect(shouldSkipEmptyUpstreamPoll(fixtureId)).resolves.toEqual({
      skip: true,
      streak: 1,
      nextRetryInMs: 30_000,
    });

    jest.setSystemTime(new Date('2026-09-04T12:01:00.000Z'));
    await expect(shouldSkipEmptyUpstreamPoll(fixtureId)).resolves.toEqual({
      skip: false,
      streak: 1,
    });
    const second = await recordEmptyUpstreamResult(fixtureId);
    expect(second.streak).toBe(2);
    expect(second.nextBackoffMs).toBe(120_000);

    jest.setSystemTime(new Date('2026-09-04T12:01:30.000Z'));
    await expect(shouldSkipEmptyUpstreamPoll(fixtureId)).resolves.toEqual({
      skip: true,
      streak: 2,
      nextRetryInMs: 90_000,
    });

    jest.setSystemTime(new Date('2026-09-04T12:03:00.000Z'));
    await expect(shouldSkipEmptyUpstreamPoll(fixtureId)).resolves.toEqual({
      skip: false,
      streak: 2,
    });
    const third = await recordEmptyUpstreamResult(fixtureId);
    expect(third.streak).toBe(3);
    expect(third.nextBackoffMs).toBe(240_000);
  });

  it('non-empty result after empties resets streak and next poll uses base cadence', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-04T12:00:00.000Z'));
    const redis = createRedisFake();
    mockedGetRedisClient.mockReturnValue(redis as any);

    await recordEmptyUpstreamResult(fixtureId);
    await recordEmptyUpstreamResult(fixtureId);
    await recordNonEmptyUpstreamResult(fixtureId);

    expect(redis.store.has(emptyUpstreamStreakKey(fixtureId))).toBe(false);
    await expect(shouldSkipEmptyUpstreamPoll(fixtureId)).resolves.toEqual({ skip: false });

    const afterReset = await recordEmptyUpstreamResult(fixtureId);
    expect(afterReset.streak).toBe(1);
    expect(afterReset.nextBackoffMs).toBe(EMPTY_UPSTREAM_BASE_BACKOFF_MS);
  });

  it('backoff caps at maximum and does not grow unbounded', async () => {
    const redis = createRedisFake();
    mockedGetRedisClient.mockReturnValue(redis as any);

    let last = EMPTY_UPSTREAM_BASE_BACKOFF_MS;
    for (let i = 0; i < 12; i += 1) {
      const result = await recordEmptyUpstreamResult(fixtureId);
      expect(result.nextBackoffMs).toBeLessThanOrEqual(EMPTY_UPSTREAM_MAX_BACKOFF_MS);
      expect(result.nextBackoffMs).toBeGreaterThanOrEqual(last);
      last = result.nextBackoffMs;
    }
    expect(last).toBe(EMPTY_UPSTREAM_MAX_BACKOFF_MS);
  });

  it('simulates 20 minutes of 60s ticks with fewer upstream attempts than baseline', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-04T12:00:00.000Z'));
    const redis = createRedisFake();
    mockedGetRedisClient.mockReturnValue(redis as any);

    const tickMs = 60_000;
    const durationMs = 20 * 60_000;
    let upstreamCalls = 0;

    for (let elapsed = 0; elapsed <= durationMs; elapsed += tickMs) {
      jest.setSystemTime(new Date(Date.parse('2026-09-04T12:00:00.000Z') + elapsed));
      const gate = await shouldSkipEmptyUpstreamPoll(fixtureId);
      if (gate.skip) continue;
      upstreamCalls += 1;
      await recordEmptyUpstreamResult(fixtureId);
    }

    const baselineCalls = Math.floor(durationMs / tickMs) + 1;
    expect(baselineCalls).toBe(21);
    expect(upstreamCalls).toBeLessThan(baselineCalls);
    expect(upstreamCalls).toBe(6);
  });

  it('terminal handoff clears empty streak without double-counting', async () => {
    const redis = createRedisFake();
    mockedGetRedisClient.mockReturnValue(redis as any);

    await recordEmptyUpstreamResult(fixtureId);
    await recordEmptyUpstreamResult(fixtureId);
    expect(redis.store.has(emptyUpstreamStreakKey(fixtureId))).toBe(true);

    await clearEmptyUpstreamBackoff(fixtureId);
    expect(redis.store.has(emptyUpstreamStreakKey(fixtureId))).toBe(false);

    await expect(shouldSkipEmptyUpstreamPoll(fixtureId)).resolves.toEqual({ skip: false });
    const afterTerminal = await recordEmptyUpstreamResult(fixtureId);
    expect(afterTerminal.streak).toBe(1);
  });

  it('fail-opens when Redis is null (does not skip polls)', async () => {
    mockedGetRedisClient.mockReturnValue(null);
    await expect(shouldSkipEmptyUpstreamPoll(fixtureId)).resolves.toEqual({ skip: false });
    await expect(recordEmptyUpstreamResult(fixtureId)).resolves.toEqual({
      streak: 1,
      nextBackoffMs: EMPTY_UPSTREAM_BASE_BACKOFF_MS,
    });
  });
});
