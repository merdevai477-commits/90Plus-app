import { ALL_COUNTRY_FLAGS, type CountryFlag } from '../../data/localCountryFlags';

export const DEFAULT_SPONSOR_PHONE_COUNTRY_ID = 'egypt';

export type SponsorPhoneSocialLinks = {
  facebook?: string;
  instagram?: string;
  whatsapp?: string;
  phoneCountryId?: string;
  phoneNational?: string;
};

/** ISO 3166-1 alpha-2 → country calling code (without +). */
const DIAL_BY_ISO: Record<string, string> = {
  EG: '20',
  SA: '966',
  AE: '971',
  QA: '974',
  KW: '965',
  BH: '973',
  OM: '968',
  JO: '962',
  LB: '961',
  SY: '963',
  IQ: '964',
  YE: '967',
  PS: '970',
  MA: '212',
  DZ: '213',
  TN: '216',
  LY: '218',
  SD: '249',
  MR: '222',
  SO: '252',
  DJ: '253',
  KM: '269',
  GB: '44',
  ES: '34',
  IT: '39',
  DE: '49',
  FR: '33',
  PT: '351',
  NL: '31',
  BE: '32',
  HR: '385',
  UY: '598',
  CO: '57',
  SN: '221',
  NG: '234',
  CM: '237',
  TR: '90',
  UA: '380',
  RS: '381',
  CZ: '420',
  US: '1',
};

export function getCountryById(countryId: string): CountryFlag | undefined {
  return ALL_COUNTRY_FLAGS.find((c) => c.id === countryId);
}

export function getDialCode(countryId: string): string {
  const country = getCountryById(countryId);
  if (!country) return '+20';
  const iso = country.code.includes('-') ? country.code.split('-')[0]! : country.code;
  const dial = DIAL_BY_ISO[iso];
  return dial ? `+${dial}` : '+20';
}

/** Strip to national digits and cap length per country habits. */
export function normalizeNationalDigits(raw: string, countryId: string): string {
  let digits = raw.replace(/\D/g, '');
  if (countryId === 'egypt') {
    if (digits.startsWith('20')) digits = digits.slice(2);
    if (digits.startsWith('0')) digits = digits.slice(1);
    return digits.slice(0, 10);
  }
  if (digits.startsWith('0')) digits = digits.slice(1);
  return digits.slice(0, 15);
}

/** Pretty groups while typing — Egypt: `10 1234 5678`. */
export function formatNationalDisplay(digits: string, countryId: string): string {
  const d = digits.replace(/\D/g, '');
  if (!d) return '';
  if (countryId === 'egypt') {
    const parts: string[] = [];
    if (d.length > 0) parts.push(d.slice(0, 2));
    if (d.length > 2) parts.push(d.slice(2, 6));
    if (d.length > 6) parts.push(d.slice(6, 10));
    return parts.join(' ');
  }
  return d.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
}

export function buildE164(countryId: string, nationalDigits: string): string | null {
  const national = normalizeNationalDigits(nationalDigits, countryId);
  if (!national) return null;
  const dial = getDialCode(countryId).replace('+', '');
  return `+${dial}${national}`;
}

export function sponsorPhoneLine(links?: SponsorPhoneSocialLinks | null): string | null {
  const countryId = links?.phoneCountryId?.trim();
  const national = links?.phoneNational?.trim();
  if (!countryId || !national) return null;
  const digits = normalizeNationalDigits(national, countryId);
  if (!digits) return null;
  return `${getDialCode(countryId)} ${formatNationalDisplay(digits, countryId)}`;
}

export function parseStoredPhone(links?: SponsorPhoneSocialLinks | null): {
  countryId: string;
  national: string;
} {
  const countryId = links?.phoneCountryId?.trim() || DEFAULT_SPONSOR_PHONE_COUNTRY_ID;
  const national = links?.phoneNational
    ? normalizeNationalDigits(links.phoneNational, countryId)
    : '';
  return { countryId, national };
}

export function sponsorContactLine(sponsor: {
  description?: string | null;
  socialLinks?: SponsorPhoneSocialLinks | null;
}): string | null {
  const phone = sponsorPhoneLine(sponsor.socialLinks);
  if (phone) return phone;
  const legacy = sponsor.description?.trim();
  return legacy || null;
}
