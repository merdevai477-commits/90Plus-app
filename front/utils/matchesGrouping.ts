import type { Match } from '../components/Matches/matchCardUtils';
import type { CountryGroup, GroupedMatches } from '../hooks/matchesData.types';
import { getCountryFlagUri } from './countryFlagUri';
import { sortCountryGroupsForMatches } from './matchesCountrySort';

/** Fallback to full re-group when more than this fraction of rows changed (P1-5). */
export const INCREMENTAL_GROUP_CHANGE_RATIO = 0.3;

function sortLeagueMatches(matches: Match[]): Match[] {
  return [...matches].sort((a, b) => {
    if (a.status === 'live' && b.status !== 'live') return -1;
    if (b.status === 'live' && a.status !== 'live') return 1;
    if (a.fixtureDate && b.fixtureDate) {
      return new Date(a.fixtureDate).getTime() - new Date(b.fixtureDate).getTime();
    }
    return 0;
  });
}

/** Full rebuild — groups matches by league (live-first sort within each league). */
export function groupMatchesByLeague(matches: Match[]): GroupedMatches[] {
  const groupsMap = new Map<number, GroupedMatches>();

  for (const match of matches) {
    const leagueId = match.league?.id || 0;
    const leagueName = match.league?.name || 'Unknown League';
    const leagueLogo = match.league?.logo;

    if (!groupsMap.has(leagueId)) {
      groupsMap.set(leagueId, {
        leagueId,
        leagueName,
        leagueLogo,
        matches: [],
      });
    }

    groupsMap.get(leagueId)!.matches.push(match);
  }

  const groups = Array.from(groupsMap.values());
  for (const group of groups) {
    group.matches = sortLeagueMatches(group.matches);
  }
  return groups;
}

/**
 * Groups matches by country, then by league within each country.
 * Pass pre-built league groups to avoid re-grouping the same match list.
 */
export function groupMatchesByCountry(
  matches: Match[],
  leagueGroups?: GroupedMatches[],
): CountryGroup[] {
  const groups = leagueGroups ?? groupMatchesByLeague(matches);
  const countryMap = new Map<string, { flag: string | null; leagues: GroupedMatches[] }>();

  for (const group of groups) {
    const firstMatch = group.matches[0];
    const country = firstMatch?.league?.country || 'World';
    const flag = firstMatch?.league?.countryFlag || null;

    if (!countryMap.has(country)) {
      countryMap.set(country, { flag, leagues: [] });
    }
    countryMap.get(country)!.leagues.push(group);
  }

  const raw = Array.from(countryMap.entries()).map(([country, data]) => ({
    country,
    countryFlag: getCountryFlagUri(country, data.flag),
    leagues: data.leagues,
  }));

  return sortCountryGroupsForMatches(raw);
}

/**
 * Incremental country/league regroup when only a subset of match rows changed.
 * Preserves object identity for unaffected country and league groups.
 * Falls back to full regroup when changedIds is large or structure is unknown.
 */
export function groupMatchesByCountryIncremental(
  matches: Match[],
  changedIds: Set<string>,
  previous: CountryGroup[] | null,
): CountryGroup[] {
  if (!previous || previous.length === 0 || matches.length === 0) {
    return groupMatchesByCountry(matches);
  }

  // Nothing changed — preserve all group identities.
  if (changedIds.size === 0) {
    return previous;
  }

  if (changedIds.size > matches.length * INCREMENTAL_GROUP_CHANGE_RATIO) {
    return groupMatchesByCountry(matches);
  }

  const matchById = new Map(matches.map((m) => [m.id, m]));
  const changedCountries = new Set<string>();

  for (const id of changedIds) {
    const m = matchById.get(id);
    if (!m) {
      // Row disappeared — structure may have changed; full rebuild.
      return groupMatchesByCountry(matches);
    }
    changedCountries.add(m.league?.country || 'World');
  }

  // Verify previous structure still covers all leagues present in matches.
  const prevLeagueIds = new Set<number>();
  for (const cg of previous) {
    for (const lg of cg.leagues) prevLeagueIds.add(lg.leagueId);
  }
  for (const m of matches) {
    const lid = m.league?.id || 0;
    if (!prevLeagueIds.has(lid)) {
      return groupMatchesByCountry(matches);
    }
  }

  let anyCountryRebuilt = false;
  const nextCountries: CountryGroup[] = previous.map((cg) => {
    if (!changedCountries.has(cg.country)) {
      return cg;
    }
    anyCountryRebuilt = true;
    // Rebuild the whole country from current matches so league order/content
    // matches a full regroup for this country.
    const countryMatches = matches.filter(
      (m) => (m.league?.country || 'World') === cg.country,
    );
    if (countryMatches.length === 0) {
      return cg;
    }
    // Full country regroup includes live-first league ordering.
    const rebuilt = groupMatchesByCountry(countryMatches);
    return rebuilt.find((c) => c.country === cg.country) ?? rebuilt[0] ?? cg;
  });

  return anyCountryRebuilt ? nextCountries : previous;
}
