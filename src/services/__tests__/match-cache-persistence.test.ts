const cachedFixture = {
  findMany: jest.fn().mockResolvedValue([]),
  create: jest.fn(),
  update: jest.fn(),
};
const transaction = jest.fn(async (writes: unknown[]) => Promise.all(writes));

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {
    cachedFixture,
    $transaction: transaction,
  },
}));

import type { CachedFixture } from '@prisma/client';
import { matchCacheService, type FixtureFromAPI } from '../match-cache.service';

function fixture(id: number, score = 2): FixtureFromAPI {
  return {
    fixture: {
      id,
      referee: 'Fresh Ref',
      timezone: 'UTC',
      date: '2026-07-21T12:00:00.000Z',
      timestamp: 1784635200,
      periods: { first: null, second: null },
      venue: { id: 4, name: 'Fresh Venue', city: 'Cairo' },
      status: { long: 'Second Half', short: '2H', elapsed: 72 },
    },
    league: {
      id: 7_000_123,
      name: 'Fresh League',
      country: 'Egypt',
      logo: 'league.png',
      flag: null,
      season: 2026,
      round: '20',
    },
    teams: {
      home: { id: 10, name: 'Home', logo: 'home.png', winner: true },
      away: { id: 20, name: 'Away', logo: 'away.png', winner: false },
    },
    goals: { home: score, away: 1 },
    score: {
      halftime: { home: 1, away: 0 },
      fulltime: { home: score, away: 1 },
      extratime: { home: null, away: null },
      penalty: { home: null, away: null },
    },
  };
}

