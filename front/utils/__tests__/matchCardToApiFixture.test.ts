import { matchCardToApiFixture, isApiFootballFixtureShape } from '../matchCardToApiFixture';
import type { Match } from '../../components/Matches/matchCardUtils';

describe('matchCardToApiFixture', () => {
  it('converts a calendar Match into API fixture shape', () => {
    const match: Match = {
      id: '4733590',
      homeTeam: { name: 'Home FC', logo: 'h.png' },
      awayTeam: { name: 'Away FC', logo: 'a.png' },
      score: { home: 1, away: 2 },
      status: 'live',
      statusShort: '2H',
      elapsed: 67,
      extra: null,
      startTimestamp: 1_700_000_000,
      fixtureDate: '2026-08-30T18:00:00Z',
      league: { id: 39, name: 'Premier League', logo: 'l.png', country: 'England' },
    };
    const fx = matchCardToApiFixture(match);
    expect(fx?.fixture.id).toBe(4_733_590);
    expect(fx?.teams.home.name).toBe('Home FC');
    expect(fx?.goals.away).toBe(2);
    expect(fx?.fixture.status.short).toBe('2H');
    expect(fx?.fixture.status.elapsed).toBe(67);
  });

  it('converts a list-row card (home/away fields)', () => {
    const fx = matchCardToApiFixture({
      id: '1489387',
      home: 'Arsenal',
      away: 'Chelsea',
      homeLogo: 'a.png',
      awayLogo: 'c.png',
      homeScore: 0,
      awayScore: 0,
      status: 'UPCOMING',
      statusShort: 'NS',
      matchDate: '2026-08-30T20:00:00Z',
      leagueId: 39,
      leagueName: 'Premier League',
    });
    expect(fx?.fixture.id).toBe(1_489_387);
    expect(fx?.teams.away.name).toBe('Chelsea');
    expect(fx?.fixture.status.short).toBe('NS');
  });

  it('rejects invalid ids', () => {
    expect(matchCardToApiFixture({ id: 'nope', home: 'A', away: 'B' })).toBeNull();
  });
});

describe('isApiFootballFixtureShape', () => {
  it('accepts nested API fixtures and rejects cards', () => {
    expect(
      isApiFootballFixtureShape({
        fixture: { id: 1 },
        teams: { home: { name: 'H' }, away: { name: 'A' } },
      }),
    ).toBe(true);
    expect(isApiFootballFixtureShape({ id: '1', home: 'H', away: 'A' })).toBe(false);
  });
});
