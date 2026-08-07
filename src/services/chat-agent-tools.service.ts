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
} from './chat-football-tools.service';
import { ensureScores365GameMapping } from './scores365-experiment.service';
import { threeSixFiveScoresService } from './threeSixFiveScores.service';

const LIVE_STATUSES = new Set(['1H', '2H', 'HT', 'ET', 'P', 'LIVE', 'BT', 'INT', 'SUSP']);

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
        'Look up a football player by name (Arabic or English). Returns current club, age, nationality, and season stats. Use for any player question.',
      parameters: {
        type: 'object',
        properties: {
          player_name: {
            type: 'string',
            description: 'Player name as the user said it (e.g. مبابي, Mohamed Salah)',
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
        'List football matches scheduled for today (kickoff, status, score). Optionally filter by league name (e.g. Egyptian Premier League, Premier League, الدوري المصري). Use for "مباريات النهاردة" or league-specific today questions.',
      parameters: {
        type: 'object',
        properties: {
          league: {
            type: 'string',
            description:
              'Optional league filter in Arabic or English (e.g. الدوري المصري, Premier League, البريمير ليج)',
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
        'List matches currently being played live (minute + score). Use for "مين بيلعب دلوقتي" / live scores.',
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
      description: 'Team dossier: recent form, league position, coach, squad snapshot.',
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
        'Player trophies and career titles (World Cup, UCL, league titles) with counts. ALWAYS use this for questions like "كام كاس عالم" / how many titles / trophies / ألقاب.',
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

function jsonCap(value: unknown, maxChars = 6000): string {
  const raw = JSON.stringify(value);
  if (raw.length <= maxChars) return raw;
  return JSON.stringify({
    truncated: true,
    preview: raw.slice(0, maxChars - 80),
    note: 'Result truncated for size — ask a more specific follow-up if needed.',
  });
}

function summarizeTrophies(trophies: Array<{ name?: string; displayName?: string; count?: number }>) {
  const list = (trophies ?? []).map((t) => ({
    name: t.displayName ?? t.name ?? '—',
    count: t.count ?? 1,
  }));
  const worldCup = list.filter((t) =>
    /fifa\s*world\s*cup|^world\s*cup|كأس\s*العالم/i.test(t.name) &&
    !/club|u20|u-20|تحت|youth/i.test(t.name),
  );
  return { trophies: list.slice(0, 20), fifaWorldCup: worldCup };
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

async function toolSearchPlayer(args: Record<string, unknown>, language: MessageLanguage) {
  const name = String(args.player_name ?? '').trim();
  if (name.length < 2) return { error: 'player_name required' };

  try {
    const from365 = await footballDataCacheService.lookup365Player(name, language, {
      limit: 1,
      includeInfo: true,
      includeCareer: true,
    });
    const player = from365.data?.players?.[0];
    if (player) {
      const info = player.info as any;
      const career = player.career as any;
      const trophySummary = summarizeTrophies(career?.trophies ?? []);
      const apiFb = await enrichApiFootballTrophies(name, player.athleteId);
      return {
        source: '365scores',
        athleteId: player.athleteId,
        name: player.name || player.shortName,
        club: player.clubName ?? info?.clubName ?? null,
        nationality: info?.nationalityName ?? info?.nationality ?? null,
        age: info?.age ?? null,
        position: info?.positionName ?? info?.position ?? null,
        seasonStats: career?.currentSeason ?? career?.seasons?.[0] ?? null,
        ...trophySummary,
        apiFootballWorldCup: apiFb
          ? {
              count: apiFb.fifaWorldCupCount,
              wins: apiFb.fifaWorldCupWins,
            }
          : null,
        note: 'Use fifaWorldCup / apiFootballWorldCup for World Cup title questions. Prefer season-level wins when present.',
      };
    }
  } catch (err) {
    logger.warn('[chat-agent] search_player 365 failed:', (err as Error)?.message);
  }

  const row = await fetchPlayerStatsRow(name);
  if (!row) return { error: 'player_not_found', query: name };
  const apiFb = row.apiPlayerId
    ? await enrichApiFootballTrophies(name)
    : null;
  return {
    source: 'api-football',
    apiPlayerId: row.apiPlayerId ?? null,
    summary: row.aiResponse,
    aliases: row.aliases ?? [],
    apiFootballWorldCup: apiFb
      ? { count: apiFb.fifaWorldCupCount, wins: apiFb.fifaWorldCupWins }
      : null,
  };
}

async function toolTodayMatches(args: Record<string, unknown> = {}) {
  const date = localDateKey();
  const fixtures = await footballDataCacheService.getMatchesByDate(date);
  if (!fixtures.length) return { date, matches: [], note: 'No fixtures scheduled today' };

  const leagueText = String(args.league ?? '').trim();
  const league = leagueText ? detectLeague(leagueText) : null;

  let pool = fixtures;
  if (league) {
    pool = fixtures.filter((f: any) => f?.league?.id === league.id);
    if (!pool.length) {
      // Soft match on league name when id mapping misses
      const needle = league.label.toLowerCase();
      pool = fixtures.filter((f: any) =>
        String(f?.league?.name ?? '')
          .toLowerCase()
          .includes(needle.split(' ')[0] ?? needle),
      );
    }
  }

  const top = [...pool]
    .map((f) => ({ f, score: scoreFixtureImportance(f) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, league ? 20 : 12)
    .map((r) => compactFixture(r.f));

  return {
    date,
    leagueFilter: league ? { id: league.id, label: league.label, query: leagueText } : null,
    totalToday: fixtures.length,
    matchedInLeague: league ? pool.length : undefined,
    matches: top,
    note: league
      ? pool.length
        ? `Showing ${top.length} of ${pool.length} matches in ${league.label} today.`
        : `No matches found for ${league.label} today.`
      : fixtures.length > top.length
        ? `Showing top ${top.length} of ${fixtures.length}. User can open Matches tab for the rest.`
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
  return {
    teamId: dossier.apiTeamId,
    source: dossier.source,
    summary: dossier.block,
  };
}

async function toolPlayerCareer(args: Record<string, unknown>, language: MessageLanguage) {
  const name = String(args.player_name ?? '').trim();
  if (!name) return { error: 'player_name required' };

  const from365 = await footballDataCacheService.lookup365Player(name, language, {
    limit: 1,
    includeCareer: true,
  });
  const player = from365.data?.players?.[0];
  const trophySummary = player
    ? summarizeTrophies(((player.career as any)?.trophies ?? []) as any[])
    : { trophies: [], fifaWorldCup: [] };
  const apiFb = await enrichApiFootballTrophies(name, player?.athleteId);

  const dossier = await fetchPlayerUclCareerDossier(name, language);

  if (!player && !dossier && !apiFb) {
    return { error: 'player_not_found', query: name };
  }

  return {
    source: player ? '365scores+api' : dossier ? 'ucl_dossier' : 'api-football',
    athleteId: player?.athleteId ?? null,
    name: player?.name ?? name,
    club: player?.clubName ?? null,
    ...trophySummary,
    apiFootballWorldCup: apiFb
      ? { count: apiFb.fifaWorldCupCount, wins: apiFb.fifaWorldCupWins }
      : null,
    uclSummary: dossier ?? null,
    guidance:
      'For FIFA World Cup titles: prefer apiFootballWorldCup.wins (season+place) when present; else fifaWorldCup count from 365. Do NOT invent extra titles.',
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
