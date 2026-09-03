import { getRedisClient } from '../../lib/redis';
import {
  API_FOOTBALL_DAILY_LIMIT,
  API_FOOTBALL_JOB_LIMIT,
  __resetQuotaWarnLatchesForTests,
  canCallApiFootball,
  getQuotaStatus,
  isPurposeAllowed,
  recordApiFootballCall,
  resolveQuotaPurpose,
} from '../api-football-quota.service';

const mockedGetRedisClient = getRedisClient as jest.MockedFunction<typeof getRedisClient>;

/** Minimal Redis fake with atomic-enough INCR for single-process unit tests. */
function createRedisFake(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial));
  const ttls = new Map<string, number>();
  return {
    store,
    ttls,
    get: jest.fn(async (key: string) => store.get(key) ?? null),
    incr: jest.fn(async (key: string) => {
      const next = (parseInt(store.get(key) ?? '0', 10) || 0) + 1;
      store.set(key, String(next));
      return next;
    }),
    set: jest.fn(async (key: string, value: string, ...args: unknown[]) => {
      store.set(key, value);
      const exIdx = args.indexOf('EX');
      if (exIdx >= 0 && typeof args[exIdx + 1] === 'number') {
        ttls.set(key, args[exIdx + 1] as number);
      }
      return 'OK';
    }),
    expire: jest.fn(async (key: string, sec: number) => {
      ttls.set(key, sec);
      return 1;
    }),
  };
}

describe('api-football-quota.service (P0-1)', () => {
  beforeEach(() => {
    jest.useRealTimers();
    mockedGetRedisClient.mockReset();
    __resetQuotaWarnLatchesForTests();
  });

  it('resolves purpose from source when purpose omitted', () => {
    expect(resolveQuotaPurpose('user')).toBe('user');
    expect(resolveQuotaPurpose('job')).toBe('job');
    expect(resolveQuotaPurpose('internal')).toBe('internal');
    expect(resolveQuotaPurpose(undefined, 'verify-finished')).toBe('verify-finished');
  });

  it('allowlists only verify-finished and user', () => {
    expect(isPurposeAllowed('verify-finished')).toBe(true);
    expect(isPurposeAllowed('user')).toBe(true);
    expect(isPurposeAllowed('live-sync')).toBe(false);
    expect(isPurposeAllowed('calendar-sync')).toBe(false);
    expect(isPurposeAllowed('warmup')).toBe(false);
    expect(isPurposeAllowed('probe-kickoff')).toBe(false);
    expect(isPurposeAllowed('job')).toBe(false);
    expect(isPurposeAllowed('internal')).toBe(false);
  });

  it('returns true at count 0 and 97, false at 98+', async () => {
    const day = new Date().toISOString().slice(0, 10);
    const redis = createRedisFake({ [`apifootball:quota:${day}`]: '0' });
    mockedGetRedisClient.mockReturnValue(redis as any);

    await expect(canCallApiFootball('verify-finished')).resolves.toBe(true);

    redis.store.set(`apifootball:quota:${day}`, '97');
    await expect(canCallApiFootball('verify-finished')).resolves.toBe(true);

    redis.store.set(`apifootball:quota:${day}`, '98');
    await expect(canCallApiFootball('verify-finished')).resolves.toBe(false);

    redis.store.set(`apifootball:quota:${day}`, '150');
    await expect(canCallApiFootball('verify-finished')).resolves.toBe(false);
  });

  it('resets after UTC midnight boundary (mocked clock)', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-03T23:59:00.000Z'));
    const redis = createRedisFake({
      'apifootball:quota:2026-09-03': String(API_FOOTBALL_DAILY_LIMIT),
    });
    mockedGetRedisClient.mockReturnValue(redis as any);

    await expect(canCallApiFootball('verify-finished')).resolves.toBe(false);

    jest.setSystemTime(new Date('2026-09-04T00:00:01.000Z'));
    // New day key is empty → allowed
    await expect(canCallApiFootball('verify-finished')).resolves.toBe(true);
  });

  it('fail-closes when Redis is null', async () => {
    mockedGetRedisClient.mockReturnValue(null);
    await expect(canCallApiFootball('verify-finished')).resolves.toBe(false);
    await expect(canCallApiFootball('user')).resolves.toBe(false);
  });

  it('denies barred purposes even with unused budget', async () => {
    const redis = createRedisFake();
    mockedGetRedisClient.mockReturnValue(redis as any);
    await expect(canCallApiFootball('live-sync')).resolves.toBe(false);
    await expect(canCallApiFootball('job')).resolves.toBe(false);
    expect(redis.incr).not.toHaveBeenCalled();
  });

  it('blocks jobs at job cap 20 while global is still under 98', async () => {
    const day = new Date().toISOString().slice(0, 10);
    const redis = createRedisFake({
      [`apifootball:quota:${day}`]: '30',
      [`apifootball:quota:job:${day}`]: String(API_FOOTBALL_JOB_LIMIT),
    });
    mockedGetRedisClient.mockReturnValue(redis as any);

    await expect(canCallApiFootball('verify-finished')).resolves.toBe(false);
    // user purpose does not consume job budget
    await expect(canCallApiFootball('user')).resolves.toBe(true);
  });

  it('recordApiFootballCall increments global and job counters', async () => {
    const day = new Date().toISOString().slice(0, 10);
    const redis = createRedisFake();
    mockedGetRedisClient.mockReturnValue(redis as any);

    const used = await recordApiFootballCall('verify-finished');
    expect(used).toBe(1);
    expect(redis.store.get(`apifootball:quota:${day}`)).toBe('1');
    expect(redis.store.get(`apifootball:quota:job:${day}`)).toBe('1');
    expect(redis.expire).toHaveBeenCalled();
  });

  it('getQuotaStatus reports exhausted when used >= limit', async () => {
    const day = new Date().toISOString().slice(0, 10);
    const redis = createRedisFake({
      [`apifootball:quota:${day}`]: String(API_FOOTBALL_DAILY_LIMIT),
    });
    mockedGetRedisClient.mockReturnValue(redis as any);

    const status = await getQuotaStatus(0);
    expect(status.status).toBe('quota_exhausted');
    expect(status.used).toBe(API_FOOTBALL_DAILY_LIMIT);
    expect(status.remaining).toBe(0);
    expect(status.dailyLimit).toBe(API_FOOTBALL_DAILY_LIMIT);
  });

  it('getQuotaStatus reports suspended when breaker deadline is in the future', async () => {
    const redis = createRedisFake();
    mockedGetRedisClient.mockReturnValue(redis as any);
    const status = await getQuotaStatus(Date.now() + 60_000);
    expect(status.status).toBe('suspended');
  });
});
