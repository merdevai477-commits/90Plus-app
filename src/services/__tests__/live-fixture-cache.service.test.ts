import { getRedisClient } from '../../lib/redis';
import {
  FOOTBALL_365_LIVE_ABSENT_KEY_PREFIX,
  FOOTBALL_365_LIVE_MATCHES_KEY,
  FOOTBALL_API_LIVE_MATCHES_KEY,
  FOOTBALL_FIXTURE_TERMINAL_LATCHED_KEY_PREFIX,
  FOOTBALL_LIVE_MATCHES_KEY,
} from '../../utils/football-cache-keys.util';
import { FOOTBALL_FIXTURE_TERMINAL_KEY_PREFIX } from '../live-fixture-cache.service';
import {
  mergeLiveFixturesIntoRedisSnapshot,
  read365LiveFixtureIds,
  readLiveFixtureById,
  isTerminalLatched,
  readLiveFixturesList,
  replace365LiveFixturesSnapshot,
  resolveFixtureForClient,
  resolveLiveFixturesForClient,
  shouldRescueLiveListFromApiFootball,
  writeLiveFixturesSnapshot,
  writeTerminalFixtureSnapshot,
} from '../live-fixture-cache.service';

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: { cachedFixture: { findUnique: jest.fn(), findMany: jest.fn() } },
}));

jest.mock('../match-cache.service', () => ({
  LIVE_STATUSES: ['1H', '2H', 'HT', 'LIVE'],
  FINISHED_STATUSES: ['FT', 'AET', 'PEN', 'PST', 'CANC', 'ABD', 'AWD', 'WO'],
  TERMINAL_LATCH_STATUSES: ['FT', 'AET', 'PEN', 'CANC', 'ABD', 'AWD', 'WO'],
  matchCacheService: {
    convertDbMatchToApiFormat: jest.fn(),
    upsertFixtures: jest.fn(async () => 0),
  },
}));

const invalidateFixtureDetailCaches = jest.fn(async () => undefined);
jest.mock('../football-data-cache.service', () => ({
  footballDataCacheService: {
    invalidateFixtureDetailCaches,
  },
}));

jest.mock('../scores365-experiment.service', () => ({
  getScores365ExperimentConfig: () => ({ fixtureId: -1 }),
  getScores365ExperimentFixture: jest.fn(async () => null),
  isScores365ExperimentEnabled: jest.fn(() => false),
  isScores365ExperimentFixture: () => false,
  resolveScores365AppLanguage: () => 'en',
  SCORES365_LEAGUE_ID_OFFSET: 10_000_000,
}));

const mockedGetRedisClient = getRedisClient as jest.MockedFunction<typeof getRedisClient>;

function fixture(id: number, status: string, provider: string, leagueId?: number): any {
  return {
    fixture: { id, status: { short: status } },
    league: { id: leagueId ?? 0 },
    provider,
  };
}

function redisHarness(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const hashes = new Map<string, Map<string, string>>();
  const ttls = new Map<string, number>();
  const drop = (key: string) => {
    values.delete(key);
    hashes.delete(key);
    ttls.delete(key);
  };
  const pipeline = () => ({
    setex: jest.fn((key: string, ttl: number, value: string) => {
      values.set(key, value);
      ttls.set(key, ttl);
    }),
    del: jest.fn((key: string) => {
      drop(key);
    }),
    exec: jest.fn(async () => []),
  });
  return {
    values,
    hashes,
    ttls,
    client: {
      get: jest.fn(async (key: string) => values.get(key) ?? null),
      set: jest.fn(async (key: string, value: string, ...args: unknown[]) => {
        const nx = args.includes('NX');
        if (nx && values.has(key)) return null;
        values.set(key, value);
        const exAt = args.indexOf('EX');
        if (exAt >= 0 && typeof args[exAt + 1] === 'number') {
          ttls.set(key, args[exAt + 1] as number);
        }
        return 'OK';
      }),
      del: jest.fn(async (key: string) => {
        drop(key);
        return 1;
      }),
      hsetnx: jest.fn(async (key: string, field: string, value: string) => {
        const bucket = hashes.get(key) ?? new Map<string, string>();
        hashes.set(key, bucket);
        if (bucket.has(field)) return 0;
        bucket.set(field, value);
        return 1;
      }),
      hincrby: jest.fn(async (key: string, field: string, increment: number) => {
        const bucket = hashes.get(key) ?? new Map<string, string>();
        hashes.set(key, bucket);
        const next = (Number(bucket.get(field) ?? '0') || 0) + increment;
        bucket.set(field, String(next));
        return next;
      }),
      hget: jest.fn(async (key: string, field: string) => hashes.get(key)?.get(field) ?? null),
      expire: jest.fn(async (key: string, ttl: number) => {
        ttls.set(key, ttl);
        return 1;
      }),
      pipeline: jest.fn(pipeline),
    },
  };
}

