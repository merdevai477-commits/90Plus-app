import type { FixtureFromAPI } from '../services/match-cache.service';

/** Force a live (or unknown) snapshot into a finished terminal observation. */
export function asTerminalFinishedFixture(fixture: FixtureFromAPI): FixtureFromAPI {
  return {
    ...fixture,
    fixture: {
      ...fixture.fixture,
      status: {
        long: 'Match Finished',
        short: 'FT',
        elapsed: fixture.fixture?.status?.elapsed ?? 90,
        extra: null,
      },
    },
  };
}

/** Minimal FT tombstone when 365 retired a gameId and we have no DB row. */
export function asMinimalTerminalFixture(fixtureId: number): FixtureFromAPI {
  const now = new Date();
  return {
    fixture: {
      id: fixtureId,
      referee: null,
      timezone: 'UTC',
      date: now.toISOString(),
      timestamp: Math.floor(now.getTime() / 1000),
      periods: { first: null, second: null },
      venue: { id: null, name: null, city: null },
      status: {
        long: 'Match Finished',
        short: 'FT',
        elapsed: 90,
        extra: null,
      },
    },
    league: {
      id: 0,
      name: '',
      country: '',
      logo: '',
      flag: null,
      season: 0,
      round: '',
    },
    teams: {
      home: { id: 0, name: 'Home', logo: '', winner: null },
      away: { id: 0, name: 'Away', logo: '', winner: null },
    },
    goals: { home: null, away: null },
    score: {
      halftime: { home: null, away: null },
      fulltime: { home: null, away: null },
      extratime: { home: null, away: null },
      penalty: { home: null, away: null },
    },
  };
}

export function fixtureFromMissing365Game(
  fixtureId: number,
  dbConverted: FixtureFromAPI | null,
): FixtureFromAPI {
  return dbConverted ? asTerminalFinishedFixture(dbConverted) : asMinimalTerminalFixture(fixtureId);
}
