import { projectFixtureForListView, projectMatchesForListView } from '../matches-list-projection.util';

function sampleFixture(overrides: Record<string, unknown> = {}) {
  return {
    fixture: {
      id: 1,
      referee: 'Someone',
      timezone: 'UTC',
      date: '2026-09-04T18:00:00+00:00',
      timestamp: 1,
      periods: { first: 100, second: 200 },
      venue: { id: 1, name: '', city: '' },
      status: { long: 'Not Started', short: 'NS', elapsed: null, extra: null },
    },
    league: {
      id: 39,
      name: 'Premier League',
      country: 'England',
      logo: 'l.png',
      flag: 'f.png',
      season: 2026,
      round: 'R1',
    },
    teams: {
      home: { id: 1, name: 'Home', logo: 'h.png', winner: null },
      away: { id: 2, name: 'Away', logo: 'a.png', winner: null },
    },
    goals: { home: 1, away: 0 },
    score: {
      halftime: { home: 0, away: 0 },
      fulltime: { home: 1, away: 0 },
      extratime: { home: null, away: null },
      penalty: { home: null, away: null },
    },
    crowdPrediction: { home: 40, draw: 30, away: 30, totalVotes: 10 },
    _crowdPrediction: { home: 40, draw: 30, away: 30, totalVotes: 10 },
    events: [{ type: 'Goal' }],
    ...overrides,
  };
}

describe('matches-list-projection (P0-2)', () => {
  it('keeps fields mapFixtureToMatch needs and drops dead weight', () => {
    const projected = projectFixtureForListView(sampleFixture()) as any;
    expect(projected.fixture.id).toBe(1);
    expect(projected.fixture.date).toBeTruthy();
    expect(projected.fixture.periods.first).toBe(100);
    expect(projected.fixture.status.short).toBe('NS');
    expect(projected.league.id).toBe(39);
    expect(projected.league.round).toBe('R1');
    expect(projected.teams.home.name).toBe('Home');
    expect(projected.goals.home).toBe(1);
    expect(projected._crowdPrediction).toEqual({
      home: 40,
      draw: 30,
      away: 30,
      totalVotes: 10,
    });

    expect(projected.score).toBeUndefined();
    expect(projected.crowdPrediction).toBeUndefined();
    expect(projected.fixture.venue).toBeUndefined();
    expect(projected.fixture.referee).toBeUndefined();
    expect(projected.events).toBeUndefined();
    expect(projected.teams.home.winner).toBeUndefined();
  });

  it('shrinks payload for a 318-fixture day vs full sample envelope', () => {
    const full = Array.from({ length: 318 }, (_, i) =>
      sampleFixture({
        fixture: {
          ...sampleFixture().fixture,
          id: i + 1,
        },
      }),
    );
    const list = projectMatchesForListView(full);
    const fullBytes = Buffer.byteLength(JSON.stringify(full), 'utf8');
    const listBytes = Buffer.byteLength(JSON.stringify(list), 'utf8');
    const bytesPerFixture = listBytes / 318;
    // Documented baseline for review — synthetic fixtures; production logos are longer URLs.
    // eslint-disable-next-line no-console
    console.table([
      {
        fixtures: 318,
        fullBytes,
        listBytes,
        ratio: Number((listBytes / fullBytes).toFixed(3)),
        bytesPerFixtureList: Math.round(bytesPerFixture),
      },
    ]);
    expect(listBytes).toBeLessThan(fullBytes * 0.65);
    expect(bytesPerFixture).toBeLessThan(550);
  });
});
