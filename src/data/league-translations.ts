/**
 * Curated football league/competition translations keyed by API-Football id.
 * Keep in sync with front/data/leagues.ts.
 */

export interface LeagueTranslation {
  id: number;
  nameEn: string;
  nameAr: string;
  country: string;
}

export const LEAGUE_TRANSLATIONS: LeagueTranslation[] = [
  { id: 1, nameEn: 'World Cup', nameAr: 'كأس العالم', country: 'World' },
  { id: 4, nameEn: 'Euro Championship', nameAr: 'كأس أمم أوروبا', country: 'Europe' },
  { id: 6, nameEn: 'Africa Cup of Nations', nameAr: 'كأس أمم أفريقيا', country: 'Africa' },
  { id: 12, nameEn: 'CAF Champions League', nameAr: 'دوري أبطال أفريقيا', country: 'Africa' },
  { id: 13, nameEn: 'CAF Confederation Cup', nameAr: 'كأس الاتحاد الأفريقي', country: 'Africa' },
  { id: 15, nameEn: 'FIFA Club World Cup', nameAr: 'كأس العالم للأندية', country: 'World' },
  { id: 39, nameEn: 'Premier League', nameAr: 'الدوري الإنجليزي الممتاز', country: 'England' },
  { id: 140, nameEn: 'La Liga', nameAr: 'الدوري الإسباني', country: 'Spain' },
  { id: 135, nameEn: 'Serie A', nameAr: 'الدوري الإيطالي', country: 'Italy' },
  { id: 78, nameEn: 'Bundesliga', nameAr: 'الدوري الألماني', country: 'Germany' },
  { id: 61, nameEn: 'Ligue 1', nameAr: 'الدوري الفرنسي', country: 'France' },
  { id: 94, nameEn: 'Primeira Liga', nameAr: 'الدوري البرتغالي', country: 'Portugal' },
  { id: 88, nameEn: 'Eredivisie', nameAr: 'الدوري الهولندي', country: 'Netherlands' },
  { id: 144, nameEn: 'Jupiler Pro League', nameAr: 'الدوري البلجيكي', country: 'Belgium' },
  { id: 235, nameEn: 'Premier League', nameAr: 'الدوري الروسي', country: 'Russia' },
  { id: 2, nameEn: 'UEFA Champions League', nameAr: 'دوري أبطال أوروبا', country: 'Europe' },
  { id: 3, nameEn: 'UEFA Europa League', nameAr: 'الدوري الأوروبي', country: 'Europe' },
  { id: 848, nameEn: 'UEFA Europa Conference League', nameAr: 'دوري المؤتمر الأوروبي', country: 'Europe' },
  { id: 233, nameEn: 'Egyptian Premier League', nameAr: 'الدوري المصري الممتاز', country: 'Egypt' },
  { id: 307, nameEn: 'Saudi Pro League', nameAr: 'دوري روشن السعودي', country: 'Saudi Arabia' },
  { id: 551, nameEn: 'UAE Pro League', nameAr: 'دوري أدنوك للمحترفين', country: 'UAE' },
  { id: 536, nameEn: 'Qatar Stars League', nameAr: 'دوري نجوم قطر', country: 'Qatar' },
  { id: 200, nameEn: 'Botola Pro', nameAr: 'الدوري المغربي', country: 'Morocco' },
  { id: 202, nameEn: 'Ligue 1', nameAr: 'الدوري التونسي', country: 'Tunisia' },
  { id: 201, nameEn: 'Ligue 1', nameAr: 'الدوري الجزائري', country: 'Algeria' },
  { id: 357, nameEn: 'Iraqi Premier League', nameAr: 'الدوري العراقي', country: 'Iraq' },
  { id: 366, nameEn: 'Jordanian Pro League', nameAr: 'الدوري الأردني', country: 'Jordan' },
  { id: 425, nameEn: 'Premier League', nameAr: 'الدوري اللبناني', country: 'Lebanon' },
  { id: 330, nameEn: 'Premier League', nameAr: 'الدوري الكويتي', country: 'Kuwait' },
  { id: 417, nameEn: 'Premier League', nameAr: 'الدوري البحريني', country: 'Bahrain' },
  { id: 406, nameEn: 'Professional League', nameAr: 'دوري المحترفين العماني', country: 'Oman' },
  { id: 384, nameEn: 'Premier League', nameAr: 'الدوري الليبي', country: 'Libya' },
  { id: 402, nameEn: 'Sudani Premier League', nameAr: 'الدوري السوداني', country: 'Sudan' },
  { id: 542, nameEn: 'Premier League', nameAr: 'الدوري السوري', country: 'Syria' },
  { id: 496, nameEn: 'West Bank Premier League', nameAr: 'دوري الضفة الغربية', country: 'Palestine' },
  { id: 428, nameEn: 'Yemeni League', nameAr: 'الدوري اليمني', country: 'Yemen' },
  { id: 383, nameEn: "Ligat ha'Al", nameAr: 'الدوري الإسرائيلي', country: 'Israel' },
  { id: 504, nameEn: "King's Cup", nameAr: 'كأس الملك', country: 'Saudi Arabia' },
  { id: 203, nameEn: 'Süper Lig', nameAr: 'الدوري التركي', country: 'Turkey' },
  { id: 71, nameEn: 'Serie A', nameAr: 'الدوري البرازيلي', country: 'Brazil' },
  { id: 128, nameEn: 'Liga Profesional Argentina', nameAr: 'الدوري الأرجنتيني', country: 'Argentina' },
  { id: 188, nameEn: 'A-League', nameAr: 'الدوري الأسترالي', country: 'Australia' },
  { id: 98, nameEn: 'J1 League', nameAr: 'الدوري الياباني', country: 'Japan' },
  { id: 253, nameEn: 'Major League Soccer', nameAr: 'الدوري الأمريكي', country: 'USA' },
  { id: 262, nameEn: 'Liga MX', nameAr: 'الدوري المكسيكي', country: 'Mexico' },
  { id: 292, nameEn: 'K League 1', nameAr: 'الدوري الكوري', country: 'South Korea' },
  { id: 40, nameEn: 'Championship', nameAr: 'الدرجة الأولى الإنجليزية', country: 'England' },
  { id: 179, nameEn: 'Premiership', nameAr: 'الدوري الاسكتلندي', country: 'Scotland' },
  { id: 45, nameEn: 'FA Cup', nameAr: 'كأس الاتحاد الإنجليزي', country: 'England' },
  { id: 48, nameEn: 'EFL Cup', nameAr: 'كأس الرابطة الإنجليزية', country: 'England' },
  { id: 143, nameEn: 'Copa del Rey', nameAr: 'كأس ملك إسبانيا', country: 'Spain' },
  { id: 137, nameEn: 'Coppa Italia', nameAr: 'كأس إيطاليا', country: 'Italy' },
  { id: 81, nameEn: 'DFB Pokal', nameAr: 'كأس ألمانيا', country: 'Germany' },
  { id: 66, nameEn: 'Coupe de France', nameAr: 'كأس فرنسا', country: 'France' },
];