describe('provider-owned live fixture snapshots', () => {
  beforeEach(() => {
    mockedGetRedisClient.mockReset();
    const experiment = require('../scores365-experiment.service');
    experiment.isScores365ExperimentEnabled.mockReturnValue(false);
  });

  it('intentional empty REPLACE clears a previous 365 list (legitimate quiet period)', async () => {
    const redis = redisHarness({
      [FOOTBALL_365_LIVE_MATCHES_KEY]: JSON.stringify([
        fixture(1, '1H', '365'),
        fixture(2, '2H', '365'),
      ]),
      [FOOTBALL_API_LIVE_MATCHES_KEY]: JSON.stringify([fixture(9, '1H', 'api')]),
    });
    mockedGetRedisClient.mockReturnValue(redis.client as any);

    // Ids 1 and 2 are not 365-owned, so a legitimate empty snapshot still drops
    // them on this tick. Owned rows wait out the absence grace.
    await replace365LiveFixturesSnapshot([]);

    expect(JSON.parse(redis.values.get(FOOTBALL_365_LIVE_MATCHES_KEY) ?? '[]')).toEqual([]);
    await expect(readLiveFixturesList()).resolves.toEqual([fixture(9, '1H', 'api')]);
  });

  it('KEEP path leaves Redis untouched when replace365 is not called', async () => {
    const previous = [fixture(10, '1H', '365'), fixture(11, '2H', '365')];
    const redis = redisHarness({
      [FOOTBALL_365_LIVE_MATCHES_KEY]: JSON.stringify(previous),
    });
    mockedGetRedisClient.mockReturnValue(redis.client as any);

    // Simulates syncLiveSnapshot KEEP_PREVIOUS: skip replace365 on empty degraded tick.
    await expect(read365LiveFixtureIds()).resolves.toEqual([10, 11]);
    const { fixtures, source } = await resolveLiveFixturesForClient();
    expect(source).toBe('redis');
    expect(fixtures).toEqual(previous);
  });

  it('merges legacy and provider lists with provider data winning duplicates', async () => {
    const redis = redisHarness({
      [FOOTBALL_LIVE_MATCHES_KEY]: JSON.stringify([
        fixture(1, '1H', 'legacy'),
        fixture(2, '1H', 'legacy'),
      ]),
      [FOOTBALL_API_LIVE_MATCHES_KEY]: JSON.stringify([fixture(1, '2H', 'api')]),
      [FOOTBALL_365_LIVE_MATCHES_KEY]: JSON.stringify([fixture(1, 'HT', '365')]),
    });
    mockedGetRedisClient.mockReturnValue(redis.client as any);

    await expect(readLiveFixturesList()).resolves.toEqual([
      fixture(1, 'HT', '365'),
      fixture(2, '1H', 'legacy'),
    ]);
  });

  it('terminal tombstone suppresses stale live rows from either provider', async () => {
    const redis = redisHarness({
      [FOOTBALL_API_LIVE_MATCHES_KEY]: JSON.stringify([fixture(7, '1H', 'api')]),
      [FOOTBALL_365_LIVE_MATCHES_KEY]: JSON.stringify([fixture(7, '2H', '365')]),
    });
    mockedGetRedisClient.mockReturnValue(redis.client as any);

    await mergeLiveFixturesIntoRedisSnapshot([fixture(7, 'FT', '365')]);

    expect(redis.values.get(FOOTBALL_365_LIVE_MATCHES_KEY)).toBe('[]');
    await expect(readLiveFixturesList()).resolves.toEqual([]);
    await expect(readLiveFixtureById(7)).resolves.toBeNull();
  });

  it('REPLACE 365 live list drops ghost ids and keeps only the current set', async () => {
    const ghostId = 4_751_186;
    const liveId = 4_822_440;
    const redis = redisHarness({
      [FOOTBALL_365_LIVE_MATCHES_KEY]: JSON.stringify([fixture(ghostId, '1H', '365')]),
      [FOOTBALL_API_LIVE_MATCHES_KEY]: JSON.stringify([fixture(12, '2H', 'api')]),
    });
    mockedGetRedisClient.mockReturnValue(redis.client as any);
    // Owned 365 rows are no longer tombstoned on the first accepted omission.
    // The original end state still holds once the absence grace is satisfied.
    const now = jest.spyOn(Date, 'now');
    const t0 = 1_700_000_000_000;
    now.mockReturnValue(t0);

    try {
      await replace365LiveFixturesSnapshot([fixture(liveId, '2H', '365')]);

      let next365 = JSON.parse(redis.values.get(FOOTBALL_365_LIVE_MATCHES_KEY) ?? '[]') as any[];
      expect(next365.map((row) => row.fixture.id).sort((a, b) => a - b)).toEqual(
        [ghostId, liveId].sort((a, b) => a - b),
      );
      expect(redis.values.has(`${FOOTBALL_FIXTURE_TERMINAL_KEY_PREFIX}${ghostId}`)).toBe(false);
      expect(redis.values.has(`${FOOTBALL_FIXTURE_TERMINAL_LATCHED_KEY_PREFIX}${ghostId}`)).toBe(false);

      now.mockReturnValue(t0 + 180_000);
      await replace365LiveFixturesSnapshot([fixture(liveId, '2H', '365')]);
      await replace365LiveFixturesSnapshot([fixture(liveId, '2H', '365')]);

      next365 = JSON.parse(redis.values.get(FOOTBALL_365_LIVE_MATCHES_KEY) ?? '[]') as any[];
      expect(next365.map((row) => row.fixture.id)).toEqual([liveId]);
      expect(redis.values.has(`${FOOTBALL_FIXTURE_TERMINAL_KEY_PREFIX}${ghostId}`)).toBe(true);
      expect(redis.values.has(`${FOOTBALL_FIXTURE_TERMINAL_LATCHED_KEY_PREFIX}${ghostId}`)).toBe(false);
      await expect(read365LiveFixtureIds()).resolves.toEqual([liveId]);
      await expect(readLiveFixturesList()).resolves.toEqual([
        fixture(12, '2H', 'api'),
        fixture(liveId, '2H', '365'),
      ]);
    } finally {
      now.mockRestore();
    }
  });

  it('REPLACE keeps a statusGroup-3 row even if the mapper classified it as FT', async () => {
    const id = 4_633_358;
    const redis = redisHarness({
      [FOOTBALL_365_LIVE_MATCHES_KEY]: JSON.stringify([]),
    });
    mockedGetRedisClient.mockReturnValue(redis.client as any);

    await replace365LiveFixturesSnapshot([fixture(id, 'FT', '365')]);

    const next365 = JSON.parse(redis.values.get(FOOTBALL_365_LIVE_MATCHES_KEY) ?? '[]') as any[];
    expect(next365).toHaveLength(1);
    expect(next365[0].fixture.id).toBe(id);
    expect(next365[0].fixture.status.short).toBe('LIVE');
    expect(redis.values.has(`${FOOTBALL_FIXTURE_TERMINAL_KEY_PREFIX}${id}`)).toBe(false);
  });

  it('REPLACE drops a stuck 90+20 clock instead of remapping it to LIVE', async () => {
    const id = 4_633_359;
    const redis = redisHarness({
      [FOOTBALL_365_LIVE_MATCHES_KEY]: JSON.stringify([
        {
          fixture: { id, status: { short: '2H', elapsed: 90, extra: 4 } },
          league: { id: 0 },
          provider: '365',
        },
      ]),
    });
    mockedGetRedisClient.mockReturnValue(redis.client as any);

    await replace365LiveFixturesSnapshot([
      {
        ...fixture(id, '2H', '365'),
        fixture: {
          id,
          status: { short: '2H', long: 'Second Half', elapsed: 90, extra: 20 },
          date: new Date(Date.now() - 130 * 60 * 1000).toISOString(),
        },
      } as any,
    ]);

    const next365 = JSON.parse(redis.values.get(FOOTBALL_365_LIVE_MATCHES_KEY) ?? '[]') as any[];
    expect(next365).toHaveLength(0);
    expect(redis.values.has(`${FOOTBALL_FIXTURE_TERMINAL_KEY_PREFIX}${id}`)).toBe(true);
  });

  it('keeps a current 365 live row even if a leftover terminal tombstone exists', async () => {
    const id = 4_633_358;
    const redis = redisHarness({
      [`${FOOTBALL_FIXTURE_TERMINAL_KEY_PREFIX}${id}`]: JSON.stringify(fixture(id, 'FT', '365')),
      [FOOTBALL_365_LIVE_MATCHES_KEY]: JSON.stringify([fixture(id, '2H', '365')]),
    });
    mockedGetRedisClient.mockReturnValue(redis.client as any);

    await expect(readLiveFixturesList()).resolves.toEqual([fixture(id, '2H', '365')]);
    await expect(readLiveFixtureById(id)).resolves.toEqual(fixture(id, '2H', '365'));
  });

  it('authoritative FT tombstone wins over the current 365 live set', async () => {
    const id = 4_633_360;
    const redis = redisHarness({
      [`${FOOTBALL_FIXTURE_TERMINAL_KEY_PREFIX}${id}`]: JSON.stringify({
        ...fixture(id, 'FT', '365'),
        _authoritativeTerminal: true,
      }),
      [FOOTBALL_365_LIVE_MATCHES_KEY]: JSON.stringify([fixture(id, '2H', '365')]),
    });
    mockedGetRedisClient.mockReturnValue(redis.client as any);

    await expect(readLiveFixturesList()).resolves.toEqual([]);
    await expect(readLiveFixtureById(id)).resolves.toEqual(fixture(id, 'FT', '365'));
  });

  it('REPLACE does not revive a details-confirmed FT tombstone', async () => {
    const id = 4_633_361;
    const redis = redisHarness({
      [`${FOOTBALL_FIXTURE_TERMINAL_KEY_PREFIX}${id}`]: JSON.stringify({
        ...fixture(id, 'FT', '365'),
        _authoritativeTerminal: true,
      }),
      [FOOTBALL_365_LIVE_MATCHES_KEY]: JSON.stringify([fixture(id, '2H', '365')]),
    });
    mockedGetRedisClient.mockReturnValue(redis.client as any);

    await replace365LiveFixturesSnapshot([fixture(id, '2H', '365')]);

    const next365 = JSON.parse(redis.values.get(FOOTBALL_365_LIVE_MATCHES_KEY) ?? '[]') as any[];
    expect(next365).toHaveLength(0);
    expect(redis.values.has(`${FOOTBALL_FIXTURE_TERMINAL_KEY_PREFIX}${id}`)).toBe(true);
    await expect(readLiveFixturesList()).resolves.toEqual([]);
  });

  it('does not rehydrate 365 live rows from CachedFixture when Redis is the source', async () => {
    const prisma = require('../../lib/prisma').default;
    prisma.cachedFixture.findMany.mockClear();
    const experiment = require('../scores365-experiment.service');
    experiment.isScores365ExperimentEnabled.mockReturnValue(true);

    const redis = redisHarness({
      [FOOTBALL_365_LIVE_MATCHES_KEY]: JSON.stringify([fixture(4_822_440, '1H', '365')]),
    });
    mockedGetRedisClient.mockReturnValue(redis.client as any);

    const { fixtures } = await resolveLiveFixturesForClient();
    expect(fixtures.map((row) => row.fixture.id)).toEqual([4_822_440]);
    expect(prisma.cachedFixture.findMany).not.toHaveBeenCalled();
  });

  it('serves a native 365 fixture from CachedFixture even when the row is stale', async () => {
    const prisma = require('../../lib/prisma').default;
    const { matchCacheService } = require('../match-cache.service');
    const id = 4_627_937;
    const converted = fixture(id, 'NS', '365');
    matchCacheService.convertDbMatchToApiFormat.mockReturnValue(converted);
    prisma.cachedFixture.findUnique.mockResolvedValue({
      fixtureId: id,
      status: 'NS',
      matchDate: new Date('2026-12-01T18:00:00.000Z'),
      matchTimestamp: Math.floor(new Date('2026-12-01T18:00:00.000Z').getTime() / 1000),
      updatedAt: new Date('2020-01-01T00:00:00.000Z'),
    });
    mockedGetRedisClient.mockReturnValue(redisHarness().client as any);

    await expect(resolveFixtureForClient(id)).resolves.toEqual({
      fixture: converted,
      source: 'db',
    });
  });
});

