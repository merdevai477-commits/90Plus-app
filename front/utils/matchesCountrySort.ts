import type { CountryGroup, GroupedMatches } from '../hooks/matchesData.types';
import {
  compareInternationalLeagues,
  getInternationalSortTier,
  isInternationalCompetition,
} from './internationalCompetition';

/** Top domestic leagues — after continental block. */
const TOP5_COUNTRIES: Record<string, number> = {
  England: 1,
  Spain: 2,
  Italy: 3,
  France: 4,
  Germany: 5,
};

/** Arab / MENA countries — alphabetical after top 5. */
const ARAB_COUNTRIES = new Set([
  'Saudi-Arabia',
  'Egypt',
  'UAE',
  'Qatar',
  'Kuwait',
  'Bahrain',
  'Oman',
  'Jordan',
  'Iraq',
  'Syria',
  'Lebanon',
  'Palestine',
  'Yemen',
  'Libya',
  'Tunisia',
  'Algeria',
  'Morocco',
  'Sudan',
  'Turkey',
]);

const CONTINENTAL_COUNTRY_LABELS = new Set([
  'world',
  'europe',
  'africa',
  'asia',
  'south america',
  'north america',
  'oceania',
  'international',
]);

type CountryBand = 0 | 1 | 2 | 3;

function leagueRef(group: GroupedMatches) {
  const sample = group.matches[0]?.league;
  return {
    id: group.leagueId,
    name: group.leagueName,
    country: sample?.country ?? null,
  };
}

function isContinentalCountryGroup(country: string, leagues: GroupedMatches[]): boolean {
  const normalized = country.trim().toLowerCase();
  if (CONTINENTAL_COUNTRY_LABELS.has(normalized)) return true;
  if (leagues.length === 0) return false;
  return leagues.every((l) =>
    isInternationalCompetition(leagueRef(l), { excludeLeagueId: null }),
  );
}

function countryBand(country: string, leagues: GroupedMatches[]): CountryBand {
  if (isContinentalCountryGroup(country, leagues)) return 0;
  if (TOP5_COUNTRIES[country] != null) return 1;
  if (ARAB_COUNTRIES.has(country)) return 2;
  return 3;
}

function continentalTier(leagues: GroupedMatches[]): number {
  let best = Number.MAX_SAFE_INTEGER;
  for (const l of leagues) {
    const tier = getInternationalSortTier(leagueRef(l));
    if (tier < best) best = tier;
  }
  return best === Number.MAX_SAFE_INTEGER ? 99 : best;
}

function compareCountryGroups(a: CountryGroup, b: CountryGroup): number {
  const bandA = countryBand(a.country, a.leagues);
  const bandB = countryBand(b.country, b.leagues);
  if (bandA !== bandB) return bandA - bandB;

  if (bandA === 0) {
    const tierDiff = continentalTier(a.leagues) - continentalTier(b.leagues);
    if (tierDiff !== 0) return tierDiff;
    return a.country.localeCompare(b.country, 'en');
  }

  if (bandA === 1) {
    const priA = TOP5_COUNTRIES[a.country] ?? 99;
    const priB = TOP5_COUNTRIES[b.country] ?? 99;
    if (priA !== priB) return priA - priB;
    return a.country.localeCompare(b.country, 'en');
  }

  return a.country.localeCompare(b.country, 'en');
}

function sortLeaguesInCountry(leagues: GroupedMatches[]): GroupedMatches[] {
  return [...leagues].sort((a, b) => {
    const aIntl = isInternationalCompetition(leagueRef(a));
    const bIntl = isInternationalCompetition(leagueRef(b));
    if (aIntl && bIntl) {
      return compareInternationalLeagues(leagueRef(a), leagueRef(b));
    }
    const aLive = a.matches.some((m) => m.status === 'live');
    const bLive = b.matches.some((m) => m.status === 'live');
    if (aLive !== bLive) return aLive ? -1 : 1;
    return a.leagueName.localeCompare(b.leagueName, 'en');
  });
}

/** Apply Matches list country order: continental → top 5 → Arab → rest (alpha). */
export function sortCountryGroupsForMatches(groups: CountryGroup[]): CountryGroup[] {
  return [...groups]
    .map((cg) => ({
      ...cg,
      leagues: sortLeaguesInCountry(cg.leagues),
    }))
    .sort(compareCountryGroups);
}
