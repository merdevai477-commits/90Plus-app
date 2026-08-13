/**
 * Football search: Arabic/Latin normalization, alias → entity-id index,
 * query expansion, and relevance ranking.
 *
 * Entity IDs (365 competitorId / athleteId) are the source of truth.
 * Names and aliases are a presentation/search layer only — never rewrite IDs.
 */

export type FootballSearchEntityType = 'club' | 'national' | 'player' | 'coach' | 'competition';

export interface FootballSearchAliasRecord {
  /** 365Scores competitorId (club/NT) or athleteId (player). */
  entityId: number;
  type: FootballSearchEntityType;
  canonicalName: string;
  aliases: string[];
}

/** Extra English/Arabic queries to send upstream when the raw query is weak. */
export interface QueryExpansion {
  queries: string[];
  boostedEntityIds: Set<number>;
}

const ARABIC_DIACRITICS = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g;
const LATIN_DIACRITICS = /[\u0300-\u036f]/g;
const TATWEEL = /\u0640/g;
const STOPWORDS = new Set([
  'نادي',
  'النادي',
  'club',
  'sc',
  'fc',
  'cf',
  'the',
  'team',
  'منتخب',
  'المنتخب',
]);

/**
 * Curated alias index. Aliases map to entity IDs — never to each other.
 * Short tokens like "الأهلي" belong only to clubs actually named that way
 * (Al Ahly Egypt 8200, Al Ahli Saudi 8946, …). National Bank is a different
 * entity and must NOT receive the bare alias "الأهلي".
 */
