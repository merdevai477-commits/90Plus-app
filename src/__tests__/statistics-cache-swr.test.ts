/**
 * `/cached/fixture/:id/statistics` for 365 fixtures used to call upstream on every read and
 * wait on it for up to 24s. The read path must now be cache-first, share one upstream
 * resolution, serve stale data while revalidating, and cap the cold wait.
 */

const redisStore = new Map<string, any>();

jest.mock('../lib/prisma', () => ({
  __esModule: true,
  default: {
    cachedFixture: {
      findUnique: jest.fn(async () => ({
        status: '2H',
        leagueId: 7_000_140,
        matchDate: new Date(),
        fullData: {
          teams: {
            home: { id: 1, name: 'Home', logo: '' },
            away: { id: 2, name: 'Away', logo: '' },
          },
          goals: { home: 1, away: 0 },
        },
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

const richStats = (possession: string) => [
  {
    team: { id: 1, name: 'Home', logo: '' },
    statistics: [
      { type: 'Ball Possession', value: possession },
      { type: 'Total Shots', value: 7 },
    ],
  },
  {
    team: { id: 2, name: 'Away', logo: '' },
    statistics: [
      { type: 'Ball Possession', value: '40%' },
      { type: 'Total Shots', value: 3 },
    ],
  },
];

const get365Statistics = jest.fn(async (): Promise<any[]> => richStats('60%'));

jest.mock('../services/scores365-experiment.service', () => ({
  ensureScores365GameMapping: jest.fn(async () => undefined),
  getScores365ExperimentBundle: jest.fn(async () => null),
  getScores365ExperimentEvents: jest.fn(async () => []),
  getScores365ExperimentStatistics: (...args: any[]) => get365Statistics(...(args as [])),
  getScores365GameIdForFixture: jest.fn(() => 4752417),
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
  isTerminalLatched: jest.fn(async () => false),
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
    getFixtureEvents: jest.fn(async () => []),
    getFixtureStatistics: jest.fn(async () => []),
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
const FIXTURE = 4752417;

describe('getMatchStatistics for 365 fixtures', () => {
  beforeEach(() => {
    redisStore.clear();
    service.statisticsCache.clear();
    service.statsResolveInFlight.clear();
    get365Statistics.mockClear();
    get365Statistics.mockResolvedValue(richStats('60%'));
  });

  it('resolves upstream once and serves the shared cache afterwards', async () => {
    const first = await service.getMatchStatistics(FIXTURE);
    expect(first[0].statistics[0].value).toBe('60%');
    expect(get365Statistics).toHaveBeenCalledTimes(1);

    await service.getMatchStatistics(FIXTURE);
    await service.getMatchStatistics(FIXTURE);
    expect(get365Statistics).toHaveBeenCalledTimes(1);
    expect(redisStore.has(`statistics:${FIXTURE}`)).toBe(true);
  });

  it('serves stale stats immediately and revalidates in the background', async () => {
    await service.getMatchStatistics(FIXTURE);
    const entry = redisStore.get(`statistics:${FIXTURE}`);
    entry.timestamp = Date.now() - entry.ttl - 1;
    service.statisticsCache.set(FIXTURE, entry);

    let release: (value: any[]) => void = () => undefined;
    get365Statistics.mockImplementation(
      () => new Promise<any[]>((resolve) => { release = resolve; }),
    );

    const stale = await service.getMatchStatistics(FIXTURE);
    expect(stale[0].statistics[0].value).toBe('60%');
    expect(get365Statistics).toHaveBeenCalledTimes(2);

    release(richStats('70%'));
    await new Promise((resolve) => setImmediate(resolve));
    const refreshed = await service.getMatchStatistics(FIXTURE);
    expect(refreshed[0].statistics[0].value).toBe('70%');
    expect(get365Statistics).toHaveBeenCalledTimes(2);
  });

  it('shares one upstream resolution between concurrent cold readers', async () => {
    let release: (value: any[]) => void = () => undefined;
    get365Statistics.mockImplementation(
      () => new Promise<any[]>((resolve) => { release = resolve; }),
    );

    const readers = Promise.all([
      service.getMatchStatistics(FIXTURE),
      service.getMatchStatistics(FIXTURE),
      service.getMatchStatistics(FIXTURE),
    ]);
    await new Promise((resolve) => setImmediate(resolve));
    release(richStats('55%'));

    const results = await readers;
    expect(results.map((r: any[]) => r[0].statistics[0].value)).toEqual(['55%', '55%', '55%']);
    expect(get365Statistics).toHaveBeenCalledTimes(1);
  });

  it('gives up on a cold resolution that outlasts the response budget', async () => {
    jest.useFakeTimers();
    try {
      get365Statistics.mockImplementation(() => new Promise<any[]>(() => undefined));
      const pending = service.getMatchStatistics(FIXTURE);
      await jest.advanceTimersByTimeAsync(service.STATS_RESPONSE_BUDGET_MS + 10);
      await expect(pending).resolves.toEqual([]);
    } finally {
      jest.useRealTimers();
    }
  });

  it('caches an empty live answer briefly so pollers do not hammer upstream', async () => {
    get365Statistics.mockResolvedValue([]);
    await expect(service.getMatchStatistics(FIXTURE)).resolves.toEqual([]);
    await expect(service.getMatchStatistics(FIXTURE)).resolves.toEqual([]);
    expect(get365Statistics).toHaveBeenCalledTimes(1);
    expect(redisStore.get(`statistics:${FIXTURE}`).ttl).toBe(service.STATS_EMPTY_LIVE_TTL_MS);
  });
});
