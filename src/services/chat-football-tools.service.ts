/**
 * Fetches live football data for Captain AI chat context injection.
 * Used before LLM calls when the user asks about players, stats, or standings.
 */

import { footballService } from './football.service';
import { logger } from '../utils/logger';
import { scoreEntityNameMatch } from './quiz-name-match.util';

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

function isPlayerQuery(message: string): boolean {
  return /player|لاعب|إحصائيات|احصائيات|أهداف|اهداف|goals?|assists?|stats?|trophies|جوائز|ألقاب|القاب|who\s+is|من\s+هو|مين\s+هو/i.test(
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

  return Array.from(out)
    .map((n) => n.replace(/[؟?!.,،]+$/g, '').trim())
    .filter((n) => n.length >= 3 && n.split(/\s+/).length <= 5)
    .slice(0, 3);
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

async function fetchPlayerContext(name: string): Promise<string | null> {
  if (!footballService.isConfigured()) return null;
  try {
    const results = await footballService.searchPlayers(name);
    const match = pickBestPlayerMatch(name, results);
    if (!match) return null;

    const playerId = match.player.id;
    const detailed = await footballService.getPlayerStatistics(playerId);
    const row = detailed?.[0] ?? match;
    return formatPlayerBlock(name, row);
  } catch (err) {
    logger.warn('[ChatFootball] player lookup failed:', err);
    return null;
  }
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
  // Top-scorer queries also match the broad player regex; skip name extraction
  // for them so we don't waste a player search that can't resolve a name.
  const wantsPlayer = isPlayerQuery(message) && !wantsTopScorers;

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
  if (wantsPlayer) {
    for (const name of extractNameCandidates(message)) {
      tasks.push(cachedLookup(`player:${name.toLowerCase()}`, 30 * 60_000, () => fetchPlayerContext(name)));
    }
  }

  if (tasks.length === 0) return null;

  const results = await Promise.all(tasks);
  const blocks = results.filter((b): b is string => !!b);
  if (blocks.length === 0) return null;

  const header =
    'LIVE FOOTBALL API DATA (authoritative — use these numbers in your answer; do not invent stats):';
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
