/**
 * OpenAI-style tool schemas + executors for Captain AI football agent.
 * Wraps existing football / 365Scores services; returns compact JSON for the model.
 */

import type { ChatCompletionTool } from 'openai/resources/chat/completions';
import { logger } from '../utils/logger';
import type { MessageLanguage } from '../utils/message-language.util';
import { localDateKey } from '../utils/world-cup-campaign.util';
import { resolveFootballSeason } from '../utils/football-season.util';
import { footballService } from './football.service';
import { footballDataCacheService } from './football-data-cache.service';
import { resolveLiveFixturesForClient } from './live-fixture-cache.service';
import { resolveTeamId } from './team-name-resolver.service';
import { fetchTeamDossierContext } from './team-dossier.service';
import {
  detectLeague,
  fetchPlayerStatsRow,
  fetchPlayerUclCareerDossier,
  fetchPlayerWorldCupGoals,
} from './chat-football-tools.service';
import { resolvePlayerName } from './player-name-resolver.service';
import { ensureScores365GameMapping } from './scores365-experiment.service';
import { threeSixFiveScoresService } from './threeSixFiveScores.service';
import {
  containsArabicScript,
  foldArabic,
  normalizeName,
  scoreEntityNameMatch,
  scorePlayerMatch,
  transliterateArabicToLatin,
} from './quiz-name-match.util';


const LIVE_STATUSES = new Set(['1H', '2H', 'HT', 'ET', 'P', 'LIVE', 'BT', 'INT', 'SUSP']);
const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN']);

const HIGHLIGHT_LEAGUE_SCORE: Record<number, number> = {
  2: 100,
  39: 92,
  140: 90,
  135: 89,
  78: 88,
  61: 87,
  3: 85,
  233: 84,
  307: 80,
  1: 75,
};

