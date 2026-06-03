/**
 * Fast country flag URLs — prefer flagcdn.com over slow api-sports.io flag CDN.
 */

import { ALL_COUNTRY_FLAGS, getFlagByCountryName } from '../data/localCountryFlags';
import { COUNTRIES } from '../data/countries';

const FLAGCDN = (code: string, width = 40) =>
  `https://flagcdn.com/w${width}/${code.toLowerCase()}.png`;

const API_SPORTS_FLAG = /media(?:-\d+)?\.api-sports\.io\/flags\/([a-z]{2}(?:-[a-z]{3})?)\./i;

function normKey(value: string): string {
  return value.trim().toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-');
}

const ISO_BY_NAME = (() => {
  const map = new Map<string, string>();
  for (const c of COUNTRIES) {
    map.set(normKey(c.nameEn), c.id);
    map.set(normKey(c.name), c.id);
    map.set(c.id, c.id);
  }
  for (const c of ALL_COUNTRY_FLAGS) {
    const code = c.code.toLowerCase();
    map.set(normKey(c.name), code);
    map.set(normKey(c.nameAr), code);
    map.set(normKey(c.id), code);
  }
  const aliases: Record<string, string> = {
    england: 'gb-eng',
    scotland: 'gb-sct',
    wales: 'gb-wls',
    'northern-ireland': 'gb-nir',
    'czech-republic': 'cz',
    usa: 'us',
    'united-states': 'us',
    'south-korea': 'kr',
    'north-korea': 'kp',
    'ivory-coast': 'ci',
    'cote-divoire': 'ci',
    uae: 'ae',
    'united-arab-emirates': 'ae',
    bolivia: 'bo',
    aruba: 'aw',
    cameroon: 'cm',
    colombia: 'co',
    denmark: 'dk',
    austria: 'at',
    brazil: 'br',
    argentina: 'ar',
    algeria: 'dz',
    morocco: 'ma',
    germany: 'de',
    europe: 'eu',
    world: 'un',
  };
  for (const [alias, code] of Object.entries(aliases)) {
    map.set(alias, code);
  }
  return map;
})();

function isoFromApiFlagUrl(apiFlag?: string | null): string | null {
  if (!apiFlag) return null;
  const trimmed = apiFlag.trim();
  if (!trimmed.startsWith('http')) return null;
  const match = trimmed.match(API_SPORTS_FLAG);
  return match?.[1]?.toLowerCase() ?? null;
}

function resolveIsoCode(country: string, apiFlag?: string | null): string | null {
  const key = normKey(country);
  if (key) {
    const hit = ISO_BY_NAME.get(key);
    if (hit) return hit;
  }
  return isoFromApiFlagUrl(apiFlag);
}

/** Emoji fallback for instant paint while the PNG loads. */
export function getCountryFlagEmoji(country: string, apiFlag?: string | null): string {
  const fromLocal = getFlagByCountryName(country);
  if (fromLocal?.flag) return fromLocal.flag;

  const key = normKey(country);
  const fromList = COUNTRIES.find(
    (c) => normKey(c.nameEn) === key || normKey(c.name) === key,
  );
  if (fromList?.flag) return fromList.flag;

  if (key === 'world') return '🌍';
  if (key === 'europe') return '🇪🇺';

  return '🏳️';
}

/** Prefer fast flagcdn URLs; never return api-sports flag URLs when ISO is known. */
export function getCountryFlagUri(
  country: string,
  apiFlag?: string | null,
  width = 40,
): string | null {
  const iso = resolveIsoCode(country, apiFlag);
  if (iso) return FLAGCDN(iso, width);

  const trimmed = (apiFlag ?? '').trim();
  if (trimmed.startsWith('http') && trimmed.includes('flagcdn.com')) {
    return trimmed.replace(/\/w\d+\//, `/w${width}/`);
  }

  // Unknown country — keep api URL as last resort (team/league logos still use api-sports).
  if (trimmed.startsWith('http') && !API_SPORTS_FLAG.test(trimmed)) {
    return trimmed;
  }

  return null;
}

export function prefetchCountryFlags(
  entries: ReadonlyArray<{ country: string; apiFlag?: string | null }>,
  width = 40,
): string[] {
  const urls = new Set<string>();
  for (const { country, apiFlag } of entries) {
    const uri = getCountryFlagUri(country, apiFlag, width);
    if (uri) urls.add(uri);
  }
  return [...urls];
}