export const FOOTBALL_SEARCH_INDEX: FootballSearchAliasRecord[] = [
  {
    entityId: 8200,
    type: 'club',
    canonicalName: 'Al Ahly SC',
    aliases: [
      'al ahly',
      'al-ahly',
      'al ahly sc',
      'ahly',
      'الأهلي',
      'الاهلي',
      'اهلي',
      'الأهلي المصري',
      'الاهلي المصري',
      'النادي الأهلي',
      'نادي الاهلي',
      'نادي الأهلي',
    ],
  },
  {
    entityId: 50527,
    type: 'club',
    canonicalName: 'National Bank',
    aliases: [
      'national bank',
      'national bank of egypt',
      'nbe',
      'البنك الأهلي',
      'البنك الاهلي',
      'بنك اهلي',
      'البنك الاهلى',
    ],
  },
  {
    entityId: 8201,
    type: 'club',
    canonicalName: 'Zamalek SC',
    aliases: [
      'zamalek',
      'zamalek sc',
      'el zamalek',
      'الزمالك',
      'زمالك',
      'الزماك',
      'نادي الزمالك',
      'النادي الزمالك',
    ],
  },
  {
    entityId: 22143,
    type: 'club',
    canonicalName: 'Pyramids',
    aliases: ['pyramids', 'pyramids fc', 'بيراميدز', 'نادي بيراميدز'],
  },
  {
    entityId: 8303,
    type: 'club',
    canonicalName: 'Al Masry',
    aliases: ['al masry', 'el masry', 'المصري', 'المصري البورسعيدي', 'نادي المصري'],
  },
  {
    entityId: 8299,
    type: 'club',
    canonicalName: 'Ismaily',
    aliases: ['ismaily', 'ismaily sc', 'الإسماعيلي', 'الاسماعيلي', 'نادي الإسماعيلي'],
  },
  {
    entityId: 8300,
    type: 'club',
    canonicalName: 'ENPPI',
    aliases: ['enppi', 'enppi sc', 'إنبي', 'انبي'],
  },
  {
    entityId: 50882,
    type: 'club',
    canonicalName: 'Ceramica Cleopatra',
    aliases: ['ceramica', 'ceramica cleopatra', 'سيراميكا', 'سيراميكا كليوباترا'],
  },
  {
    entityId: 8946,
    type: 'club',
    canonicalName: 'Al Ahli',
    aliases: ['al ahli', 'al-ahli', 'ahli jeddah', 'الأهلي السعودي', 'الاهلي السعودي'],
  },
  {
    entityId: 5457,
    type: 'club',
    canonicalName: 'Al Hilal Riyadh',
    aliases: ['al hilal', 'al-hilal', 'hilal', 'الهلال', 'الهلال السعودي', 'نادي الهلال'],
  },
  {
    entityId: 7549,
    type: 'club',
    canonicalName: 'Al Nassr FC Riyadh',
    aliases: ['al nassr', 'al-nassr', 'nassr', 'النصر', 'النصر السعودي', 'نادي النصر'],
  },
  {
    entityId: 8593,
    type: 'club',
    canonicalName: 'Ittihad Jeddah',
    aliases: ['al ittihad', 'ittihad jeddah', 'al-ittihad', 'الاتحاد', 'الاتحاد السعودي', 'نادي الاتحاد'],
  },
  {
    entityId: 8945,
    type: 'club',
    canonicalName: 'Al Shabab Riyadh',
    aliases: ['al shabab', 'al-shabab', 'الشباب', 'الشباب السعودي'],
  },
  {
    entityId: 8943,
    type: 'club',
    canonicalName: 'Al Ettifaq',
    aliases: ['al ettifaq', 'ettifaq', 'الاتفاق', 'نادي الاتفاق'],
  },
  {
    entityId: 9976,
    type: 'club',
    canonicalName: 'Al Wehda Mecca',
    aliases: ['al wehda', 'al-wehda', 'الوحدة', 'الوحدة السعودي'],
  },
  {
    entityId: 131,
    type: 'club',
    canonicalName: 'Real Madrid',
    aliases: ['real madrid', 'ريال مدريد', 'ريال', 'الريال'],
  },
  {
    entityId: 132,
    type: 'club',
    canonicalName: 'FC Barcelona',
    aliases: ['barcelona', 'fc barcelona', 'barca', 'برشلونة', 'برشلونه', 'البرسا', 'برسا'],
  },
  {
    entityId: 134,
    type: 'club',
    canonicalName: 'Atletico Madrid',
    aliases: ['atletico madrid', 'atletico', 'اتلتيكو مدريد', 'أتلتيكو مدريد', 'اتلتيكو'],
  },
  {
    entityId: 480,
    type: 'club',
    canonicalName: 'PSG',
    aliases: ['psg', 'paris saint germain', 'paris sg', 'باريس سان جيرمان', 'سان جيرمان'],
  },
  {
    entityId: 110,
    type: 'club',
    canonicalName: 'Manchester City',
    aliases: ['manchester city', 'man city', 'مانشستر سيتي', 'مان سيتي', 'السيتي'],
  },
  {
    entityId: 105,
    type: 'club',
    canonicalName: 'Manchester United',
    aliases: ['manchester united', 'man united', 'man utd', 'مانشستر يونايتد', 'مان يونايتد'],
  },
  {
    entityId: 108,
    type: 'club',
    canonicalName: 'Liverpool',
    aliases: ['liverpool', 'ليفربول'],
  },
  {
    entityId: 104,
    type: 'club',
    canonicalName: 'Arsenal',
    aliases: ['arsenal', 'ارسنال', 'أرسنال', 'الارسنال'],
  },
  {
    entityId: 106,
    type: 'club',
    canonicalName: 'Chelsea',
    aliases: ['chelsea', 'تشيلسي', 'تشلسي'],
  },
  {
    entityId: 114,
    type: 'club',
    canonicalName: 'Tottenham',
    aliases: ['tottenham', 'spurs', 'توتنهام', 'توتنهم'],
  },
  {
    entityId: 331,
    type: 'club',
    canonicalName: 'Bayern Munich',
    aliases: ['bayern munich', 'bayern', 'بايرن ميونخ', 'بايرن', 'البايرن'],
  },
  {
    entityId: 341,
    type: 'club',
    canonicalName: 'Borussia Dortmund',
    aliases: ['borussia dortmund', 'dortmund', 'بوروسيا دورتموند', 'دورتموند'],
  },
  {
    entityId: 226,
    type: 'club',
    canonicalName: 'Juventus',
    aliases: ['juventus', 'يوفنتوس', 'اليوفي'],
  },
  {
    entityId: 224,
    type: 'club',
    canonicalName: 'Inter Milan',
    aliases: ['inter milan', 'inter', 'انتر ميلان', 'إنتر', 'الانتر'],
  },
  {
    entityId: 227,
    type: 'club',
    canonicalName: 'AC Milan',
    aliases: ['ac milan', 'milan', 'ميلان', 'اي سي ميلان'],
  },
  {
    entityId: 234,
    type: 'club',
    canonicalName: 'Napoli',
    aliases: ['napoli', 'نابولي'],
  },
  {
    entityId: 887,
    type: 'club',
    canonicalName: 'FC Porto',
    aliases: ['porto', 'fc porto', 'بورتو'],
  },
  {
    entityId: 888,
    type: 'club',
    canonicalName: 'Benfica',
    aliases: ['benfica', 'بنفيكا'],
  },
  {
    entityId: 5100,
    type: 'national',
    canonicalName: 'Egypt',
    aliases: ['egypt', 'egypt nt', 'منتخب مصر', 'مصر', 'الفراعنة'],
  },
  {
    entityId: 5093,
    type: 'national',
    canonicalName: 'Morocco',
    aliases: ['morocco', 'morocco nt', 'منتخب المغرب', 'المغرب', 'أسود الأطلس', 'اسود الاطلس'],
  },
  {
    entityId: 874,
    type: 'player',
    canonicalName: 'Lionel Messi',
    aliases: ['messi', 'lionel messi', 'lionel', 'ميسي', 'ليونيل', 'ليونيل ميسي'],
  },
  {
    entityId: 39820,
    type: 'player',
    canonicalName: 'Kylian Mbappé',
    aliases: [
      'mbappe',
      'mbappé',
      'kylian mbappe',
      'kylian mbappé',
      'kylian',
      'مبابي',
      'كيليان',
      'كيليان مبابي',
    ],
  },
  {
    entityId: 48298,
    type: 'player',
    canonicalName: 'Vinícius Júnior',
    aliases: [
      'vinicius',
      'vinicius junior',
      'vinícius júnior',
      'vinicius jr',
      'vini',
      'فيني',
      'فينيسيوس',
      'فينيسيوس جونيور',
    ],
  },
  {
    entityId: 1439,
    type: 'player',
    canonicalName: 'Mohamed Salah',
    aliases: ['salah', 'mohamed salah', 'mo salah', 'صلاح', 'محمد صلاح'],
  },
  {
    entityId: 817,
    type: 'player',
    canonicalName: 'Cristiano Ronaldo',
    aliases: ['ronaldo', 'cristiano ronaldo', 'cr7', 'رونالدو', 'كريستيانو', 'كريستيانو رونالدو'],
  },
  {
    entityId: 65760,
    type: 'player',
    canonicalName: 'Erling Haaland',
    aliases: ['haaland', 'erling haaland', 'هالاند', 'إيرلينج هالاند', 'ايرلينج هالاند'],
  },
  {
    entityId: 51976,
    type: 'coach',
    canonicalName: 'Hussein Ammouta',
    aliases: ['ammouta', 'hussein ammouta', 'عموتة', 'حسين عموتة', 'لحسين عموتة'],
  },
  {
    entityId: 552,
    type: 'competition',
    canonicalName: 'Egyptian Premier League',
    aliases: [
      'egyptian premier league',
      'egypt premier league',
      'الدوري المصري',
      'الدوري المصري الممتاز',
      'دوري المصري',
    ],
  },
  {
    entityId: 649,
    type: 'competition',
    canonicalName: 'Saudi League',
    aliases: ['saudi pro league', 'saudi league', 'الدوري السعودي', 'دوري روشن', 'روشن'],
  },
  {
    entityId: 7,
    type: 'competition',
    canonicalName: 'Premier League',
    aliases: ['premier league', 'epl', 'الدوري الإنجليزي', 'الدوري الانجليزي', 'البريميرليج'],
  },
  {
    entityId: 11,
    type: 'competition',
    canonicalName: 'LaLiga',
    aliases: ['laliga', 'la liga', 'الدوري الإسباني', 'الدوري الاسباني'],
  },
  {
    entityId: 17,
    type: 'competition',
    canonicalName: 'Serie A',
    aliases: ['serie a', 'الدوري الإيطالي', 'الدوري الايطالي'],
  },
  {
    entityId: 25,
    type: 'competition',
    canonicalName: 'Bundesliga',
    aliases: ['bundesliga', 'الدوري الألماني', 'الدوري الالماني'],
  },
  {
    entityId: 35,
    type: 'competition',
    canonicalName: 'Ligue 1',
    aliases: ['ligue 1', 'الدوري الفرنسي'],
  },
  {
    entityId: 572,
    type: 'competition',
    canonicalName: 'UEFA Champions League',
    aliases: ['champions league', 'ucl', 'دوري أبطال أوروبا', 'دوري ابطال اوروبا', 'الأبطال'],
  },
  {
    entityId: 573,
    type: 'competition',
    canonicalName: 'UEFA Europa League',
    aliases: ['europa league', 'uel', 'الدوري الأوروبي', 'يوروبا ليغ'],
  },
  {
    entityId: 624,
    type: 'competition',
    canonicalName: 'CAF Champions League',
    aliases: ['caf champions league', 'دوري أبطال أفريقيا', 'دوري ابطال افريقيا'],
  },
  {
    entityId: 167,
    type: 'competition',
    canonicalName: 'Africa Cup of Nations',
    aliases: ['afcon', 'africa cup', 'كأس أمم أفريقيا', 'كاس امم افريقيا', 'الأمم الأفريقية'],
  },
  {
    entityId: 5930,
    type: 'competition',
    canonicalName: 'FIFA World Cup',
    aliases: ['world cup', 'fifa world cup', 'كأس العالم', 'كاس العالم'],
  },
];

