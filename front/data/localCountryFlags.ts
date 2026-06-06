/**
 * Local Country Flags for Top 5 Leagues
 * أعلام الدول للدوريات الخمسة الكبرى
 * 
 * This file contains country flags with local URLs
 * for offline support and better performance
 */

export interface CountryFlag {
    id: string;
    name: string;
    nameAr: string;
    code: string; // ISO 3166-1 alpha-2 code
    flag: string; // Flag emoji or URL
    flagUrl: string; // High-quality flag URL
    league?: string; // Associated league
}

// ============ TOP 5 LEAGUES COUNTRIES ============
export const TOP_5_LEAGUES_FLAGS: CountryFlag[] = [
    {
        id: 'england',
        name: 'England',
        nameAr: 'إنجلترا',
        code: 'GB-ENG',
        flag: '🇬🇧',
        flagUrl: 'https://flagcdn.com/w320/gb-eng.png',
        league: 'Premier League'
    },
    {
        id: 'spain',
        name: 'Spain',
        nameAr: 'إسبانيا',
        code: 'ES',
        flag: '🇪🇸',
        flagUrl: 'https://flagcdn.com/w320/es.png',
        league: 'La Liga'
    },
    {
        id: 'italy',
        name: 'Italy',
        nameAr: 'إيطاليا',
        code: 'IT',
        flag: '🇮🇹',
        flagUrl: 'https://flagcdn.com/w320/it.png',
        league: 'Serie A'
    },
    {
        id: 'germany',
        name: 'Germany',
        nameAr: 'ألمانيا',
        code: 'DE',
        flag: '🇩🇪',
        flagUrl: 'https://flagcdn.com/w320/de.png',
        league: 'Bundesliga'
    },
    {
        id: 'france',
        name: 'France',
        nameAr: 'فرنسا',
        code: 'FR',
        flag: '🇫🇷',
        flagUrl: 'https://flagcdn.com/w320/fr.png',
        league: 'Ligue 1'
    },
];

