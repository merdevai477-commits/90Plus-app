/**
 * Advertiser country on Predict & Win cards.
 *
 * Location / stored ISO wins; phone country is a fallback. Israel is always
 * shown as Palestine (flag + ISO) — including when Google geocodes a pin as IL.
 */

import { ALL_COUNTRY_FLAGS } from '../data/localCountryFlags';
import { COUNTRIES } from '../data/countries';
import { getCountryFlagEmoji, getCountryFlagUri } from './countryFlagUri';

export const PALESTINE_ISO = 'ps';

type SponsorCountryInput = {
  address?: string | null;
  socialLinks?: {
    countryCode?: string | null;
    phoneCountryId?: string | null;
  } | null;
};

function normKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

/** Full names / phrases only — never the bare token `il` (US state Illinois). */
const ISRAEL_NAME_KEYS = new Set(
  [
    'israel',
    'state of israel',
    'إسرائيل',
    'اسرائيل',
    'اسرائیل',
    'ישראל',
    'מדינת ישראל',
  ].map(normKey),
);

const PALESTINE_NAME_KEYS = new Set(
  [
    'palestine',
    'state of palestine',
    'palestinian territory',
    'palestinian territories',
    'occupied palestinian territory',
    'occupied palestinian territories',
    'west bank',
    'gaza',
    'gaza strip',
    'فلسطين',
    'دولة فلسطين',
    'قطاع غزة',
    'غزة',
    'الضفة الغربية',
    'الضفة',
  ].map(normKey),
);

const ISO_BY_NAME = (() => {
  const map = new Map<string, string>();
  const put = (raw: string, iso: string) => {
    const key = normKey(raw);
    if (key) map.set(key, iso);
  };
  for (const c of COUNTRIES) {
    put(c.id, c.id);
    put(c.nameEn, c.id);
    put(c.name, c.id);
  }
  for (const c of ALL_COUNTRY_FLAGS) {
    const iso = c.code.includes('-') ? c.code.split('-')[0]!.toLowerCase() : c.code.toLowerCase();
    put(c.id, iso);
    put(c.name, iso);
    put(c.nameAr, iso);
    put(c.code, iso);
  }
  put('usa', 'us');
  put('united states', 'us');
  put('uk', 'gb');
  put('ksa', 'sa');
  put('uae', 'ae');
  return map;
})();

function lookupIso(raw: string): string | null {
  const key = normKey(raw);
  if (!key) return null;
  if (PALESTINE_NAME_KEYS.has(key)) return PALESTINE_ISO;
  if (ISRAEL_NAME_KEYS.has(key)) return 'il';
  return ISO_BY_NAME.get(key) ?? null;
}

/** Google `address_components.short_name` (IL) and stored ISO — remap Israel → Palestine. */
export function remapSponsorCountryIso(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const key = normKey(raw);
  if (key === 'il' || ISRAEL_NAME_KEYS.has(key)) return PALESTINE_ISO;
  const iso = lookupIso(raw);
  if (!iso) {
    if (/^[a-z]{2}$/.test(key) && key !== 'il') return key;
    return null;
  }
  return iso === 'il' ? PALESTINE_ISO : iso;
}

function isoFromAddressFragment(fragment: string): string | null {
  const key = normKey(fragment);
  if (!key) return null;
  // Bare "IL" is Illinois in US addresses — only geocoder countryCode may use it.
  if (key === 'il') return null;
  const iso = lookupIso(fragment);
  return iso === 'il' ? PALESTINE_ISO : iso;
}

function containsPhrase(haystack: string, phraseKey: string): boolean {
  const h = normKey(haystack);
  if (!h || !phraseKey) return false;
  if (/[^\u0000-\u007f]/.test(phraseKey)) return h.includes(phraseKey);
  const escaped = phraseKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`).test(h);
}

export function parseCountryIsoFromAddress(address?: string | null): string | null {
  const text = (address ?? '').trim();
  if (!text) return null;

  for (const key of PALESTINE_NAME_KEYS) {
    if (containsPhrase(text, key)) return PALESTINE_ISO;
  }
  for (const key of ISRAEL_NAME_KEYS) {
    if (containsPhrase(text, key)) return PALESTINE_ISO;
  }

  const parts = text
    .split(/[,،]/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length > 0) {
    const fromLast = isoFromAddressFragment(parts[parts.length - 1]!);
    if (fromLast) return fromLast;
  }

  return null;
}

function isoFromPhoneCountryId(phoneCountryId?: string | null): string | null {
  const id = (phoneCountryId ?? '').trim();
  if (!id) return null;
  return remapSponsorCountryIso(id);
}

export function resolveSponsorCountryIso(input: SponsorCountryInput): string | null {
  const stored = remapSponsorCountryIso(input.socialLinks?.countryCode);
  if (stored) return stored;

  const fromAddress = parseCountryIsoFromAddress(input.address);
  if (fromAddress) return fromAddress;

  return isoFromPhoneCountryId(input.socialLinks?.phoneCountryId);
}

export function getSponsorCountryFlagUri(
  input: SponsorCountryInput,
  width = 40,
): string | null {
  const iso = resolveSponsorCountryIso(input);
  if (!iso) return null;
  return getCountryFlagUri(iso, null, width);
}

export function getSponsorCountryFlagEmoji(input: SponsorCountryInput): string | null {
  const iso = resolveSponsorCountryIso(input);
  if (!iso) return null;
  const emoji = getCountryFlagEmoji(iso);
  if (emoji && emoji !== '🏳️') return emoji;
  const byId = COUNTRIES.find((c) => c.id === iso);
  if (byId?.flag) return byId.flag;
  const byFlag = ALL_COUNTRY_FLAGS.find(
    (c) => c.code.toLowerCase() === iso || c.code.split('-')[0]!.toLowerCase() === iso,
  );
  if (byFlag?.flag) return byFlag.flag;
  return iso === PALESTINE_ISO ? '🇵🇸' : null;
}