const INDEX_BY_NORM_ALIAS = new Map<string, FootballSearchAliasRecord[]>();
for (const rec of FOOTBALL_SEARCH_INDEX) {
  const keys = [rec.canonicalName, ...rec.aliases].map(normalizeSearchText);
  for (const key of keys) {
    if (!key) continue;
    const list = INDEX_BY_NORM_ALIAS.get(key) ?? [];
    if (!list.some((r) => r.entityId === rec.entityId && r.type === rec.type)) {
      list.push(rec);
    }
    INDEX_BY_NORM_ALIAS.set(key, list);
  }
}

export function normalizeSearchText(input: string): string {
  let s = (input ?? '').normalize('NFKD');
  s = s.replace(LATIN_DIACRITICS, '');
  s = s.replace(ARABIC_DIACRITICS, '');
  s = s.replace(TATWEEL, '');
  s = s.replace(/[أإآٱ]/g, 'ا');
  s = s.replace(/ى/g, 'ي');
  s = s.replace(/ئ/g, 'ي');
  s = s.replace(/ؤ/g, 'و');
  s = s.replace(/ة/g, 'ه');
  s = s.replace(/[^\p{L}\p{N}\s]/gu, ' ');
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function stripSearchStopwords(normalized: string): string {
  return normalized
    .split(' ')
    .filter((t) => t.length > 0 && !STOPWORDS.has(t))
    .join(' ')
    .trim();
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) row[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let prev = i - 1;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = tmp;
    }
  }
  return row[b.length];
}

