/**
 * Classify & sort international / continental competitions for the Matches
 * "International" tab. Metadata-first (league id), then confederation country,
 * then governing-body name cues. FIFA World Cup (dedicated tab) is excluded
 * via excludeLeagueId.
 */

export type InternationalLeagueRef = {
  id?: number | null;
  name?: string | null;
  country?: string | null;
};

/** Sort tiers — lower = higher on the International tab. */
export const INTERNATIONAL_TIER = {
  /** Euro, Copa América, AFCON, Asian Cup, Gold Cup, Confederations, Club WC */
  MAJOR_CONTINENTAL: 0,
  /** UEFA Champions League */
  UCL: 1,
  /** Europa, Conference, Nations League */
  TOP_EUROPE: 2,
  /** Everything else international / continental */
  OTHER: 3,
} as const;

export type InternationalTier =
  (typeof INTERNATIONAL_TIER)[keyof typeof INTERNATIONAL_TIER];

/** Pseudo-countries used by API-Football / 365 for non-domestic comps. */
const CONTINENTAL_COUNTRIES = new Set([
  'world',
  'europe',
  'africa',
  'asia',
  'south america',
  'north america',
  'oceania',
  'international',
]);

/**
 * Curated API-Football ids → tier.
 * Keep in sync with common catalog; unknown international comps fall through
 * to country / name heuristics at OTHER (or a named major tier).
 */
const TIER_BY_LEAGUE_ID = new Map<number, InternationalTier>([
  // Major continental / Club World Cup
  [4, INTERNATIONAL_TIER.MAJOR_CONTINENTAL], // Euro
  [5, INTERNATIONAL_TIER.TOP_EUROPE], // UEFA Nations League (top Europe band)
  [6, INTERNATIONAL_TIER.MAJOR_CONTINENTAL], // AFCON
  [7, INTERNATIONAL_TIER.MAJOR_CONTINENTAL], // Asian Cup
  [9, INTERNATIONAL_TIER.MAJOR_CONTINENTAL], // Copa América
  [15, INTERNATIONAL_TIER.MAJOR_CONTINENTAL], // FIFA Club World Cup
  [22, INTERNATIONAL_TIER.OTHER], // Copa Libertadores (club continental)
  // UCL
  [2, INTERNATIONAL_TIER.UCL],
  // Top Europe club
  [3, INTERNATIONAL_TIER.TOP_EUROPE], // Europa League
  [848, INTERNATIONAL_TIER.TOP_EUROPE], // Conference League
  // Other continental club / qualifiers (still International, OTHER tier)
  [12, INTERNATIONAL_TIER.OTHER], // CAF CL
  [13, INTERNATIONAL_TIER.OTHER], // CAF Confed
  [16, INTERNATIONAL_TIER.OTHER], // CONCACAF Champions
  [17, INTERNATIONAL_TIER.OTHER], // AFC Champions
  [18, INTERNATIONAL_TIER.OTHER], // AFC Cup
  [29, INTERNATIONAL_TIER.OTHER], // WC Qual Europe
  [30, INTERNATIONAL_TIER.OTHER],
  [31, INTERNATIONAL_TIER.OTHER],
  [32, INTERNATIONAL_TIER.OTHER],
  [33, INTERNATIONAL_TIER.OTHER],
  [34, INTERNATIONAL_TIER.OTHER],
  [10, INTERNATIONAL_TIER.OTHER], // Friendlies
  [1, INTERNATIONAL_TIER.OTHER], // World Cup (excluded via excludeLeagueId in practice)
]);

const GOVERNING_BODY_RE =
  /\b(fifa|uefa|caf|afc|conmebol|concacaf|ofc)\b/i;

const MAJOR_NAME_RE =
  /\b(euro(?:pean)?\s*championship|uefa\s*euro|copa\s*am[eé]rica|africa\s*cup|afcon|asian\s*cup|gold\s*cup|confederations?\s*cup|club\s*world\s*cup|كأس\s*العالم\s*للأندية|أمم\s*أوروبا|أمم\s*أفريقيا|كوبا\s*أمريكا)\b/i;

