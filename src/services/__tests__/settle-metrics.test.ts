/**
 * E9 — durable settle counters, PII-free health summary, SETTLE_STALE watchdog.
 */

const store = new Map<string, Record<string, number>>();
const ttl = new Map<string, number>();
const mockRedis = {
  multi: () => {
    const ops: Array<() => void> = [];
    const chain = {
      hincrby: (key: string, field: string, by: number) => {
        ops.push(() => {
          const h = store.get(key) ?? {};
          h[field] = (h[field] ?? 0) + by;
          store.set(key, h);
        });
        return chain;
      },
      expire: (key: string, sec: number) => {
        ops.push(() => ttl.set(key, sec));
        return chain;
      },
      exec: async () => ops.forEach((op) => op()),
    };
    return chain;
  },
  hgetall: async (key: string) => {
    const h = store.get(key);
    return h ? Object.fromEntries(Object.entries(h).map(([k, v]) => [k, String(v)])) : {};
  },
};
let redisUp = true;
jest.mock('../../lib/redis', () => ({
  getRedisClient: () => (redisUp ? mockRedis : null),
  isRedisConnected: () => redisUp,
}));

const mockCount = jest.fn();
const mockAggregate = jest.fn();
const mockQueryRaw = jest.fn();
jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {
    prediction: {
      count: (...a: unknown[]) => mockCount(...a),
      aggregate: (...a: unknown[]) => mockAggregate(...a),
    },
    $queryRaw: (...a: unknown[]) => mockQueryRaw(...a),
  },
}));

