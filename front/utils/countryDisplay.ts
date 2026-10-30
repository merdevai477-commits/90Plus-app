import { ALL_COUNTRY_FLAGS } from '../data/localCountryFlags';
import { COUNTRIES } from '../data/countries';

/** Unset / decorative placeholders — not a chosen country. */
const UNSET_FLAGS = new Set(['🏳️', '🏴']);

/** Intentional global / app-world marker (shown as a globe, not a national flag). */
export const WORLD_COUNTRY_FLAG = '🌍';

/**
 * Resolve a human-readable country label from stored profile fields.
 * Falls back to flag lookup when `country` text was never saved.
 */
export function resolveCountryDisplayName(
  country?: string | null,
  countryFlag?: string | null,
  preferArabic = true,
): string {
  const trimmed = (country ?? '').trim();
  if (trimmed) return trimmed;

  const flag = (countryFlag ?? '').trim();
  if (!flag || UNSET_FLAGS.has(flag)) return '';
  if (flag === WORLD_COUNTRY_FLAG) return preferArabic ? 'عالمي' : 'Global';

  const fromLocal = ALL_COUNTRY_FLAGS.find((c) => c.flag === flag);
  if (fromLocal) return preferArabic ? fromLocal.nameAr : fromLocal.name;

  const fromList = COUNTRIES.find((c) => c.flag === flag);
  if (fromList) return preferArabic ? fromList.name : fromList.nameEn;

  return '';
}

/** True when the profile should show a country/globe slot (not blank / unset). */
export function isMeaningfulCountryFlag(countryFlag?: string | null): boolean {
  const flag = (countryFlag ?? '').trim();
  return flag.length > 0 && !UNSET_FLAGS.has(flag);
}