function lookupExactAlias(norm: string): FootballSearchAliasRecord[] {
  if (!norm) return [];
  return INDEX_BY_NORM_ALIAS.get(norm) ?? [];
}

function lookupFuzzyAlias(norm: string): FootballSearchAliasRecord[] {
  if (norm.length < 4) return [];
  const hits: FootballSearchAliasRecord[] = [];
  const seen = new Set<string>();
  for (const [alias, recs] of INDEX_BY_NORM_ALIAS) {
    const maxDist = norm.length >= 6 ? 2 : 1;
    if (Math.abs(alias.length - norm.length) > maxDist) continue;
    if (levenshtein(norm, alias) > maxDist) continue;
    for (const rec of recs) {
      const key = `${rec.type}:${rec.entityId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      hits.push(rec);
    }
  }
  return hits;
}

export function expandSearchQueries(rawQuery: string): QueryExpansion {
  const trimmed = rawQuery.trim();
  const norm = normalizeSearchText(trimmed);
  const stripped = stripSearchStopwords(norm);
  const queries: string[] = [];
  const push = (q: string) => {
    const t = q.trim();
    if (t.length < 2) return;
    if (!queries.some((x) => normalizeSearchText(x) === normalizeSearchText(t))) {
      queries.push(t);
    }
  };

  push(trimmed);
  if (stripped && stripped !== norm) push(stripped);

  const exact = lookupExactAlias(norm).concat(stripped !== norm ? lookupExactAlias(stripped) : []);
  const fuzzy = exact.length ? [] : lookupFuzzyAlias(stripped || norm);

  const boosted = new Set<number>();
  for (const rec of [...exact, ...fuzzy]) {
    boosted.add(rec.entityId);
    push(rec.canonicalName);
    const primaryAlias = rec.aliases[0];
    if (primaryAlias) push(primaryAlias);
  }

  return { queries: queries.slice(0, 3), boostedEntityIds: boosted };
}

export function scoreSearchName(
  queryNorm: string,
  name: string,
  extraNames: Array<string | null | undefined> = [],
): number {
  if (!queryNorm) return 0;
  const candidates = [name, ...extraNames]
    .filter((x): x is string => !!x && x.trim().length > 0)
    .map(normalizeSearchText);

  let best = 0;
  for (const n of candidates) {
    if (!n) continue;
    if (n === queryNorm) {
      best = Math.max(best, 1000);
      continue;
    }
    if (n.startsWith(queryNorm) || queryNorm.startsWith(n)) {
      best = Math.max(best, 780);
      continue;
    }
    const nameTokens = n.split(' ').filter(Boolean);
    const queryTokens = queryNorm.split(' ').filter(Boolean);
    const allQueryTokensHit = queryTokens.every((t) => nameTokens.includes(t));
    if (allQueryTokensHit && nameTokens.length === queryTokens.length) {
      best = Math.max(best, 1000);
      continue;
    }
    if (allQueryTokensHit && nameTokens.length > queryTokens.length) {
      // "الأهلي" inside "البنك الأهلي" / "شباب الأهلي" — token hit with extra words.
      best = Math.max(best, 380);
      continue;
    }
    const dist = levenshtein(n, queryNorm);
    const maxDist = queryNorm.length >= 6 ? 2 : 1;
    if (dist <= maxDist && queryNorm.length >= 4) {
      best = Math.max(best, dist === 1 ? 520 : 360);
      continue;
    }
    if (queryNorm.length >= 3 && n.includes(queryNorm)) {
      best = Math.max(best, 220);
    }
  }
  return best;
}

export function popularityBoost(rank: number | null | undefined): number {
  if (rank == null || rank <= 0) return 0;
  return Math.log10(rank + 1) * 40;
}

export function countryBoost(
  countryId: number | null | undefined,
  preferredCountryId: number | null,
): number {
  if (!preferredCountryId || countryId == null) return 0;
  return countryId === preferredCountryId ? 70 : 0;
}

export function entityBoost(entityId: number, boosted: Set<number>): number {
  return boosted.has(entityId) ? 250 : 0;
}

export function queryHasArabic(query: string): boolean {
  return /[\u0600-\u06FF]/.test(query);
}

/** Egypt — used as a soft country prior for Arabic queries in this product. */
export const DEFAULT_ARABIC_COUNTRY_ID = 131;

export function isPlayerOrientedBoost(boosted: Set<number>): boolean {
  if (boosted.size === 0) return false;
  let person = false;
  let club = false;
  for (const rec of FOOTBALL_SEARCH_INDEX) {
    if (!boosted.has(rec.entityId)) continue;
    if (rec.type === 'player' || rec.type === 'coach') person = true;
    else if (rec.type === 'club' || rec.type === 'national') club = true;
  }
  return person && !club;
}

const COACH_ENTITY_IDS = new Set(
  FOOTBALL_SEARCH_INDEX.filter((r) => r.type === 'coach').map((r) => r.entityId),
);

export function isIndexedCoachId(entityId: number): boolean {
  return COACH_ENTITY_IDS.has(entityId);
}

export function competitionIndexRecords(): FootballSearchAliasRecord[] {
  return FOOTBALL_SEARCH_INDEX.filter((r) => r.type === 'competition');
}

export interface RankableSearchCompetitor {
  competitorId: number;
  name: string;
  countryId: number | null;
  popularityRank?: number | null;
  longName?: string | null;
  symbolicName?: string | null;
}

export interface RankableSearchAthlete {
  athleteId: number;
  name: string;
  shortName?: string;
  clubName?: string | null;
}

export function scoreCompetitor(
  item: RankableSearchCompetitor,
  queryNorm: string,
  boosted: Set<number>,
  preferredCountryId: number | null,
): number {
  const nameScore = scoreSearchName(queryNorm, item.name, [
    item.longName,
    item.symbolicName,
  ]);
  return (
    nameScore +
    popularityBoost(item.popularityRank) +
    countryBoost(item.countryId, preferredCountryId) +
    entityBoost(item.competitorId, boosted)
  );
}

export function scoreAthlete(
  item: RankableSearchAthlete,
  queryNorm: string,
  boosted: Set<number>,
): number {
  const nameScore = scoreSearchName(queryNorm, item.name, [item.shortName, item.clubName]);
  return nameScore + entityBoost(item.athleteId, boosted);
}

export interface RankableSearchCompetition {
  competitionId: number;
  name: string;
  country?: string | null;
}

export function scoreCompetition(
  item: RankableSearchCompetition,
  queryNorm: string,
  boosted: Set<number>,
): number {
  const nameScore = scoreSearchName(queryNorm, item.name, [item.country]);
  return nameScore + entityBoost(item.competitionId, boosted);
}

export function rankByScore<T>(items: T[], scoreOf: (item: T) => number): T[] {
  return [...items].sort((a, b) => {
    const diff = scoreOf(b) - scoreOf(a);
    if (diff !== 0) return diff;
    return 0;
  });
}
