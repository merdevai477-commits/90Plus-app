jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: { cachedFixture: { findMany: jest.fn().mockResolvedValue([]) } },
}));

jest.mock('../football-sync-leader.service', () => ({
  withSyncLeaderLease: async (_scope: string, work: () => Promise<unknown>) => ({
    acquired: true,
    value: await work(),
  }),
}));

import { footballDataCacheService } from '../football-data-cache.service';

const fixture = (id: number, iso: string) => ({
  fixture: { id, date: iso, timestamp: Math.floor(Date.parse(iso) / 1000) },
});

// Cairo is UTC+3 on 2026-10-08.
const lateCairoPrevDay = fixture(1, '2026-10-07T20:00:00Z'); // Cairo 10-07 23:00
const earlyCairoDay = fixture(2, '2026-10-08T02:00:00Z'); // Cairo 10-08 05:00
const afternoon = fixture(3, '2026-10-08T15:00:00Z'); // Cairo 10-08 18:00
const afterCairoMidnight = fixture(4, '2026-10-08T22:30:00Z'); // Cairo 10-09 01:30

const appDays: Record<string, any[]> = {
  '2026-10-07': [lateCairoPrevDay],
  // Today's live overlay can repeat a fixture from the previous app day.
  '2026-10-08': [earlyCairoDay, afternoon, lateCairoPrevDay],
  '2026-10-09': [afterCairoMidnight],
};

describe('getMatchesByDateInTimezone', () => {
  let spy: jest.SpyInstance;

  beforeEach(() => {
    spy = jest
      .spyOn(footballDataCacheService, 'getMatchesByDate')
      .mockImplementation(async (day: string) => appDays[day] ?? []);
  });

  afterEach(() => spy.mockRestore());

  it('uses the app day as-is when no timezone is given', async () => {
    const rows = await footballDataCacheService.getMatchesByDateInTimezone('2026-10-08', null);
    expect(rows).toBe(appDays['2026-10-08']);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('uses the app day as-is for zones on the same offset', async () => {
    await footballDataCacheService.getMatchesByDateInTimezone('2026-10-08', 'Asia/Riyadh');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('2026-10-08', undefined);
  });

  it('builds the New York day from adjacent app days', async () => {
    const rows = await footballDataCacheService.getMatchesByDateInTimezone(
      '2026-10-08',
      'America/New_York',
    );
    expect(spy).toHaveBeenCalledTimes(3);
    expect(rows.map((r) => r.fixture.id)).toEqual([3, 4]);
  });

  it('builds the Tokyo day and de-duplicates overlay rows', async () => {
    const rows = await footballDataCacheService.getMatchesByDateInTimezone(
      '2026-10-08',
      'Asia/Tokyo',
    );
    expect(rows.map((r) => r.fixture.id)).toEqual([1, 2]);
  });

  it('returns the remaining days when one app day fails', async () => {
    spy.mockImplementation(async (day: string) => {
      if (day === '2026-10-09') throw new Error('boom');
      return appDays[day] ?? [];
    });
    const rows = await footballDataCacheService.getMatchesByDateInTimezone(
      '2026-10-08',
      'America/New_York',
    );
    expect(rows.map((r) => r.fixture.id)).toEqual([3]);
  });

  it('throws when every app day fails', async () => {
    spy.mockRejectedValue(new Error('down'));
    await expect(
      footballDataCacheService.getMatchesByDateInTimezone('2026-10-08', 'America/New_York'),
    ).rejects.toThrow('down');
  });
});