const UCL_NAME_RE =
  /\b(uefa\s*champions\s*league|champions\s*league|دوري\s*أبطال\s*أوروبا)\b/i;

const TOP_EUROPE_NAME_RE =
  /\b(europa\s*league|conference\s*league|nations\s*league|الدوري\s*الأوروبي|دوري\s*المؤتمر|دوري\s*الأمم)\b/i;

function normalizeCountry(country?: string | null): string {
  return (country ?? '').trim().toLowerCase();
}

function normalizeName(name?: string | null): string {
  return (name ?? '').trim();
}

/**
 * Resolve API-Football league id when the client uses 365 synthetic ids
 * (SCORES365_LEAGUE_ID_OFFSET + competitionId). Callers may pass either.
 */
export function resolveCanonicalLeagueId(
  leagueId: number | null | undefined,
  scores365Offset = 7_000_000,
): number | null {
  if (leagueId == null || !Number.isFinite(leagueId) || leagueId <= 0) return null;
  if (leagueId >= scores365Offset) return leagueId - scores365Offset;
  return leagueId;
}

function tierFromName(name: string): InternationalTier | null {
  if (!name) return null;
  if (MAJOR_NAME_RE.test(name)) return INTERNATIONAL_TIER.MAJOR_CONTINENTAL;
  if (UCL_NAME_RE.test(name)) return INTERNATIONAL_TIER.UCL;
  if (TOP_EUROPE_NAME_RE.test(name)) return INTERNATIONAL_TIER.TOP_EUROPE;
  return null;
}

/**
 * True when the competition belongs on the International tab.
 * Pass excludeLeagueId (usually World Cup league id) to keep WC on its own tab.
 */
export function isInternationalCompetition(
  league: InternationalLeagueRef | null | undefined,
  options?: { excludeLeagueId?: number | null; scores365Offset?: number },
): boolean {
  if (!league) return false;
  const rawId = league.id ?? null;
  const excludeId = options?.excludeLeagueId ?? null;
  if (excludeId != null && rawId === excludeId) return false;

  const canonical = resolveCanonicalLeagueId(rawId, options?.scores365Offset);
  if (excludeId != null && canonical === excludeId) return false;
  // Dedicated FIFA World Cup tab — never list WC under International.
  if (canonical === 1) return false;
  if (rawId === 1) return false;

  if (canonical != null && TIER_BY_LEAGUE_ID.has(canonical)) return true;

  const country = normalizeCountry(league.country);
  if (CONTINENTAL_COUNTRIES.has(country)) return true;

  const name = normalizeName(league.name);
  if (GOVERNING_BODY_RE.test(name)) return true;
  if (tierFromName(name) != null) return true;

  return false;
}

/** Sort tier for an international competition (caller should already filter). */
export function getInternationalSortTier(
  league: InternationalLeagueRef | null | undefined,
  options?: { scores365Offset?: number },
): InternationalTier {
  if (!league) return INTERNATIONAL_TIER.OTHER;
  const canonical = resolveCanonicalLeagueId(league.id, options?.scores365Offset);
  if (canonical != null) {
    const byId = TIER_BY_LEAGUE_ID.get(canonical);
    if (byId != null) return byId;
  }
  const fromName = tierFromName(normalizeName(league.name));
  if (fromName != null) return fromName;
  return INTERNATIONAL_TIER.OTHER;
}

function displaySortKey(name: string): string {
  return name.trim().toLocaleLowerCase('en');
}

/**
 * Compare two international leagues for tab ordering:
 * tier first, then alphabetical by display name.
 */
export function compareInternationalLeagues(
  a: InternationalLeagueRef,
  b: InternationalLeagueRef,
  options?: { scores365Offset?: number },
): number {
  const tierA = getInternationalSortTier(a, options);
  const tierB = getInternationalSortTier(b, options);
  if (tierA !== tierB) return tierA - tierB;
  return displaySortKey(a.name ?? '').localeCompare(displaySortKey(b.name ?? ''), 'en');
}
