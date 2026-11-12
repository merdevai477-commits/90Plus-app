/**
 * Curated King daily slate overrides auto top-10 ranking.
 */

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {
    kingDailySlate: {
      findMany: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    cachedFixture: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(async (fn: (tx: any) => Promise<unknown>) => {
      const { default: db } = jest.requireMock('../../lib/prisma') as { default: any };
      return fn({
        kingDailySlate: db.kingDailySlate,
        $executeRaw: jest.fn().mockResolvedValue(1),
      });
    }),
  },
}));

jest.mock('../football-data-cache.service', () => ({
  footballDataCacheService: {
    getMatchesByDate: jest.fn(),
  },
}));

jest.mock('../../utils/fixture-importance', () => ({
  pickTopFixtures: jest.fn((rows: unknown[]) => rows.slice(0, 10)),
}));

jest.mock('../../utils/matches-list-projection.util', () => ({
  projectMatchesForListView: jest.fn((rows: unknown[]) => rows),
}));

import prisma from '../../lib/prisma';
import { footballDataCacheService } from '../football-data-cache.service';
import { getKingDailyMatches, setKingDailySlate } from '../king-prediction.service';

const mockedPrisma = prisma as jest.Mocked<typeof prisma>;
const mockedCache = footballDataCacheService as jest.Mocked<typeof footballDataCacheService>;

function fixture(id: number, name: string) {
  return {
    fixture: { id, date: `2026-11-01T12:00:00.000Z`, status: { short: 'NS' } },
    teams: { home: { name }, away: { name: 'Away' } },
    league: { name: 'Test', id: 1 },
  };
}

describe('king daily slate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns curated ids in sortOrder when a slate exists', async () => {
    (mockedPrisma.kingDailySlate.findMany as jest.Mock).mockResolvedValue([
      { apiMatchId: 200 },
      { apiMatchId: 100 },
    ]);
    (mockedCache.getMatchesByDate as jest.Mock).mockResolvedValue([
      fixture(100, 'A'),
      fixture(200, 'B'),
      fixture(300, 'C'),
    ]);

    const rows = (await getKingDailyMatches('2026-11-01')) as any[];
    expect(rows.map((r) => r.fixture.id)).toEqual([200, 100]);
  });

  it('pins the auto ranking on the first read and keeps that list', async () => {
    const findMany = mockedPrisma.kingDailySlate.findMany as jest.Mock;
    findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    (mockedCache.getMatchesByDate as jest.Mock).mockResolvedValue([
      fixture(1, 'One'),
      fixture(2, 'Two'),
    ]);

    const rows = (await getKingDailyMatches('2026-11-01')) as any[];
    expect(rows.map((row) => row.fixture.id)).toEqual([1, 2]);
    expect(mockedPrisma.kingDailySlate.createMany).toHaveBeenCalledWith({
      data: [
        { cairoDay: new Date('2026-11-01T00:00:00.000Z'), apiMatchId: 1, sortOrder: 1 },
        { cairoDay: new Date('2026-11-01T00:00:00.000Z'), apiMatchId: 2, sortOrder: 2 },
      ],
    });

    findMany.mockResolvedValue([{ apiMatchId: 2 }, { apiMatchId: 1 }]);
    const again = (await getKingDailyMatches('2026-11-01')) as any[];
    expect(again.map((row) => row.fixture.id)).toEqual([2, 1]);
    expect(mockedPrisma.kingDailySlate.createMany).toHaveBeenCalledTimes(1);
  });

  it('keeps the list already pinned inside the lock', async () => {
    const findMany = mockedPrisma.kingDailySlate.findMany as jest.Mock;
    findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ apiMatchId: 2 }]);
    (mockedCache.getMatchesByDate as jest.Mock).mockResolvedValue([
      fixture(1, 'One'),
      fixture(2, 'Two'),
    ]);

    const rows = (await getKingDailyMatches('2026-11-01')) as any[];
    expect(rows.map((row) => row.fixture.id)).toEqual([2]);
    expect(mockedPrisma.kingDailySlate.createMany).not.toHaveBeenCalled();
  });

  it('does not pin an empty day', async () => {
    (mockedPrisma.kingDailySlate.findMany as jest.Mock).mockResolvedValue([]);
    (mockedCache.getMatchesByDate as jest.Mock).mockResolvedValue([]);

    const rows = await getKingDailyMatches('2026-11-01');
    expect(rows).toEqual([]);
    expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('setKingDailySlate replaces the day and caps at 10', async () => {
    const ids = Array.from({ length: 12 }, (_, i) => i + 1);
    const result = await setKingDailySlate('2026-11-01', ids);
    expect(result.matchIds).toHaveLength(10);
    expect(result.date).toBe('2026-11-01');
  });
});
