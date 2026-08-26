/**
 * Ranks fixtures by perceived importance (league tier, live status, knockout round).
 * Shared by chat highlights and prediction group daily rounds.
 */

import { scores365CompetitionToLeagueId } from './scores365-league-id.util';

/** API-Football league ids treated as high-detail / warm priority. */
export const MAJOR_LEAGUE_IDS = new Set<number>([
  1, // World Cup
  2, // UCL
  3, // UEL
  4, // Euro
  5, // Nations League
  6, // AFCON
  9, // Copa America
  12, // CAF CL
  13, // CAF Confed
  15, // FIFA Club World Cup
  39, // Premier League
  40, // Championship
  45, // FA Cup
  61, // Ligue 1
  78, // Bundesliga
  88, // Eredivisie
  94, // Primeira Liga
  135, // Serie A
  140, // La Liga
  143, // Copa del Rey
  200, // Botola
  203, // Super Lig
  233, // Egyptian Premier
  253, // MLS
  307, // Saudi Pro League
  383, // Israel Premier
  848, // Conference League
]);

export function isMajorLeagueId(leagueId: number | null | undefined): boolean {
  return leagueId != null && MAJOR_LEAGUE_IDS.has(leagueId);
}

/** Scores365 competitionIds for the Big 5 domestic leagues. */
export const BIG_5_SCORES365_COMPETITION_IDS = [7, 11, 17, 25, 35] as const;
// 7 PL · 11 LaLiga · 17 Serie A · 25 Bundesliga · 35 Ligue 1

/** Big 5 European domestic leagues (API-Football + Scores365 synthetic ids). */
export const BIG_5_LEAGUE_IDS = new Set<number>([
  39, // Premier League (API-Football)
  140, // La Liga
  135, // Serie A
  78, // Bundesliga
  61, // Ligue 1
  ...BIG_5_SCORES365_COMPETITION_IDS.map(scores365CompetitionToLeagueId),
]);

export function isBig5LeagueId(leagueId: number | null | undefined): boolean {
  return leagueId != null && BIG_5_LEAGUE_IDS.has(leagueId);
}

/** Name/country fallback when league id is missing or unmapped. */
export function isBig5LeagueFixture(fixture: any): boolean {
  if (isBig5LeagueId(fixture?.league?.id)) return true;
  const name = String(fixture?.league?.name ?? '');
  const country = String(fixture?.league?.country ?? '');
  // Exact-ish domestic top flights only (exclude "Premier League" Egypt/SA, Serie B, etc.).
  if (/^LaLiga$/i.test(name) && /spain/i.test(country)) return true;
  if (/^Premier League$/i.test(name) && /england/i.test(country)) return true;
  if (/^Serie A$/i.test(name) && /italy/i.test(country)) return true;
  if (/^Bundesliga$/i.test(name) && /germany/i.test(country)) return true;
  if (/^Ligue 1$/i.test(name) && /france/i.test(country)) return true;
  return false;
}

const HIGHLIGHT_LEAGUE_SCORE: Record<number, number> = {
  1: 110,
  2: 100,
  3: 98,
  4: 105,
  5: 90,
  9: 96,
  15: 99,
  848: 97,
  39: 95,
  140: 94,
  135: 93,
  78: 92,
  61: 91,
  // Scores365 synthetic Big 5
  [scores365CompetitionToLeagueId(7)]: 95, // Premier League
  [scores365CompetitionToLeagueId(11)]: 94, // LaLiga
  [scores365CompetitionToLeagueId(17)]: 93, // Serie A
  [scores365CompetitionToLeagueId(25)]: 92, // Bundesliga
  [scores365CompetitionToLeagueId(35)]: 91, // Ligue 1
  [scores365CompetitionToLeagueId(552)]: 88, // Egyptian Premier
  [scores365CompetitionToLeagueId(649)]: 85, // Saudi League
  [scores365CompetitionToLeagueId(572)]: 100, // UCL
  [scores365CompetitionToLeagueId(573)]: 98, // UEL
  [scores365CompetitionToLeagueId(624)]: 90, // CAF CL
  233: 88,
  307: 85,
  203: 84,
  88: 80,
  94: 79,
  253: 78,
  40: 72,
  45: 86,
  143: 86,
};

