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
});