// ============ ADDITIONAL POPULAR COUNTRIES ============
export const POPULAR_COUNTRIES_FLAGS: CountryFlag[] = [
    {
        id: 'brazil',
        name: 'Brazil',
        nameAr: 'البرازيل',
        code: 'BR',
        flag: '🇧🇷',
        flagUrl: 'https://flagcdn.com/w320/br.png'
    },
    {
        id: 'argentina',
        name: 'Argentina',
        nameAr: 'الأرجنتين',
        code: 'AR',
        flag: '🇦🇷',
        flagUrl: 'https://flagcdn.com/w320/ar.png'
    },
    {
        id: 'portugal',
        name: 'Portugal',
        nameAr: 'البرتغال',
        code: 'PT',
        flag: '🇵🇹',
        flagUrl: 'https://flagcdn.com/w320/pt.png'
    },
    {
        id: 'netherlands',
        name: 'Netherlands',
        nameAr: 'هولندا',
        code: 'NL',
        flag: '🇳🇱',
        flagUrl: 'https://flagcdn.com/w320/nl.png'
    },
    {
        id: 'belgium',
        name: 'Belgium',
        nameAr: 'بلجيكا',
        code: 'BE',
        flag: '🇧🇪',
        flagUrl: 'https://flagcdn.com/w320/be.png'
    },
    {
        id: 'croatia',
        name: 'Croatia',
        nameAr: 'كرواتيا',
        code: 'HR',
        flag: '🇭🇷',
        flagUrl: 'https://flagcdn.com/w320/hr.png'
    },
    {
        id: 'uruguay',
        name: 'Uruguay',
        nameAr: 'أوروغواي',
        code: 'UY',
        flag: '🇺🇾',
        flagUrl: 'https://flagcdn.com/w320/uy.png'
    },
    {
        id: 'colombia',
        name: 'Colombia',
        nameAr: 'كولومبيا',
        code: 'CO',
        flag: '🇨🇴',
        flagUrl: 'https://flagcdn.com/w320/co.png'
    },
    {
        id: 'morocco',
        name: 'Morocco',
        nameAr: 'المغرب',
        code: 'MA',
        flag: '🇲🇦',
        flagUrl: 'https://flagcdn.com/w320/ma.png'
    },
    {
        id: 'egypt',
        name: 'Egypt',
        nameAr: 'مصر',
        code: 'EG',
        flag: '🇪🇬',
        flagUrl: 'https://flagcdn.com/w320/eg.png'
    },
    {
        id: 'saudi-arabia',
        name: 'Saudi Arabia',
        nameAr: 'السعودية',
        code: 'SA',
        flag: '🇸🇦',
        flagUrl: 'https://flagcdn.com/w320/sa.png'
    },
    {
        id: 'algeria',
        name: 'Algeria',
        nameAr: 'الجزائر',
        code: 'DZ',
        flag: '🇩🇿',
        flagUrl: 'https://flagcdn.com/w320/dz.png'
    },
    {
        id: 'tunisia',
        name: 'Tunisia',
        nameAr: 'تونس',
        code: 'TN',
        flag: '🇹🇳',
        flagUrl: 'https://flagcdn.com/w320/tn.png'
    },
    {
        id: 'senegal',
        name: 'Senegal',
        nameAr: 'السنغال',
        code: 'SN',
        flag: '🇸🇳',
        flagUrl: 'https://flagcdn.com/w320/sn.png'
    },
    {
        id: 'nigeria',
        name: 'Nigeria',
        nameAr: 'نيجيريا',
        code: 'NG',
        flag: '🇳🇬',
        flagUrl: 'https://flagcdn.com/w320/ng.png'
    },
    {
        id: 'cameroon',
        name: 'Cameroon',
        nameAr: 'الكاميرون',
        code: 'CM',
        flag: '🇨🇲',
        flagUrl: 'https://flagcdn.com/w320/cm.png'
    },
    {
        id: 'ivory-coast',
        name: 'Ivory Coast',
        nameAr: 'ساحل العاج',
        code: 'CI',
        flag: '🇨🇮',
        flagUrl: 'https://flagcdn.com/w320/ci.png'
    },
    {
        id: 'ghana',
        name: 'Ghana',
        nameAr: 'غانا',
        code: 'GH',
        flag: '🇬🇭',
        flagUrl: 'https://flagcdn.com/w320/gh.png'
    },
    {
        id: 'south-korea',
        name: 'South Korea',
        nameAr: 'كوريا الجنوبية',
        code: 'KR',
        flag: '🇰🇷',
        flagUrl: 'https://flagcdn.com/w320/kr.png'
    },
    {
        id: 'japan',
        name: 'Japan',
        nameAr: 'اليابان',
        code: 'JP',
        flag: '🇯🇵',
        flagUrl: 'https://flagcdn.com/w320/jp.png'
    },
    {
        id: 'poland',
        name: 'Poland',
        nameAr: 'بولندا',
        code: 'PL',
        flag: '🇵🇱',
        flagUrl: 'https://flagcdn.com/w320/pl.png'
    },
    {
        id: 'denmark',
        name: 'Denmark',
        nameAr: 'الدنمارك',
        code: 'DK',
        flag: '🇩🇰',
        flagUrl: 'https://flagcdn.com/w320/dk.png'
    },
    {
        id: 'sweden',
        name: 'Sweden',
        nameAr: 'السويد',
        code: 'SE',
        flag: '🇸🇪',
        flagUrl: 'https://flagcdn.com/w320/se.png'
    },
    {
        id: 'norway',
        name: 'Norway',
        nameAr: 'النرويج',
        code: 'NO',
        flag: '🇳🇴',
        flagUrl: 'https://flagcdn.com/w320/no.png'
    },
    {
        id: 'switzerland',
        name: 'Switzerland',
        nameAr: 'سويسرا',
        code: 'CH',
        flag: '🇨🇭',
        flagUrl: 'https://flagcdn.com/w320/ch.png'
    },
    {
        id: 'austria',
        name: 'Austria',
        nameAr: 'النمسا',
        code: 'AT',
        flag: '🇦🇹',
        flagUrl: 'https://flagcdn.com/w320/at.png'
    },
    {
        id: 'czech-republic',
        name: 'Czech Republic',
        nameAr: 'التشيك',
        code: 'CZ',
        flag: '🇨🇿',
        flagUrl: 'https://flagcdn.com/w320/cz.png'
    },
    {
        id: 'serbia',
        name: 'Serbia',
        nameAr: 'صربيا',
        code: 'RS',
        flag: '🇷🇸',
        flagUrl: 'https://flagcdn.com/w320/rs.png'
    },
    {
        id: 'ukraine',
        name: 'Ukraine',
        nameAr: 'أوكرانيا',
        code: 'UA',
        flag: '🇺🇦',
        flagUrl: 'https://flagcdn.com/w320/ua.png'
    },
    {
        id: 'turkey',
        name: 'Turkey',
        nameAr: 'تركيا',
        code: 'TR',
        flag: '🇹🇷',
        flagUrl: 'https://flagcdn.com/w320/tr.png'
    },
];

