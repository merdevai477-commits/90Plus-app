const redisGet = jest.fn();
const redisSet = jest.fn().mockResolvedValue(undefined);
const fetchCompetitorGames = jest.fn();

jest.mock('../redis-cache.service', () => ({
  redisCacheService: {
    get: (...args: unknown[]) => redisGet(...args),
    set: (...args: unknown[]) => redisSet(...args),
  },
}));

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../match-cache.service', () => ({
  matchCacheService: { upsertFixtures: jest.fn() },
  LIVE_STATUSES: new Set(['1H']),
}));

jest.mock('../scores365-experiment.service', () => ({
  isScores365ExperimentEnabled: () => true,
  resolveScores365LangId: () => 1,
  scores365CompetitionToLeagueId: (id: number) => id,
  synthesizeBaseFrom365Game: (game: { id: number }, id: number) => ({
    fixture: { id, date: '2026-01-01T12:00:00Z', status: { short: 'FT' } },
    teams: { home: { id: 1 }, away: { id: 2 } },
    goals: { home: 1, away: 0 },
  }),
}));

import { threeSixFiveScoresService, ThreeSixFiveScoresService } from '../threeSixFiveScores.service';

describe('competitor-matches cache + coalescing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetchCompetitorGames.mockResolvedValue({
      games: [{ id: 100, startTime: '2026-01-01T12:00:00Z', competitionId: 1 }],
      competitionMeta: new Map(),
    });
    (threeSixFiveScoresService as any).fetchCompetitorGames = fetchCompetitorGames;
    (threeSixFiveScoresService as any).persistAllScoresFixtures = jest.fn();
    (threeSixFiveScoresService as any).toFixtureItem = (g: { id: number }) => g;
    (threeSixFiveScoresService as any).classifyPhase = () => 'finished';
  });

  it('returns cached data without upstream on warm path', async () => {
    redisGet.mockResolvedValueOnce({
      live: [],
      upcoming: [],
      finished: [{ fixture: { id: 1 } }],
    });

    const warm = await threeSixFiveScoresService.getCompetitorMatches(69463, 'en');
    expect(warm.cacheHit).toBe(true);
    expect(fetchCompetitorGames).not.toHaveBeenCalled();
  });

  it('coalesces parallel in-flight fetches for the same competitor', async () => {
    redisGet.mockResolvedValue(null);
    let resolveFetch!: (v: unknown) => void;
    fetchCompetitorGames.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );

    const p1 = threeSixFiveScoresService.getCompetitorMatches(69463, 'en');
    const p2 = threeSixFiveScoresService.getCompetitorMatches(69463, 'en');

    resolveFetch({
      games: [{ id: 100, startTime: '2026-01-01T12:00:00Z', competitionId: 1 }],
      competitionMeta: new Map(),
    });

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1.data?.finished?.length).toBeGreaterThan(0);
    expect(r2.data?.finished?.length).toBeGreaterThan(0);
    expect(fetchCompetitorGames).toHaveBeenCalledTimes(1);
  });

  it('uses long TTL when no live games', async () => {
    redisGet.mockResolvedValue(null);
    await threeSixFiveScoresService.getCompetitorMatches(69463, 'en');

    expect(redisSet).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      ThreeSixFiveScoresService.COMPETITOR_MATCHES_FINISHED_TTL_MS,
    );
  });
});
