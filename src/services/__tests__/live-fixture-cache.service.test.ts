import { getRedisClient } from '../../lib/redis';
import {
  FOOTBALL_365_LIVE_MATCHES_KEY,
  FOOTBALL_API_LIVE_MATCHES_KEY,
  FOOTBALL_LIVE_MATCHES_KEY,
} from '../../utils/football-cache-keys.util';
import { FOOTBALL_FIXTURE_TERMINAL_KEY_PREFIX } from '../live-fixture-cache.service';
import {
  mergeLiveFixturesIntoRedisSnapshot,
  read365LiveFixtureIds,
  readLiveFixtureById,
  readLiveFixturesList,
  replace365LiveFixturesSnapshot,
  resolveLiveFixturesForClient,
  writeLiveFixturesSnapshot,
} from '../live-fixture-cache.service';

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: { cachedFixture: { findUnique: jest.fn(), findMany: jest.fn() } },
}));

jest.mock('../match-cache.service', () => ({
  LIVE_STATUSES: ['1H', '2H', 'HT', 'LIVE'],
  FINISHED_STATUSES: ['FT', 'AET', 'PEN'],
  matchCacheService: {
    convertDbMatchToApiFormat: jest.fn(),
    upsertFixtures: jest.fn(async () => 0),
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
  const pipeline = () => ({
    setex: jest.fn((key: string, _ttl: number, value: string) => {
      values.set(key, value);
    }),
    del: jest.fn((key: string) => {
      values.delete(key);
    }),
    exec: jest.fn(async () => []),
  });
  return {
    values,
    client: {
      get: jest.fn(async (key: string) => values.get(key) ?? null),
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

  it('does not erase 365 rows when API-Football writes an empty snapshot', async () => {
    const redis = redisHarness({
      [FOOTBALL_365_LIVE_MATCHES_KEY]: JSON.stringify([fixture(365, '1H', '365')]),
    });
    mockedGetRedisClient.mockReturnValue(redis.client as any);

    await writeLiveFixturesSnapshot([]);

    expect(redis.values.get(FOOTBALL_API_LIVE_MATCHES_KEY)).toBe('[]');
    await expect(readLiveFixturesList()).resolves.toEqual([fixture(365, '1H', '365')]);
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

    await replace365LiveFixturesSnapshot([fixture(liveId, '2H', '365')]);

    const next365 = JSON.parse(redis.values.get(FOOTBALL_365_LIVE_MATCHES_KEY) ?? '[]') as any[];
    expect(next365.map((row) => row.fixture.id)).toEqual([liveId]);
    expect(redis.values.has(`${FOOTBALL_FIXTURE_TERMINAL_KEY_PREFIX}${ghostId}`)).toBe(true);
    await expect(read365LiveFixtureIds()).resolves.toEqual([liveId]);
    await expect(readLiveFixturesList()).resolves.toEqual([
      fixture(12, '2H', 'api'),
      fixture(liveId, '2H', '365'),
    ]);
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
});
