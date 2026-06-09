/**
 * Fetches live football data for Captain AI chat context injection.
 * Used before LLM calls when the user asks about players, stats, or standings.
 */

import { footballService } from './football.service';
import { logger } from '../utils/logger';
import {
  scoreEntityNameMatch,
  containsArabicScript,
  normalizeName,
  transliterateArabicToLatin,
} from './quiz-name-match.util';
import { resolvePlayerName, learnPlayerMapping } from './player-name-resolver.service';
import { getCachedOrFetch } from './player-stats-cache.service';
import { fetchTeamDossierContext } from './team-dossier.service';
import { resolveTeamFromDictionary } from './team-name-resolver.service';
import { footballMetrics } from '../utils/football-metrics';
import { redisCacheService } from './redis-cache.service';

// Dossier-level Redis TTLs (separate namespaces from the football:* proxy keys
// so clearCache() can't wipe them mid-session).
const PLAYER_DOSSIER_TTL_MS = 6 * 60 * 60_000; // ~6h
const PLAYER_DOSSIER_NS = 'football:player:';

/** Provenance of an injected context sub-block. */
export type DataSource = 'api' | 'cache' | 'unavailable';

interface ContextPiece {
  block: string;
  source: DataSource;
}

/** Prefix a raw block with a `source:` line, or drop it when null/empty. */
function tagPiece(block: string | null, source: DataSource): ContextPiece | null {
  if (!block) return null;
  return { block: `source: ${source}\n${block}`, source };
}

const LEAGUE_ALIASES: Array<{ pattern: RegExp; id: number; label: string }> = [
  { pattern: /premier\s*league|بريمير|الدوري\s*الإنجليزي|الانجليزي/i, id: 39, label: 'Premier League' },
  { pattern: /la\s*liga|الدوري\s*الإسباني|الاسباني/i, id: 140, label: 'La Liga' },
  { pattern: /serie\s*a|الدوري\s*الإيطالي|الايطالي/i, id: 135, label: 'Serie A' },
  { pattern: /bundesliga|الدوري\s*الألماني|الالماني/i, id: 78, label: 'Bundesliga' },
  { pattern: /ligue\s*1|الدوري\s*الفرنسي/i, id: 61, label: 'Ligue 1' },
  { pattern: /champions\s*league|دوري\s*الأبطال|ابطال\s*اوروبا/i, id: 2, label: 'UEFA Champions League' },
  { pattern: /saudi\s*pro|الدوري\s*السعودي|روشن/i, id: 307, label: 'Saudi Pro League' },
  { pattern: /egyptian\s*premier|الدوري\s*المصري/i, id: 233, label: 'Egyptian Premier League' },
];

const UCL_LEAGUE_ID = 2;

function isPlayerQuery(message: string): boolean {
  return /player|لاعب|إحصائيات|احصائيات|أهداف|اهداف|goals?|assists?|stats?|trophies|جوائز|ألقاب|القاب|أبطال|ابطال|بطولات|titles?|who\s+is|من\s+هو|مين\s+هو|جاب|فاز|كسب/i.test(
    message,
  );
}

/** Player + Champions League career / titles (e.g. "حكيمي جاب كام دوري أبطال"). */
function isUclCareerQuery(message: string): boolean {
  return /ucl|champions\s*league|دوري\s*(?:ال)?[اأأ]?بطال|[اأأ]?بطال\s*(?:أ|ا)?وروبا|كاس\s*(?:ال)?[اأأ]?بطال|champions\s*league\s*titles?/i.test(
    message,
  );
}

function isStandingsQuery(message: string): boolean {
  return /standings?|table|ترتيب|جدول|classification|league\s*table|top\s*\d+/i.test(message);
}

function isTopScorerQuery(message: string): boolean {
  return /top\s*scorer|top\s*scorers|golden\s*boot|most\s+goals|هداف|الهداف|الهدافين|أكثر.*(تسجيل|أهداف|اهداف)/i.test(
    message,
  );
}

/**
 * Club/team-centric question (e.g. "أخبار ريال مدريد", "Liverpool standings").
 * Broad on purpose; team extraction + resolver decide if it actually resolves.
 */
function isTeamQuery(message: string): boolean {
  return /نادي|فريق|الفريق|club|team|أخبار|اخبار|news|ترتيب|standing|coach|مدرب|squad|تشكيل/i.test(
    message,
  );
}

function isLiveMatchesQuery(message: string): boolean {
  return /live\s*match|matches?\s+(?:now|today|live)|who(?:'s|\s+is)\s+playing|playing\s+now|currently\s+playing|live\s+score|مباريات\s*(?:اليوم|دلوقتي|الان|الآن|مباشرة|الحية)|مين\s*بيلعب|مين\s*يلعب|يلعب\s*(?:دلوقتي|الان|الآن)|النتيجة\s*(?:دلوقتي|الان|الآن|المباشرة)/i.test(
    message,
  );
}

/** API-Football season for the current European campaign (Aug→May). */
function currentFootballSeason(): number {
  const now = new Date();
  const year = now.getUTCFullYear();
  return now.getUTCMonth() >= 6 ? year : year - 1;
}