export const AGENT_TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'search_player',
      description:
        'PRIMARY player lookup via 365Scores profile (same data as the in-app player profile/career). Returns current club, age, jersey, latest season stats by competition, highlights, recent seasons, and trophy counts. ALWAYS call this first for any player question (club, season stats, where he plays, goals/assists).',
      parameters: {
        type: 'object',
        properties: {
          player_name: {
            type: 'string',
            description: 'Player name as the user said it (e.g. مبابي, Mohamed Salah, ديبوريم)',
          },
        },
        required: ['player_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_today_matches',
      description:
        "Football matches grouped by status. when='today' (default) returns today's fixtures split into live (with minute), finished (with score), and upcoming (with kickoff). when='upcoming' returns the most important fixtures over the next few days. Optionally filter by league (e.g. الدوري المصري, Premier League). Use for \"مباريات النهاردة\", \"اي اللي لعب/جاي في الدوري\", or \"أهم المباريات الجاية\".",
      parameters: {
        type: 'object',
        properties: {
          league: {
            type: 'string',
            description:
              'Optional league filter in Arabic or English (e.g. الدوري المصري, Premier League, البريمير ليج, الدوري البوليفي)',
          },
          when: {
            type: 'string',
            enum: ['today', 'upcoming'],
            description:
              "'today' (default) for today's matches grouped by status; 'upcoming' for the most important matches in the next few days.",
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_live_matches',
      description:
        'List matches currently being played live (minute + score). Use for "مين بيلعب دلوقتي" / live scores. Always call fresh — do not invent live scores.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'resolve_match',
      description:
        'Find a specific match by team name(s) and return its fixtureId. Prefer this before get_match_details when the user names a team/match but not an id.',
      parameters: {
        type: 'object',
        properties: {
          team_name: {
            type: 'string',
            description: 'One team involved (e.g. الأهلي, Real Madrid)',
          },
          home_team: { type: 'string', description: 'Optional home team name' },
          away_team: { type: 'string', description: 'Optional away team name' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_match_details',
      description:
        'Get live/finished match details by fixtureId: score, minute, status, recent events, lineups summary, and key stats. Always call fresh for live questions.',
      parameters: {
        type: 'object',
        properties: {
          fixture_id: { type: 'number', description: 'API-Football / app fixtureId' },
        },
        required: ['fixture_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_match_lineup',
      description: 'Get starting XI and substitutes for a match by fixtureId.',
      parameters: {
        type: 'object',
        properties: {
          fixture_id: { type: 'number' },
        },
        required: ['fixture_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_standings',
      description: 'Get league table / standings (top rows). Pass league name in Arabic or English.',
      parameters: {
        type: 'object',
        properties: {
          league: {
            type: 'string',
            description: 'e.g. Premier League, الدوري المصري, Champions League',
          },
          season: { type: 'number', description: 'Optional season start year' },
        },
        required: ['league'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_top_scorers',
      description: 'Get top scorers for a league/competition.',
      parameters: {
        type: 'object',
        properties: {
          league: { type: 'string' },
          season: { type: 'number' },
        },
        required: ['league'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_team_info',
      description:
        'Team/national-team dossier: current head COACH (مدرب), recent form, league position, and African/continental titles. REQUIRED for club trophy questions (e.g. الأهلي كام أفريقيا) AND for coach questions (e.g. مين مدرب منتخب مصر). Works for clubs and national teams (منتخب مصر = Egypt). Returns coach + cafChampionsLeagueWins — use those values only, never invent.',
      parameters: {
        type: 'object',
        properties: {
          team_name: { type: 'string' },
        },
        required: ['team_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_player_career',
      description:
        'Full 365Scores player career profile: trophies (World Cup / UCL / CAF), World Cup GOALS (worldCupGoals), recent seasons, clubs. ALWAYS use for "كام كاس عالم" / أهداف في كأس العالم / titles / ألقاب / career history. Prefer numbers from this tool over memory.',
      parameters: {
        type: 'object',
        properties: {
          player_name: { type: 'string' },
        },
        required: ['player_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_player_match_report',
      description:
        'Per-player stats inside a specific match (minutes, goals, rating). Needs athleteId from search_player and fixtureId.',
      parameters: {
        type: 'object',
        properties: {
          athlete_id: { type: 'number', description: '365Scores athleteId' },
          fixture_id: { type: 'number' },
        },
        required: ['athlete_id', 'fixture_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_head_to_head',
      description: 'Recent head-to-head form for the two teams in a fixture.',
      parameters: {
        type: 'object',
        properties: {
          fixture_id: { type: 'number' },
        },
        required: ['fixture_id'],
      },
    },
  },
];

function scoreFixtureImportance(fixture: any): number {
  const leagueId = fixture?.league?.id ?? 0;
  let score = HIGHLIGHT_LEAGUE_SCORE[leagueId] ?? 8;
  const status = fixture?.fixture?.status?.short ?? '';
  if (LIVE_STATUSES.has(status)) score += 65;
  if (status === 'FT' || status === 'AET' || status === 'PEN') score += 18;
  return score;
}

function compactFixture(f: any) {
  return {
    fixtureId: f?.fixture?.id ?? null,
    league: f?.league?.name ?? null,
    home: f?.teams?.home?.name ?? null,
    away: f?.teams?.away?.name ?? null,
    score: {
      home: f?.goals?.home ?? null,
      away: f?.goals?.away ?? null,
    },
    status: f?.fixture?.status?.short ?? null,
    minute: f?.fixture?.status?.elapsed ?? null,
    kickoff: f?.fixture?.date ?? null,
  };
}

function compactLineups(lineups: any[]) {
  return (lineups ?? []).slice(0, 2).map((side) => ({
    team: side?.team?.name ?? null,
    formation: side?.formation ?? null,
    coach: side?.coach?.name ?? null,
    startXI: (side?.startXI ?? [])
      .slice(0, 11)
      .map((r: any) => r?.player?.name ?? r?.name)
      .filter(Boolean),
    substitutes: (side?.substitutes ?? [])
      .slice(0, 8)
      .map((r: any) => r?.player?.name ?? r?.name)
      .filter(Boolean),
  }));
}

function compactEvents(events: any[]) {
  return (events ?? [])
    .slice(-15)
    .map((e) => ({
      minute: e?.time?.elapsed ?? null,
      type: e?.type ?? null,
      detail: e?.detail ?? null,
      team: e?.team?.name ?? null,
      player: e?.player?.name ?? null,
      assist: e?.assist?.name ?? null,
    }));
}

function jsonCap(value: unknown, maxChars = 9000): string {
  const raw = JSON.stringify(value);
  if (raw.length <= maxChars) return raw;
  return JSON.stringify({
    truncated: true,
    preview: raw.slice(0, maxChars - 80),
    note: 'Result truncated for size — ask a more specific follow-up if needed.',
  });
}

function cleanClubName(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw)
    .replace(/^نادي\s*\(?/u, '')
    .replace(/\)?\s*$/u, '')
    .trim();
  return s || null;
}

function compactHighlights(highlights: any[] | undefined) {
  return (highlights ?? []).slice(0, 6).map((comp) => ({
    competition: comp.competitionName ?? null,
    stats: (comp.stats ?? []).slice(0, 8).map((s: any) => ({
      k: s.shortName ?? s.name ?? null,
      v: s.value ?? null,
      top: !!s.isTop,
    })),
  }));
}

function buildSeasonStats(season: any | null) {
  if (!season) return null;
  return {
    label: season.label ?? null,
    seasonKey: season.seasonKey ?? null,
    goals: season.goals ?? 0,
    assists: season.assists ?? 0,
    appearances: season.appearances ?? 0,
    minutes: season.minutes ?? null,
    competitions: Array.isArray(season.competitions)
      ? season.competitions.slice(0, 8).map((c: any) => ({
          competitionName: c.competitionName ?? null,
          teamName: cleanClubName(c.teamName),
          goals: c.goals ?? null,
          assists: c.assists ?? null,
          appearances: c.appearances ?? null,
          minutes: c.minutes ?? null,
          yellowCards: c.yellowCards ?? null,
          redCards: c.redCards ?? null,
          rating: c.rating ?? null,
        }))
      : [],
  };
}

const WORLD_CUP_COMP_RE = /(fifa\s*)?world\s*cup|كأس\s*العالم|كاس\s*العالم|مونديال/i;
const WORLD_CUP_EXCLUDE_RE =
  /club|أندية|انديه|u-?\d|تحت\s*\d|youth|شباب|ناشئ|qualif|تصفيات|women|سيدات|beach|شاطئ|futsal|صالات|intercontinental/i;

/**
 * Sum a player's FIFA World Cup goals from the 365 career competition rows
 * (across all seasons). Excludes qualifiers, youth, club, women, beach/futsal.
 * Returns null when no genuine World Cup row is present (never invents).
 */
function aggregateWorldCup365(seasons: any[]): {
  source: string;
  total: number;
  apps: number;
  editions: Array<{ season: string | null; team: string | null; goals: number; apps: number }>;
} | null {
  const editions: Array<{ season: string | null; team: string | null; goals: number; apps: number }> = [];
  for (const s of seasons ?? []) {
    for (const c of s?.competitions ?? []) {
      const name = String(c?.competitionName ?? '');
      if (!WORLD_CUP_COMP_RE.test(name) || WORLD_CUP_EXCLUDE_RE.test(name)) continue;
      const goals = Number(c?.goals ?? 0) || 0;
      const apps = Number(c?.appearances ?? 0) || 0;
      if (goals === 0 && apps === 0) continue;
      editions.push({
        season: s?.label ?? s?.seasonKey ?? null,
        team: cleanClubName(c?.teamName),
        goals,
        apps,
      });
    }
  }
  if (!editions.length) return null;
  return {
    source: '365scores',
    total: editions.reduce((a, e) => a + e.goals, 0),
    apps: editions.reduce((a, e) => a + e.apps, 0),
    editions,
  };
}

/**
 * Same 365 profile/career bundle the in-app player profile uses.
 * Profile-first payload so the agent answers from live data, not memory.
 */
function build365ProfilePayload(
  player: any,
  rawName: string,
  resolvedAs: string,
  opts?: { includeApiFbWc?: boolean; apiFb?: Awaited<ReturnType<typeof enrichApiFootballTrophies>> },
) {
  const info = player.info as any;
  const career = player.career as any;
  const profile = career?.profile ?? {};
  const seasons: any[] = Array.isArray(career?.seasons) ? career.seasons : [];
  const season = seasons[0] ?? null;
  const seasonStats = buildSeasonStats(season);
  const worldCupGoals = aggregateWorldCup365(seasons);
  const club =
    seasonStats?.competitions?.[0]?.teamName ||
    cleanClubName(profile.clubName) ||
    cleanClubName(info?.clubName) ||
    cleanClubName(player.clubName);
  const trophySummary = summarizeTrophies(career?.trophies ?? []);
  const wcCount =
    opts?.apiFb?.fifaWorldCupCount ??
    trophySummary.fifaWorldCup[0]?.count ??
    0;
  const uclCount = trophySummary.championsLeague[0]?.count ?? 0;

  const quickFacts = {
    currentClub: club,
    age: profile.age ?? info?.age ?? null,
    position: profile.position ?? info?.positionName ?? info?.position ?? null,
    nationality: profile.nationality ?? info?.nationalityName ?? info?.nationality ?? null,
    jerseyNumber: profile.jerseyNumber ?? null,
    latestSeasonLine: seasonStats
      ? `${seasonStats.label}: ${seasonStats.goals}G / ${seasonStats.assists}A / ${seasonStats.appearances} apps`
      : null,
    worldCupTitles: wcCount,
    championsLeagueTitles: uclCount,
  };

  const nextGame = info?.nextGame
    ? {
        competition: info.nextGame.competitionName ?? info.nextGame.competition ?? null,
        home: info.nextGame.homeCompetitorName ?? info.nextGame.home ?? null,
        away: info.nextGame.awayCompetitorName ?? info.nextGame.away ?? null,
        kickoff: info.nextGame.startTime ?? info.nextGame.kickoff ?? null,
      }
    : null;

  return {
    source: '365scores_profile',
    query: rawName,
    resolvedAs,
    athleteId: player.athleteId,
    name: player.name || profile.name || player.shortName,
    club,
    clubRaw: cleanClubName(profile.clubName ?? player.clubName),
    quickFacts,
    profile: {
      age: quickFacts.age,
      position: quickFacts.position,
      nationality: quickFacts.nationality,
      jerseyNumber: quickFacts.jerseyNumber,
      imageUrl: profile.imageUrl ?? player.imageUrl ?? null,
    },
    seasonStats,
    currentSeasonHighlights: compactHighlights(career?.currentSeasonHighlights),
    recentSeasons: seasons.slice(0, 6).map((s: any) => ({
      label: s.label,
      seasonKey: s.seasonKey,
      goals: s.goals,
      assists: s.assists,
      appearances: s.appearances,
      minutes: s.minutes ?? null,
      clubs: Array.from(
        new Set(
          (s.competitions ?? [])
            .map((c: any) => cleanClubName(c.teamName))
            .filter(Boolean),
        ),
      ).slice(0, 3),
    })),
    trend: Array.isArray(career?.trend) ? career.trend.slice(0, 6) : [],
    ...trophySummary,
    apiFootballWorldCup: opts?.apiFb
      ? { count: opts.apiFb.fifaWorldCupCount, wins: opts.apiFb.fifaWorldCupWins }
      : null,
    worldCupGoals,
    nextGame,
    answerHint: seasonStats
      ? `Latest season ${seasonStats.label}: ${seasonStats.goals} goals, ${seasonStats.assists} assists, ${seasonStats.appearances} apps at ${club ?? '—'}.`
      : `Current club: ${club ?? 'unknown'}.`,
    answerRules:
      'STRICT: Use ONLY the numbers/club in this payload (quickFacts / seasonStats / trophies). The current club is `club` / quickFacts.currentClub — state it EXACTLY as written and never name an old or remembered club. Trophy counts come only from quickFacts.worldCupTitles / quickFacts.championsLeagueTitles (if a count is 1 say 1, if 0 say 0). If worldCupTitles>=1 the player HAS won it — never say "hasn\'t won" or reason from his age. For World Cup GOALS use worldCupGoals.total ONLY; if worldCupGoals is null say you have no confirmed World Cup goal data for this player (do NOT guess a number). NEVER add a World Cup/Champions League year, national team, club, or tournament edition that is not explicitly listed here (only apiFootballWorldCup.wins may contain years). Do NOT add historical narrative. Do NOT say data is missing when seasonStats or quickFacts.latestSeasonLine is present.',
  };
}

function summarizeTrophies(trophies: Array<{ name?: string; displayName?: string; count?: number }>) {
  const list = (trophies ?? []).map((t) => ({
    name: t.displayName ?? t.name ?? '—',
    count: t.count ?? 1,
  }));
  const fifaWorldCup = list.filter(
    (t) =>
      /fifa\s*world\s*cup|^world\s*cup|كأس\s*العالم/i.test(t.name) &&
      !/club|u20|u-20|تحت|youth|أندية|انديه/i.test(t.name),
  );
  const championsLeague = list.filter((t) =>
    /uefa\s*champions|دوري\s*أبطال\s*اوروبا|دوري\s*ابطال\s*اوروبا|شامبيونز/i.test(t.name),
  );
  const cafChampions = list.filter((t) =>
    /caf\s*champions|أبطال\s*أفريقيا|ابطال\s*افريقيا|دوري\s*أبطال\s*أفريقيا/i.test(t.name),
  );
  return { trophies: list.slice(0, 20), fifaWorldCup, championsLeague, cafChampions };
}

async function enrichApiFootballTrophies(playerName: string, existingAthleteId?: number) {
  if (!footballService.isConfigured()) return null;
  try {
    const row = await fetchPlayerStatsRow(playerName);
    const apiPlayerId = row?.apiPlayerId;
    if (!apiPlayerId) return null;
    const trophies = await footballService.getPlayerTrophies(apiPlayerId);
    const rows = (trophies ?? []).map((t: any) => ({
      league: String(t.league ?? t.name ?? '—'),
      country: t.country ?? null,
      season: t.season ?? null,
      place: t.place ?? null,
    }));
    const worldCupWins = rows.filter(
      (t) =>
        /world\s*cup|كأس\s*العالم/i.test(t.league) &&
        !/club|u20|under-?20|youth/i.test(t.league) &&
        /winner|بطل|champion/i.test(String(t.place ?? '')),
    );
    return {
      apiPlayerId,
      athleteIdHint: existingAthleteId ?? null,
      trophyRows: rows.slice(0, 40),
      fifaWorldCupWins: worldCupWins,
      fifaWorldCupCount: worldCupWins.length,
    };
  } catch (err) {
    logger.warn('[chat-agent] API-FB trophies failed:', (err as Error)?.message);
    return null;
  }
}

interface PlayerCandidate {
  athleteId: number;
  name: string;
  shortName?: string;
  clubName?: string | null;
}

interface Best365Resolution {
  best: PlayerCandidate | null;
  bestScore: number;
  /** High confidence — answer directly from this player. */
  confident: boolean;
  /** Medium confidence with rivals — ask the user to confirm ("قصدك ...؟"). */
  ambiguous: boolean;
  /** Top few real 365 hits for a "did you mean" prompt (never invented). */
  suggestions: Array<{ athleteId: number; name: string; club: string | null }>;
}

/** Fold Arabic orthographic variants so 365 search matches typos/spelling. */
const normalizeArabicQuery = foldArabic;

const PLAYER_CONFIDENT_SCORE = 0.82;
const PLAYER_AMBIGUOUS_SCORE = 0.5;

/**
 * Resolve the best 365Scores athlete for a (possibly misspelled / medium-fame /
 * Arabic) name. Unlike the old `limit: 1` behavior, this normalizes the query,
 * pulls several candidates, and re-ranks them with the shared fuzzy matcher so
 * the correct player at rank 2+ is not dropped. Returns confidence + real
 * suggestions for a "did you mean" clarification.
 */
async function resolveBest365Player(
  rawName: string,
  language: MessageLanguage,
): Promise<Best365Resolution> {
  const empty: Best365Resolution = {
    best: null,
    bestScore: 0,
    confident: false,
    ambiguous: false,
    suggestions: [],
  };

  const mapping = await resolvePlayerName(rawName);
  const canonical =
    mapping?.english && mapping.resolvedBy && mapping.resolvedBy !== 'raw'
      ? mapping.english
      : null;
  const normalized = normalizeArabicQuery(rawName);
  const translit = containsArabicScript(rawName) ? transliterateArabicToLatin(rawName) : null;

  // Try the strongest queries first; stop at the first that yields hits.
  const queries = Array.from(
    new Set([canonical, normalized, rawName, translit].filter((q): q is string => !!q && q.length >= 2)),
  );

  let athletes: PlayerCandidate[] = [];
  for (const q of queries) {
    try {
      const search = await threeSixFiveScoresService.searchAthletes(q, language);
      if (search.data?.length) {
        athletes = search.data as PlayerCandidate[];
        break;
      }
    } catch (err) {
      logger.warn('[chat-agent] searchAthletes failed:', (err as Error)?.message);
    }
  }
  if (!athletes.length) return empty;

  const targetNames = Array.from(
    new Set(
      [normalizeName(normalized), normalizeName(rawName), canonical ? normalizeName(canonical) : '']
        .filter(Boolean),
    ),
  );

  const scored = athletes
    .map((a) => {
      let score = scorePlayerMatch(rawName, targetNames, { name: a.name, lastname: a.shortName });
      score = Math.max(score, scoreEntityNameMatch(rawName, a.name));
      score = Math.max(score, scoreEntityNameMatch(normalized, a.name));
      if (canonical) score = Math.max(score, scoreEntityNameMatch(canonical, a.name));
      if (a.shortName) score = Math.max(score, scoreEntityNameMatch(normalized, a.shortName));
      return { a, score };
    })
    .sort((x, y) => y.score - x.score);

  const best = scored[0];
  const gap = best.score - (scored[1]?.score ?? 0);
  const confident =
    best.score >= PLAYER_CONFIDENT_SCORE ||
    (best.score >= 0.6 && (scored.length === 1 || gap >= 0.2));
  const ambiguous = !confident && best.score >= PLAYER_AMBIGUOUS_SCORE;

  const suggestions = scored
    .filter((s) => s.score >= 0.4)
    .slice(0, 3)
    .map((s) => ({ athleteId: s.a.athleteId, name: s.a.name, club: s.a.clubName ?? null }));

  return { best: best.a, bestScore: best.score, confident, ambiguous, suggestions };
}

function buildSuggestionHint(
  suggestions: Array<{ name: string; club: string | null }>,
  language: MessageLanguage,
): string {
  const names = suggestions
    .map((s) => (s.club ? `${s.name} (${s.club})` : s.name))
    .join(language === 'en' ? ' or ' : ' ولا ');
  return language === 'en'
    ? `Not sure who is meant. Ask the user to confirm: did you mean ${names}? Do NOT invent a player or stats.`
    : `مش متأكد تقصد مين بالظبط. اسأل المستخدم للتأكيد: قصدك ${names}؟ وممنوع تخترع لاعب أو أرقام.`;
}

async function toolSearchPlayer(args: Record<string, unknown>, language: MessageLanguage) {
  const rawName = String(args.player_name ?? '').trim();
  if (rawName.length < 2) return { error: 'player_name required' };

  const resolution = await resolveBest365Player(rawName, language);

  if (resolution.confident && resolution.best) {
    try {
      const from365 = await footballDataCacheService.lookup365Player(resolution.best.name, language, {
        athleteId: resolution.best.athleteId,
        includeInfo: true,
        includeCareer: true,
      });
      const player = from365.data?.players?.[0];
      if (player) {
        const apiFb = await enrichApiFootballTrophies(resolution.best.name, player.athleteId);
        return build365ProfilePayload(player, rawName, resolution.best.name, {
          includeApiFbWc: true,
          apiFb,
        });
      }
    } catch (err) {
      logger.warn('[chat-agent] search_player 365 failed:', (err as Error)?.message);
    }
  }

  // Medium confidence with rivals → let the agent confirm instead of guessing.
  if (resolution.ambiguous && resolution.suggestions.length) {
    return {
      status: 'need_clarification',
      query: rawName,
      suggestions: resolution.suggestions,
      answerHint: buildSuggestionHint(resolution.suggestions, language),
    };
  }

  // Low/no 365 match → API-Football fallback (handles its own transliteration).
  const fallbackName = resolution.best?.name ?? (normalizeArabicQuery(rawName) || rawName);
  const row = await fetchPlayerStatsRow(fallbackName);
  if (!row) {
    return {
      error: 'player_not_found',
      query: rawName,
      resolvedAs: fallbackName,
      suggestions: resolution.suggestions,
      answerHint: resolution.suggestions.length
        ? buildSuggestionHint(resolution.suggestions, language)
        : language === 'en'
          ? 'No reliable match found. Ask the user for the full name or the club, and do NOT invent data.'
          : 'مفيش نتيجة موثوقة. اطلب من المستخدم الاسم الكامل أو النادي، وممنوع تخترع بيانات.',
    };
  }
  const apiFb = row.apiPlayerId ? await enrichApiFootballTrophies(fallbackName) : null;
  return {
    source: 'api-football',
    query: rawName,
    resolvedAs: fallbackName,
    apiPlayerId: row.apiPlayerId ?? null,
    summary: row.aiResponse,
    aliases: row.aliases ?? [],
    apiFootballWorldCup: apiFb
      ? { count: apiFb.fifaWorldCupCount, wins: apiFb.fifaWorldCupWins }
      : null,
  };
}

/** Filter a day's fixtures down to a league (id first, then name/country tokens). */
function filterFixturesByLeague(
  fixtures: any[],
  league: { id: number; label: string } | null,
  leagueText: string,
): any[] {
  if (league) {
    const byId = fixtures.filter((f: any) => f?.league?.id === league.id);
    if (byId.length) return byId;
    return fixtures.filter((f: any) => {
      const name = String(f?.league?.name ?? '').toLowerCase();
      const country = String(f?.league?.country ?? '').toLowerCase();
      const blob = `${name} ${country}`;
      // Prefer country/label tokens — never match a generic first word like "Division".
      if (league.id === 344) return /bolivia|boliv|بوليفي/i.test(blob);
      if (league.id === 12) return /caf|africa|أفريق|افريق/i.test(blob);
      const tokens = league.label
        .toLowerCase()
        .split(/[\s\-–,]+/)
        .filter((t) => t.length >= 4 && !/^(division|league|profesional|professional)$/i.test(t));
      return tokens.some((t) => blob.includes(t));
    });
  }
  if (leagueText) {
    const needle = leagueText.toLowerCase();
    return fixtures.filter((f: any) => {
      const name = String(f?.league?.name ?? '').toLowerCase();
      const country = String(f?.league?.country ?? '').toLowerCase();
      return (
        name.includes(needle) ||
        country.includes(needle) ||
        (/بوليفي|bolivia/i.test(leagueText) && /bolivia|boliv/i.test(`${name} ${country}`)) ||
        (/افريق|أفريق|africa|caf/i.test(leagueText) && /caf|africa|أفريق/i.test(`${name} ${country}`))
      );
    });
  }
  return fixtures;
}

/** Bucket fixtures (importance-ranked) into live / finished / upcoming, capped. */
function groupFixturesByStatus(fixtures: any[], perBucket = 15) {
  const ranked = [...fixtures]
    .map((f) => ({ f, score: scoreFixtureImportance(f) }))
    .sort((a, b) => b.score - a.score);

  const live: any[] = [];
  const finished: any[] = [];
  const upcoming: any[] = [];
  for (const { f } of ranked) {
    const cf = compactFixture(f);
    const st = String(cf.status ?? '');
    if (LIVE_STATUSES.has(st)) {
      if (live.length < perBucket) live.push(cf);
    } else if (FINISHED_STATUSES.has(st)) {
      if (finished.length < perBucket) finished.push(cf);
    } else if (upcoming.length < perBucket) {
      upcoming.push(cf);
    }
  }
  // Show today's upcoming in kickoff order (nicer "later today" list).
  upcoming.sort((a, b) => String(a.kickoff ?? '').localeCompare(String(b.kickoff ?? '')));
  return { live, finished, upcoming };
}

function buildMatchesAnswerHint(grouped: {
  live: any[];
  finished: any[];
  upcoming: any[];
}): string {
  return (
    `Render a friendly reply: first any LIVE matches (bold minute + score), then FINISHED (final score), ` +
    `then UPCOMING (kickoff time). Use a compact Markdown table when there are 3+ rows. ` +
    `live=${grouped.live.length}, finished=${grouped.finished.length}, upcoming=${grouped.upcoming.length}. ` +
    `Use ONLY these fixtures/scores/minutes — never invent a match, score, or time.`
  );
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map((n) => parseInt(n, 10));
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Most important fixtures over the next few days (ranked, optionally league-filtered). */
async function toolUpcomingMatches(
  league: { id: number; label: string } | null,
  leagueText: string,
) {
  const today = localDateKey();
  const HORIZON_DAYS = league ? 10 : 4;
  const collected: any[] = [];
  for (let i = 0; i <= HORIZON_DAYS; i += 1) {
    const dateKey = addDaysToDateKey(today, i);
    let dayFixtures: any[] = [];
    try {
      dayFixtures = await footballDataCacheService.getMatchesByDate(dateKey);
    } catch (err) {
      logger.warn('[chat-agent] upcoming getMatchesByDate failed:', (err as Error)?.message);
      continue;
    }
    const pool = filterFixturesByLeague(dayFixtures, league, leagueText);
    for (const f of pool) {
      const st = String(f?.fixture?.status?.short ?? '');
      // Only genuinely upcoming (not yet started / not finished).
      if (LIVE_STATUSES.has(st) || FINISHED_STATUSES.has(st)) continue;
      collected.push(f);
    }
    if (!league && collected.length >= 40) break;
  }

  const top = collected
    .map((f) => ({ f, score: scoreFixtureImportance(f) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return String(a.f?.fixture?.date ?? '').localeCompare(String(b.f?.fixture?.date ?? ''));
    })
    .slice(0, league ? 15 : 12)
    .map((r) => compactFixture(r.f));

  return {
    when: 'upcoming' as const,
    from: today,
    horizonDays: HORIZON_DAYS,
    leagueFilter: league ? { id: league.id, label: league.label, query: leagueText } : null,
    count: top.length,
    matches: top,
    upcoming: top,
    answerHint:
      `These are the most important UPCOMING fixtures (next ${HORIZON_DAYS} days), ranked by importance then kickoff. ` +
      `Lead with the biggest one, list the rest as short bullets or a compact table with kickoff times. ` +
      `Use ONLY these fixtures/times — never invent a match or date.`,
    note: top.length
      ? undefined
      : league
        ? `No upcoming fixtures found for ${league.label} in the next ${HORIZON_DAYS} days.`
        : 'No upcoming fixtures found.',
  };
}

async function toolTodayMatches(args: Record<string, unknown> = {}) {
  const leagueText = String(args.league ?? '').trim();
  const league = leagueText ? detectLeague(leagueText) : null;
  const when = String(args.when ?? 'today').toLowerCase() === 'upcoming' ? 'upcoming' : 'today';

  if (when === 'upcoming') {
    return toolUpcomingMatches(league, leagueText);
  }

  const date = localDateKey();
  const fixtures = await footballDataCacheService.getMatchesByDate(date);
  if (!fixtures.length) {
    return { date, when, matches: [], live: [], finished: [], upcoming: [], note: 'No fixtures scheduled today' };
  }

  const pool = filterFixturesByLeague(fixtures, league, leagueText);
  const grouped = groupFixturesByStatus(pool, league ? 20 : 12);
  const matches = [...grouped.live, ...grouped.upcoming, ...grouped.finished];

  return {
    date,
    when,
    leagueFilter: league ? { id: league.id, label: league.label, query: leagueText } : null,
    totalToday: fixtures.length,
    matchedInLeague: league ? pool.length : undefined,
    live: grouped.live,
    finished: grouped.finished,
    upcoming: grouped.upcoming,
    matches,
    answerHint: buildMatchesAnswerHint(grouped),
    note: league
      ? pool.length
        ? `Showing ${matches.length} of ${pool.length} matches in ${league.label} today (live ${grouped.live.length} / finished ${grouped.finished.length} / upcoming ${grouped.upcoming.length}).`
        : `No matches found for ${league.label} today.`
      : fixtures.length > matches.length
        ? `Showing top ${matches.length} of ${fixtures.length}. User can open Matches tab for the rest.`
        : undefined,
  };
}

async function toolLiveMatches(language: MessageLanguage) {
  const { fixtures } = await resolveLiveFixturesForClient(language);
  let list = fixtures;
  if (!list.length && footballService.isConfigured()) {
    list = await footballService.getLiveFixtures();
  }
  return {
    count: list.length,
    matches: list.slice(0, 15).map(compactFixture),
    note: list.length === 0 ? 'No live matches right now' : undefined,
  };
}

function teamNamesMatch(a: string, b: string): boolean {
  const na = a.trim().toLowerCase();
  const nb = b.trim().toLowerCase();
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

async function toolResolveMatch(args: Record<string, unknown>) {
  const teamName = String(args.team_name ?? '').trim();
  const homeTeam = String(args.home_team ?? '').trim();
  const awayTeam = String(args.away_team ?? '').trim();
  const query = teamName || homeTeam || awayTeam;
  if (!query) return { error: 'team_name or home/away required' };

  const resolved = await resolveTeamId(query, { allowSearch: true });
  if (!resolved) return { error: 'team_not_found', query };

  const pack = await footballDataCacheService.getTeamMatches(resolved.apiTeamId, 8);
  const candidates = [
    ...pack.live.map((f) => ({ f, rank: 3 })),
    ...pack.upcoming.map((f) => ({ f, rank: 2 })),
    ...pack.finished.map((f) => ({ f, rank: 1 })),
  ];

  let best = candidates[0]?.f ?? null;
  if (homeTeam && awayTeam) {
    const both = candidates.find(({ f }) => {
      const h = f?.teams?.home?.name ?? '';
      const a = f?.teams?.away?.name ?? '';
      return (
        (teamNamesMatch(h, homeTeam) && teamNamesMatch(a, awayTeam)) ||
        (teamNamesMatch(h, awayTeam) && teamNamesMatch(a, homeTeam))
      );
    });
    if (both) best = both.f;
  }

  if (!best) {
    const today = await footballDataCacheService.getMatchesByDate(localDateKey());
    const hit = today.find((f) => {
      const h = f?.teams?.home?.name ?? '';
      const a = f?.teams?.away?.name ?? '';
      return (
        teamNamesMatch(h, resolved.englishName) ||
        teamNamesMatch(a, resolved.englishName) ||
        teamNamesMatch(h, query) ||
        teamNamesMatch(a, query)
      );
    });
    best = hit ?? null;
  }

  if (!best) return { error: 'match_not_found', team: resolved.englishName, teamId: resolved.apiTeamId };
  return {
    team: resolved.englishName,
    teamId: resolved.apiTeamId,
    match: compactFixture(best),
  };
}

async function toolMatchDetails(args: Record<string, unknown>, language: MessageLanguage) {
  const fixtureId = Number(args.fixture_id);
  if (!Number.isFinite(fixtureId)) return { error: 'fixture_id required' };
  const bundle = await footballDataCacheService.getFixtureDetailsBundle(fixtureId, {
    language,
    forceRefresh: true,
  });
  if (!bundle.fixture) return { error: 'fixture_not_found', fixtureId };
  return {
    match: compactFixture(bundle.fixture),
    events: compactEvents(bundle.events),
    lineups: compactLineups(bundle.lineups),
    lineupsAvailable: bundle.lineupsAvailable ?? false,
    stats: (bundle.statistics ?? []).slice(0, 2).map((s: any) => ({
      team: s?.team?.name,
      statistics: (s?.statistics ?? []).slice(0, 12),
    })),
  };
}

async function toolMatchLineup(args: Record<string, unknown>, language: MessageLanguage) {
  const fixtureId = Number(args.fixture_id);
  if (!Number.isFinite(fixtureId)) return { error: 'fixture_id required' };
  const lineups = await footballDataCacheService.getMatchLineups(fixtureId, { language });
  if (!lineups?.length) return { error: 'lineups_unavailable', fixtureId };
  return { fixtureId, lineups: compactLineups(lineups) };
}

async function toolStandings(args: Record<string, unknown>) {
  const leagueText = String(args.league ?? '').trim();
  if (!leagueText) return { error: 'league required' };
  const league = detectLeague(leagueText);
  if (!league) return { error: 'league_not_recognized', league: leagueText };
  const season = Number(args.season) || resolveFootballSeason();
  const { flat } = await footballDataCacheService.getStandingsParsed(league.id, season);
  const top = (flat ?? []).slice(0, 10).map((row: any, i: number) => ({
    rank: row.rank ?? i + 1,
    team: row.team?.name ?? null,
    played: row.all?.played ?? null,
    points: row.points ?? null,
    gd: row.goalsDiff ?? null,
  }));
  return { league: league.label, season, standings: top };
}

async function toolTopScorers(args: Record<string, unknown>) {
  const leagueText = String(args.league ?? '').trim();
  if (!leagueText) return { error: 'league required' };
  const league = detectLeague(leagueText);
  if (!league) return { error: 'league_not_recognized', league: leagueText };
  const season = Number(args.season) || resolveFootballSeason();
  const scorers = await footballDataCacheService.getTopScorers(league.id, season);
  return {
    league: league.label,
    season,
    topScorers: (scorers ?? []).slice(0, 10).map((p: any, i: number) => {
      const st = p.statistics?.[0] ?? {};
      return {
        rank: i + 1,
        player: p.player?.name ?? null,
        team: st.team?.name ?? null,
        goals: st.goals?.total ?? 0,
        assists: st.goals?.assists ?? 0,
      };
    }),
  };
}

async function toolTeamInfo(args: Record<string, unknown>) {
  const teamName = String(args.team_name ?? '').trim();
  if (!teamName) return { error: 'team_name required' };
  const dossier = await fetchTeamDossierContext(teamName, { allowSearch: true });
  if (!dossier) return { error: 'team_not_found', teamName };

  let trophies: Array<{ league?: string; country?: string; season?: string; place?: string }> = [];
  let cafChampionsWins: typeof trophies = [];
  try {
    trophies = (await footballDataCacheService.getTeamTrophies(dossier.apiTeamId)) ?? [];
    cafChampionsWins = trophies.filter(
      (t) =>
        /caf\s*champions|أبطال\s*أفريقيا|ابطال\s*افريقيا|african\s*champions/i.test(
          String(t.league ?? ''),
        ) && /winner|بطل|champion/i.test(String(t.place ?? '')),
    );
  } catch (err) {
    logger.warn('[chat-agent] team trophies failed:', (err as Error)?.message);
  }

  // Curated fallback when API-Football trophies are unavailable (e.g. suspended).
  const CURATED_CAF_CL: Record<number, { wins: number; note: string }> = {
    1015: {
      wins: 12,
      note: 'Al Ahly record CAF Champions League titles (through 2024). 2025 Pyramids, 2026 Sundowns.',
    },
    1016: {
      wins: 5,
      note: 'Zamalek CAF Champions League titles (through 2002).',
    },
  };
  const curated = CURATED_CAF_CL[dossier.apiTeamId];
  const cafCount = cafChampionsWins.length > 0 ? cafChampionsWins.length : curated?.wins ?? null;

  const coachName = dossier.coach?.name ?? null;

  return {
    teamId: dossier.apiTeamId,
    teamName: teamName,
    source: dossier.source,
    summary: dossier.block,
    coach: coachName,
    coachNationality: dossier.coach?.nationality ?? null,
    cafChampionsLeagueWins: cafCount,
    cafChampionsLeagueSeasons: cafChampionsWins.map((t) => t.season).filter(Boolean).slice(0, 20),
    cafSource: cafChampionsWins.length > 0 ? 'api-football' : curated ? 'curated' : null,
    quickFacts: {
      ...(cafCount != null ? { cafChampionsLeagueWins: cafCount } : {}),
      ...(coachName ? { coach: coachName } : {}),
    },
    answerHint: [
      coachName
        ? `The current head coach is exactly "${coachName}" — use this name; do not name a former or remembered coach.`
        : 'Head coach unavailable — say it is unavailable; do not invent a name.',
      cafCount != null
        ? `African Champions League titles = exactly ${cafCount}. Do not invent another number.`
        : 'CAF title count unavailable — do not invent a number.',
    ].join(' '),
    note:
      cafCount != null
        ? `For African Champions League titles use cafChampionsLeagueWins=${cafCount} (${cafChampionsWins.length > 0 ? 'API winners' : curated?.note}).`
        : 'CAF title count unavailable — do not invent a number.',
  };
}

async function toolPlayerCareer(args: Record<string, unknown>, language: MessageLanguage) {
  const rawName = String(args.player_name ?? '').trim();
  if (!rawName) return { error: 'player_name required' };

  const resolution = await resolveBest365Player(rawName, language);

  // Medium confidence with rivals → confirm before answering trophies/career.
  if (!resolution.confident && resolution.ambiguous && resolution.suggestions.length) {
    return {
      status: 'need_clarification',
      query: rawName,
      suggestions: resolution.suggestions,
      answerHint: buildSuggestionHint(resolution.suggestions, language),
    };
  }

  const name = resolution.best?.name ?? (normalizeArabicQuery(rawName) || rawName);

  const from365 =
    resolution.confident && resolution.best
      ? await footballDataCacheService.lookup365Player(name, language, {
          athleteId: resolution.best.athleteId,
          includeInfo: true,
          includeCareer: true,
        })
      : await footballDataCacheService.lookup365Player(name, language, {
          limit: 1,
          includeInfo: true,
          includeCareer: true,
        });
  const player = from365.data?.players?.[0];
  const apiFb = await enrichApiFootballTrophies(name, player?.athleteId);
  const dossier = await fetchPlayerUclCareerDossier(name, language);

  if (!player && !dossier && !apiFb) {
    return {
      error: 'player_not_found',
      query: rawName,
      resolvedAs: name,
      suggestions: resolution.suggestions,
      answerHint: resolution.suggestions.length
        ? buildSuggestionHint(resolution.suggestions, language)
        : undefined,
    };
  }

  if (player) {
    const profile = build365ProfilePayload(player, rawName, name, {
      includeApiFbWc: true,
      apiFb,
    });
    // World Cup goals: prefer 365 aggregation; fall back to API-Football editions.
    let worldCupGoals = profile.worldCupGoals as unknown;
    if (!worldCupGoals) {
      worldCupGoals = (await fetchPlayerWorldCupGoals(name)) ?? null;
    }
    return {
      ...profile,
      worldCupGoals,
      uclSummary: dossier ?? null,
      guidance:
        'Authoritative 365 profile+career (same as app player profile). For FIFA World Cup TITLES prefer apiFootballWorldCup.wins when present else fifaWorldCup/quickFacts.worldCupTitles. For World Cup GOALS use worldCupGoals.total ONLY (null = no confirmed data; do NOT guess). For UCL use championsLeague/quickFacts.championsLeagueTitles. State the current club exactly as `club`/quickFacts.currentClub. If a trophy count is >=1 the player HAS won it (never say "hasn\'t won" or reason from age); if 1 say 1. NEVER invent or add title years, national teams, clubs, or tournament editions that are not explicitly present here.',
    };
  }

  return {
    source: dossier ? 'ucl_dossier' : 'api-football',
    query: rawName,
    resolvedAs: name,
    name,
    club: null,
    trophies: [],
    fifaWorldCup: [],
    championsLeague: [],
    cafChampions: [],
    apiFootballWorldCup: apiFb
      ? { count: apiFb.fifaWorldCupCount, wins: apiFb.fifaWorldCupWins }
      : null,
    uclSummary: dossier ?? null,
    guidance:
      'For FIFA World Cup: prefer apiFootballWorldCup.wins when present. Do NOT invent extra titles.',
  };
}

async function toolPlayerMatchReport(args: Record<string, unknown>, language: MessageLanguage) {
  const athleteId = Number(args.athlete_id);
  const fixtureId = Number(args.fixture_id);
  if (!Number.isFinite(athleteId) || !Number.isFinite(fixtureId)) {
    return { error: 'athlete_id and fixture_id required' };
  }
  const gameId = await ensureScores365GameMapping(fixtureId);
  if (!gameId) return { error: 'scores365_game_not_mapped', fixtureId };
  const report = await threeSixFiveScoresService.getPlayerMatchReport(athleteId, gameId, language);
  if (!report.data) return { error: 'report_unavailable', athleteId, fixtureId, gameId };
  return { fixtureId, gameId, athleteId, report: report.data };
}

async function toolHeadToHead(args: Record<string, unknown>, language: MessageLanguage) {
  const fixtureId = Number(args.fixture_id);
  if (!Number.isFinite(fixtureId)) return { error: 'fixture_id required' };
  const gameId = await ensureScores365GameMapping(fixtureId);
  if (!gameId) return { error: 'scores365_game_not_mapped', fixtureId };
  const h2h = await threeSixFiveScoresService.getHeadToHeadForm(gameId, language);
  if (!h2h?.data) return { error: 'h2h_unavailable', fixtureId, gameId };
  return { fixtureId, gameId, headToHead: h2h.data };
}

export async function executeAgentTool(
  name: string,
  argsJson: string,
  opts: { language: MessageLanguage },
): Promise<string> {
  let args: Record<string, unknown> = {};
  try {
    args = argsJson ? (JSON.parse(argsJson) as Record<string, unknown>) : {};
  } catch {
    return jsonCap({ error: 'invalid_tool_arguments', raw: argsJson.slice(0, 200) });
  }

  try {
    let result: unknown;
    switch (name) {
      case 'search_player':
        result = await toolSearchPlayer(args, opts.language);
        break;
      case 'get_today_matches':
        result = await toolTodayMatches(args);
        break;
      case 'get_live_matches':
        result = await toolLiveMatches(opts.language);
        break;
      case 'resolve_match':
        result = await toolResolveMatch(args);
        break;
      case 'get_match_details':
        result = await toolMatchDetails(args, opts.language);
        break;
      case 'get_match_lineup':
        result = await toolMatchLineup(args, opts.language);
        break;
      case 'get_standings':
        result = await toolStandings(args);
        break;
      case 'get_top_scorers':
        result = await toolTopScorers(args);
        break;
      case 'get_team_info':
        result = await toolTeamInfo(args);
        break;
      case 'get_player_career':
        result = await toolPlayerCareer(args, opts.language);
        break;
      case 'get_player_match_report':
        result = await toolPlayerMatchReport(args, opts.language);
        break;
      case 'get_head_to_head':
        result = await toolHeadToHead(args, opts.language);
        break;
      default:
        result = { error: 'unknown_tool', name };
    }
    return jsonCap(result);
  } catch (err) {
    logger.warn(`[chat-agent] tool ${name} failed:`, (err as Error)?.message ?? err);
    return jsonCap({ error: 'tool_execution_failed', name, message: (err as Error)?.message });
  }
}

export function isChatAgentConfigured(): boolean {
  const enabled = (process.env.CHAT_AGENT_ENABLED ?? 'true').trim().toLowerCase();
  if (enabled === 'false' || enabled === '0' || enabled === 'off') return false;
  const key = process.env.OPENROUTER_API_KEY ?? process.env.AI_API_KEY ?? '';
  return key.length > 0;
}

export function resolveAgentModel(): string {
  return (
    process.env.OPENROUTER_AGENT_MODEL ??
    process.env.OPENROUTER_CHAT_MODEL ??
    'qwen/qwen3.7-flash'
  );
}
