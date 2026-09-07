import { shouldPollFixtureOnMatchesList } from '../matchesListInterest';
import type { Match } from '../../components/Matches/matchCardUtils';

function match(overrides: Partial<Match> & { id: string }): Match {
  return {
    homeTeam: { name: 'Home', logo: '' },
    awayTeam: { name: 'Away', logo: '' },
    score: { home: 0, away: 0 },
    status: 'upcoming',
    time: '15:00',
    league: { id: 1, name: 'League', logo: '', country: 'Lebanon' },
    fixtureDate: new Date().toISOString(),
    ...overrides,
  };
}

describe('shouldPollFixtureOnMatchesList', () => {
  it('polls an NS row 10 minutes before kickoff', () => {
    const kickoff = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    expect(
      shouldPollFixtureOnMatchesList(match({ id: '0', status: 'upcoming', fixtureDate: kickoff })),
    ).toBe(true);
  });

  it('polls an NS row 20 minutes after kickoff (delayed start)', () => {
    const kickoff = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    expect(
      shouldPollFixtureOnMatchesList(match({ id: '1', status: 'upcoming', fixtureDate: kickoff })),
    ).toBe(true);
  });

  it('polls an NS row 1h45 after kickoff', () => {
    const kickoff = new Date(Date.now() - 105 * 60 * 1000).toISOString();
    expect(
      shouldPollFixtureOnMatchesList(match({ id: '2', status: 'upcoming', fixtureDate: kickoff })),
    ).toBe(true);
  });

  it('does not poll an NS row 4 hours after kickoff', () => {
    const kickoff = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    expect(
      shouldPollFixtureOnMatchesList(match({ id: '3', status: 'upcoming', fixtureDate: kickoff })),
    ).toBe(false);
  });

  it('always polls live rows', () => {
    expect(shouldPollFixtureOnMatchesList(match({ id: '4', status: 'live' }))).toBe(true);
  });
});