// Lightweight in-memory cache so repeated chat data lookups don't re-hit
// API-Football within the same window (cuts latency + cost).
const ctxCache = new Map<string, { value: string | null; expires: number }>();

async function cachedLookup(
  key: string,
  ttlMs: number,
  fn: () => Promise<string | null>,
): Promise<string | null> {
  const hit = ctxCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = await fn();
  ctxCache.set(key, { value, expires: Date.now() + ttlMs });
  // Bound the cache so it can't grow unbounded across many queries.
  if (ctxCache.size > 200) {
    const firstKey = ctxCache.keys().next().value;
    if (firstKey) ctxCache.delete(firstKey);
  }
  return value;
}

// Arabic stop-words that are never part of a player name — stripped from
// Arabic-script name candidates so "كام هدف لمحمد صلاح" yields "محمد صلاح".
const ARABIC_NAME_STOPWORDS = new Set([
  'كام', 'كم', 'هدف', 'اهداف', 'أهداف', 'سجل', 'لعب', 'مباريات', 'مباراة',
  'اسيست', 'تمريرات', 'حاسمة', 'بطاقات', 'صفراء', 'حمراء', 'تقييم', 'في',
  'مع', 'من', 'عن', 'هو', 'مين', 'كان', 'هذا', 'هذه', 'الموسم', 'لاعب',
  'إحصائيات', 'احصائيات', 'معلومات', 'كرة', 'القدم', 'دوري', 'الدوري', 'و',
  'يا', 'ال', 'علي', 'على', 'عند', 'له', 'ل',
  'جاب', 'فاز', 'كسب', 'خد', 'أخذ', 'اخذ', 'ابطال', 'أبطال', 'ابطال', 'اوروبا', 'أوروبا',
  'بطولات', 'بطولة', 'كام', 'كم', 'قد', 'ايه', 'إيه',
]);

function extractArabicNameSpans(message: string): string[] {
  const out: string[] = [];
  // Grab runs of Arabic words, then drop stop-words to isolate the name.
  for (const m of message.matchAll(/[\u0600-\u06FF]+(?:\s+[\u0600-\u06FF]+){0,4}/g)) {
    const tokens = m[0]
      .split(/\s+/)
      .map((t) => t.trim())
      .filter(Boolean);
    const nameTokens = tokens.filter((t) => !ARABIC_NAME_STOPWORDS.has(t));
    if (nameTokens.length >= 1 && nameTokens.length <= 3) {
      out.push(nameTokens.join(' '));
    }
  }
  return out;
}

