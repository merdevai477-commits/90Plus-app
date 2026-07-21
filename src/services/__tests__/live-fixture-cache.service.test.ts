import { getRedisClient } from '../../lib/redis';
import {
  FOOTBALL_365_LIVE_MATCHES_KEY,
  FOOTBALL_API_LIVE_MATCHES_KEY,
  FOOTBALL_LIVE_MATCHES_KEY,
} from '../../utils/football-cache-keys.util';
import {
  mergeLiveFixturesIntoRedisSnapshot,
  readLiveFixtureById,
  readLiveFixturesList,
  writeLiveFixturesSnapshot,
} from '../live-fixture-cache.service';

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: { cachedFixture: { findUnique: jest.fn(), findMany: jest.fn() } },
}));

jest.mock('../match-cache.service', () => ({
  LIVE_STATUSES: ['1H', '2H', 'HT', 'LIVE'],
  FINISHED_STATUSES: ['FT', 'AET', 'PEN'],
  matchCacheService: { convertDbMatchToApiFormat: jest.fn() },
}));

jest.mock('../scores365-experiment.service', () => ({
  getScores365ExperimentConfig: () => ({ fixtureId: -1 }),
  getScores365ExperimentFixture: jest.fn(async () => null),
  isScores365ExperimentEnabled: () => false,
  isScores365ExperimentFixture: () => false,
  resolveScores365AppLanguage: () => 'en',
  SCORES365_LEAGUE_ID_OFFSET: 10_000_000,
}));

const mockedGetRedisClient = getRedisClient as jest.MockedFunction<typeof getRedisClient>;

function fixture(id: number, status: string, provider: string): any {
  return { fixture: { id, status: { short: status } }, provider };
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
  beforeEach(() => mockedGetRedisClient.mockReset());

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
});