describe('terminal latch (P1-3)', () => {
  beforeEach(() => {
    mockedGetRedisClient.mockReset();
    invalidateFixtureDetailCaches.mockClear();
  });

  it('invalidates detail caches only on the first LIVE→FT write', async () => {
    const {
      writeTerminalFixtureSnapshot,
      isTerminalLatched,
    } = require('../live-fixture-cache.service');
    const redis = redisHarness();
    mockedGetRedisClient.mockReturnValue(redis.client as any);
    const ft = fixture(4732070, 'FT', 'api-football');

    await writeTerminalFixtureSnapshot(ft);
    await Promise.resolve();
    await Promise.resolve();
    expect(invalidateFixtureDetailCaches).toHaveBeenCalledTimes(1);
    expect(invalidateFixtureDetailCaches).toHaveBeenCalledWith(4732070, 'LIVE→FT');
    await expect(isTerminalLatched(4732070)).resolves.toBe(true);

    // Second write may take the one-shot 6h correction slot.
    invalidateFixtureDetailCaches.mockClear();
    await writeTerminalFixtureSnapshot(ft);
    await Promise.resolve();
    await Promise.resolve();
    expect(invalidateFixtureDetailCaches).toHaveBeenCalledTimes(1);
    expect(invalidateFixtureDetailCaches).toHaveBeenCalledWith(4732070, 'LIVE→FT-correction');

    // Third write must be fully suppressed.
    invalidateFixtureDetailCaches.mockClear();
    await writeTerminalFixtureSnapshot(ft);
    await Promise.resolve();
    await Promise.resolve();
    expect(invalidateFixtureDetailCaches).not.toHaveBeenCalled();
  });

  it('allows one correction invalidate after latch within a separate 6h window', async () => {
    const { writeTerminalFixtureSnapshot } = require('../live-fixture-cache.service');
    const redis = redisHarness({
      'football:fixture_terminal_latched:99': '1',
    });
    mockedGetRedisClient.mockReturnValue(redis.client as any);

    await writeTerminalFixtureSnapshot(fixture(99, 'FT', 'api-football'));
    await Promise.resolve();
    await Promise.resolve();
    expect(invalidateFixtureDetailCaches).toHaveBeenCalledWith(99, 'LIVE→FT-correction');

    invalidateFixtureDetailCaches.mockClear();
    await writeTerminalFixtureSnapshot(fixture(99, 'FT', 'api-football'));
    await Promise.resolve();
    await Promise.resolve();
    expect(invalidateFixtureDetailCaches).not.toHaveBeenCalled();
  });

  it('rescues live list from API-Football only when Redis snapshot is missing', () => {
    expect(shouldRescueLiveListFromApiFootball(null)).toBe(true);
    expect(shouldRescueLiveListFromApiFootball('redis')).toBe(false);
    expect(shouldRescueLiveListFromApiFootball('scores365-experiment')).toBe(false);
  });
});

