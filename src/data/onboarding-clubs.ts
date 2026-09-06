import { mapCountryInput } from './country-catalog';

export interface OnboardingClub {
  competitorId: number;
  name: string;
  nameAr: string;
  logo: string;
  country: string;
  isLocal?: boolean;
}

function competitorLogo(competitorId: number): string {
  return `https://imagecache.365scores.com/image/upload/f_png,w_128,h_128,c_limit,q_auto:eco,dpr_2/v1/Competitors/${competitorId}`;
}

/** Curated 365 competitorIds — same IDs as football-search-index. */
export const GLOBAL_ONBOARDING_CLUBS: OnboardingClub[] = [
  {
    competitorId: 104,
    name: 'Arsenal',
    nameAr: 'أرسنال',
    logo: competitorLogo(104),
    country: 'England',
  },
  {
    competitorId: 110,
    name: 'Manchester City',
    nameAr: 'مانشستر',
    logo: competitorLogo(110),
    country: 'England',
  },
  {
    competitorId: 131,
    name: 'Real Madrid',
    nameAr: 'ريال مدريد',
    logo: competitorLogo(131),
    country: 'Spain',
  },
  {
    competitorId: 132,
    name: 'FC Barcelona',
    nameAr: 'برشلونة',
    logo: competitorLogo(132),
    country: 'Spain',
  },
];

/**
 * Country key (catalog id, nameEn, or ClubPicker key) → 365Scores competition id.
 * 0 means we have no domestic-league standings feed for that country yet.
 */
export const COUNTRY_365_COMPETITION: Record<string, number> = {
  gb: 7,
  england: 7,
  es: 11,
  spain: 11,
  it: 17,
  italy: 17,
  de: 25,
  germany: 25,
  fr: 35,
  france: 35,
  sa: 649,
  saudi: 649,
  'saudi arabia': 649,
  eg: 552,
  egypt: 552,
  us: 104,
  usa: 104,
  'united states': 104,
};

export function resolveCountry365Competition(countryRaw: string | null | undefined): number | null {
  if (!countryRaw) return null;
  const mapped = mapCountryInput(countryRaw);
  const keys = [
    mapped?.id,
    mapped?.nameEn.toLowerCase(),
    countryRaw.trim().toLowerCase(),
  ].filter((k): k is string => Boolean(k));

  for (const key of keys) {
    const id = COUNTRY_365_COMPETITION[key];
    if (id && id > 0) return id;
  }
  return null;
}

export const MAX_ONBOARDING_TEAMS = 3;
export const LOCAL_ONBOARDING_CLUB_COUNT = 4;
