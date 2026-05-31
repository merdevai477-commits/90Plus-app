import { ALL_COUNTRY_FLAGS } from '../data/localCountryFlags';
import { COUNTRIES } from '../data/countries';

const GENERIC_FLAGS = new Set(['🌍', '🏳️', '🏴']);

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
  if (!flag || GENERIC_FLAGS.has(flag)) return '';

  const fromLocal = ALL_COUNTRY_FLAGS.find((c) => c.flag === flag);
  if (fromLocal) return preferArabic ? fromLocal.nameAr : fromLocal.name;

  const fromList = COUNTRIES.find((c) => c.flag === flag);
  if (fromList) return preferArabic ? fromList.name : fromList.nameEn;

  return '';
}

export function isMeaningfulCountryFlag(countryFlag?: string | null): boolean {
  const flag = (countryFlag ?? '').trim();
  return flag.length > 0 && !GENERIC_FLAGS.has(flag);
}
