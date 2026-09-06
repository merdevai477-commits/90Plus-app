/**
 * A live fixture row with empty fullData must not be cached as the details bundle.
 * Otherwise `/details` keeps painting lineups=0/stats=0 while `/statistics` already has data.
 */

const redisStore = new Map<string, any>();

const liveFixture = {
  fixture: {
    id: 4752417,
    status: { short: '2H', elapsed: 70 },
    venue: { name: 'El Madrigal' },
    timestamp: Math.floor(Date.now() / 1000),
  },
  teams: {
    home: { id: 1, name: 'Villarreal B', logo: '' },
    away: { id: 2, name: 'Algeciras', logo: '' },
  },
  goals: { home: 1, away: 1 },
};

const structuredXi = [
  {
    team: { id: 1, name: 'Villarreal B' },
    _source: 'scores365-experiment',
    startXI: Array.from({ length: 11 }, (_, i) => ({
      player: { id: i + 1, name: `H${i}` },
    })),
    substitutes: [],
  },
];

const richStats = [
  {
    team: { id: 1, name: 'Villarreal B', logo: '' },
    statistics: [
      { type: 'Ball Possession', value: '58%' },
      { type: 'Total Shots', value: 9 },
    ],
  },
  {
    team: { id: 2, name: 'Algeciras', logo: '' },
    statistics: [
      { type: 'Ball Possession', value: '42%' },
      { type: 'Total Shots', value: 4 },
    ],
  },
];

jest.mock('../lib/prisma', () => ({
  __esModule: true,
  default: {
    cachedFixture: {
      findUnique: jest.fn(async () => ({
        status: '2H',
        leagueId: 7_000_140,
        matchDate: new Date(),
        fullData: null,
        homeTeamId: 1,
        homeTeamName: 'Villarreal B',
        homeTeamLogo: '',
        awayTeamId: 2,
        awayTeamName: 'Algeciras',
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

const get365Bundle = jest.fn(async (): Promise<any> => null);

jest.mock('../services/scores365-experiment.service', () => ({
  ensureScores365GameMapping: jest.fn(async () => undefined),
  getScores365ExperimentBundle: (...args: any[]) => get365Bundle(...(args as [])),
  getScores365ExperimentEvents: jest.fn(async () => []),
  getScores365ExperimentStatistics: jest.fn(async () => []),
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
  posFrom365: jest.fn(() => 'M'),
  SCORES365_LEAGUE_ID_OFFSET: 7000000,
}));

jest.mock('../services/live-fixture-cache.service', () => ({
  isTerminalLatched: jest.fn(async () => false),
  readLiveFixtureById: jest.fn(async () => liveFixture),
  resolveLiveFixturesForClient: jest.fn(async () => ({ fixtures: [], source: null })),
}));

jest.mock('../services/match-cache.service', () => ({
  matchCacheService: {
    cacheMatch: jest.fn(),
    cacheMatches: jest.fn(),
    convertDbMatchToApiFormat: jest.fn(() => liveFixture),
  },
  TERMINAL_LATCH_STATUSES: ['FT', 'AET', 'PEN'],
}));

jest.mock('../services/football.service', () => ({
  footballService: {
    isConfigured: jest.fn(() => false),
    getFixtureById: jest.fn(async () => null),
    getFixtureLineupsResolved: jest.fn(async () => []),
    getFixtureLineups: jest.fn(async () => []),
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

jest.mock('../services/player-cache.service', () => ({
  playerCacheService: { upsertScores365LineupPlayers: jest.fn(async () => undefined) },
}));
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

describe('getFixtureDetailsBundle hollow live stub', () => {
  beforeEach(() => {
    redisStore.clear();
    service.detailsBundleLocal.clear();
    service.pendingDetailsBundles.clear();
    service.detailsBackgroundRefresh.clear();
    service.statisticsCache.clear();
    service.lineupsCache.clear();
    service.eventsCache.clear();
    get365Bundle.mockReset();
    get365Bundle.mockResolvedValue(null);
  });

  it('does not cache a live fixture-only stub in Redis', async () => {
    jest.useFakeTimers();
    try {
      get365Bundle.mockImplementation(() => new Promise(() => undefined));
      const pending = service.getFixtureDetailsBundle(FIXTURE);
      await jest.advanceTimersByTimeAsync(service.DETAILS_UPSTREAM_BUDGET_MS + 50);
      const bundle = await pending;
      expect(bundle.fixture?.fixture?.id).toBe(FIXTURE);
      expect(bundle.lineups).toEqual([]);
      const detailsKeys = [...redisStore.keys()].filter((key) => key.includes('details'));
      expect(detailsKeys).toEqual([]);
    } finally {
      jest.useRealTimers();
    }
  });

  it('overlays dedicated statistics onto a hollow live stub immediately', async () => {
    service.statisticsCache.set(FIXTURE, {
      data: richStats,
      timestamp: Date.now(),
      ttl: 30_000,
    });
    get365Bundle.mockImplementation(() => new Promise(() => undefined));

    const bundle = await service.getFixtureDetailsBundle(FIXTURE);
    expect(bundle.statistics[0].statistics[0].value).toBe('58%');
    expect(bundle.lineups).toEqual([]);
  });

  it('waits the upstream budget for a real 365 bundle instead of returning the stub', async () => {
    get365Bundle.mockResolvedValue({
      fixture: liveFixture,
      lineups: structuredXi,
      events: [],
      statistics: richStats,
      venue: liveFixture.fixture.venue,
      lineupsAvailable: true,
      eventsFeedAvailable: false,
    });

    const bundle = await service.getFixtureDetailsBundle(FIXTURE);
    expect(bundle.lineups[0].startXI).toHaveLength(11);
    expect(bundle.statistics[0].statistics[0].type).toBe('Ball Possession');
    expect(redisStore.get(`lineups:${FIXTURE}`)?.data[0].startXI).toHaveLength(11);
  });
});
