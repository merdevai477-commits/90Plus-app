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
  });
});