describe('365 live absence grace', () => {
  // Policy lock. These are the required thresholds, not imports of the implementation.
  const T0 = 1_700_000_000_000;
  const GRACE_MS = 180_000;
  const ABSENCE_TTL_SEC = 900;
  let now: jest.SpyInstance;

  function absentKey(id: number): string {
    return `${FOOTBALL_365_LIVE_ABSENT_KEY_PREFIX}${id}`;
  }

  function tombKey(id: number): string {
    return `${FOOTBALL_FIXTURE_TERMINAL_KEY_PREFIX}${id}`;
  }

  function latchKey(id: number): string {
    return `${FOOTBALL_FIXTURE_TERMINAL_LATCHED_KEY_PREFIX}${id}`;
  }

  function listIds(redis: ReturnType<typeof redisHarness>): number[] {
    return (JSON.parse(redis.values.get(FOOTBALL_365_LIVE_MATCHES_KEY) ?? '[]') as any[]).map(
      (row) => row.fixture.id,
    );
  }

  function clocked(id: number, elapsed: number, extra: number | null, kickoffIso?: string): any {
    return {
      fixture: {
        id,
        date: kickoffIso,
        status: { short: '2H', long: 'Second Half', elapsed, extra },
      },
      league: { id: 0 },
      provider: '365',
    };
  }

  async function flushDetailInvalidate(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  }

  beforeEach(() => {
    mockedGetRedisClient.mockReset();
    invalidateFixtureDetailCaches.mockClear();
    const experiment = require('../scores365-experiment.service');
    experiment.isScores365ExperimentEnabled.mockReturnValue(false);
    const { matchCacheService } = require('../match-cache.service');
    matchCacheService.upsertFixtures.mockClear();
    now = jest.spyOn(Date, 'now').mockReturnValue(T0);
  });

  afterEach(() => {
    now?.mockRestore();
  });

  it('does not finalize a 365 live row after a single accepted omission', async () => {
    const id = 4_800_101;
    const sibling = 4_800_102;
    const previous = fixture(id, '2H', '365');
    const redis = redisHarness({
      [FOOTBALL_365_LIVE_MATCHES_KEY]: JSON.stringify([previous]),
    });
    mockedGetRedisClient.mockReturnValue(redis.client as any);

    await replace365LiveFixturesSnapshot([fixture(sibling, '1H', '365')]);

    expect(listIds(redis).sort((a, b) => a - b)).toEqual([id, sibling].sort((a, b) => a - b));
    expect(redis.values.has(tombKey(id))).toBe(false);
    expect(redis.values.has(latchKey(id))).toBe(false);
    await expect(readLiveFixtureById(id)).resolves.toEqual(previous);
    await expect(redis.client.hget(absentKey(id), 'misses')).resolves.toBe('1');
    expect(redis.client.expire).toHaveBeenCalledWith(absentKey(id), ABSENCE_TTL_SEC);
    const { matchCacheService } = require('../match-cache.service');
    expect(matchCacheService.upsertFixtures).not.toHaveBeenCalled();
  });

  it('does not finalize before 180s even after three accepted misses', async () => {
    const id = 4_800_201;
    const sibling = 4_800_202;
    const redis = redisHarness({
      [FOOTBALL_365_LIVE_MATCHES_KEY]: JSON.stringify([fixture(id, '2H', '365')]),
    });
    mockedGetRedisClient.mockReturnValue(redis.client as any);
    const incoming = [fixture(sibling, '1H', '365')];

    await replace365LiveFixturesSnapshot(incoming);
    now.mockReturnValue(T0 + 20_000);
    await replace365LiveFixturesSnapshot(incoming);
    now.mockReturnValue(T0 + 40_000);
    await replace365LiveFixturesSnapshot(incoming);
    expect(listIds(redis)).toContain(id);
    expect(redis.values.has(tombKey(id))).toBe(false);
    await expect(redis.client.hget(absentKey(id), 'misses')).resolves.toBe('3');

    now.mockReturnValue(T0 + GRACE_MS - 1);
    await replace365LiveFixturesSnapshot(incoming);
    expect(listIds(redis)).toContain(id);
    expect(redis.values.has(tombKey(id))).toBe(false);
    expect(redis.values.has(latchKey(id))).toBe(false);
  });

  it('finalizes a weak FT once 180s and 3 accepted misses are both satisfied', async () => {
    const id = 4_800_211;
    const sibling = 4_800_212;
    const redis = redisHarness({
      [FOOTBALL_365_LIVE_MATCHES_KEY]: JSON.stringify([fixture(id, '1H', '365')]),
    });
    mockedGetRedisClient.mockReturnValue(redis.client as any);
    const incoming = [fixture(sibling, '2H', '365')];
    const { matchCacheService } = require('../match-cache.service');

    await replace365LiveFixturesSnapshot(incoming);
    now.mockReturnValue(T0 + GRACE_MS);
    await replace365LiveFixturesSnapshot(incoming);
    expect(listIds(redis)).toContain(id);
    expect(redis.values.has(tombKey(id))).toBe(false);
    await expect(redis.client.hget(absentKey(id), 'misses')).resolves.toBe('2');

    await replace365LiveFixturesSnapshot(incoming);

    expect(listIds(redis)).toEqual([sibling]);
    const tomb = redis.values.get(tombKey(id));
    expect(tomb).toBeTruthy();
    expect(JSON.parse(tomb!)._authoritativeTerminal).toBeUndefined();
    expect(JSON.parse(tomb!).fixture.status.short).toBe('FT');
    expect(redis.ttls.get(tombKey(id))).toBe(600);
    expect(redis.values.has(latchKey(id))).toBe(false);
    await expect(isTerminalLatched(id)).resolves.toBe(false);
    await expect(redis.client.hget(absentKey(id), 'misses')).resolves.toBeNull();
    expect(matchCacheService.upsertFixtures).toHaveBeenCalledTimes(1);
    await flushDetailInvalidate();
    expect(invalidateFixtureDetailCaches).toHaveBeenCalledWith(id, 'LIVE→FT');
    await expect(resolveFixtureForClient(id)).resolves.toMatchObject({
      source: 'redis-terminal',
      fixture: { fixture: { id, status: { short: 'FT' } } },
    });
  });

  it('does not treat a gap with no accepted snapshot as another absence', async () => {
    const id = 4_800_301;
    const sibling = 4_800_302;
    const redis = redisHarness({
      [FOOTBALL_365_LIVE_MATCHES_KEY]: JSON.stringify([fixture(id, '2H', '365')]),
    });
    mockedGetRedisClient.mockReturnValue(redis.client as any);
    const incoming = [fixture(sibling, '1H', '365')];

    await replace365LiveFixturesSnapshot(incoming);
    // Failed, timed-out, or KEEP_PREVIOUS syncs never call replace365.
    // 10 minutes is past the 180s grace and inside the 900s absence TTL.
    now.mockReturnValue(T0 + 600_000);
    expect(listIds(redis)).toContain(id);
    expect(redis.values.has(tombKey(id))).toBe(false);
    await expect(redis.client.hget(absentKey(id), 'misses')).resolves.toBe('1');

    await replace365LiveFixturesSnapshot(incoming);

    expect(listIds(redis)).toContain(id);
    expect(redis.values.has(tombKey(id))).toBe(false);
    expect(redis.values.has(latchKey(id))).toBe(false);
    await expect(redis.client.hget(absentKey(id), 'misses')).resolves.toBe('2');
    await expect(redis.client.hget(absentKey(id), 'since')).resolves.toBe(String(T0));
    expect(redis.client.expire).toHaveBeenCalledWith(absentKey(id), ABSENCE_TTL_SEC);
  });

  it('clears absence tracking when the fixture returns before finalization', async () => {
    const id = 4_800_401;
    const sibling = 4_800_402;
    const previous = fixture(id, '2H', '365');
    const redis = redisHarness({
      [FOOTBALL_365_LIVE_MATCHES_KEY]: JSON.stringify([previous]),
    });
    mockedGetRedisClient.mockReturnValue(redis.client as any);

    await replace365LiveFixturesSnapshot([fixture(sibling, '1H', '365')]);
    await expect(redis.client.hget(absentKey(id), 'misses')).resolves.toBe('1');

    await replace365LiveFixturesSnapshot([previous, fixture(sibling, '1H', '365')]);

    await expect(redis.client.hget(absentKey(id), 'misses')).resolves.toBeNull();
    expect(redis.values.has(tombKey(id))).toBe(false);
    expect(redis.values.has(latchKey(id))).toBe(false);
    await expect(readLiveFixtureById(id)).resolves.toEqual(previous);

    await replace365LiveFixturesSnapshot([fixture(sibling, '1H', '365')]);
    await expect(redis.client.hget(absentKey(id), 'misses')).resolves.toBe('1');
    expect(listIds(redis)).toContain(id);
    expect(redis.values.has(tombKey(id))).toBe(false);
  });

  it('drops a weak tombstone and does not leave a latch when the fixture returns', async () => {
    const id = 4_800_411;
    const sibling = 4_800_412;
    const previous = fixture(id, '2H', '365');
    const redis = redisHarness({
      [FOOTBALL_365_LIVE_MATCHES_KEY]: JSON.stringify([previous]),
    });
    mockedGetRedisClient.mockReturnValue(redis.client as any);
    const incoming = [fixture(sibling, '1H', '365')];

    await replace365LiveFixturesSnapshot(incoming);
    now.mockReturnValue(T0 + GRACE_MS);
    await replace365LiveFixturesSnapshot(incoming);
    await replace365LiveFixturesSnapshot(incoming);
    expect(redis.values.has(tombKey(id))).toBe(true);
    expect(redis.values.has(latchKey(id))).toBe(false);

    await replace365LiveFixturesSnapshot([previous]);

    expect(redis.values.has(tombKey(id))).toBe(false);
    expect(redis.values.has(latchKey(id))).toBe(false);
    await expect(isTerminalLatched(id)).resolves.toBe(false);
    await expect(readLiveFixtureById(id)).resolves.toEqual(previous);
    // The sibling was live on the previous tick, so this one omission retains it too.
    expect(listIds(redis)).toEqual([id, sibling]);

    await replace365LiveFixturesSnapshot(incoming);
    await expect(redis.client.hget(absentKey(id), 'misses')).resolves.toBe('1');
    expect(listIds(redis)).toContain(id);
    expect(redis.values.has(tombKey(id))).toBe(false);
  });

  it('still finalizes an explicit FT immediately and latches it', async () => {
    const id = 4_800_501;
    const redis = redisHarness({
      [FOOTBALL_365_LIVE_MATCHES_KEY]: JSON.stringify([fixture(id, '2H', '365')]),
    });
    mockedGetRedisClient.mockReturnValue(redis.client as any);

    await mergeLiveFixturesIntoRedisSnapshot([fixture(id, 'FT', '365')]);
    await flushDetailInvalidate();

    const tomb = redis.values.get(tombKey(id));
    expect(tomb).toBeTruthy();
    expect(JSON.parse(tomb!).fixture.status.short).toBe('FT');
    expect(JSON.parse(tomb!)._authoritativeTerminal).toBeUndefined();
    expect(redis.ttls.get(tombKey(id))).toBe(600);
    expect(listIds(redis)).not.toContain(id);
    await expect(isTerminalLatched(id)).resolves.toBe(true);
    expect(redis.ttls.get(latchKey(id))).toBe(24 * 60 * 60);
    await expect(redis.client.hget(absentKey(id), 'misses')).resolves.toBeNull();
    expect(invalidateFixtureDetailCaches).toHaveBeenCalledWith(id, 'LIVE→FT');
  });

  it('does not let an older live snapshot override an authoritative tombstone and latch', async () => {
    const id = 4_800_601;
    const redis = redisHarness({
      [tombKey(id)]: JSON.stringify({
        ...fixture(id, 'FT', '365'),
        _authoritativeTerminal: true,
      }),
      [latchKey(id)]: '1',
      [FOOTBALL_365_LIVE_MATCHES_KEY]: JSON.stringify([fixture(id, '2H', '365')]),
    });
    mockedGetRedisClient.mockReturnValue(redis.client as any);

    await replace365LiveFixturesSnapshot([fixture(id, '1H', '365')]);

    expect(listIds(redis)).not.toContain(id);
    expect(JSON.parse(redis.values.get(tombKey(id))!)._authoritativeTerminal).toBe(true);
    expect(JSON.parse(redis.values.get(tombKey(id))!).fixture.status.short).toBe('FT');
    expect(redis.values.get(latchKey(id))).toBe('1');
    await expect(isTerminalLatched(id)).resolves.toBe(true);
    await expect(readLiveFixtureById(id)).resolves.toEqual(fixture(id, 'FT', '365'));
  });

  it('applies the same grace to a CLEAR instead of finalizing every owned row', async () => {
    const ownedA = 4_800_701;
    const ownedB = 4_800_702;
    const notOwned = 42;
    const redis = redisHarness({
      [FOOTBALL_365_LIVE_MATCHES_KEY]: JSON.stringify([
        fixture(ownedA, '2H', '365'),
        fixture(ownedB, '1H', '365'),
        fixture(notOwned, '1H', '365'),
      ]),
    });
    mockedGetRedisClient.mockReturnValue(redis.client as any);

    await replace365LiveFixturesSnapshot([]);

    expect(listIds(redis).sort((a, b) => a - b)).toEqual([ownedA, ownedB].sort((a, b) => a - b));
    expect(redis.values.has(tombKey(ownedA))).toBe(false);
    expect(redis.values.has(tombKey(ownedB))).toBe(false);
    expect(redis.values.has(tombKey(notOwned))).toBe(false);
    expect(redis.values.has(latchKey(ownedA))).toBe(false);

    now.mockReturnValue(T0 + GRACE_MS);
    await replace365LiveFixturesSnapshot([]);
    expect(listIds(redis)).toEqual(expect.arrayContaining([ownedA, ownedB]));
    expect(redis.values.has(tombKey(ownedA))).toBe(false);

    await replace365LiveFixturesSnapshot([]);

    expect(listIds(redis)).toEqual([]);
    expect(redis.values.has(tombKey(ownedA))).toBe(true);
    expect(redis.values.has(tombKey(ownedB))).toBe(true);
    expect(redis.values.has(tombKey(notOwned))).toBe(false);
    expect(redis.values.has(latchKey(ownedA))).toBe(false);
    expect(redis.values.has(latchKey(ownedB))).toBe(false);
    expect(JSON.parse(redis.values.get(tombKey(ownedA))!)._authoritativeTerminal).toBeUndefined();
  });

  it('keeps an incoming 90+7 clock live', async () => {
    const id = 4_800_801;
    const kickoff = new Date(T0 - 100 * 60_000).toISOString();
    const row = clocked(id, 90, 7, kickoff);
    const redis = redisHarness();
    mockedGetRedisClient.mockReturnValue(redis.client as any);

    await replace365LiveFixturesSnapshot([row]);

    expect(listIds(redis)).toEqual([id]);
    expect(JSON.parse(redis.values.get(FOOTBALL_365_LIVE_MATCHES_KEY)! )[0].fixture.status).toMatchObject({
      short: '2H',
      elapsed: 90,
      extra: 7,
    });
    expect(redis.values.has(tombKey(id))).toBe(false);

    const mappedFt = clocked(4_800_803, 90, 7, kickoff);
    mappedFt.fixture.status.short = 'FT';
    await replace365LiveFixturesSnapshot([mappedFt]);
    const kept = JSON.parse(redis.values.get(FOOTBALL_365_LIVE_MATCHES_KEY)!)[0];
    expect(kept.fixture.id).toBe(4_800_803);
    expect(kept.fixture.status.short).toBe('LIVE');
    expect(kept.fixture.status.extra).toBe(7);
    expect(redis.values.has(tombKey(4_800_803))).toBe(false);
  });

  it('still drops an incoming 90+20, elapsed 110, or 170-minute kickoff immediately', async () => {
    const kickoff = new Date(T0 - 100 * 60_000).toISOString();
    const cases = [
      clocked(4_800_811, 90, 20, kickoff),
      clocked(4_800_812, 110, null),
      clocked(4_800_813, 90, null, new Date(T0 - 170 * 60_000).toISOString()),
    ];

    for (const row of cases) {
      const id = row.fixture.id;
      const redis = redisHarness();
      mockedGetRedisClient.mockReturnValue(redis.client as any);
      await replace365LiveFixturesSnapshot([row]);
      expect(listIds(redis)).toEqual([]);
      expect(redis.values.has(tombKey(id))).toBe(true);
      expect(redis.values.has(latchKey(id))).toBe(true);
      expect(redis.ttls.get(tombKey(id))).toBe(600);
    }
  });

  it('retains a 90+7 row across a single omission and still drops a stale last clock', async () => {
    const kickoff = new Date(T0 - 100 * 60_000).toISOString();
    const liveId = 4_800_821;
    const staleId = 4_800_822;
    const agedId = 4_800_823;
    const sibling = 4_800_824;
    const live = clocked(liveId, 90, 7, kickoff);
    const redis = redisHarness({
      [FOOTBALL_365_LIVE_MATCHES_KEY]: JSON.stringify([
        live,
        clocked(staleId, 90, 20, kickoff),
        clocked(agedId, 90, null, new Date(T0 - 170 * 60_000).toISOString()),
        clocked(4_800_825, 110, null, kickoff),
      ]),
    });
    mockedGetRedisClient.mockReturnValue(redis.client as any);

    await replace365LiveFixturesSnapshot([fixture(sibling, '2H', '365')]);

    const kept = (JSON.parse(redis.values.get(FOOTBALL_365_LIVE_MATCHES_KEY)!) as any[]).find(
      (row) => row.fixture.id === liveId,
    );
    expect(kept.fixture.status).toMatchObject({ short: '2H', elapsed: 90, extra: 7 });
    expect(redis.values.has(tombKey(liveId))).toBe(false);
    expect(redis.values.has(latchKey(liveId))).toBe(false);
    expect(listIds(redis)).not.toEqual(expect.arrayContaining([staleId, agedId, 4_800_825]));
    for (const id of [staleId, agedId, 4_800_825]) {
      expect(redis.values.has(tombKey(id))).toBe(true);
      expect(redis.values.has(latchKey(id))).toBe(true);
    }
  });

  it('keeps an authoritative FT written during the grace window', async () => {
    const id = 4_800_901;
    const sibling = 4_800_902;
    const live = fixture(id, '2H', '365');
    const redis = redisHarness({
      [FOOTBALL_365_LIVE_MATCHES_KEY]: JSON.stringify([live]),
    });
    mockedGetRedisClient.mockReturnValue(redis.client as any);

    await replace365LiveFixturesSnapshot([fixture(sibling, '1H', '365')]);
    expect(listIds(redis)).toContain(id);

    await writeTerminalFixtureSnapshot(fixture(id, 'FT', '365'), '365', { authoritative: true });
    expect(JSON.parse(redis.values.get(tombKey(id))!)._authoritativeTerminal).toBe(true);
    expect(redis.ttls.get(tombKey(id))).toBe(24 * 60 * 60);
    await expect(isTerminalLatched(id)).resolves.toBe(true);
    await expect(readLiveFixtureById(id)).resolves.toEqual(fixture(id, 'FT', '365'));

    await replace365LiveFixturesSnapshot([live, fixture(sibling, '1H', '365')]);

    expect(listIds(redis)).not.toContain(id);
    expect(listIds(redis)).toContain(sibling);
    expect(JSON.parse(redis.values.get(tombKey(id))!)._authoritativeTerminal).toBe(true);
    expect(JSON.parse(redis.values.get(tombKey(id))!).fixture.status.short).toBe('FT');
    expect(redis.values.get(latchKey(id))).toBe('1');
    expect(redis.ttls.get(tombKey(id))).toBe(24 * 60 * 60);

    invalidateFixtureDetailCaches.mockClear();
    await writeTerminalFixtureSnapshot(live, '365', { skipLatch: true });
    await flushDetailInvalidate();

    expect(invalidateFixtureDetailCaches).not.toHaveBeenCalled();
    expect(JSON.parse(redis.values.get(tombKey(id))!).fixture.status.short).toBe('FT');
    expect(JSON.parse(redis.values.get(tombKey(id))!)._authoritativeTerminal).toBe(true);
    expect(redis.values.get(latchKey(id))).toBe('1');
    expect(redis.ttls.get(tombKey(id))).toBe(24 * 60 * 60);
  });

  it('upgrades a weak absence FT when an authoritative FT arrives later', async () => {
    const id = 4_800_911;
    const sibling = 4_800_912;
    const redis = redisHarness({
      [FOOTBALL_365_LIVE_MATCHES_KEY]: JSON.stringify([fixture(id, '2H', '365')]),
    });
    mockedGetRedisClient.mockReturnValue(redis.client as any);
    const incoming = [fixture(sibling, '1H', '365')];

    await replace365LiveFixturesSnapshot(incoming);
    now.mockReturnValue(T0 + GRACE_MS);
    await replace365LiveFixturesSnapshot(incoming);
    await replace365LiveFixturesSnapshot(incoming);
    expect(redis.values.has(latchKey(id))).toBe(false);
    expect(JSON.parse(redis.values.get(tombKey(id))!)._authoritativeTerminal).toBeUndefined();

    await writeTerminalFixtureSnapshot(fixture(id, 'FT', '365'), '365', { authoritative: true });

    expect(JSON.parse(redis.values.get(tombKey(id))!)._authoritativeTerminal).toBe(true);
    expect(redis.ttls.get(tombKey(id))).toBe(24 * 60 * 60);
    await expect(isTerminalLatched(id)).resolves.toBe(true);

    await replace365LiveFixturesSnapshot([fixture(id, '2H', '365')]);

    expect(listIds(redis)).not.toContain(id);
    expect(JSON.parse(redis.values.get(tombKey(id))!)._authoritativeTerminal).toBe(true);
    expect(JSON.parse(redis.values.get(tombKey(id))!).fixture.status.short).toBe('FT');
    expect(redis.values.get(latchKey(id))).toBe('1');
  });

  it('shares one grace window when two accepted omissions overlap', async () => {
    const id = 4_800_921;
    const redis = redisHarness({
      [FOOTBALL_365_LIVE_MATCHES_KEY]: JSON.stringify([fixture(id, '2H', '365')]),
    });
    mockedGetRedisClient.mockReturnValue(redis.client as any);

    await Promise.all([
      replace365LiveFixturesSnapshot([]),
      replace365LiveFixturesSnapshot([]),
    ]);

    expect(listIds(redis)).toContain(id);
    await expect(redis.client.hget(absentKey(id), 'misses')).resolves.toBe('2');
    await expect(redis.client.hget(absentKey(id), 'since')).resolves.toBe(String(T0));
    expect(redis.values.has(tombKey(id))).toBe(false);
    expect(redis.values.has(latchKey(id))).toBe(false);
  });
});
