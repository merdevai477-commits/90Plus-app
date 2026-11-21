import { ALL_COUNTRY_FLAGS } from '../data/localCountryFlags';
import { COUNTRIES } from '../data/countries';

/** Unset / decorative placeholders — not a chosen country. */
const UNSET_FLAGS = new Set(['🏳️', '🏴']);

/** Intentional global / app-world marker (shown as a globe, not a national flag). */
export const WORLD_COUNTRY_FLAG = '🌍';

const ARABIC_SCRIPT = /[\u0600-\u06FF]/;

function normKey(value: string): string {
  return value.trim().toLowerCase().replace(/_/g, '-').replace(/\s+/g, ' ');
}

type CountryHit = { nameAr: string; nameEn: string };

const COUNTRY_LOOKUP = (() => {
  const map = new Map<string, CountryHit>();
  const put = (key: string, hit: CountryHit) => {
    const k = normKey(key);
    if (k) map.set(k, hit);
  };

  for (const c of COUNTRIES) {
    const hit = { nameAr: c.name, nameEn: c.nameEn };
    put(c.id, hit);
    put(c.name, hit);
    put(c.nameEn, hit);
    put(c.flag, hit);
  }

  for (const c of ALL_COUNTRY_FLAGS) {
    const hit = { nameAr: c.nameAr, nameEn: c.name };
    put(c.id, hit);
    put(c.code, hit);
    put(c.name, hit);
    put(c.nameAr, hit);
    put(c.flag, hit);
  }

  return map;
})();

function lookupCountry(
  country?: string | null,
  countryFlag?: string | null,
): CountryHit | null {
  const trimmed = (country ?? '').trim();
  if (trimmed) {
    const byText = COUNTRY_LOOKUP.get(normKey(trimmed));
    if (byText) return byText;
  }
  const flag = (countryFlag ?? '').trim();
  if (flag && !UNSET_FLAGS.has(flag)) {
    const byFlag = COUNTRY_LOOKUP.get(normKey(flag));
    if (byFlag) return byFlag;
  }
  return null;
}

/**
 * Resolve a human-readable country label from stored profile fields.
 * Maps ISO codes (`eg`), English names, and flags to Arabic or English.
 */
export function resolveCountryDisplayName(
  country?: string | null,
  countryFlag?: string | null,
  preferArabic = true,
): string {
  const flag = (countryFlag ?? '').trim();
  if (flag === WORLD_COUNTRY_FLAG) return preferArabic ? 'عالمي' : 'Global';

  const hit = lookupCountry(country, countryFlag);
  if (hit) return preferArabic ? hit.nameAr : hit.nameEn;

  const trimmed = (country ?? '').trim();
  if (!trimmed) return '';

  // Already Arabic copy — keep as-is.
  if (ARABIC_SCRIPT.test(trimmed)) return trimmed;

  // Prefer Arabic UI: never surface raw ISO codes like "eg".
  if (preferArabic && /^[a-z]{2}(?:-[a-z]{2,3})?$/i.test(trimmed)) {
    return '';
  }

  return trimmed;
}

/** True when the profile should show a country/globe slot (not blank / unset). */
export function isMeaningfulCountryFlag(countryFlag?: string | null): boolean {
  const flag = (countryFlag ?? '').trim();
  return flag.length > 0 && !UNSET_FLAGS.has(flag);
}
