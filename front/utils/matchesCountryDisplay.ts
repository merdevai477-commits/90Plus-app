/**
 * Matches-list country display: Israeli leagues show as Palestine for every
 * viewer except users whose profile country is Israel.
 */

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

const ISRAEL_KEYS = new Set(
  [
    'il',
    'israel',
    'state of israel',
    'إسرائيل',
    'اسرائيل',
    'اسرائیل',
    'ישראל',
    'מדינת ישראל',
  ].map(normKey),
);

/** True when the signed-in profile is Israel (ISO / name / 🇮🇱). Unknown → false. */
export function isViewerFromIsrael(
  country?: string | null,
  countryFlag?: string | null,
): boolean {
  const flag = (countryFlag ?? '').trim();
  if (flag === '🇮🇱') return true;
  if (flag.length === 2 && flag.toLowerCase() === 'il') return true;

  const countryKey = normKey(country ?? '');
  if (!countryKey) return false;
  return ISRAEL_KEYS.has(countryKey);
}

/** API league country → accordion label. Non-Israel viewers see Palestine. */
export function displayMatchListCountry(
  apiCountry: string | null | undefined,
  viewerIsIsrael: boolean,
): string {
  const raw = (apiCountry ?? '').trim() || 'World';
  if (viewerIsIsrael) return raw;
  if (ISRAEL_KEYS.has(normKey(raw))) return 'Palestine';
  return raw;
}

/**
 * Flag URL seed for a country group. When remapping Israel → Palestine, drop
 * the Israeli API flag so getCountryFlagUri resolves the Palestine CDN asset.
 */
export function displayMatchListCountryFlag(
  apiCountry: string | null | undefined,
  apiFlag: string | null | undefined,
  viewerIsIsrael: boolean,
): string | null {
  const display = displayMatchListCountry(apiCountry, viewerIsIsrael);
  if (!viewerIsIsrael && display === 'Palestine' && ISRAEL_KEYS.has(normKey(apiCountry ?? ''))) {
    return null;
  }
  return apiFlag ?? null;
}
