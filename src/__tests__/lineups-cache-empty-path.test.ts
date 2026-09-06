/**
 * Empty lineups are a legitimate answer for most fixtures, and the cache has to
 * treat them as one. Before this path existed every reader of a lineup-less
 * fixture repeated a 5-10s upstream round trip that returned nothing.
 */

const redisStore = new Map<string, any>();

jest.mock('../lib/prisma', () => ({
  __esModule: true,
  default: {
    cachedFixture: {
      findUnique: jest.fn(async () => ({
        status: 'FT',
        leagueId: 39,
        matchDate: new Date('2026-09-03T18:00:00Z'),
        fullData: null,
        homeTeamId: 1,
        homeTeamName: 'Home',
        homeTeamLogo: '',
        awayTeamId: 2,
        awayTeamName: 'Away',
        awayTeamLogo: '',
      })),
      update: jest.fn(async () => ({})),
    },
  },
}));

jest.mock('../services/redis-cache.service', () => ({
  redisCacheService: {
    get: jest.fn(async (key: string) => redisStore.get(key) ?? null),
    set: jest.fn(async (key: string, value: any) => {
      redisStore.set(key, value);
    }),
    del: jest.fn(async (key: string) => {
      redisStore.delete(key);
    }),
  },
}));

const get365Lineups = jest.fn(async (): Promise<any[]> => []);

jest.mock('../services/scores365-experiment.service', () => ({
  ensureScores365GameMapping: jest.fn(async () => undefined),
  getScores365ExperimentBundle: jest.fn(async () => null),
  getScores365ExperimentEvents: jest.fn(async () => []),
  getScores365ExperimentStatistics: jest.fn(async () => []),
  getScores365GameIdForFixture: jest.fn(() => 123),
  getScores365MatchesForDate: jest.fn(async () => []),
  getScores365WorldCupPhaseFixtures: jest.fn(async () => []),
  getScores365CompetitionId: jest.fn(() => null),
  is365StoreDetailsHotfix: jest.fn(() => false),
  isScores365ExperimentEnabled: jest.fn(() => true),
  isScores365ExperimentFixture: jest.fn(() => true),
  resolveApiFixtureIdFor365GameId: jest.fn(() => null),
  resolveScores365AppLanguage: jest.fn(() => 'ar'),
  resolveScores365LangId: jest.fn(() => 27),
  SCORES365_LEAGUE_ID_OFFSET: 7000000,
}));

jest.mock('../services/live-fixture-cache.service', () => ({
  isTerminalLatched: jest.fn(async () => true),
  readLiveFixtureById: jest.fn(async () => null),
  resolveLiveFixturesForClient: jest.fn(async () => ({ fixtures: [], source: null })),
}));

jest.mock('../services/match-cache.service', () => ({
  matchCacheService: { cacheMatch: jest.fn(), cacheMatches: jest.fn() },
  TERMINAL_LATCH_STATUSES: ['FT', 'AET', 'PEN'],
}));

jest.mock('../services/football.service', () => ({
  footballService: {
    isConfigured: jest.fn(() => false),
    getFixtureLineupsResolved: jest.fn(async () => []),
    getFixtureLineups: jest.fn(async () => []),
    getFixtureEvents: jest.fn(async () => []),
  },
  isFootballQuotaExhausted: jest.fn(() => false),
}));

jest.mock('../services/empty-upstream-backoff.service', () => ({
  shouldSkipEmptyUpstreamPoll: jest.fn(async () => ({ skip: false, nextRetryInMs: null })),
  recordEmptyUpstreamResult: jest.fn(async () => ({ nextBackoffMs: 60_000 })),
  recordNonEmptyUpstreamResult: jest.fn(async () => undefined),
}));

jest.mock('../services/player-cache.service', () => ({ playerCacheService: {} }));
jest.mock('../services/league-cache.service', () => ({ leagueCacheService: {} }));
jest.mock('../services/app-features.service', () => ({
  getWorldCupTabState: jest.fn(async () => ({ enabled: false })),
}));
jest.mock('../services/football-sync-leader.service', () => ({
  withSyncLeaderLease: jest.fn(async (_k: string, fn: () => any) => fn()),
}));
jest.mock('../lib/redis', () => ({ getRedisClient: jest.fn(() => null) }));

import { footballDataCacheService } from '../services/football-data-cache.service';

const service = footballDataCacheService as any;

describe('getMatchLineups empty-result handling', () => {
  beforeEach(() => {
    redisStore.clear();
    service.lineupsCache.clear();
    get365Lineups.mockClear();
    get365Lineups.mockResolvedValue([]);
    service.get365LineupsMerged = get365Lineups;
  });

  it('serves a cached empty result instead of hitting upstream again', async () => {
    await expect(service.getMatchLineups(4778474)).resolves.toEqual([]);
    expect(get365Lineups).toHaveBeenCalledTimes(1);

    await expect(service.getMatchLineups(4778474)).resolves.toEqual([]);
    await expect(service.getMatchLineups(4778474)).resolves.toEqual([]);
    expect(get365Lineups).toHaveBeenCalledTimes(1);
  });

  it('revalidates an expired empty result without making the caller wait', async () => {
    await service.getMatchLineups(4778474);
    expect(get365Lineups).toHaveBeenCalledTimes(1);

    const entry = redisStore.get('lineups:4778474');
    entry.timestamp = Date.now() - entry.ttl - 1;

    await expect(service.getMatchLineups(4778474)).resolves.toEqual([]);
    await new Promise((resolve) => setImmediate(resolve));
    expect(get365Lineups).toHaveBeenCalledTimes(2);
  });

  it('shares one upstream resolution between concurrent readers', async () => {
    let release: (value: any[]) => void = () => undefined;
    get365Lineups.mockImplementation(
      () => new Promise<any[]>((resolve) => { release = resolve; }),
    );

    const readers = Promise.all([
      service.getMatchLineups(4778474),
      service.getMatchLineups(4778474),
      service.getMatchLineups(4778474),
    ]);
    await new Promise((resolve) => setImmediate(resolve));
    release([]);

    await expect(readers).resolves.toEqual([[], [], []]);
    expect(get365Lineups).toHaveBeenCalledTimes(1);
  });

  it('gives up on a resolution that outlasts the response budget', async () => {
    jest.useFakeTimers();
    try {
      get365Lineups.mockImplementation(() => new Promise<any[]>(() => undefined));

      const pending = service.getMatchLineups(4778474);
      await jest.advanceTimersByTimeAsync(service.LINEUP_RESPONSE_BUDGET_MS + 10);
      await expect(pending).resolves.toEqual([]);
    } finally {
      jest.useRealTimers();
    }
  });

  it('returns last-good lineups when a stale refresh outlasts the budget', async () => {
    const xi = [
      {
        team: { id: 1, name: 'Home' },
        _source: 'scores365-experiment',
        startXI: Array.from({ length: 11 }, (_, i) => ({
          player: { id: i + 1, name: `P${i}` },
        })),
        substitutes: [],
      },
    ];
    const entry = { data: xi, timestamp: Date.now() - 60_000, ttl: 1_000 };
    redisStore.set('lineups:4778474', entry);
    service.lineupsCache.set(4778474, entry);

    jest.useFakeTimers();
    try {
      get365Lineups.mockImplementation(() => new Promise<any[]>(() => undefined));
      const pending = service.getMatchLineups(4778474);
      await jest.advanceTimersByTimeAsync(service.LINEUP_RESPONSE_BUDGET_MS + 10);
      await expect(pending).resolves.toEqual(xi);
    } finally {
      jest.useRealTimers();
    }
  });
});
