const prismaMock = {
  cachedFixture: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  cachedStandings: {
    findUnique: jest.fn(),
    upsert: jest.fn().mockResolvedValue({}),
  },
  cachedTeam: {
    findMany: jest.fn().mockResolvedValue([]),
    upsert: jest.fn().mockResolvedValue({}),
  },
  $transaction: jest.fn(async (writes: Promise<unknown>[]) => Promise.all(writes)),
};

const leaseMock = jest.fn(
  async (_scope: string, work: () => Promise<unknown>) => ({
    acquired: true,
    value: await work(),
  }),
);

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: prismaMock,
}));

jest.mock('../football-sync-leader.service', () => ({
  withSyncLeaderLease: (...args: unknown[]) => leaseMock(...(args as [string, () => Promise<unknown>])),
}));

import type { Request } from 'express';
import { buildResponseCacheKey } from '../../middleware/responseCache.middleware';
import {
  footballDataCacheService,
  mergeFixtureProviders,
} from '../football-data-cache.service';
import {
  setBoundedMapEntry,
  threeSixFiveScoresService,
} from '../threeSixFiveScores.service';
import { footballService } from '../football.service';

const standingRow = {
  groupNum: 1,
  groupName: 'A',
  position: 1,
  teamId: 10,
  teamName: 'Team',
  teamLogo: 'team.png',
  gamePlayed: 2,
  gamesWon: 2,
  gamesEven: 0,
  gamesLost: 0,
  goalsFor: 4,
  goalsAgainst: 0,
  ratio: 4,
  points: 6,
};

describe('football cache reliability', () => {
  const originalExperiment = process.env.SCORES365_EXPERIMENT_ENABLED;

  beforeEach(() => {
    jest.restoreAllMocks();
    process.env.SCORES365_EXPERIMENT_ENABLED = 'true';
    process.env.FOOTBALL_STANDINGS_FRESH_MS = '3600000';
    process.env.FOOTBALL_STANDINGS_STALE_MS = '86400000';
    footballDataCacheService.clearMemoryCache();
    jest.clearAllMocks();
    prismaMock.cachedFixture.findMany.mockResolvedValue([]);
    prismaMock.cachedTeam.findMany.mockResolvedValue([]);
    prismaMock.cachedStandings.upsert.mockResolvedValue({});
  });

  afterAll(() => {
    if (originalExperiment == null) delete process.env.SCORES365_EXPERIMENT_ENABLED;
    else process.env.SCORES365_EXPERIMENT_ENABLED = originalExperiment;
  });

  it('isolates shared response cache entries by resolved language', () => {
    const request = (language: string) => ({
      baseUrl: '/api/football',
      path: '/cached/365/standings',
      query: {},
      headers: { 'accept-language': language },
    }) as unknown as Request;

    expect(buildResponseCacheKey(request('en-US'), true))
      .not.toBe(buildResponseCacheKey(request('ar-EG'), true));
  });

  it('evicts oldest entries from bounded process maps', () => {
    const map = new Map<string, number>();
    setBoundedMapEntry(map, 'a', 1, 2);
    setBoundedMapEntry(map, 'b', 2, 2);
    setBoundedMapEntry(map, 'c', 3, 2);
    expect([...map.entries()]).toEqual([['b', 2], ['c', 3]]);

    const service = footballDataCacheService as any;
    for (let i = 0; i < 70; i++) {
      service.storeLocalMatchesByDate(`2026-01-${String(i).padStart(2, '0')}`, [], 1000);
    }
    expect(footballDataCacheService.getInProcessCacheSizes().matchesByDateLocal).toBeLessThanOrEqual(64);
  });

  it('serves stale standings immediately and coalesces distributed refresh', async () => {
    prismaMock.cachedStandings.findUnique.mockResolvedValue({
      payload: { raw: [standingRow] },
      updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    });
    const upstream = jest
      .spyOn(threeSixFiveScoresService, 'getStandings')
      .mockResolvedValue({ data: null, source: null });

    const [first, second] = await Promise.all([
      footballDataCacheService.getCached365Standings(777, 'en'),
      footballDataCacheService.getCached365Standings(777, 'en'),
    ]);

    expect(first.data).toEqual([standingRow]);
    expect(second.data).toEqual([standingRow]);
    expect(leaseMock).toHaveBeenCalledTimes(1);
    await Promise.resolve();
    expect(upstream).toHaveBeenCalledWith(777, 'en', { force: true });
    expect(prismaMock.cachedTeam.upsert).not.toHaveBeenCalled();
  });

  it('uses fresh durable standings without upstream or team writes', async () => {
    prismaMock.cachedStandings.findUnique.mockResolvedValue({
      payload: { raw: [standingRow] },
      updatedAt: new Date(),
    });
    const upstream = jest.spyOn(threeSixFiveScoresService, 'getStandings');

    await expect(
      footballDataCacheService.getCached365Standings(888, 'ar'),
    ).resolves.toMatchObject({ data: [standingRow] });

    expect(upstream).not.toHaveBeenCalled();
    expect(leaseMock).not.toHaveBeenCalled();
    expect(prismaMock.cachedTeam.upsert).not.toHaveBeenCalled();
  });

  it('refreshes the requested competition and batches only changed teams', async () => {
    prismaMock.cachedStandings.findUnique.mockResolvedValue({
      payload: { raw: [standingRow] },
      updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    });
    prismaMock.cachedTeam.findMany.mockResolvedValue([
      { teamId: 10, name: 'Old Team', logo: 'old.png' },
    ]);
    const refreshed = [{ ...standingRow, teamName: 'New Team', teamLogo: 'new.png' }];
    const upstream = jest
      .spyOn(threeSixFiveScoresService, 'getStandings')
      .mockResolvedValue({ data: refreshed, source: '365scores' });

    await expect(
      footballDataCacheService.getCached365Standings(999, 'en'),
    ).resolves.toMatchObject({ data: refreshed });

    expect(upstream).toHaveBeenCalledWith(999, 'en', { force: true });
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.cachedTeam.upsert).toHaveBeenCalledTimes(1);
    expect(prismaMock.cachedTeam.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { teamId: 10 },
        update: expect.objectContaining({ name: 'New Team', logo: 'new.png' }),
      }),
    );
  });

  it('keeps past-date reads DB/cache-only when empty', async () => {
    const upstream = jest.spyOn(footballService, 'getFixtures');
    await expect(footballDataCacheService.getMatchesByDate('2020-01-01')).resolves.toEqual([]);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('merges provider duplicates while preserving the canonical fixture id', () => {
    const base = {
      fixture: { id: 100, timestamp: 1_800_000_000, status: { short: 'NS' } },
      teams: { home: { name: 'Al Ahly' }, away: { name: 'Zamalek' } },
      goals: { home: null, away: null },
    };
    const overlay = {
      fixture: { id: 9_999, timestamp: 1_800_000_000, status: { short: '1H', elapsed: 12 } },
      teams: { home: { name: 'Al-Ahly' }, away: { name: 'Zamalek' } },
      goals: { home: 1, away: 0 },
      _experiment: 'scores365',
    };

    const merged = mergeFixtureProviders([base], [overlay]);
    expect(merged).toHaveLength(1);
    expect(merged[0].fixture).toMatchObject({ id: 100, status: { short: '1H', elapsed: 12 } });
    expect(merged[0].goals).toEqual({ home: 1, away: 0 });
  });
});