export const LEAGUE_BY_ID = new Map<number, LeagueTranslation>(
  LEAGUE_TRANSLATIONS.map((league) => [league.id, league]),
);

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
  'fa cup': { england: 45 },
  'efl cup': { england: 48 },
  'carabao cup': { england: 48 },
  'bundesliga': { germany: 78 },
  'la liga': { spain: 140 },
  'primeira liga': { portugal: 94 },
  'eredivisie': { netherlands: 88 },
  'premiership': { scotland: 179 },
  'a-league': { australia: 188 },
  'professional league': { oman: 406 },
  'süper lig': { turkey: 203 },
  'super lig': { turkey: 203 },
};

const LEAGUE_NAME_EN_TO_AR: Record<string, string> = Object.fromEntries(
  LEAGUE_TRANSLATIONS.map((league) => [league.nameEn, league.nameAr]),
);

export function normalizeLeagueCountryKey(country?: string | null): string {
  return (country ?? '')
    .trim()
    .toLowerCase()
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ');
}

export function isAmbiguousLeagueName(name: string): boolean {
  return AMBIGUOUS_LEAGUE_NAMES.has(name.trim().toLowerCase());
}

export function getLeagueArabicById(leagueId: number | null | undefined): string | null {
  if (leagueId == null) return null;
  return LEAGUE_BY_ID.get(leagueId)?.nameAr ?? null;
}

export function getCuratedArabicLeagueName(
  name: string,
  options?: { leagueId?: number | null; country?: string | null },
): string | null {
  if (options?.leagueId != null) {
    const byId = getLeagueArabicById(options.leagueId);
    if (byId) return byId;
  }

  const trimmed = name.trim();
  const lowerName = trimmed.toLowerCase();
  if (!lowerName) return null;

  const countryKey = normalizeLeagueCountryKey(options?.country);
  const disambigId = LEAGUE_NAME_COUNTRY_ID[lowerName]?.[countryKey];
  if (disambigId != null) {
    return LEAGUE_BY_ID.get(disambigId)?.nameAr ?? null;
  }

  if (AMBIGUOUS_LEAGUE_NAMES.has(lowerName)) return null;

  return LEAGUE_NAME_EN_TO_AR[trimmed] ?? null;
}