// ============ 22 ARAB LEAGUE COUNTRIES ============
const ARAB_COUNTRY_ENTRIES: CountryFlag[] = [
    { id: 'algeria', name: 'Algeria', nameAr: 'الجزائر', code: 'DZ', flag: '🇩🇿', flagUrl: 'https://flagcdn.com/w320/dz.png' },
    { id: 'bahrain', name: 'Bahrain', nameAr: 'البحرين', code: 'BH', flag: '🇧🇭', flagUrl: 'https://flagcdn.com/w320/bh.png' },
    { id: 'comoros', name: 'Comoros', nameAr: 'جزر القمر', code: 'KM', flag: '🇰🇲', flagUrl: 'https://flagcdn.com/w320/km.png' },
    { id: 'djibouti', name: 'Djibouti', nameAr: 'جيبوتي', code: 'DJ', flag: '🇩🇯', flagUrl: 'https://flagcdn.com/w320/dj.png' },
    { id: 'egypt', name: 'Egypt', nameAr: 'مصر', code: 'EG', flag: '🇪🇬', flagUrl: 'https://flagcdn.com/w320/eg.png' },
    { id: 'iraq', name: 'Iraq', nameAr: 'العراق', code: 'IQ', flag: '🇮🇶', flagUrl: 'https://flagcdn.com/w320/iq.png' },
    { id: 'jordan', name: 'Jordan', nameAr: 'الأردن', code: 'JO', flag: '🇯🇴', flagUrl: 'https://flagcdn.com/w320/jo.png' },
    { id: 'kuwait', name: 'Kuwait', nameAr: 'الكويت', code: 'KW', flag: '🇰🇼', flagUrl: 'https://flagcdn.com/w320/kw.png' },
    { id: 'lebanon', name: 'Lebanon', nameAr: 'لبنان', code: 'LB', flag: '🇱🇧', flagUrl: 'https://flagcdn.com/w320/lb.png' },
    { id: 'libya', name: 'Libya', nameAr: 'ليبيا', code: 'LY', flag: '🇱🇾', flagUrl: 'https://flagcdn.com/w320/ly.png' },
    { id: 'mauritania', name: 'Mauritania', nameAr: 'موريتانيا', code: 'MR', flag: '🇲🇷', flagUrl: 'https://flagcdn.com/w320/mr.png' },
    { id: 'morocco', name: 'Morocco', nameAr: 'المغرب', code: 'MA', flag: '🇲🇦', flagUrl: 'https://flagcdn.com/w320/ma.png' },
    { id: 'oman', name: 'Oman', nameAr: 'عُمان', code: 'OM', flag: '🇴🇲', flagUrl: 'https://flagcdn.com/w320/om.png' },
    { id: 'palestine', name: 'Palestine', nameAr: 'فلسطين', code: 'PS', flag: '🇵🇸', flagUrl: 'https://flagcdn.com/w320/ps.png' },
    { id: 'qatar', name: 'Qatar', nameAr: 'قطر', code: 'QA', flag: '🇶🇦', flagUrl: 'https://flagcdn.com/w320/qa.png' },
    { id: 'saudi-arabia', name: 'Saudi Arabia', nameAr: 'السعودية', code: 'SA', flag: '🇸🇦', flagUrl: 'https://flagcdn.com/w320/sa.png' },
    { id: 'somalia', name: 'Somalia', nameAr: 'الصومال', code: 'SO', flag: '🇸🇴', flagUrl: 'https://flagcdn.com/w320/so.png' },
    { id: 'sudan', name: 'Sudan', nameAr: 'السودان', code: 'SD', flag: '🇸🇩', flagUrl: 'https://flagcdn.com/w320/sd.png' },
    { id: 'syria', name: 'Syria', nameAr: 'سوريا', code: 'SY', flag: '🇸🇾', flagUrl: 'https://flagcdn.com/w320/sy.png' },
    { id: 'tunisia', name: 'Tunisia', nameAr: 'تونس', code: 'TN', flag: '🇹🇳', flagUrl: 'https://flagcdn.com/w320/tn.png' },
    { id: 'uae', name: 'UAE', nameAr: 'الإمارات', code: 'AE', flag: '🇦🇪', flagUrl: 'https://flagcdn.com/w320/ae.png' },
    { id: 'yemen', name: 'Yemen', nameAr: 'اليمن', code: 'YE', flag: '🇾🇪', flagUrl: 'https://flagcdn.com/w320/ye.png' },
];

