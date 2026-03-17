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
        flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
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

// ============ COMBINED EXPORT ============
export const ALL_COUNTRY_FLAGS: CountryFlag[] = [
    ...TOP_5_LEAGUES_FLAGS,
    ...POPULAR_COUNTRIES_FLAGS,
];

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