function extractNameCandidates(message: string): string[] {
  const out = new Set<string>();

  for (const m of message.matchAll(/["'«]([^"'»]{3,48})["'»]/g)) {
    out.add(m[1].trim());
  }

  for (const m of message.matchAll(/\b([A-Z][a-zÀ-ÿ]+(?:\s+[A-Z][a-zÀ-ÿ'.-]+){1,3})\b/g)) {
    out.add(m[1].trim());
  }

  for (const m of message.matchAll(
    /(?:لاعب|إحصائيات|أهداف|معلومات\s+عن|stats?\s+(?:for|of)|about|tell\s+me\s+about)\s+([^\n?.!،؟]{3,48})/gi,
  )) {
    const cleaned = m[1].replace(/\s+(goals|stats|career|season).*$/i, '').trim();
    if (cleaned.length >= 3) out.add(cleaned);
  }

  // Arabic-script name spans (e.g. "محمد صلاح") — the patterns above mostly
  // capture Latin/quoted text, so Arabic queries need their own extraction.
  for (const span of extractArabicNameSpans(message)) {
    out.add(span);
  }

  const sanitized = Array.from(out)
    .map((n) => sanitizePlayerNameCandidate(n.replace(/[؟?!.,،]+$/g, '').trim()))
    .filter((n) => {
      if (!n) return false;
      const minLen = containsArabicScript(n) ? 2 : 3;
      return n.length >= minLen && n.split(/\s+/).length <= 5;
    });

  return [...new Set(sanitized)].slice(0, 4);
}

/** Strip trophy/competition tokens accidentally glued to a player name. */
function sanitizePlayerNameCandidate(name: string): string {
  const noise = new Set([
    ...ARABIC_NAME_STOPWORDS,
    'أبطال', 'ابطال', 'الأبطال', 'الابطال', 'اوروبا', 'أوروبا', 'أوروبا',
    'champions', 'league', 'ucl', 'titles', 'trophies', 'winner', 'winners',
  ]);
  const tokens = name
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t) => !noise.has(t.toLowerCase()) && !noise.has(t));
  return tokens.slice(0, 3).join(' ').trim();
}

type PlayerStatType =
  | 'goals'
  | 'assists'
  | 'appearances'
  | 'yellow_cards'
  | 'red_cards'
  | 'rating'
  | 'general';

function detectStatType(message: string): PlayerStatType {
  const m = message.toLowerCase();
  if (/بطاقات?\s*حمراء|red\s*cards?/i.test(message)) return 'red_cards';
  if (/بطاقات?\s*صفراء|yellow\s*cards?/i.test(message)) return 'yellow_cards';
  if (/اسيست|أسيست|تمريرات?\s*حاسمة|assists?/i.test(message)) return 'assists';
  if (/مباريات|لعب\s*كام|appearances?|games?|matches\s*played/i.test(message)) {
    return 'appearances';
  }
  if (/تقييم|rating/i.test(m)) return 'rating';
  if (/هدف|اهداف|أهداف|goals?|scored/i.test(message)) return 'goals';
  return 'general';
}

function detectLeague(message: string): { id: number; label: string } | null {
  for (const entry of LEAGUE_ALIASES) {
    if (entry.pattern.test(message)) {
      return { id: entry.id, label: entry.label };
    }
  }
  return null;
}

/** Strong threshold aligned with the resolver (0.82) to stop cross-script
 * mismatches like "فينيسيوس" → "Giroud". An exact normalized-name match wins
 * outright. */
const PLAYER_MATCH_THRESHOLD = 0.82;

function pickBestPlayerMatch(name: string, results: any[]): any | null {
  const normTarget = normalizeName(name);

  // 1. Exact normalized-name match first — never lose to a fuzzy near-miss.
  if (normTarget) {
    for (const row of results ?? []) {
      const player = row?.player;
      if (!player?.id) continue;
      if (normalizeName(player.name ?? '') === normTarget) return row;
    }
  }

  // 2. Best fuzzy score, gated by a strong threshold.
  let best: any | null = null;
  let bestScore = 0;
  for (const row of results ?? []) {
    const player = row?.player;
    if (!player?.id) continue;
    const score = scoreEntityNameMatch(name, player.name ?? '');
    if (score > bestScore) {
      bestScore = score;
      best = row;
    }
  }
  return bestScore >= PLAYER_MATCH_THRESHOLD ? best : null;
}

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Per-competition stat figures pulled from one API `statistics[]` entry. */
interface CompetitionStat {
  competition: string;
  team: string;
  appearances: number;
  minutes: number;
  goals: number;
  assists: number;
  yellow: number;
  red: number;
  rating: number | null;
}

function extractCompetitionStat(entry: any): CompetitionStat {
  const games = entry?.games ?? {};
  const goals = entry?.goals ?? {};
  const cards = entry?.cards ?? {};
  const ratingRaw = games.rating != null ? Number(games.rating) : NaN;
  return {
    competition: entry?.league?.name ?? '—',
    team: entry?.team?.name ?? '—',
    appearances: num(games.appearences ?? games.appearances),
    minutes: num(games.minutes),
    goals: num(goals.total),
    assists: num(goals.assists),
    yellow: num(cards.yellow),
    red: num(cards.red),
    rating: Number.isFinite(ratingRaw) ? ratingRaw : null,
  };
}

/**
 * Build a player stat block.
 *
 * Default = full-season aggregate across ALL competitions (sum of apps/minutes/
 * goals/assists/cards; minutes-weighted average rating) plus a per-competition
 * breakdown. When `competitionLabel` is given, show only that competition row.
 * Stats Type is always labeled so the model never conflates league vs season.
 */
function formatPlayerBlock(
  name: string,
  row: any,
  opts?: { competitionLabel?: string },
): string {
  const player = row.player ?? {};
  const allStats: any[] = Array.isArray(row.statistics) ? row.statistics : [];
  const comps = allStats.map(extractCompetitionStat).filter((c) => c.competition !== '—' || c.appearances > 0 || c.minutes > 0);

  const seasonLabel = `${PLAYER_SEASON}/${PLAYER_SEASON + 1}`;

  // Primary club = entry with most minutes (fallback first entry).
  const primary =
    comps.slice().sort((a, b) => b.minutes - a.minutes)[0] ??
    extractCompetitionStat(allStats[0] ?? {});

  // ── Single-competition mode ──────────────────────────────────────────────
  if (opts?.competitionLabel) {
    const target = normalizeName(opts.competitionLabel);
    const one =
      comps.find((c) => normalizeName(c.competition) === target) ??
      comps.find((c) => normalizeName(c.competition).includes(target));
    if (one) {
      return [
        `Player: ${player.name ?? name}`,
        `Age: ${player.age ?? '—'} | Nationality: ${player.nationality ?? '—'}`,
        `Stats Type: ${one.competition} ${seasonLabel}`,
        `Team: ${one.team} | Position: ${primary && primary.team === one.team ? '—' : '—'}`,
        `Appearances: ${one.appearances} | Minutes: ${one.minutes}`,
        `Goals: ${one.goals} | Assists: ${one.assists}`,
        `Cards: Y ${one.yellow} / R ${one.red}`,
        one.rating != null ? `Rating: ${one.rating.toFixed(2)}` : 'Rating: —',
      ].join('\n');
    }
  }

  // ── Default: season aggregate across all competitions ────────────────────
  const agg = comps.reduce(
    (acc, c) => {
      acc.appearances += c.appearances;
      acc.minutes += c.minutes;
      acc.goals += c.goals;
      acc.assists += c.assists;
      acc.yellow += c.yellow;
      acc.red += c.red;
      if (c.rating != null && c.minutes > 0) {
        acc.ratingWeighted += c.rating * c.minutes;
        acc.ratingMinutes += c.minutes;
      }
      return acc;
    },
    {
      appearances: 0,
      minutes: 0,
      goals: 0,
      assists: 0,
      yellow: 0,
      red: 0,
      ratingWeighted: 0,
      ratingMinutes: 0,
    },
  );
  const avgRating = agg.ratingMinutes > 0 ? agg.ratingWeighted / agg.ratingMinutes : null;

  const lines = [
    `Player: ${player.name ?? name}`,
    `Age: ${player.age ?? '—'} | Nationality: ${player.nationality ?? '—'}`,
    `Stats Type: Season ${seasonLabel} (all competitions combined)`,
    `Primary club: ${primary?.team ?? '—'}`,
    `Total Appearances: ${agg.appearances} | Minutes: ${agg.minutes}`,
    `Total Goals: ${agg.goals} | Total Assists: ${agg.assists}`,
    `Cards: Y ${agg.yellow} / R ${agg.red}`,
    avgRating != null ? `Avg rating (minutes-weighted): ${avgRating.toFixed(2)}` : 'Avg rating: —',
  ];

  if (comps.length > 1) {
    lines.push('Per-competition breakdown:');
    for (const c of comps.slice().sort((a, b) => b.goals - a.goals)) {
      lines.push(
        `  • ${c.competition} (${c.team}): ${c.appearances} apps, ${c.goals} G, ${c.assists} A, ${c.minutes} min`,
      );
    }
  } else if (comps.length === 1) {
    lines.push(`Competition: ${comps[0].competition} (${comps[0].team})`);
  }

  return lines.join('\n');
}

interface PlayerStatsRow {
  aiResponse: string;
  statValue: unknown;
  apiPlayerId?: number;
  aliases?: string[];
}

const PLAYER_SEASON = currentFootballSeason();

/**
 * Resolve a raw player name (AR/EN) and fetch its stats block. Uses the
 * name-mapping resolver to (a) translate Arabic → English and (b) skip the
 * expensive league-scan search when a known apiPlayerId exists.
 */
export async function fetchPlayerStatsRow(
  rawName: string,
  opts?: { competitionLabel?: string },
): Promise<PlayerStatsRow | null> {
  if (!footballService.isConfigured()) return null;
  try {
    const resolved = await resolvePlayerName(rawName);
    const searchName = resolved?.english ?? rawName;

    let row: any = null;
    let apiPlayerId = resolved?.apiPlayerId;

    // ── Fast path: trusted seeded/fuzzy id → fetch stats directly. We do NOT
    //    fall back to a name search when this id resolves nothing, because that
    //    fallback is exactly what produced Vinicius→Giroud. An empty stat feed
    //    for a known id means "no verified data this season", not "wrong id".
    if (apiPlayerId && (resolved?.source === 'mapping' || resolved?.source === 'fuzzy')) {
      const detailed = await footballService.getPlayerStatistics(apiPlayerId, PLAYER_SEASON);
      row = detailed?.[0] ?? null;
      footballMetrics.recordResolver(true);
      if (!row) {
        logger.info(
          `[Resolve] "${rawName}" -> ${resolved.source} -> ${searchName} (id ${apiPlayerId}) — no stats this season (unavailable)`,
        );
        return null;
      }
    } else if (apiPlayerId) {
      // Raw-source id (rare) — try it, but allow a search fallback below.
      const detailed = await footballService.getPlayerStatistics(apiPlayerId, PLAYER_SEASON);
      row = detailed?.[0] ?? null;
    }

    // ── Fallback search: only for names with NO trusted id. Transliterate
    //    Arabic so unmapped Arabic names can still hit the (Latin-only) API.
    if (!row && !apiPlayerId) {
      const searchQuery = containsArabicScript(searchName)
        ? transliterateArabicToLatin(searchName)
        : searchName;
      const results = await footballService.searchPlayers(searchQuery);
      const match = pickBestPlayerMatch(searchQuery, results);
      if (!match) {
        footballMetrics.recordResolver(false);
        logger.info(`[Resolve] "${rawName}" -> search "${searchQuery}" -> no confident match`);
        return null;
      }
      apiPlayerId = match.player?.id ?? apiPlayerId;
      if (apiPlayerId) {
        const detailed = await footballService.getPlayerStatistics(apiPlayerId, PLAYER_SEASON);
        row = detailed?.[0] ?? match;
      } else {
        row = match;
      }
      footballMetrics.recordResolver(!!apiPlayerId);

      // Self-learn ONLY on a high-confidence match (exact normalized name or
      // fuzzy score >= 0.88) to prevent alias pollution that misroutes names.
      const matchedName: string = match.player?.name ?? '';
      const isExact =
        !!matchedName && normalizeName(matchedName) === normalizeName(searchQuery);
      const score = scoreEntityNameMatch(searchQuery, matchedName);
      if (apiPlayerId && matchedName && (isExact || score >= 0.88)) {
        logger.info(
          `[Resolve] "${rawName}" -> search -> ${matchedName} (id ${apiPlayerId}, score ${score.toFixed(2)}) [learned]`,
        );
        void learnPlayerMapping({ rawQuery: rawName, englishName: matchedName, apiPlayerId });
      } else if (apiPlayerId) {
        logger.info(
          `[Resolve] "${rawName}" -> search -> ${matchedName} (id ${apiPlayerId}, score ${score.toFixed(2)}) [not learned — low confidence]`,
        );
      }
    }

    if (!row) {
      footballMetrics.recordResolver(false);
      return null;
    }

    return {
      aiResponse: formatPlayerBlock(searchName, row, opts),
      statValue: row,
      apiPlayerId,
      aliases: Array.from(
        new Set([rawName, searchName, row?.player?.name].filter(Boolean) as string[]),
      ),
    };
  } catch (err) {
    logger.warn('[ChatFootball] player lookup failed:', err);
    return null;
  }
}

/**
 * Player context with two cache layers: L1 in-memory (ctxCache, per-process,
 * fast) in front of L2 Postgres (PlayerStatsCache, persistent across restarts).
 */
async function fetchPlayerContextCached(
  rawName: string,
  message: string,
): Promise<string | null> {
  const statType = detectStatType(message);
  const league = detectLeague(message);
  const isLive = isLiveMatchesQuery(message);

  const redisKey = `${PLAYER_DOSSIER_NS}${normalizeName(rawName)}:${statType}:${league?.id ?? 'all'}`;

  return cachedLookup(
    `player:${rawName.toLowerCase()}:${statType}:${league?.id ?? 'all'}`,
    30 * 60_000,
    async () => {
      // Redis dossier layer (skipped for volatile live queries).
      if (!isLive) {
        const cached = await redisCacheService.get<string>(redisKey);
        if (cached != null) {
          footballMetrics.recordCacheHit();
          logger.info(`[DossierCache] player HIT ${redisKey}`);
          return cached;
        }
        footballMetrics.recordCacheMiss();
        logger.info(`[DossierCache] player MISS ${redisKey}`);
      }

      const result = await getCachedOrFetch({
        playerName: rawName,
        statType,
        competition: league?.label ?? null,
        season: String(PLAYER_SEASON),
        questionAsked: message,
        isLive,
        fetcher: () => fetchPlayerStatsRow(rawName, { competitionLabel: league?.label }),
      });
      const out = result?.aiResponse ?? null;
      if (!isLive && out) {
        await redisCacheService.set(redisKey, out, PLAYER_DOSSIER_TTL_MS);
      }
      return out;
    },
  );
}

async function fetchStandingsContext(message: string): Promise<string | null> {
  if (!footballService.isConfigured()) return null;
  const league = detectLeague(message);
  if (!league) return null;

  try {
    const { flat } = await footballService.getStandingsParsed(league.id);
    const top = (flat ?? []).slice(0, 12);
    if (!top.length) return null;

    const rows = top.map((row: any, i: number) => {
      const t = row.team?.name ?? '—';
      const pts = row.points ?? '—';
      const played = row.all?.played ?? '—';
      const gd = row.goalsDiff ?? '—';
      return `${i + 1}. ${t} — P${played} GD${gd} Pts ${pts}`;
    });

    return `${league.label} standings (top ${rows.length}):\n${rows.join('\n')}`;
  } catch (err) {
    logger.warn('[ChatFootball] standings lookup failed:', err);
    return null;
  }
}

async function fetchTopScorersContext(message: string): Promise<string | null> {
  if (!footballService.isConfigured()) return null;
  const league = detectLeague(message);
  if (!league) return null;

  const season = currentFootballSeason();
  return cachedLookup(`topscorers:${league.id}:${season}`, 30 * 60_000, async () => {
    try {
      const scorers = await footballService.getTopScorers(league.id, season);
      const top = (scorers ?? []).slice(0, 10);
      if (!top.length) return null;

      const rows = top.map((p: any, i: number) => {
        const name = p.player?.name ?? '—';
        const st = p.statistics?.[0] ?? {};
        const goals = st.goals?.total ?? 0;
        const assists = st.goals?.assists ?? 0;
        const team = st.team?.name ?? '—';
        return `${i + 1}. ${name} (${team}) — ${goals} goals, ${assists} assists`;
      });

      return `${league.label} top scorers (${season}/${season + 1}):\n${rows.join('\n')}`;
    } catch (err) {
      logger.warn('[ChatFootball] top scorers lookup failed:', err);
      return null;
    }
  });
}

function isUclTrophyEntry(league: string): boolean {
  return /champions\s*league|uefa\s*champions/i.test(league);
}

function isWinnerPlace(place: string): boolean {
  return /winner|بطل|فائز/i.test(place);
}

/** Map API trophy season label → API-Football `season` year param. */
function parseTrophySeasonToApiYear(season: unknown): number | null {
  if (season == null || season === '') return null;
  const s = String(season).trim();
  const range = s.match(/^(\d{4})\s*[/\-–]\s*(\d{2,4})$/);
  if (range) return Number(range[1]);
  const year = s.match(/^(\d{4})$/);
  if (year) return Number(year[1]);
  return null;
}

async function resolvePlayerApiId(
  rawName: string,
): Promise<{ apiPlayerId: number; displayName: string; searchName: string } | null> {
  const row = await fetchPlayerStatsRow(rawName);
  if (row?.apiPlayerId) {
    const name =
      (row.statValue as { player?: { name?: string } })?.player?.name ??
      row.aliases?.[0] ??
      rawName;
    return {
      apiPlayerId: row.apiPlayerId,
      displayName: name,
      searchName: rawName,
    };
  }

  const resolved = await resolvePlayerName(rawName);
  const searchName = resolved?.english ?? rawName;
  if (resolved?.apiPlayerId) {
    return {
      apiPlayerId: resolved.apiPlayerId,
      displayName: searchName,
      searchName,
    };
  }

  const searchQuery = containsArabicScript(searchName)
    ? transliterateArabicToLatin(searchName)
    : searchName;
  const results = await footballService.searchPlayers(searchQuery);
  const match = pickBestPlayerMatch(searchQuery, results);
  const apiPlayerId = match?.player?.id;
  if (!apiPlayerId) return null;

  // Only persist a learned alias on a high-confidence match (prevents the
  // alias pollution that previously misrouted names).
  const matchedName: string = match.player?.name ?? '';
  const isExact = !!matchedName && normalizeName(matchedName) === normalizeName(searchQuery);
  const score = scoreEntityNameMatch(searchQuery, matchedName);
  if (matchedName && (isExact || score >= 0.88)) {
    void learnPlayerMapping({ rawQuery: rawName, englishName: matchedName, apiPlayerId });
  }

  return {
    apiPlayerId,
    displayName: match.player.name ?? searchName,
    searchName,
  };
}

function formatUclSeasonStatBlock(
  seasonLabel: string,
  place: string,
  stats: { statistics: any } | null,
): string {
  const lines = [`=== ${seasonLabel} — ${place} ===`];
  if (!stats?.statistics) {
    lines.push('UCL campaign stats: not available in API feed for this season.');
    return lines.join('\n');
  }

  const st = stats.statistics;
  const team = st.team?.name ?? '—';
  const games = st.games ?? {};
  const goals = st.goals ?? {};
  const cards = st.cards ?? {};

  lines.push(`Club in UCL: ${team}`);
  lines.push(
    `Appearances: ${games.appearences ?? games.appearances ?? 0} | Minutes: ${games.minutes ?? 0}`,
  );
  lines.push(`Goals: ${goals.total ?? 0} | Assists: ${goals.assists ?? 0}`);
  lines.push(`Cards: Y ${cards.yellow ?? 0} / R ${cards.red ?? 0}`);
  if (games.rating) lines.push(`Avg rating: ${games.rating}`);
  return lines.join('\n');
}

/**
 * Rich UCL dossier: titles from /trophies + per-winning-season UCL stats from /players.
 * Injected into the LLM prompt; the model writes the professional narrative.
 */
export async function fetchPlayerUclCareerDossier(rawName: string): Promise<string | null> {
  if (!footballService.isConfigured()) return null;

  try {
    const player = await resolvePlayerApiId(rawName);
    if (!player) return null;

    const trophies = await footballService.getPlayerTrophies(player.apiPlayerId);
    const uclWinners = (trophies ?? []).filter((t: any) => {
      const league = String(t.league ?? t.name ?? '');
      const place = String(t.place ?? '');
      return isUclTrophyEntry(league) && isWinnerPlace(place);
    });

    const seenSeasons = new Set<string>();
    const uniqueWins: Array<{ seasonLabel: string; place: string; apiYear: number | null }> =
      [];

    for (const t of uclWinners) {
      const seasonLabel = String(t.season ?? '—');
      const dedupeKey = `${seasonLabel}|${t.place ?? 'Winner'}`;
      if (seenSeasons.has(dedupeKey)) continue;
      seenSeasons.add(dedupeKey);
      uniqueWins.push({
        seasonLabel,
        place: String(t.place ?? 'Winner'),
        apiYear: parseTrophySeasonToApiYear(t.season),
      });
    }

    uniqueWins.sort((a, b) => (b.apiYear ?? 0) - (a.apiYear ?? 0));

    const currentSeasonRow = await footballService.getPlayerStatisticsInLeague(
      player.apiPlayerId,
      UCL_LEAGUE_ID,
      PLAYER_SEASON,
    );

    const seasonBlocks: string[] = [];
    for (const win of uniqueWins) {
      let stats: { statistics: any } | null = null;
      if (win.apiYear != null) {
        stats = await footballService.getPlayerStatisticsInLeague(
          player.apiPlayerId,
          UCL_LEAGUE_ID,
          win.apiYear,
        );
      }
      seasonBlocks.push(formatUclSeasonStatBlock(win.seasonLabel, win.place, stats));
    }

    const header = [
      `PLAYER: ${player.displayName} (API id ${player.apiPlayerId})`,
      `UCL TITLES (Winner, deduped): ${uniqueWins.length}`,
      uniqueWins.length
        ? uniqueWins.map((w, i) => `  ${i + 1}. ${w.seasonLabel} (${w.place})`).join('\n')
        : '  (none listed as Winner in API trophies feed)',
    ].join('\n');

    let currentBlock = '';
    if (currentSeasonRow) {
      currentBlock = `\nCURRENT UCL SEASON (${PLAYER_SEASON}/${PLAYER_SEASON + 1}):\n${formatUclSeasonStatBlock(
        `${PLAYER_SEASON}/${PLAYER_SEASON + 1}`,
        'in progress',
        currentSeasonRow,
      )}`;
    }

    const coachNotes = `
MODEL COACHING (follow strictly):
- Answer in the user's language with a professional tone (coach/analyst style).
- Start with total UCL titles won, then dedicate a short paragraph per winning season.
- For each season, cite appearances/goals/assists/minutes/rating from the UCL stat blocks below.
- Use ONLY numbers from this dossier; never invent stats or titles.
- If API lists a dubious title without matching UCL stats, mention it cautiously and rely on stat-backed seasons.
- Prefer a Markdown table when comparing multiple UCL campaigns.`.trim();

    return [
      header,
      '',
      'PER-WINNING-SEASON UCL STATS:',
      seasonBlocks.length ? seasonBlocks.join('\n\n') : '(no per-season UCL stat rows)',
      currentBlock,
      '',
      coachNotes,
    ]
      .filter(Boolean)
      .join('\n');
  } catch (err) {
    logger.warn('[ChatFootball] UCL career dossier failed:', err);
    return null;
  }
}

async function fetchPlayerUclCareerContextCached(rawName: string): Promise<string | null> {
  return cachedLookup(
    `ucl-career:${rawName.toLowerCase()}`,
    60 * 60_000,
    () => fetchPlayerUclCareerDossier(rawName),
  );
}

async function fetchLiveMatchesContext(): Promise<string | null> {
  if (!footballService.isConfigured()) return null;

  // Short TTL — live scores move fast.
  return cachedLookup('live:all', 25_000, async () => {
    try {
      const fixtures = await footballService.getLiveFixtures();
      if (!Array.isArray(fixtures) || fixtures.length === 0) {
        return 'No football matches are being played live right now.';
      }

      const rows = fixtures.slice(0, 25).map((f: any) => {
        const home = f.teams?.home?.name ?? '—';
        const away = f.teams?.away?.name ?? '—';
        const gh = f.goals?.home ?? 0;
        const ga = f.goals?.away ?? 0;
        const elapsed = f.fixture?.status?.elapsed;
        const league = f.league?.name ?? '';
        return `${home} ${gh}-${ga} ${away} (${elapsed != null ? elapsed + "'" : 'LIVE'}${
          league ? `, ${league}` : ''
        })`;
      });

      return `Live matches right now (${rows.length}):\n${rows.join('\n')}`;
    } catch (err) {
      logger.warn('[ChatFootball] live matches lookup failed:', err);
      return null;
    }
  });
}

export interface FootballChatContext {
  block: string;
  usedApi: boolean;
  /** False when the block includes volatile live data that must not be cached. */
  cacheable: boolean;
  /** Provenance of each injected sub-block (additive; safe to ignore). */
  sources?: DataSource[];
}

/**
 * Build optional live-data context for the user's message.
 * Returns null when no football lookup applies. When a player/team data query
 * IS detected but nothing resolves, returns an explicit `unavailable` guard
 * block (usedApi=false) so the model is told not to invent numbers.
 * Lookups run in parallel to minimise the delay before the first LLM token.
 */
export async function buildFootballChatContext(
  message: string,
): Promise<FootballChatContext | null> {
  if (!footballService.isConfigured()) return null;

  const wantsLive = isLiveMatchesQuery(message);
  const wantsTopScorers = isTopScorerQuery(message);
  const wantsStandings = isStandingsQuery(message);
  const wantsUclCareer = isUclCareerQuery(message);
  const nameCandidates = extractNameCandidates(message);
  // Top-scorer queries also match the broad player regex; skip name extraction
  // for them so we don't waste a player search that can't resolve a name.
  const wantsPlayer = isPlayerQuery(message) && !wantsTopScorers && !wantsUclCareer;
  const wantsTeam = isTeamQuery(message) && !wantsTopScorers && !wantsStandings;

  const tasks: Array<Promise<ContextPiece | null>> = [];

  if (wantsLive) tasks.push(fetchLiveMatchesContext().then((b) => tagPiece(b, 'api')));
  if (wantsTopScorers) {
    tasks.push(fetchTopScorersContext(message).then((b) => tagPiece(b, 'api')));
  }
  if (wantsStandings) {
    tasks.push(
      cachedLookup(`standings:${message.slice(0, 64)}`, 10 * 60_000, () =>
        fetchStandingsContext(message),
      ).then((b) => tagPiece(b, 'api')),
    );
  }

  // ── Team dossier takes precedence over player search for the SAME candidate,
  //    so clubs (ريال مدريد / PSG) stop being mis-resolved as players. We
  //    classify candidates SYNCHRONOUSLY via the alias dictionary so the
  //    player path can be skipped reliably (parallel tasks can't coordinate
  //    via a shared set after they've started).
  const dictTeamNames = new Set<string>();
  if ((wantsTeam || wantsPlayer) && !wantsUclCareer) {
    for (const name of nameCandidates) {
      if (resolveTeamFromDictionary(name)) dictTeamNames.add(name);
    }
  }

  if ((wantsTeam || wantsPlayer) && !wantsUclCareer) {
    for (const name of nameCandidates) {
      const isDictTeam = dictTeamNames.has(name);
      // Dictionary hit → free dossier. Explicit team query → allow an API search
      // for non-dict names. Pure stats intent on a non-dict name → skip (it's a
      // player, handled below) to avoid wasting quota on a team search.
      if (!isDictTeam && !wantsTeam) continue;
      tasks.push(
        fetchTeamDossierContext(name, { allowSearch: wantsTeam }).then((res) =>
          res ? { block: res.block, source: res.source } : null,
        ),
      );
    }
  }

  if (wantsUclCareer && nameCandidates.length > 0) {
    for (const name of nameCandidates) {
      tasks.push(fetchPlayerUclCareerContextCached(name).then((b) => tagPiece(b, 'api')));
    }
  } else if (wantsPlayer) {
    for (const name of nameCandidates) {
      // Skip the player path for dictionary-confirmed clubs (precedence).
      if (dictTeamNames.has(name)) continue;
      tasks.push(fetchPlayerContextCached(name, message).then((b) => tagPiece(b, 'api')));
    }
  }

  if (tasks.length === 0) return null;

  const pieces = (await Promise.all(tasks)).filter((p): p is ContextPiece => !!p);

  // ── No verified data resolved for a data query → inject an explicit guard
  //    so the LLM is told NOT to fabricate stats (anti-hallucination).
  if (pieces.length === 0) {
    const isStatsIntent = wantsPlayer || wantsTeam || wantsUclCareer;
    if (isStatsIntent && nameCandidates.length > 0) {
      const subject = nameCandidates.join('", "');
      const guard = [
        'NO-VERIFIED-DATA GUARD (authoritative):',
        `No verified statistics were found for "${subject}".`,
        'Do NOT state any numbers (goals, assists, appearances, ratings, titles, positions).',
        'Reply that up-to-date verified data is unavailable right now; you may give only',
        'general, non-numeric descriptive context. Never invent figures.',
      ].join('\n');
      return {
        block: `${tagPiece(guard, 'unavailable')!.block}`,
        usedApi: false,
        cacheable: false,
        sources: ['unavailable'],
      };
    }
    return null;
  }

  const sources = pieces.map((p) => p.source);
  const sourceSummary = `DATA SOURCES: ${sources.join(', ')} (api=live API-Football, cache=our DB, unavailable=no verified data)`;

  const header = wantsUclCareer
    ? 'LIVE FOOTBALL API DATA — PLAYER UCL CAREER DOSSIER (authoritative; model: write a professional per-season breakdown using ONLY this data):'
    : 'LIVE FOOTBALL DATA (authoritative — use ONLY these numbers; never invent stats. Items tagged "source: unavailable" have NO data):';

  return {
    block: `${header}\n\n${pieces.map((p) => p.block).join('\n\n---\n\n')}\n\n${sourceSummary}`,
    usedApi: true,
    // Live scores change minute to minute — never persist those answers.
    cacheable: !wantsLive,
    sources,
  };
}

/**
 * Route heavier work to the complex model (Gemini 3): factual/data-backed
 * questions and explicitly long answers. Simple/short chit-chat stays on the
 * fast model (Qwen) for snappy, cheap replies.
 */
export function shouldUseComplexModel(
  lengthMode: 'short' | 'medium' | 'detailed',
  hasFootballContext: boolean,
): boolean {
  if (hasFootballContext) return true;
  if (lengthMode === 'detailed') return true;
  return false;
}

export type PlayerInfoQueryType = 'ucl_career' | 'season_stats';

/**
 * Detect player-centric chat questions suitable for the player_info DB cache.
 */
export function detectPlayerInfoQuery(
  message: string,
): { playerName: string; queryType: PlayerInfoQueryType } | null {
  const names = extractNameCandidates(message);
  if (!names.length) return null;

  if (isUclCareerQuery(message)) {
    return { playerName: names[0], queryType: 'ucl_career' };
  }

  if (
    isPlayerQuery(message) &&
    !isTopScorerQuery(message) &&
    !isStandingsQuery(message) &&
    !isLiveMatchesQuery(message)
  ) {
    return { playerName: names[0], queryType: 'season_stats' };
  }

  return null;
}
