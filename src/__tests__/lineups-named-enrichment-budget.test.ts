/**
 * Named 365 lineup enrichment (localized names / shirt numbers) used to block `/lineups`
 * past its 4s response budget, so the client got [] even though the structured XI was ready.
 */

const redisStore = new Map<string, any>();

jest.mock('../lib/prisma', () => ({
  __esModule: true,
  default: {
    cachedFixture: {
      findUnique: jest.fn(async () => null),
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

const structuredXi = [
  {
    team: { id: 1, name: 'Home' },
    _source: 'scores365-experiment',
    startXI: Array.from({ length: 11 }, (_, i) => ({
      player: { id: i + 1, name: `H${i}`, number: i + 1, pos: 'M', grid: null },
    })),
    substitutes: [],
  },
  {
    team: { id: 2, name: 'Away' },
    _source: 'scores365-experiment',
    startXI: Array.from({ length: 11 }, (_, i) => ({
      player: { id: 100 + i, name: `A${i}`, number: i + 1, pos: 'M', grid: null },
    })),
    substitutes: [],
  },
];

jest.mock('../services/scores365-experiment.service', () => ({
  ensureScores365GameMapping: jest.fn(async () => undefined),
  getScores365ExperimentBundle: jest.fn(async () => ({
    fixture: { fixture: { id: 4778474, status: { short: '2H' } } },
    lineups: structuredXi,
    events: [],
    statistics: [],
    venue: null,
  })),
  getScores365ExperimentEvents: jest.fn(async () => []),
  getScores365ExperimentStatistics: jest.fn(async () => []),
  getScores365GameIdForFixture: jest.fn(() => 4778474),
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

describe('get365LineupsMerged named-enrichment budget', () => {
  beforeEach(() => {
    redisStore.clear();
    service.lineupsCache.clear();
  });

  it('serves the structured XI when named enrichment hangs past the budget', async () => {
    jest.useFakeTimers();
    try {
      service.getCached365LineupsWithNames = jest.fn(
        () => new Promise(() => undefined),
      );
      const pending = service.get365LineupsMerged(4778474, 'ar');
      await jest.advanceTimersByTimeAsync(service.LINEUP_ENRICHMENT_BUDGET_MS + 20);
      const lineups = await pending;
      expect(lineups[0].startXI).toHaveLength(11);
      expect(lineups[1].startXI).toHaveLength(11);
    } finally {
      jest.useRealTimers();
    }
  });
});