function row(id: number): CachedFixture {
  return {
    id: `row-${id}`,
    fixtureId: id,
    leagueId: 7_000_123,
    leagueName: 'Old League',
    leagueLogo: 'old-league.png',
    leagueCountry: 'Old Country',
    leagueSeason: 2025,
    leagueRound: '19',
    homeTeamId: 10,
    homeTeamName: 'Old Home',
    homeTeamLogo: 'old-home.png',
    awayTeamId: 20,
    awayTeamName: 'Old Away',
    awayTeamLogo: 'old-away.png',
    homeScore: 0,
    awayScore: 0,
    homeHalftimeScore: 0,
    awayHalftimeScore: 0,
    matchDate: new Date('2026-07-21T12:00:00.000Z'),
    matchTimestamp: 1784635200,
    status: '1H',
    statusLong: 'First Half',
    venue: 'Old Venue',
    referee: 'Old Ref',
    elapsed: 30,
    fullData: {
      ...fixture(id, 0),
      events: [{ type: 'Goal', player: 'Preserved' }],
      lineups: [{ team: 'Preserved' }],
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('match cache persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cachedFixture.create.mockResolvedValue({});
    cachedFixture.update.mockResolvedValue({});
  });

  it('preloads once and preserves enriched fullData during scalar live updates', async () => {
    cachedFixture.findMany.mockResolvedValue([row(101), row(102)]);

    await matchCacheService.upsertFixtures([fixture(101), fixture(102)]);

    expect(cachedFixture.findMany).toHaveBeenCalledTimes(1);
    expect(cachedFixture.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { fixtureId: { in: [101, 102] } } }),
    );
    expect(cachedFixture.update).toHaveBeenCalledTimes(2);
    expect(transaction).toHaveBeenCalledTimes(1);
    for (const call of cachedFixture.update.mock.calls) {
      expect(call[0].data).toMatchObject({ homeScore: 2, status: '2H', elapsed: 72 });
      // Enriched arrays survive; only status / goals / score lines are merged.
      expect(call[0].data.fullData.events).toEqual([{ type: 'Goal', player: 'Preserved' }]);
      expect(call[0].data.fullData.lineups).toEqual([{ team: 'Preserved' }]);
      expect(call[0].data.fullData.goals).toEqual({ home: 2, away: 1 });
      expect(call[0].data.fullData.fixture.referee).toBe('Fresh Ref');
    }
  });

  it('persists the shootout tally into a stale preserved fullData (A10)', async () => {
    const existing = row(160);
    existing.status = 'PEN';
    existing.fullData = {
      ...(existing.fullData as object),
      fixture: { ...fixture(160).fixture, status: { long: 'Not Started', short: 'NS', elapsed: null } },
      goals: { away: null, home: null },
      score: {
        penalty: { away: null, home: null },
        fulltime: { away: null, home: null },
        halftime: { away: null, home: null },
        extratime: { away: null, home: null },
      },
    } as never;
    cachedFixture.findMany.mockResolvedValue([existing]);
    const pen = fixture(160, 1);
    pen.fixture.status = { long: 'Match Finished After Penalties', short: 'PEN', elapsed: 120 };
    pen.score.penalty = { home: 3, away: 4 };

    await matchCacheService.upsertFixtures([pen], { preserveFullData: true });

    const data = cachedFixture.update.mock.calls[0][0].data;
    expect(data.fullData.score.penalty).toEqual({ home: 3, away: 4 });
    expect(data.fullData.fixture.status.short).toBe('PEN');
    expect(data.fullData.events).toHaveLength(1);
  });

  it('does not rewrite when only jsonb key order differs', async () => {
    const existing = row(170);
    const fresh = fixture(170);
    Object.assign(existing, {
      leagueName: 'Fresh League', leagueLogo: 'league.png', leagueCountry: 'Egypt',
      leagueSeason: 2026, leagueRound: '20', homeTeamName: 'Home', homeTeamLogo: 'home.png',
      awayTeamName: 'Away', awayTeamLogo: 'away.png', homeScore: 2, awayScore: 1,
      homeHalftimeScore: 1, awayHalftimeScore: 0, status: '2H', statusLong: 'Second Half',
      venue: 'Fresh Venue', referee: 'Fresh Ref', elapsed: 72,
      fullData: {
        fixture: { ...fresh.fixture, status: { short: '2H', long: 'Second Half', elapsed: 72 } },
        goals: { away: 1, home: 2 },
        score: {
          penalty: { away: null, home: null },
          fulltime: { away: 1, home: 2 },
          halftime: { away: 0, home: 1 },
          extratime: { away: null, home: null },
        },
      },
    });
    cachedFixture.findMany.mockResolvedValue([existing]);

    await matchCacheService.upsertFixtures([fresh], { preserveFullData: true });

    expect(cachedFixture.update).not.toHaveBeenCalled();
  });

  it('skips unchanged rows after the single preload query', async () => {
    const existing = row(150);
    Object.assign(existing, {
      leagueName: 'Fresh League',
      leagueLogo: 'league.png',
      leagueCountry: 'Egypt',
      leagueSeason: 2026,
      leagueRound: '20',
      homeTeamName: 'Home',
      homeTeamLogo: 'home.png',
      awayTeamName: 'Away',
      awayTeamLogo: 'away.png',
      homeScore: 2,
      awayScore: 1,
      homeHalftimeScore: 1,
      awayHalftimeScore: 0,
      status: '2H',
      statusLong: 'Second Half',
      venue: 'Fresh Venue',
      referee: 'Fresh Ref',
      elapsed: 72,
      fullData: { ...fixture(150), events: [{ type: 'Goal', player: 'Preserved' }] },
    });
    cachedFixture.findMany.mockResolvedValue([existing]);

    await expect(
      matchCacheService.upsertFixtures([fixture(150)], { preserveFullData: true }),
    ).resolves.toBe(1);

    expect(cachedFixture.findMany).toHaveBeenCalledTimes(1);
    expect(cachedFixture.update).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it('overlays authoritative scalar columns while retaining enriched JSON fields', () => {
    const converted = matchCacheService.convertDbMatchToApiFormat(row(201));

    expect(converted.fixture).toMatchObject({
      id: 201,
      referee: 'Old Ref',
      date: '2026-07-21T12:00:00.000Z',
      status: { short: '1H', long: 'First Half', elapsed: 30 },
      venue: { name: 'Old Venue', city: 'Cairo' },
    });
    expect(converted.league).toMatchObject({
      name: 'Old League',
      country: 'Old Country',
      season: 2025,
      round: '19',
    });
    expect(converted.teams.home).toMatchObject({ name: 'Old Home', logo: 'old-home.png' });
    expect(converted.goals).toEqual({ home: 0, away: 0 });
    expect((converted as unknown as { events: unknown[] }).events).toHaveLength(1);
    expect((converted as unknown as { lineups: unknown[] }).lineups).toHaveLength(1);
  });
});