const LIVE_STATUSES = new Set(['1H', '2H', 'HT', 'ET', 'P', 'LIVE', 'BT', 'INT', 'SUSP']);
const UPCOMING_STATUSES = new Set(['NS', 'TBD', '']);

/** Five football continents used for prediction-round fill when Big 5 is thin. */
export type Continent =
  | 'europe'
  | 'africa'
  | 'asia'
  | 'south_america'
  | 'north_america';

export const CONTINENTS: Continent[] = [
  'europe',
  'africa',
  'asia',
  'south_america',
  'north_america',
];

/** Marquee clubs — used to pick “top 2 teams per continent” fixtures. */
const MARQUEE_TEAMS: Record<Continent, string[]> = {
  europe: [
    'real madrid',
    'barcelona',
    'bayern',
    'manchester city',
    'liverpool',
    'paris saint',
    'psg',
    'juventus',
    'inter milan',
    'ac milan',
    'chelsea',
    'arsenal',
    'atletico madrid',
    'atlético madrid',
    'dortmund',
    'napoli',
    'tottenham',
    'benfica',
    'porto',
    'ajax',
  ],
  africa: [
    'al ahly',
    'zamalek',
    'pyramids',
    'wydad',
    'raja casablanca',
    'mamelodi sundowns',
    'esperance',
    'mazembe',
    'kaizer chiefs',
    'orlando pirates',
    'simba',
  ],
  asia: [
    'al hilal',
    'al nassr',
    'al ittihad',
    'al ahli',
    'persepolis',
    'kawasaki',
    'urawa',
    'ulsan',
    'jeonbuk',
    'shanghai port',
    'yokohama',
  ],
  south_america: [
    'flamengo',
    'palmeiras',
    'river plate',
    'boca juniors',
    'sao paulo',
    'são paulo',
    'corinthians',
    'fluminense',
    'atletico mineiro',
    'atlético mineiro',
    'peñarol',
    'penarol',
  ],
  north_america: [
    'inter miami',
    'la galaxy',
    'lafc',
    'club america',
    'club américa',
    'chivas',
    'guadalajara',
    'monterrey',
    'tigres',
    'seattle sounders',
    'nycfc',
  ],
};

const COUNTRY_TO_CONTINENT: Record<string, Continent> = {
  // Europe
  england: 'europe',
  spain: 'europe',
  italy: 'europe',
  germany: 'europe',
  france: 'europe',
  portugal: 'europe',
  netherlands: 'europe',
  holland: 'europe',
  belgium: 'europe',
  turkey: 'europe',
  scotland: 'europe',
  ukraine: 'europe',
  greece: 'europe',
  austria: 'europe',
  switzerland: 'europe',
  russia: 'europe',
  poland: 'europe',
  croatia: 'europe',
  serbia: 'europe',
  czechia: 'europe',
  'czech republic': 'europe',
  denmark: 'europe',
  sweden: 'europe',
  norway: 'europe',
  europe: 'europe',
  // Africa
  egypt: 'africa',
  morocco: 'africa',
  tunisia: 'africa',
  algeria: 'africa',
  'south africa': 'africa',
  nigeria: 'africa',
  ghana: 'africa',
  senegal: 'africa',
  'ivory coast': 'africa',
  "cote d'ivoire": 'africa',
  kenya: 'africa',
  tanzania: 'africa',
  cameroon: 'africa',
  africa: 'africa',
  // Asia
  'saudi arabia': 'asia',
  japan: 'asia',
  'south korea': 'asia',
  korea: 'asia',
  china: 'asia',
  iran: 'asia',
  uae: 'asia',
  'united arab emirates': 'asia',
  qatar: 'asia',
  iraq: 'asia',
  india: 'asia',
  australia: 'asia', // AFC
  asia: 'asia',
  // South America
  brazil: 'south_america',
  argentina: 'south_america',
  uruguay: 'south_america',
  colombia: 'south_america',
  chile: 'south_america',
  paraguay: 'south_america',
  ecuador: 'south_america',
  peru: 'south_america',
  bolivia: 'south_america',
  venezuela: 'south_america',
  'south america': 'south_america',
  // North / Central America
  usa: 'north_america',
  'united states': 'north_america',
  mexico: 'north_america',
  canada: 'north_america',
  'costa rica': 'north_america',
  honduras: 'north_america',
  jamaica: 'north_america',
  'north america': 'north_america',
};

