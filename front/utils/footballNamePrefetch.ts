import type { Match } from '../components/Matches/matchCardUtils';
import type { CountryGroup } from '../hooks/useMatchesData';

/** Collect every translatable football label from match listings. */
export function collectNamesFromMatches(matches: Match[]): string[] {
  const names = new Set<string>();
  for (const m of matches) {
    if (m.homeTeam?.name) names.add(m.homeTeam.name);
    if (m.awayTeam?.name) names.add(m.awayTeam.name);
    if (m.league?.name) names.add(m.league.name);
    if (m.league?.country) names.add(m.league.country);
  }
  return [...names];
}

export function collectNamesFromCountryGroups(groups: CountryGroup[]): string[] {
  const names = new Set<string>();
  for (const cg of groups) {
    if (cg.country) names.add(cg.country);
    for (const league of cg.leagues) {
      if (league.leagueName) names.add(league.leagueName);
      for (const m of league.matches) {
        if (m.homeTeam?.name) names.add(m.homeTeam.name);
        if (m.awayTeam?.name) names.add(m.awayTeam.name);
        if (m.league?.name) names.add(m.league.name);
        if (m.league?.country) names.add(m.league.country);
      }
    }
  }
  return [...names];
}

/** Standings / lineups / events — pass any string labels you have. */
export function collectUniqueStrings(...groups: Array<string | null | undefined>): string[] {
  const names = new Set<string>();
  for (const g of groups) {
    const t = (g ?? '').trim();
    if (t) names.add(t);
  }
  return [...names];
}
