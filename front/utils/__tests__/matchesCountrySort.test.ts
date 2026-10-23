import { sortCountryGroupsForMatches } from '../matchesCountrySort';
import type { CountryGroup } from '../../hooks/matchesData.types';

function cg(
  country: string,
  leagues: Array<{ id: number; name: string; country?: string; live?: boolean }>,
): CountryGroup {
  return {
    country,
    countryFlag: null,
    leagues: leagues.map((l) => ({
      leagueId: l.id,
      leagueName: l.name,
      leagueLogo: undefined,
      matches: [
        {
          id: String(l.id),
          status: l.live ? 'live' : 'upcoming',
          league: { id: l.id, name: l.name, country: l.country ?? country },
        } as any,
      ],
    })),
  };
}

describe('sortCountryGroupsForMatches', () => {
  test('orders continental → top 5 → Arab → rest', () => {
    const sorted = sortCountryGroupsForMatches([
      cg('Argentina', [{ id: 999, name: 'Liga', country: 'Argentina' }]),
      cg('Egypt', [{ id: 233, name: 'Premier League', country: 'Egypt' }]),
      cg('England', [{ id: 39, name: 'Premier League', country: 'England' }]),
      cg('Europe', [{ id: 2, name: 'UEFA Champions League', country: 'Europe' }]),
      cg('Africa', [{ id: 6, name: 'Africa Cup of Nations', country: 'Africa' }]),
    ]);

    expect(sorted.map((g) => g.country)).toEqual([
      'Africa',
      'Europe',
      'England',
      'Egypt',
      'Argentina',
    ]);
  });

  test('orders England leagues by importance, not alphabet (PL above Championship)', () => {
    const sorted = sortCountryGroupsForMatches([
      cg('England', [
        { id: 40, name: 'Championship', country: 'England', live: true },
        { id: 41, name: 'League One', country: 'England' },
        { id: 39, name: 'Premier League', country: 'England' },
        { id: 45, name: 'FA Cup', country: 'England' },
        { id: 48, name: 'EFL Cup', country: 'England' },
      ]),
    ]);

    expect(sorted[0].leagues.map((l) => l.leagueName)).toEqual([
      'Premier League',
      'FA Cup',
      'EFL Cup',
      'Championship',
      'League One',
    ]);
  });

  test('orders Scores365 England ids the same way (PL above Championship)', () => {
    const sorted = sortCountryGroupsForMatches([
      cg('England', [
        { id: 7_000_001, name: 'Championship', country: 'England' },
        { id: 7_000_007, name: 'Premier League', country: 'England' },
      ]),
    ]);

    expect(sorted[0].leagues.map((l) => l.leagueId)).toEqual([7_000_007, 7_000_001]);
  });
});