function normalizeCountry(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

function continentFromCountry(country: string | null | undefined): Continent | null {
  if (!country) return null;
  return COUNTRY_TO_CONTINENT[normalizeCountry(country)] ?? null;
}

function teamNameMatches(name: string, needle: string): boolean {
  const n = name.toLowerCase();
  const t = needle.toLowerCase();
  if (!n || !t) return false;
  // Avoid Al Ahli (Saudi) matching Al Ahly via short stems — require inclusion of full needle.
  return n.includes(t);
}

export function marqueeHitCount(fixture: any, continent?: Continent): number {
  const home = String(fixture?.teams?.home?.name ?? '');
  const away = String(fixture?.teams?.away?.name ?? '');
  const continents = continent ? [continent] : CONTINENTS;
  let hits = 0;
  for (const side of [home, away]) {
    const matched = continents.some((c) =>
      MARQUEE_TEAMS[c].some((club) => teamNameMatches(side, club)),
    );
    if (matched) hits += 1;
  }
  return hits;
}

export function continentOfFixture(fixture: any): Continent | null {
  const country = continentFromCountry(fixture?.league?.country);
  if (country) return country;

  const leagueName = String(fixture?.league?.name ?? '');
  if (/champions\s*league|europa\s*league|conference\s*league|uefa/i.test(leagueName)) {
    return 'europe';
  }
  if (/caf|afcon|africa/i.test(leagueName)) return 'africa';
  if (/afc|asian\s*champions|saudi/i.test(leagueName)) return 'asia';
  if (/libertadores|sudamericana|conmebol/i.test(leagueName)) return 'south_america';
  if (/concacaf|mls|liga\s*mx|leagues\s*cup/i.test(leagueName)) return 'north_america';

  // Infer from marquee clubs in the fixture.
  for (const c of CONTINENTS) {
    if (marqueeHitCount(fixture, c) > 0) return c;
  }
  return null;
}

export function scoreFixtureImportance(fixture: any): number {
  const leagueId = fixture?.league?.id ?? 0;
  let score = HIGHLIGHT_LEAGUE_SCORE[leagueId] ?? 8;
  const leagueName = String(fixture?.league?.name ?? '').toLowerCase();

  if (/world\s*cup|كأس\s*العالم/i.test(leagueName)) score += 98;
  else if (/champions\s*league|دوري\s*الأبطال|ابطال\s*اوروبا/i.test(leagueName)) score += 95;
  else if (/europa\s*league|الدوري\s*الأوروبي/i.test(leagueName)) score += 82;
  else if (/conference\s*league/i.test(leagueName)) score += 78;
  else if (/premier\s*league|بريمير/i.test(leagueName)) score += 90;
  else if (/la\s*liga|الدوري\s*الإسباني|الاسباني/i.test(leagueName)) score += 88;
  else if (/serie\s*a|الدوري\s*الإيطالي/i.test(leagueName)) score += 87;
  else if (/bundesliga|الدوري\s*الألماني/i.test(leagueName)) score += 86;
  else if (/ligue\s*1|الدوري\s*الفرنسي/i.test(leagueName)) score += 85;
  else if (/egypt|مصر/i.test(leagueName)) score += 83;
  else if (/saudi|سعود/i.test(leagueName)) score += 78;
  else if (/eredivisie|هولند/i.test(leagueName)) score += 70;
  else if (/mls|major\s*league\s*soccer/i.test(leagueName)) score += 68;

  if (isMajorLeagueId(leagueId)) score += 25;

  const status = fixture?.fixture?.status?.short ?? '';
  if (LIVE_STATUSES.has(status)) score += 65;
  if (status === 'FT' || status === 'AET' || status === 'PEN') score += 18;

  const round = String(fixture?.league?.round ?? '');
  if (/final|نهائي/i.test(round)) score += 40;
  if (/semi|نصف/i.test(round)) score += 28;
  if (/quarter|ربع/i.test(round)) score += 18;

  return score;
}

function kickoffMs(fixture: any): number {
  const raw = fixture?.fixture?.date ?? fixture?.fixture?.timestamp;
  if (typeof raw === 'number') return raw * (raw < 1e12 ? 1000 : 1);
  if (typeof raw === 'string') {
    const t = Date.parse(raw);
    return Number.isFinite(t) ? t : Number.MAX_SAFE_INTEGER;
  }
  return Number.MAX_SAFE_INTEGER;
}

/**
 * Top upcoming fixtures for prediction-group daily rounds.
 *
 * 1) Big 5 domestic leagues first (max 2 per league).
 * 2) If slots remain: up to 2 marquee-club fixtures per continent
 *    (Europe / Africa / Asia / South America / North America).
 */
export function pickTopFixtures(fixtures: any[], limit = 10): any[] {
  const upcoming = fixtures.filter((f) => {
    const status = f?.fixture?.status?.short ?? '';
    return UPCOMING_STATUSES.has(status);
  });

  const selected: any[] = [];
  const used = new Set<number>();

  const push = (f: any): boolean => {
    if (selected.length >= limit) return false;
    const id = f?.fixture?.id;
    if (typeof id === 'number') {
      if (used.has(id)) return false;
      used.add(id);
    }
    selected.push(f);
    return true;
  };

  // —— Tier 1: Big 5 ————————————————————————————————————————————————
  const big5Ranked = upcoming
    .filter(isBig5LeagueFixture)
    .map((f) => ({
      f,
      score: scoreFixtureImportance(f),
      kickoff: kickoffMs(f),
      leagueId: f?.league?.id ?? 0,
    }))
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.kickoff - b.kickoff));

  const maxPerBig5League = 2;
  const perLeague = new Map<number, number>();
  for (const respectCap of [true, false]) {
    for (const r of big5Ranked) {
      if (selected.length >= limit) break;
      const count = perLeague.get(r.leagueId) ?? 0;
      if (respectCap && count >= maxPerBig5League) continue;
      if (push(r.f)) perLeague.set(r.leagueId, count + 1);
    }
  }

  if (selected.length >= limit) return selected;

  // —— Tier 2: 2 marquee fixtures per continent ———————————————————————
  const remaining = upcoming.filter((f) => {
    const id = f?.fixture?.id;
    if (typeof id === 'number' && used.has(id)) return false;
    // Don't re-pick Big 5 domestic as "Europe fill" — already handled above.
    return !isBig5LeagueFixture(f);
  });

  type ContRow = { f: any; continent: Continent; score: number; kickoff: number; marquee: number };
  const byContinent = new Map<Continent, ContRow[]>();

  for (const f of remaining) {
    const continent = continentOfFixture(f);
    if (!continent) continue;
    const marquee = marqueeHitCount(f, continent);
    // Prefer fixtures that involve a marquee club; allow strong league games as backup.
    const base = scoreFixtureImportance(f);
    if (marquee === 0 && base < 40) continue;
    const score = base + marquee * 120;
    const list = byContinent.get(continent) ?? [];
    list.push({ f, continent, score, kickoff: kickoffMs(f), marquee });
    byContinent.set(continent, list);
  }

  for (const continent of CONTINENTS) {
    if (selected.length >= limit) break;
    const list = (byContinent.get(continent) ?? []).sort((a, b) => {
      if (b.marquee !== a.marquee) return b.marquee - a.marquee;
      if (b.score !== a.score) return b.score - a.score;
      return a.kickoff - b.kickoff;
    });
    let taken = 0;
    for (const row of list) {
      if (selected.length >= limit || taken >= 2) break;
      if (push(row.f)) taken += 1;
    }
  }

  // —— Tier 3: global importance fill if still short ——————————————————
  if (selected.length < limit) {
    const leftovers = remaining
      .filter((f) => {
        const id = f?.fixture?.id;
        return !(typeof id === 'number' && used.has(id));
      })
      .map((f) => ({ f, score: scoreFixtureImportance(f), kickoff: kickoffMs(f) }))
      .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.kickoff - b.kickoff));
    for (const row of leftovers) {
      if (selected.length >= limit) break;
      push(row.f);
    }
  }

  return selected;
}

export function localDateKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
