/**
 * ISO-2 country catalog for onboarding geo seed + local-club matching.
 * `id` is the same 2-letter code stored on User.country from the old wizard.
 */

export interface CatalogCountry {
  id: string;
  name: string;
  nameEn: string;
  flag: string;
}

function flagEmojiFromIso2(iso2: string): string {
  const cc = iso2.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return '';
  return String.fromCodePoint(
    ...[...cc].map((ch) => 0x1f1e6 - 65 + ch.charCodeAt(0)),
  );
}

/** First-seen ISO-2 wins (Arab list preferred over later Asia duplicates). */
const ROWS: Array<[string, string, string]> = [
  ['eg', 'مصر', 'Egypt'],
  ['sa', 'السعودية', 'Saudi Arabia'],
  ['ae', 'الإمارات', 'United Arab Emirates'],
  ['kw', 'الكويت', 'Kuwait'],
  ['qa', 'قطر', 'Qatar'],
  ['bh', 'البحرين', 'Bahrain'],
  ['om', 'عُمان', 'Oman'],
  ['jo', 'الأردن', 'Jordan'],
  ['lb', 'لبنان', 'Lebanon'],
  ['iq', 'العراق', 'Iraq'],
  ['ma', 'المغرب', 'Morocco'],
  ['dz', 'الجزائر', 'Algeria'],
  ['tn', 'تونس', 'Tunisia'],
  ['ly', 'ليبيا', 'Libya'],
  ['sd', 'السودان', 'Sudan'],
  ['ps', 'فلسطين', 'Palestine'],
  ['sy', 'سوريا', 'Syria'],
  ['ye', 'اليمن', 'Yemen'],
  ['mr', 'موريتانيا', 'Mauritania'],
  ['so', 'الصومال', 'Somalia'],
  ['dj', 'جيبوتي', 'Djibouti'],
  ['km', 'جزر القمر', 'Comoros'],
  ['gb', 'بريطانيا', 'United Kingdom'],
  ['de', 'ألمانيا', 'Germany'],
  ['fr', 'فرنسا', 'France'],
  ['es', 'إسبانيا', 'Spain'],
  ['it', 'إيطاليا', 'Italy'],
  ['nl', 'هولندا', 'Netherlands'],
  ['pt', 'البرتغال', 'Portugal'],
  ['tr', 'تركيا', 'Turkey'],
  ['be', 'بلجيكا', 'Belgium'],
  ['se', 'السويد', 'Sweden'],
  ['no', 'النرويج', 'Norway'],
  ['dk', 'الدنمارك', 'Denmark'],
  ['ch', 'سويسرا', 'Switzerland'],
  ['at', 'النمسا', 'Austria'],
  ['pl', 'بولندا', 'Poland'],
  ['gr', 'اليونان', 'Greece'],
  ['ru', 'روسيا', 'Russia'],
  ['ua', 'أوكرانيا', 'Ukraine'],
  ['cz', 'التشيك', 'Czech Republic'],
  ['ro', 'رومانيا', 'Romania'],
  ['hu', 'المجر', 'Hungary'],
  ['hr', 'كرواتيا', 'Croatia'],
  ['rs', 'صربيا', 'Serbia'],
  ['ie', 'أيرلندا', 'Ireland'],
  ['fi', 'فنلندا', 'Finland'],
  ['us', 'أمريكا', 'United States'],
  ['br', 'البرازيل', 'Brazil'],
  ['ar', 'الأرجنتين', 'Argentina'],
  ['mx', 'المكسيك', 'Mexico'],
  ['ca', 'كندا', 'Canada'],
  ['co', 'كولومبيا', 'Colombia'],
  ['cl', 'تشيلي', 'Chile'],
  ['ng', 'نيجيريا', 'Nigeria'],
  ['gh', 'غانا', 'Ghana'],
  ['sn', 'السنغال', 'Senegal'],
  ['cm', 'الكاميرون', 'Cameroon'],
  ['ci', 'ساحل العاج', 'Ivory Coast'],
  ['za', 'جنوب أفريقيا', 'South Africa'],
  ['jp', 'اليابان', 'Japan'],
  ['kr', 'كوريا الجنوبية', 'South Korea'],
  ['cn', 'الصين', 'China'],
  ['in', 'الهند', 'India'],
  ['id', 'إندونيسيا', 'Indonesia'],
  ['au', 'أستراليا', 'Australia'],
  ['nz', 'نيوزيلندا', 'New Zealand'],
  ['pk', 'باكستان', 'Pakistan'],
  ['bd', 'بنغلاديش', 'Bangladesh'],
  ['ir', 'إيران', 'Iran'],
  ['il', 'إسرائيل', 'Israel'],
  ['ke', 'كينيا', 'Kenya'],
  ['et', 'إثيوبيا', 'Ethiopia'],
  ['ug', 'أوغندا', 'Uganda'],
  ['ao', 'أنغولا', 'Angola'],
  ['uy', 'أوروغواي', 'Uruguay'],
  ['pe', 'بيرو', 'Peru'],
  ['ec', 'الإكوادور', 'Ecuador'],
  ['ve', 'فنزويلا', 'Venezuela'],
  ['py', 'باراغواي', 'Paraguay'],
  ['bo', 'بوليفيا', 'Bolivia'],
  ['cr', 'كوستاريكا', 'Costa Rica'],
  ['pa', 'بنما', 'Panama'],
  ['gt', 'غواتيمالا', 'Guatemala'],
  ['hn', 'هندوراس', 'Honduras'],
  ['sv', 'السلفادور', 'El Salvador'],
  ['cu', 'كوبا', 'Cuba'],
  ['jm', 'جامايكا', 'Jamaica'],
  ['al', 'ألبانيا', 'Albania'],
  ['ba', 'البوسنة', 'Bosnia and Herzegovina'],
  ['mk', 'مقدونيا', 'North Macedonia'],
  ['me', 'الجبل الأسود', 'Montenegro'],
  ['xk', 'كوسوفو', 'Kosovo'],
  ['bg', 'بلغاريا', 'Bulgaria'],
  ['sk', 'سلوفاكيا', 'Slovakia'],
  ['si', 'سلوفينيا', 'Slovenia'],
  ['lt', 'ليتوانيا', 'Lithuania'],
  ['lv', 'لاتفيا', 'Latvia'],
  ['ee', 'إستونيا', 'Estonia'],
  ['by', 'بيلاروسيا', 'Belarus'],
  ['md', 'مولدوفا', 'Moldova'],
  ['ge', 'جورجيا', 'Georgia'],
  ['am', 'أرمينيا', 'Armenia'],
  ['az', 'أذربيجان', 'Azerbaijan'],
  ['kz', 'كازاخستان', 'Kazakhstan'],
  ['uz', 'أوزبكستان', 'Uzbekistan'],
  ['th', 'تايلاند', 'Thailand'],
  ['vn', 'فيتنام', 'Vietnam'],
  ['ph', 'الفلبين', 'Philippines'],
  ['my', 'ماليزيا', 'Malaysia'],
  ['sg', 'سنغافورة', 'Singapore'],
  ['tw', 'تايوان', 'Taiwan'],
  ['hk', 'هونغ كونغ', 'Hong Kong'],
];

