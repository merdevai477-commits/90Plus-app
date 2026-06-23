export interface League {
    id: number;
    name: string;
    nameAr: string;
    logo: string;
    country: string;
    countryFlag: string;
}

export const LEAGUES: League[] = [
    // International tournaments
    { id: 1, name: 'World Cup', nameAr: 'كأس العالم', logo: 'https://media.api-sports.io/football/leagues/1.png', country: 'World', countryFlag: '🌍' },
    { id: 4, name: 'Euro Championship', nameAr: 'كأس أمم أوروبا', logo: 'https://media.api-sports.io/football/leagues/4.png', country: 'Europe', countryFlag: '🇪🇺' },
    { id: 6, name: 'Africa Cup of Nations', nameAr: 'كأس أمم أفريقيا', logo: 'https://media.api-sports.io/football/leagues/6.png', country: 'Africa', countryFlag: '🌍' },
    { id: 12, name: 'CAF Champions League', nameAr: 'دوري أبطال أفريقيا', logo: 'https://media.api-sports.io/football/leagues/12.png', country: 'Africa', countryFlag: '🌍' },
    { id: 13, name: 'CAF Confederation Cup', nameAr: 'كأس الاتحاد الأفريقي', logo: 'https://media.api-sports.io/football/leagues/13.png', country: 'Africa', countryFlag: '🌍' },
    { id: 15, name: 'FIFA Club World Cup', nameAr: 'كأس العالم للأندية', logo: 'https://media.api-sports.io/football/leagues/15.png', country: 'World', countryFlag: '🌍' },

    // Top European Leagues
    { id: 39, name: 'Premier League', nameAr: 'الدوري الإنجليزي الممتاز', logo: 'https://media.api-sports.io/football/leagues/39.png', country: 'England', countryFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
    { id: 140, name: 'La Liga', nameAr: 'الدوري الإسباني', logo: 'https://media.api-sports.io/football/leagues/140.png', country: 'Spain', countryFlag: '🇪🇸' },
    { id: 135, name: 'Serie A', nameAr: 'الدوري الإيطالي', logo: 'https://media.api-sports.io/football/leagues/135.png', country: 'Italy', countryFlag: '🇮🇹' },
    { id: 78, name: 'Bundesliga', nameAr: 'الدوري الألماني', logo: 'https://media.api-sports.io/football/leagues/78.png', country: 'Germany', countryFlag: '🇩🇪' },
    { id: 61, name: 'Ligue 1', nameAr: 'الدوري الفرنسي', logo: 'https://media.api-sports.io/football/leagues/61.png', country: 'France', countryFlag: '🇫🇷' },
    { id: 94, name: 'Primeira Liga', nameAr: 'الدوري البرتغالي', logo: 'https://media.api-sports.io/football/leagues/94.png', country: 'Portugal', countryFlag: '🇵🇹' },
    { id: 88, name: 'Eredivisie', nameAr: 'الدوري الهولندي', logo: 'https://media.api-sports.io/football/leagues/88.png', country: 'Netherlands', countryFlag: '🇳🇱' },
    { id: 144, name: 'Jupiler Pro League', nameAr: 'الدوري البلجيكي', logo: 'https://media.api-sports.io/football/leagues/144.png', country: 'Belgium', countryFlag: '🇧🇪' },
    { id: 235, name: 'Premier League', nameAr: 'الدوري الروسي', logo: 'https://media.api-sports.io/football/leagues/235.png', country: 'Russia', countryFlag: '🇷🇺' },

    // UEFA Competitions
    { id: 2, name: 'UEFA Champions League', nameAr: 'دوري أبطال أوروبا', logo: 'https://media.api-sports.io/football/leagues/2.png', country: 'Europe', countryFlag: '🇪🇺' },
    { id: 3, name: 'UEFA Europa League', nameAr: 'الدوري الأوروبي', logo: 'https://media.api-sports.io/football/leagues/3.png', country: 'Europe', countryFlag: '🇪🇺' },
    { id: 848, name: 'UEFA Europa Conference League', nameAr: 'دوري المؤتمر الأوروبي', logo: 'https://media.api-sports.io/football/leagues/848.png', country: 'Europe', countryFlag: '🇪🇺' },

    // Arab Leagues
    { id: 233, name: 'Egyptian Premier League', nameAr: 'الدوري المصري الممتاز', logo: 'https://media.api-sports.io/football/leagues/233.png', country: 'Egypt', countryFlag: '🇪🇬' },
    { id: 307, name: 'Saudi Pro League', nameAr: 'دوري روشن السعودي', logo: 'https://media.api-sports.io/football/leagues/307.png', country: 'Saudi Arabia', countryFlag: '🇸🇦' },
    { id: 551, name: 'UAE Pro League', nameAr: 'دوري أدنوك للمحترفين', logo: 'https://media.api-sports.io/football/leagues/551.png', country: 'UAE', countryFlag: '🇦🇪' },
    { id: 536, name: 'Qatar Stars League', nameAr: 'دوري نجوم قطر', logo: 'https://media.api-sports.io/football/leagues/536.png', country: 'Qatar', countryFlag: '🇶🇦' },
    { id: 200, name: 'Botola Pro', nameAr: 'الدوري المغربي', logo: 'https://media.api-sports.io/football/leagues/200.png', country: 'Morocco', countryFlag: '🇲🇦' },
    { id: 202, name: 'Ligue 1', nameAr: 'الدوري التونسي', logo: 'https://media.api-sports.io/football/leagues/202.png', country: 'Tunisia', countryFlag: '🇹🇳' },
    { id: 201, name: 'Ligue 1', nameAr: 'الدوري الجزائري', logo: 'https://media.api-sports.io/football/leagues/201.png', country: 'Algeria', countryFlag: '🇩🇿' },
    { id: 357, name: 'Iraqi Premier League', nameAr: 'الدوري العراقي', logo: 'https://media.api-sports.io/football/leagues/357.png', country: 'Iraq', countryFlag: '🇮🇶' },
    { id: 366, name: 'Jordanian Pro League', nameAr: 'الدوري الأردني', logo: 'https://media.api-sports.io/football/leagues/366.png', country: 'Jordan', countryFlag: '🇯🇴' },
    { id: 425, name: 'Premier League', nameAr: 'الدوري اللبناني', logo: 'https://media.api-sports.io/football/leagues/425.png', country: 'Lebanon', countryFlag: '🇱🇧' },
    { id: 330, name: 'Premier League', nameAr: 'الدوري الكويتي', logo: 'https://media.api-sports.io/football/leagues/330.png', country: 'Kuwait', countryFlag: '🇰🇼' },
    { id: 417, name: 'Premier League', nameAr: 'الدوري البحريني', logo: 'https://media.api-sports.io/football/leagues/417.png', country: 'Bahrain', countryFlag: '🇧🇭' },
    { id: 406, name: 'Professional League', nameAr: 'دوري المحترفين العماني', logo: 'https://media.api-sports.io/football/leagues/406.png', country: 'Oman', countryFlag: '🇴🇲' },
    { id: 384, name: 'Premier League', nameAr: 'الدوري الليبي', logo: 'https://media.api-sports.io/football/leagues/384.png', country: 'Libya', countryFlag: '🇱🇾' },
    { id: 402, name: 'Sudani Premier League', nameAr: 'الدوري السوداني', logo: 'https://media.api-sports.io/football/leagues/402.png', country: 'Sudan', countryFlag: '🇸🇩' },
    { id: 542, name: 'Premier League', nameAr: 'الدوري السوري', logo: 'https://media.api-sports.io/football/leagues/542.png', country: 'Syria', countryFlag: '🇸🇾' },
    { id: 496, name: 'West Bank Premier League', nameAr: 'دوري الضفة الغربية', logo: 'https://media.api-sports.io/football/leagues/496.png', country: 'Palestine', countryFlag: '🇵🇸' },
    { id: 428, name: 'Yemeni League', nameAr: 'الدوري اليمني', logo: 'https://media.api-sports.io/football/leagues/428.png', country: 'Yemen', countryFlag: '🇾🇪' },
    { id: 383, name: 'Ligat ha\'Al', nameAr: 'الدوري الإسرائيلي', logo: 'https://media.api-sports.io/football/leagues/383.png', country: 'Israel', countryFlag: '🇮🇱' },

    // Domestic cups (Arab region)
    { id: 504, name: 'King\'s Cup', nameAr: 'كأس الملك', logo: 'https://media.api-sports.io/football/leagues/504.png', country: 'Saudi Arabia', countryFlag: '🇸🇦' },

    // Other Popular Leagues
    { id: 203, name: 'Süper Lig', nameAr: 'الدوري التركي', logo: 'https://media.api-sports.io/football/leagues/203.png', country: 'Turkey', countryFlag: '🇹🇷' },
    { id: 71, name: 'Serie A', nameAr: 'الدوري البرازيلي', logo: 'https://media.api-sports.io/football/leagues/71.png', country: 'Brazil', countryFlag: '🇧🇷' },
    { id: 128, name: 'Liga Profesional Argentina', nameAr: 'الدوري الأرجنتيني', logo: 'https://media.api-sports.io/football/leagues/128.png', country: 'Argentina', countryFlag: '🇦🇷' },

    // Oceania / Asia / Americas
    { id: 188, name: 'A-League', nameAr: 'الدوري الأسترالي', logo: 'https://media.api-sports.io/football/leagues/188.png', country: 'Australia', countryFlag: '🇦🇺' },
    { id: 98, name: 'J1 League', nameAr: 'الدوري الياباني', logo: 'https://media.api-sports.io/football/leagues/98.png', country: 'Japan', countryFlag: '🇯🇵' },
    { id: 253, name: 'Major League Soccer', nameAr: 'الدوري الأمريكي', logo: 'https://media.api-sports.io/football/leagues/253.png', country: 'USA', countryFlag: '🇺🇸' },
    { id: 262, name: 'Liga MX', nameAr: 'الدوري المكسيكي', logo: 'https://media.api-sports.io/football/leagues/262.png', country: 'Mexico', countryFlag: '🇲🇽' },
    { id: 292, name: 'K League 1', nameAr: 'الدوري الكوري', logo: 'https://media.api-sports.io/football/leagues/292.png', country: 'South Korea', countryFlag: '🇰🇷' },

    // UK secondary
    { id: 40, name: 'Championship', nameAr: 'الدرجة الأولى الإنجليزية', logo: 'https://media.api-sports.io/football/leagues/40.png', country: 'England', countryFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
    { id: 179, name: 'Premiership', nameAr: 'الدوري الاسكتلندي', logo: 'https://media.api-sports.io/football/leagues/179.png', country: 'Scotland', countryFlag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },

    // Domestic cups (Europe)
    { id: 45, name: 'FA Cup', nameAr: 'كأس الاتحاد الإنجليزي', logo: 'https://media.api-sports.io/football/leagues/45.png', country: 'England', countryFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
    { id: 48, name: 'EFL Cup', nameAr: 'كأس الرابطة الإنجليزية', logo: 'https://media.api-sports.io/football/leagues/48.png', country: 'England', countryFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
    { id: 143, name: 'Copa del Rey', nameAr: 'كأس ملك إسبانيا', logo: 'https://media.api-sports.io/football/leagues/143.png', country: 'Spain', countryFlag: '🇪🇸' },
    { id: 137, name: 'Coppa Italia', nameAr: 'كأس إيطاليا', logo: 'https://media.api-sports.io/football/leagues/137.png', country: 'Italy', countryFlag: '🇮🇹' },
    { id: 81, name: 'DFB Pokal', nameAr: 'كأس ألمانيا', logo: 'https://media.api-sports.io/football/leagues/81.png', country: 'Germany', countryFlag: '🇩🇪' },
    { id: 66, name: 'Coupe de France', nameAr: 'كأس فرنسا', logo: 'https://media.api-sports.io/football/leagues/66.png', country: 'France', countryFlag: '🇫🇷' },
];

/** O(1) lookup by API-Football league id — primary source of truth for translations. */
export const LEAGUE_BY_ID = new Map<number, League>(
    LEAGUES.map((league) => [league.id, league]),
);

/**
 * English names shared by multiple countries/leagues.
 * Must never be resolved by name alone — require league id or country.
 */
export const AMBIGUOUS_LEAGUE_NAMES = new Set([
    'premier league',
    'ligue 1',
    'serie a',
    'premiership',
    'super league',
    'superliga',
    'first division',
    'division 1',
    'division 2',
    'professional league',
]);

/** Normalize API country strings for disambiguation lookups. */
export function normalizeLeagueCountryKey(country?: string | null): string {
    return (country ?? '')
        .trim()
        .toLowerCase()
        .replace(/-/g, ' ')
        .replace(/\s+/g, ' ');
}

/**
 * Map generic league names → country → API league id.
 * Used when we have country but the API name alone is ambiguous.
 */
export const LEAGUE_NAME_COUNTRY_ID: Record<string, Record<string, number>> = {
    'premier league': {
        england: 39,
        lebanon: 425,
        kuwait: 330,
        bahrain: 417,
        libya: 384,
        russia: 235,
        syria: 542,
    },
    'ligue 1': {
        france: 61,
        tunisia: 202,
        algeria: 201,
    },
    'serie a': {
        italy: 135,
        brazil: 71,
    },
    'championship': { england: 40 },
    'league one': { england: 41 },
    'league two': { england: 42 },
    'fa cup': { england: 45 },
    'efl cup': { england: 48 },
    'carabao cup': { england: 48 },
    'ligue 2': { france: 62 },
    'bundesliga': { germany: 78 },
    '2. bundesliga': { germany: 79 },
    'serie b': { italy: 136 },
    'la liga': { spain: 140 },
    'segunda división': { spain: 141 },
    'segunda division': { spain: 141 },
    'primeira liga': { portugal: 94 },
    'eredivisie': { netherlands: 88 },
    'premiership': { scotland: 179 },
    'a-league': { australia: 188 },
    'a league': { australia: 188 },
    'professional league': { oman: 406 },
    'süper lig': { turkey: 203 },
    'super lig': { turkey: 203 },
};

/** Curated EN → AR map for exact English names (server + client fallback). */
export const LEAGUE_NAME_EN_TO_AR: Record<string, string> = Object.fromEntries(
    LEAGUES.map((league) => [league.name, league.nameAr]),
);

export function getLeagueArabicById(leagueId: number | null | undefined): string | null {
    if (leagueId == null) return null;
    return LEAGUE_BY_ID.get(leagueId)?.nameAr ?? null;
}

export function getLeagueArabicByNameAndCountry(
    name: string,
    country?: string | null,
): string | null {
    const lowerName = name.trim().toLowerCase();
    if (!lowerName) return null;

    const countryKey = normalizeLeagueCountryKey(country);
    const disambigId = LEAGUE_NAME_COUNTRY_ID[lowerName]?.[countryKey];
    if (disambigId != null) {
        return LEAGUE_BY_ID.get(disambigId)?.nameAr ?? null;
    }

    if (AMBIGUOUS_LEAGUE_NAMES.has(lowerName)) return null;

    const exact = LEAGUE_NAME_EN_TO_AR[name] ?? LEAGUE_NAME_EN_TO_AR[name.trim()];
    if (exact) return exact;

    const byName = LEAGUES.find((league) => league.name.toLowerCase() === lowerName);
    return byName?.nameAr ?? null;
}
