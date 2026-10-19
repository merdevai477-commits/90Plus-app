jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {
    cachedFixture: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  },
}));

import { mapScores365ToApiFootballFixture } from '../scores365-experiment.service';
import type { FixtureFromAPI } from '../match-cache.service';

const game = {
  id: 4711944,
  sportId: 1,
  competitionId: 593,
  statusId: 4,
  statusGroup: 4,
  statusText: 'Ended',
  shortStatusText: 'Ended',
  gameTime: 90,
  startTime: '2026-07-03T19:00:00.000Z',
  homeCompetitor: { id: 1232, name: 'Huachipato', score: 0 },
  awayCompetitor: { id: 8629, name: 'Deportes Concepcion', score: 2 },
  widgets: [
    {
      provider: 'SportRadarLMT',
      partnerId: 'sr:match:123',
      widgetType: 'LMT',
      widgetRatio: 1.6,
    },
  ],
} as Parameters<typeof mapScores365ToApiFootballFixture>[0];

const mismatchedDbBase: FixtureFromAPI = {
  fixture: {
    id: 4711944,
    referee: null,
    timezone: 'UTC',
    date: '2026-07-03T19:00:00.000Z',
    timestamp: 0,
    periods: { first: null, second: null },
    venue: { id: null, name: null, city: null },
    status: { long: 'Match Finished', short: 'FT', elapsed: 90 },
  },
  league: {
    id: 7_000_593,
    name: 'Chilean Cup',
    country: 'Chile',
    logo: '',
    flag: null,
    season: 2026,
    round: '',
  },
  teams: {
    home: { id: 1, name: 'فريق مختلف', logo: '', winner: false },
    away: { id: 2, name: 'اسم آخر', logo: '', winner: true },
  },
  goals: { home: 0, away: 2 },
  score: {
    halftime: { home: null, away: null },
    fulltime: { home: 0, away: 2 },
    extratime: { home: null, away: null },
    penalty: { home: null, away: null },
  },
};

describe('mapScores365ToApiFootballFixture alignment fallback', () => {
  it('falls back to synthetic 365 base when cached DB team names mismatch', async () => {
    const fixture = await mapScores365ToApiFootballFixture(game, mismatchedDbBase, 4711944);
    expect(fixture).not.toBeNull();
    expect(fixture?.teams.home.name).toBe('Huachipato');
    expect(fixture?.teams.away.name).toBe('Deportes Concepcion');
    expect(fixture?.fixture.status.short).toBe('FT');
    expect((fixture as any)?._lmt).toMatchObject({
      partnerId: 'sr:match:123',
      provider: 'SportRadarLMT',
      widgetType: 'LMT',
    });
  });

  it('keeps Al Ahly distinct from National Bank and writes 365 competitor ids', async () => {
    const ahlyBankGame = {
      ...game,
      id: 4_900_001,
      competitionId: 11,
      homeCompetitor: { id: 8200, name: 'الأهلي', score: 2 },
      awayCompetitor: { id: 50527, name: 'البنك الأهلي', score: 0 },
    } as typeof game;
    // Same kickoff sides, but API-Football leftover ids. Substring matching used to
    // also confuse these names when the DB row was swapped.
    const dbBase: FixtureFromAPI = {
      ...mismatchedDbBase,
      fixture: { ...mismatchedDbBase.fixture, id: 4_900_001 },
      teams: {
        home: { id: 1015, name: 'الأهلي', logo: 'ahly.png', winner: null },
        away: { id: 9999, name: 'البنك الأهلي', logo: 'bank.png', winner: null },
      },
      goals: { home: 2, away: 0 },
    };

    const fixture = await mapScores365ToApiFootballFixture(ahlyBankGame, dbBase, 4_900_001);
    expect(fixture).not.toBeNull();
    expect(fixture?.teams.home.id).toBe(8200);
    expect(fixture?.teams.away.id).toBe(50527);
    expect(fixture?.teams.home.name).toBe('الأهلي');
    expect(fixture?.teams.away.name).toBe('البنك الأهلي');
    expect(fixture?.goals).toEqual({ home: 2, away: 0 });
  });

  it('does not mis-align a swapped DB row of Al Ahly vs National Bank', async () => {
    const ahlyBankGame = {
      ...game,
      id: 4_900_002,
      competitionId: 11,
      homeCompetitor: { id: 8200, name: 'الأهلي', score: 2 },
      awayCompetitor: { id: 50527, name: 'البنك الأهلي', score: 0 },
    } as typeof game;
    const swappedDbBase: FixtureFromAPI = {
      ...mismatchedDbBase,
      fixture: { ...mismatchedDbBase.fixture, id: 4_900_002 },
      teams: {
        home: { id: 9999, name: 'البنك الأهلي', logo: 'bank.png', winner: null },
        away: { id: 1015, name: 'الأهلي', logo: 'ahly.png', winner: null },
      },
      goals: { home: 0, away: 2 },
    };

    const fixture = await mapScores365ToApiFootballFixture(ahlyBankGame, swappedDbBase, 4_900_002);
    expect(fixture).not.toBeNull();
    const byId = new Map([
      [fixture!.teams.home.id, { name: fixture!.teams.home.name, goals: fixture!.goals.home }],
      [fixture!.teams.away.id, { name: fixture!.teams.away.name, goals: fixture!.goals.away }],
    ]);
    expect(byId.get(8200)).toEqual({ name: 'الأهلي', goals: 2 });
    expect(byId.get(50527)).toEqual({ name: 'البنك الأهلي', goals: 0 });
  });

  it('maps venue capacity, referee, and broadcast channels', async () => {
    const fixture = await mapScores365ToApiFootballFixture(
      {
        ...game,
        venue: { id: 1023, name: 'Anfield', capacity: 61276 },
        officials: [{ name: 'Thomas Bramall' }],
        tvNetworks: [{ name: 'beIN Sport Max 1 HD', countryId: 131 }],
      } as typeof game,
      mismatchedDbBase,
      4711944,
    );
    expect(fixture?.fixture.referee).toBe('Thomas Bramall');
    expect(fixture?.fixture.venue).toMatchObject({
      id: 1023,
      name: 'Anfield',
      capacity: 61276,
    });
    expect((fixture as { _officials?: string[] } | null)?._officials).toEqual(['Thomas Bramall']);
    expect((fixture as { _tvNetworks?: string[] } | null)?._tvNetworks).toEqual(['beIN Sport Max 1 HD']);
  });
});