const ALIASES: Record<string, string> = {
  uk: 'gb',
  'united kingdom': 'gb',
  'great britain': 'gb',
  britain: 'gb',
  england: 'gb',
  scotland: 'gb',
  wales: 'gb',
  usa: 'us',
  us: 'us',
  'united states': 'us',
  'united states of america': 'us',
  ksa: 'sa',
  saudi: 'sa',
  'saudi arabia': 'sa',
  uae: 'ae',
  'united arab emirates': 'ae',
  emirates: 'ae',
  egypt: 'eg',
  'el salvador': 'sv',
  czechia: 'cz',
  'czech republic': 'cz',
  korea: 'kr',
  'south korea': 'kr',
  'republic of korea': 'kr',
  'cote divoire': 'ci',
  "cote d'ivoire": 'ci',
  'ivory coast': 'ci',
  russia: 'ru',
  'russian federation': 'ru',
  palestine: 'ps',
  'state of palestine': 'ps',
  syria: 'sy',
  morocco: 'ma',
  algeria: 'dz',
  tunisia: 'tn',
  libya: 'ly',
  sudan: 'sd',
  jordan: 'jo',
  lebanon: 'lb',
  iraq: 'iq',
  kuwait: 'kw',
  qatar: 'qa',
  bahrain: 'bh',
  oman: 'om',
  yemen: 'ye',
  turkey: 'tr',
  turkiye: 'tr',
  germany: 'de',
  france: 'fr',
  spain: 'es',
  italy: 'it',
  netherlands: 'nl',
  holland: 'nl',
  portugal: 'pt',
  belgium: 'be',
  brazil: 'br',
  argentina: 'ar',
  mexico: 'mx',
  canada: 'ca',
  australia: 'au',
  japan: 'jp',
  china: 'cn',
  india: 'in',
  nigeria: 'ng',
  ghana: 'gh',
  senegal: 'sn',
  cameroon: 'cm',
  'south africa': 'za',
  israel: 'il',
  iran: 'ir',
};

const BY_ID = new Map<string, CatalogCountry>();
const BY_NAME = new Map<string, CatalogCountry>();

for (const [id, name, nameEn] of ROWS) {
  if (BY_ID.has(id)) continue;
  const row: CatalogCountry = {
    id,
    name,
    nameEn,
    flag: flagEmojiFromIso2(id),
  };
  BY_ID.set(id, row);
  BY_NAME.set(normalizeCountryKey(nameEn), row);
  BY_NAME.set(normalizeCountryKey(name), row);
}

export function normalizeCountryKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]/g, '')
    .replace(/\s+/g, ' ');
}

export function mapCountryInput(raw: string | null | undefined): CatalogCountry | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const iso = trimmed.toLowerCase();
  if (/^[a-z]{2}$/.test(iso)) {
    const fromId = BY_ID.get(iso);
    if (fromId) return fromId;
    const aliased = ALIASES[iso];
    if (aliased) return BY_ID.get(aliased) ?? null;
  }

  const key = normalizeCountryKey(trimmed);
  const aliased = ALIASES[key];
  if (aliased) return BY_ID.get(aliased) ?? null;
  return BY_NAME.get(key) ?? BY_ID.get(key) ?? null;
}

export function countriesMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const left = mapCountryInput(a);
  const right = mapCountryInput(b);
  if (left && right) return left.id === right.id;
  if (!a || !b) return false;
  return normalizeCountryKey(a) === normalizeCountryKey(b);
}

export const NEW_USER_COUNTRY_SEED_MAX_AGE_MS = 48 * 60 * 60 * 1000;

export function shouldSeedCountry(user: {
  country?: string | null;
  countryFlag?: string | null;
  createdAt: Date;
}, now = Date.now()): boolean {
  const country = (user.country ?? '').trim();
  const flag = (user.countryFlag ?? '').trim();
  if (country || flag) return false;
  const age = now - user.createdAt.getTime();
  return age >= 0 && age <= NEW_USER_COUNTRY_SEED_MAX_AGE_MS;
}
