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

const row = (id: number, iso: string, short: string) => ({
  fixture: { id, date: iso, timestamp: Math.floor(Date.parse(iso) / 1000), status: { short } },
});

describe('today list live overlay', () => {
  it('keeps other-day rows only while they are in play', async () => {
    const service = footballDataCacheService as any;
    const merge = jest
      .spyOn(service, 'mergeCalendarWithLiveSources')
      .mockImplementation(async (rows: any) => [
        ...rows,
        row(2, '2026-10-07T21:30:00+03:00', '2H'),
        row(3, '2026-10-07T18:30:00+03:00', 'SUSP'),
        row(4, '2026-10-07T21:00:00+03:00', 'INT'),
      ]);

    const today = [row(1, '2026-10-08T20:00:00+03:00', 'NS'), row(5, '2026-10-08T15:00:00+03:00', 'SUSP')];
    const out = await service.mergeTodayCalendar(today, '2026-10-08');
    expect(out.map((f: any) => f.fixture.id)).toEqual([1, 5, 2]);
    merge.mockRestore();
  });
});