const mockLoggerError = jest.fn();
jest.mock('../../utils/logger', () => ({
  logger: { error: (...a: unknown[]) => mockLoggerError(...a), debug: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

import {
  __resetSettleMetricsForTests,
  getSettleHealthSummary,
  readSettleMetrics,
  recordSettleMetric,
  runSettleWatchdog,
  settleMetricsDayKey,
} from '../settle-metrics.service';

const flush = () => new Promise((r) => setImmediate(r));

beforeEach(() => {
  jest.clearAllMocks();
  store.clear();
  ttl.clear();
  redisUp = true;
  __resetSettleMetricsForTests();
});

describe('settle counters', () => {
  it('HINCRBY per reason with a 14-day TTL', async () => {
    recordSettleMetric('SETTLE_COMPLETE');
    recordSettleMetric('SETTLE_COMPLETE');
    recordSettleMetric('GATE_PEN_WINNER_UNKNOWN');
    recordSettleMetric('ROWS_SETTLED', 7);
    recordSettleMetric('ROWS_SETTLED', 0);
    await flush();
    const key = `metrics:settle:${settleMetricsDayKey()}`;
    expect(store.get(key)).toEqual({ SETTLE_COMPLETE: 2, GATE_PEN_WINNER_UNKNOWN: 1, ROWS_SETTLED: 7 });
    expect(ttl.get(key)).toBe(14 * 86_400);
    await expect(readSettleMetrics(14)).resolves.toEqual([
      { day: settleMetricsDayKey(), counts: { SETTLE_COMPLETE: 2, GATE_PEN_WINNER_UNKNOWN: 1, ROWS_SETTLED: 7 } },
    ]);
  });

  it('Redis down → no throw, nothing recorded', async () => {
    redisUp = false;
    expect(() => recordSettleMetric('SETTLE_COMPLETE')).not.toThrow();
    await expect(readSettleMetrics()).resolves.toEqual([]);
  });

  it('day key is UTC yyyymmdd', () => {
    expect(settleMetricsDayKey(new Date('2026-10-30T23:59:59Z'))).toBe('20261030');
  });
});

describe('health summary', () => {
  it('has counts and times only — no user ids, names or picks', async () => {
    const now = new Date('2026-10-30T12:00:00Z');
    mockCount.mockResolvedValue(98);
    mockQueryRaw.mockResolvedValue([{ matches: 2, oldest: new Date('2026-10-30T09:00:00Z') }]);
    mockAggregate.mockResolvedValue({ _max: { settledAt: new Date('2026-10-30T11:50:00Z') } });
    recordSettleMetric('SETTLE_COMPLETE');
    await flush();

    const s = await getSettleHealthSummary(now);
    expect(s).toEqual({
      pendingCount: 98,
      oldestSettleablePendingAgeMin: 180,
      settleablePendingMatches: 2,
      lastSettleAt: '2026-10-30T11:50:00.000Z',
      today: { SETTLE_COMPLETE: 1 },
    });
    expect(JSON.stringify(s)).not.toMatch(/userId|predictionType|homeTeam|email/i);
    expect(mockCount).toHaveBeenCalledWith({ where: { isCorrect: null, voidedAt: null } });
  });

  it('is cached for 60s', async () => {
    mockCount.mockResolvedValue(1);
    mockQueryRaw.mockResolvedValue([{ matches: 0, oldest: null }]);
    mockAggregate.mockResolvedValue({ _max: { settledAt: null } });
    const t = new Date('2026-10-30T12:00:00Z');
    await getSettleHealthSummary(t);
    await getSettleHealthSummary(new Date(t.getTime() + 59_000));
    expect(mockCount).toHaveBeenCalledTimes(1);
    await getSettleHealthSummary(new Date(t.getTime() + 61_000));
    expect(mockCount).toHaveBeenCalledTimes(2);
  });
});

describe('SETTLE_STALE watchdog', () => {
  const t0 = new Date('2026-10-30T20:00:00Z');
  const recentFinal = { apiMatchId: 11, status: 'PEN', pending: 3, kickoff: new Date('2026-10-30T18:00:00Z') };

  it('final with pending rows is stale only after 30 minutes', async () => {
    mockQueryRaw.mockResolvedValue([recentFinal]);
    await expect(runSettleWatchdog(t0)).resolves.toEqual([]);
    await expect(runSettleWatchdog(new Date(t0.getTime() + 29 * 60_000))).resolves.toEqual([]);
    const stale = await runSettleWatchdog(new Date(t0.getTime() + 31 * 60_000));
    expect(stale).toEqual([
      expect.objectContaining({ apiMatchId: 11, status: 'PEN', pending: 3, sinceKickoffMin: 151 }),
    ]);
    expect(mockLoggerError).toHaveBeenCalledTimes(1);
    expect(JSON.parse(mockLoggerError.mock.calls[0][0])).toMatchObject({ event: 'SETTLE_STALE', apiMatchId: 11 });
    await flush();
    expect(store.get(`metrics:settle:${settleMetricsDayKey()}`)).toMatchObject({ SETTLE_STALE: 1 });
  });

  it('reports at most once an hour per match', async () => {
    mockQueryRaw.mockResolvedValue([recentFinal]);
    await runSettleWatchdog(t0);
    await runSettleWatchdog(new Date(t0.getTime() + 31 * 60_000));
    await runSettleWatchdog(new Date(t0.getTime() + 50 * 60_000));
    expect(mockLoggerError).toHaveBeenCalledTimes(1);
    await runSettleWatchdog(new Date(t0.getTime() + 92 * 60_000));
    expect(mockLoggerError).toHaveBeenCalledTimes(2);
  });

  it('after a restart, kickoff older than 6h is stale immediately', async () => {
    mockQueryRaw.mockResolvedValue([{ ...recentFinal, kickoff: new Date('2026-10-30T13:00:00Z') }]);
    await expect(runSettleWatchdog(t0)).resolves.toHaveLength(1);
  });

  it('a settled match drops out and starts fresh if it reappears', async () => {
    mockQueryRaw.mockResolvedValueOnce([recentFinal]);
    await runSettleWatchdog(t0);
    mockQueryRaw.mockResolvedValueOnce([]);
    await runSettleWatchdog(new Date(t0.getTime() + 10 * 60_000));
    mockQueryRaw.mockResolvedValueOnce([recentFinal]);
    await expect(runSettleWatchdog(new Date(t0.getTime() + 35 * 60_000))).resolves.toEqual([]);
  });

  it('report:false lists without logging or arming', async () => {
    mockQueryRaw.mockResolvedValue([{ ...recentFinal, kickoff: new Date('2026-10-30T10:00:00Z') }]);
    await expect(runSettleWatchdog(t0, { report: false })).resolves.toHaveLength(1);
    expect(mockLoggerError).not.toHaveBeenCalled();
  });
});
