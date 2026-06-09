/**
 * Fetches live football data for Captain AI chat context injection.
 * Used before LLM calls when the user asks about players, stats, or standings.
 */

import { footballService } from './football.service';
import { logger } from '../utils/logger';
import { scoreEntityNameMatch, containsArabicScript } from './quiz-name-match.util';
import { resolvePlayerName, learnPlayerMapping } from './player-name-resolver.service';
import { getCachedOrFetch } from './player-stats-cache.service';

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

function pickBestPlayerMatch(name: string, results: any[]): any | null {
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
  return bestScore >= 0.72 ? best : null;
}

function formatPlayerBlock(name: string, row: any): string {
  const player = row.player ?? {};
  const stats = row.statistics?.[0] ?? {};
  const team = stats.team?.name ?? '—';
  const league = stats.league?.name ?? '—';
  const games = stats.games ?? {};
  const goals = stats.goals ?? {};
  const cards = stats.cards ?? {};
  const passes = stats.passes ?? {};

  const lines = [
    `Player: ${player.name ?? name}`,
    `Age: ${player.age ?? '—'} | Nationality: ${player.nationality ?? '—'}`,
    `Position: ${games.position ?? '—'} | Team: ${team} | League: ${league}`,
    `Appearances: ${games.appearences ?? games.appearances ?? 0} | Minutes: ${games.minutes ?? 0}`,
    `Goals: ${goals.total ?? 0} (home ${goals.home ?? 0}, away ${goals.away ?? 0})`,
    `Assists: ${goals.assists ?? 0}`,
    `Cards: Y ${cards.yellow ?? 0} / R ${cards.red ?? 0}`,
  ];

  if (passes.total != null) {
    lines.push(`Passes: ${passes.total} (accuracy ${passes.accuracy ?? '—'}%)`);
  }
  if (games.rating) {
    lines.push(`Rating: ${games.rating}`);
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
export async function fetchPlayerStatsRow(rawName: string): Promise<PlayerStatsRow | null> {
  if (!footballService.isConfigured()) return null;
  try {
    const resolved = await resolvePlayerName(rawName);
    const searchName = resolved?.english ?? rawName;

    let row: any = null;
    let apiPlayerId = resolved?.apiPlayerId;

    // Fast path: known API id → fetch stats directly, no search needed.
    if (apiPlayerId) {
      const detailed = await footballService.getPlayerStatistics(apiPlayerId, PLAYER_SEASON);
      row = detailed?.[0] ?? null;
    }

    // Fallback: search by (English) name across top leagues.
    if (!row) {
      const results = await footballService.searchPlayers(searchName);
      const match = pickBestPlayerMatch(searchName, results);
      if (!match) return null;
      apiPlayerId = match.player?.id ?? apiPlayerId;
      if (apiPlayerId) {
        const detailed = await footballService.getPlayerStatistics(apiPlayerId, PLAYER_SEASON);
        row = detailed?.[0] ?? match;
      } else {
        row = match;
      }

      // Self-learn: persist the discovered mapping for instant future lookups.
      if (apiPlayerId && row?.player?.name) {
        void learnPlayerMapping({
          rawQuery: rawName,
          englishName: row.player.name,
          apiPlayerId,
        });
      }
    }

    if (!row) return null;

    return {
      aiResponse: formatPlayerBlock(searchName, row),
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

  return cachedLookup(
    `player:${rawName.toLowerCase()}:${statType}:${league?.id ?? 'all'}`,
    30 * 60_000,
    async () => {
      const result = await getCachedOrFetch({
        playerName: rawName,
        statType,
        competition: league?.label ?? null,
        season: String(PLAYER_SEASON),
        questionAsked: message,
        isLive,
        fetcher: () => fetchPlayerStatsRow(rawName),
      });
      return result?.aiResponse ?? null;
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

  const results = await footballService.searchPlayers(searchName);
  const match = pickBestPlayerMatch(searchName, results);
  const apiPlayerId = match?.player?.id;
  if (!apiPlayerId) return null;

  if (match?.player?.name) {
    void learnPlayerMapping({
      rawQuery: rawName,
      englishName: match.player.name,
      apiPlayerId,
    });
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
}

/**
 * Build optional live-data context for the user's message.
 * Returns null when no football API lookup applies. Lookups run in parallel to
 * minimise the delay before the first LLM token.
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
  const wantsPlayer =
    isPlayerQuery(message) && !wantsTopScorers && !wantsUclCareer;

  const tasks: Array<Promise<string | null>> = [];

  if (wantsLive) tasks.push(fetchLiveMatchesContext());
  if (wantsTopScorers) tasks.push(fetchTopScorersContext(message));
  if (wantsStandings) {
    tasks.push(
      cachedLookup(`standings:${message.slice(0, 64)}`, 10 * 60_000, () =>
        fetchStandingsContext(message),
      ),
    );
  }
  if (wantsUclCareer && nameCandidates.length > 0) {
    for (const name of nameCandidates) {
      tasks.push(fetchPlayerUclCareerContextCached(name));
    }
  } else if (wantsPlayer) {
    for (const name of nameCandidates) {
      tasks.push(fetchPlayerContextCached(name, message));
    }
  }

  if (tasks.length === 0) return null;

  const results = await Promise.all(tasks);
  const blocks = results.filter((b): b is string => !!b);
  if (blocks.length === 0) return null;

  const header = wantsUclCareer
    ? 'LIVE FOOTBALL API DATA — PLAYER UCL CAREER DOSSIER (authoritative; model: write a professional per-season breakdown using ONLY this data):'
    : 'LIVE FOOTBALL API DATA (authoritative — use these numbers in your answer; do not invent stats):';
  return {
    block: `${header}\n\n${blocks.join('\n\n---\n\n')}`,
    usedApi: true,
    // Live scores change minute to minute — never persist those answers.
    cacheable: !wantsLive,
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