export const ARAB_COUNTRIES_FLAGS: CountryFlag[] = ARAB_COUNTRY_ENTRIES;

const ARAB_IDS = new Set(ARAB_COUNTRY_ENTRIES.map((c) => c.id));

function mergeUniqueCountries(...groups: CountryFlag[][]): CountryFlag[] {
    const seen = new Set<string>();
    const out: CountryFlag[] = [];
    for (const group of groups) {
        for (const c of group) {
            if (seen.has(c.id)) continue;
            seen.add(c.id);
            out.push(c);
        }
    }
    return out;
}

// ============ COMBINED EXPORT ============
export const ALL_COUNTRY_FLAGS: CountryFlag[] = mergeUniqueCountries(
    ARAB_COUNTRY_ENTRIES,
    TOP_5_LEAGUES_FLAGS,
    POPULAR_COUNTRIES_FLAGS,
);

export const OTHER_COUNTRY_FLAGS: CountryFlag[] = ALL_COUNTRY_FLAGS.filter(
    (c) => !ARAB_IDS.has(c.id),
);

// Helper functions
export const getFlagByCountryCode = (code: string): CountryFlag | undefined => {
    return ALL_COUNTRY_FLAGS.find(country => country.code === code);
};

export const getFlagByCountryName = (name: string): CountryFlag | undefined => {
    return ALL_COUNTRY_FLAGS.find(
        country => country.name.toLowerCase() === name.toLowerCase() || 
                   country.nameAr === name
    );
};

export const getFlagById = (id: string): CountryFlag | undefined => {
    return ALL_COUNTRY_FLAGS.find(country => country.id === id);
};

export const getTop5LeaguesFlags = (): CountryFlag[] => {
    return TOP_5_LEAGUES_FLAGS;
};

export const searchCountries = (query: string): CountryFlag[] => {
    const lowerQuery = query.toLowerCase();
    return ALL_COUNTRY_FLAGS.filter(
        country => 
            country.name.toLowerCase().includes(lowerQuery) ||
            country.nameAr.includes(query) ||
            country.code.toLowerCase().includes(lowerQuery)
    );
};

export function isCountrySelected(
    selected: string | undefined,
    country: CountryFlag,
): boolean {
    if (!selected?.trim()) return false;
    return (
        selected === country.flag ||
        selected === country.id ||
        selected === country.code ||
        selected === country.nameAr
    );
}
