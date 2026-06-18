/**
 * 365Scores live experiment — single-match feed for all users.
 * Maps webws.365scores.com game payload → API-Football shapes the app already consumes.
 */

import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { matchCacheService } from './match-cache.service';
import type { FixtureFromAPI } from './match-cache.service';

const SCORES365_GAME_BASE = 'https://webws.365scores.com/web/game/';
const SCORES365_FIXTURES_BASE = 'https://webws.365scores.com/web/games/fixtures/';
const SCORES365_WEB_ORIGIN = 'https://webws.365scores.com';

interface Scores365GamePayload {
  ttl?: number;
  game?: Scores365Game;
}

interface Scores365FixturesPayload {
  ttl?: number;
  games?: Scores365Game[];
  paging?: {
    previousPage?: string;
    nextPage?: string;
  };
}

interface Scores365Game {
  id: number;
  sportId: number;
  competitionId: number;
  statusId: number;
  statusGroup: number;
  statusText?: string;
  shortStatusText?: string;
  startTime?: string;
  gameTime?: number;
  gameTimeDisplay?: string;
  competitionDisplayName?: string;
  roundName?: string;
  groupName?: string;
  homeCompetitor?: Scores365Competitor;
  awayCompetitor?: Scores365Competitor;
  events?: Scores365Event[];
  members?: Scores365Member[];
  venue?: { id?: number; name?: string; shortName?: string; capacity?: number };
  hasStats?: boolean;
}

interface Scores365Competitor {
  id: number;
  name: string;
  score?: number;
  lineups?: {
    status?: string;
    formation?: string;
    members?: Scores365LineupMember[];
  };
  color?: string;
  nameForURL?: string;
}

interface Scores365LineupMember {
  id: number;
  status: number;
  statusText?: string;
  competitorId?: number;
  formation?: { shortName?: string };
  yardFormation?: { line?: number; fieldPosition?: number };
}

interface Scores365Member {
  id: number;
  competitorId: number;
  name: string;
  shortName?: string;
  jerseyNumber?: number;
}

interface Scores365Event {
  competitorId: number;
  gameTime?: number;
  gameTimeDisplay?: string;
  playerId?: number;
  isMajor?: boolean;
  eventType?: { id: number; name?: string; subTypeName?: string };
}

export interface Scores365ExperimentConfig {
  enabled: boolean;
  gameId: number;
  fixtureId: number;
  leagueId: number;
  season: number;
}

let cachedGameByKey = new Map<string, { fetchedAt: number; game: Scores365Game | null }>();
/** Last successful payload per gameId — used when 365Scores fetch fails (no empty flash). */
let lastGoodGameById = new Map<number, Scores365Game>();
/** Coalesce concurrent upstream calls per game+lang. */
let inFlightGameFetch = new Map<string, Promise<Scores365Game | null>>();

let cachedFixturesByLang = new Map<number, { fetchedAt: number; games: Scores365Game[] }>();
let inFlightFixturesFetch = new Map<number, Promise<Scores365Game[]>>();

/** fixtureId → 365Scores gameId (built from fixtures list sync). */
const fixtureToGameId = new Map<number, number>();

let cachedWorldCupDbRows: {
  leagueId: number;
  season: number;
  fetchedAt: number;
  rows: Awaited<ReturnType<typeof prisma.cachedFixture.findMany>>;
} | null = null;

export function isScores365ExperimentEnabled(): boolean {
  const raw = process.env.SCORES365_EXPERIMENT_ENABLED?.trim();
  return raw === 'true' || raw === '1';
}

export function getScores365ExperimentConfig(): Scores365ExperimentConfig {
  const cfg = {
    enabled: isScores365ExperimentEnabled(),
    gameId: parseInt(process.env.SCORES365_EXPERIMENT_GAME_ID || '4627937', 10),
    fixtureId: parseInt(process.env.SCORES365_EXPERIMENT_FIXTURE_ID || '1489387', 10),
    leagueId: parseInt(process.env.WORLD_CUP_LEAGUE_ID || '1', 10),
    season: parseInt(process.env.WORLD_CUP_SEASON || '2026', 10),
  };
  if (cfg.enabled) {
    registerScores365FixtureMapping(cfg.fixtureId, cfg.gameId);
  }
  return cfg;
}

export function resolveScores365LangId(appLanguage?: string | null): number {
  const lang = (appLanguage || process.env.SCORES365_DEFAULT_LANG || 'ar').trim().toLowerCase();
  if (lang.startsWith('en')) {
    return parseInt(process.env.SCORES365_LANG_ID_EN || '1', 10);
  }
  return parseInt(process.env.SCORES365_LANG_ID_AR || process.env.SCORES365_LANG_ID || '27', 10);
}

export function getScores365CompetitionId(): number {
  return parseInt(process.env.SCORES365_COMPETITION_ID || '5930', 10);
}

export function registerScores365FixtureMapping(fixtureId: number, gameId: number): void {
  fixtureToGameId.set(fixtureId, gameId);
}

export function getScores365GameIdForFixture(fixtureId: number): number | null {
  const cfg = getScores365ExperimentConfig();
  if (fixtureId === cfg.fixtureId) return cfg.gameId;
  return fixtureToGameId.get(fixtureId) ?? null;
}

export function isScores365ExperimentFixture(fixtureId: number): boolean {
  if (!isScores365ExperimentEnabled()) return false;
  return getScores365GameIdForFixture(fixtureId) != null;
}

function scores365CommonParams(langId: number): string {
  const tz = encodeURIComponent(process.env.SCORES365_TIMEZONE || 'Africa/Cairo');
  const countryId = process.env.SCORES365_USER_COUNTRY_ID || '131';
  return `appTypeId=5&langId=${langId}&timezoneName=${tz}&userCountryId=${countryId}`;
}

function scores365GameUrl(gameId: number, langId: number): string {
  return `${SCORES365_GAME_BASE}?${scores365CommonParams(langId)}&gameId=${gameId}`;
}

function scores365FixturesUrl(langId: number): string {
  const competitionId = getScores365CompetitionId();
  return `${SCORES365_FIXTURES_BASE}?${scores365CommonParams(langId)}&competitions=${competitionId}&showOdds=true`;
}

function scores365FetchHeaders(): Record<string, string> {
  return {
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'ar,en;q=0.9',
    'User-Agent':
      process.env.SCORES365_USER_AGENT?.trim() ||
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    Referer: 'https://www.365scores.com/',
    Origin: 'https://www.365scores.com',
  };
}

function gameCacheKey(gameId: number, langId: number): string {
  return `${gameId}:${langId}`;
}

async function fetchScores365GameOnce(gameId: number, langId: number): Promise<Scores365Game | null> {
  const lastGood = lastGoodGameById.get(gameId) ?? null;
  try {
    const res = await fetch(scores365GameUrl(gameId, langId), {
      headers: scores365FetchHeaders(),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      logger.warn(`[Scores365Experiment] HTTP ${res.status} for game ${gameId}`);
      return lastGood;
    }
    const payload = (await res.json()) as Scores365GamePayload;
    const game = payload?.game ?? null;
    if (game) {
      lastGoodGameById.set(gameId, game);
      cachedGameByKey.set(gameCacheKey(gameId, langId), { fetchedAt: Date.now(), game });
      logger.debug(
        `[Scores365Experiment] game ${gameId}: ${game.homeCompetitor?.name} ${normalize365Score(game.homeCompetitor?.score)}-${normalize365Score(game.awayCompetitor?.score)} ${game.awayCompetitor?.name} (${game.gameTimeDisplay ?? game.statusText}) events=${game.events?.length ?? 0}`,
      );
    }
    return game ?? lastGood;
  } catch (err: any) {
    logger.warn(`[Scores365Experiment] fetch failed for game ${gameId}:`, err?.message);
    return lastGood;
  }
}

export async function fetchScores365GameById(
  gameId: number,
  options?: { force?: boolean; language?: string | null },
): Promise<Scores365Game | null> {
  if (!isScores365ExperimentEnabled()) return null;

  const langId = resolveScores365LangId(options?.language);
  const ttlMs = Math.max(3_000, parseInt(process.env.SCORES365_CACHE_MS || '5000', 10) || 5_000);
  const key = gameCacheKey(gameId, langId);
  const cached = cachedGameByKey.get(key);

  if (!options?.force && cached && Date.now() - cached.fetchedAt < ttlMs) {
    return cached.game ?? lastGoodGameById.get(gameId) ?? null;
  }

  const inFlight = inFlightGameFetch.get(key);
  if (inFlight) return inFlight;

  const promise = fetchScores365GameOnce(gameId, langId).finally(() => {
    inFlightGameFetch.delete(key);
  });
  inFlightGameFetch.set(key, promise);
  return promise;
}

/** Back-compat: default experiment gameId. */
export async function fetchScores365Game(
  force = false,
  language?: string | null,
): Promise<Scores365Game | null> {
  const gameId = getScores365ExperimentConfig().gameId;
  return fetchScores365GameById(gameId, { force, language });
}

async function fetchScores365FixturesPage(pathOrUrl: string): Promise<Scores365FixturesPayload> {
  const url = pathOrUrl.startsWith('http')
    ? pathOrUrl
    : `${SCORES365_WEB_ORIGIN}${pathOrUrl}`;
  const res = await fetch(url, {
    headers: scores365FetchHeaders(),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new Error(`365Scores fixtures HTTP ${res.status}`);
  }
  return (await res.json()) as Scores365FixturesPayload;
}

async function paginateScores365Fixtures(langId: number): Promise<Scores365Game[]> {
  const seen = new Set<number>();
  const all: Scores365Game[] = [];
  const add = (games?: Scores365Game[]) => {
    for (const g of games ?? []) {
      if (!seen.has(g.id)) {
        seen.add(g.id);
        all.push(g);
      }
    }
  };

  const first = await fetchScores365FixturesPage(scores365FixturesUrl(langId));
  add(first.games);

  let prev = first.paging?.previousPage;
  for (let step = 0; prev && step < 40; step++) {
    const page = await fetchScores365FixturesPage(prev);
    const before = all.length;
    add(page.games);
    if (all.length === before && !(page.games?.length)) break;
    prev = page.paging?.previousPage;
  }

  let next = first.paging?.nextPage;
  for (let step = 0; next && step < 40; step++) {
    const page = await fetchScores365FixturesPage(next);
    const before = all.length;
    add(page.games);
    if (all.length === before && !(page.games?.length)) break;
    next = page.paging?.nextPage;
  }

  return all;
}

export async function fetchScores365WorldCupFixtures(
  options?: { force?: boolean; language?: string | null },
): Promise<Scores365Game[]> {
  if (!isScores365ExperimentEnabled()) return [];

  const langId = resolveScores365LangId(options?.language);
  const ttlMs = Math.max(
    30_000,
    parseInt(process.env.SCORES365_FIXTURES_CACHE_MS || '60000', 10) || 60_000,
  );
  const cached = cachedFixturesByLang.get(langId);
  if (!options?.force && cached && Date.now() - cached.fetchedAt < ttlMs) {
    return cached.games;
  }

  const inFlight = inFlightFixturesFetch.get(langId);
  if (inFlight) return inFlight;

  const promise = (async () => {
    try {
      const games = await paginateScores365Fixtures(langId);
      cachedFixturesByLang.set(langId, { fetchedAt: Date.now(), games });
      logger.info(`[Scores365Experiment] fixtures list lang=${langId}: ${games.length} games`);
      return games;
    } catch (err: any) {
      logger.warn('[Scores365Experiment] fixtures pagination failed:', err?.message);
      return cached?.games ?? [];
    } finally {
      inFlightFixturesFetch.delete(langId);
    }
  })();

  inFlightFixturesFetch.set(langId, promise);
  return promise;
}

function normalize365Score(score?: number): number | null {
  if (score == null || score < 0) return null;
  return score;
}

/** Status rules validated against 365Scores WC feed (score -1 / statusText). */
export function classifyScores365MatchStatus(
  game: Scores365Game,
): { short: string; long: string; elapsed: number | null } {
  const homeRaw = game.homeCompetitor?.score;
  const awayRaw = game.awayCompetitor?.score;
  const text = (game.statusText ?? '').toLowerCase();
  const shortCode = (game.shortStatusText ?? '').trim();
  const minute = Math.floor(game.gameTime ?? 0) || null;

  if (homeRaw === -1 || awayRaw === -1) {
    return { short: 'NS', long: 'Not Started', elapsed: null };
  }

  if (
    text.includes('انته') ||
    text.includes('finish') ||
    text.includes('ended') ||
    shortCode === 'FT'
  ) {
    return { short: 'FT', long: 'Match Finished', elapsed: 90 };
  }

  if (text.includes('استراح') || text.includes('half') || shortCode === 'HT') {
    return { short: 'HT', long: 'Halftime', elapsed: 45 };
  }
  if (text.includes('الثاني') || text.includes('second') || shortCode === '2') {
    return { short: '2H', long: 'Second Half', elapsed: minute != null ? Math.max(minute, 46) : 46 };
  }
  if (
    text.includes('الأول') ||
    text.includes('first') ||
    shortCode === '1' ||
    (minute != null && minute > 0)
  ) {
    return { short: '1H', long: 'First Half', elapsed: minute };
  }

  return { short: 'NS', long: 'Not Started', elapsed: null };
}

function map365Status(game: Scores365Game): { short: string; long: string; elapsed: number | null } {
  return classifyScores365MatchStatus(game);
}

function is365Live(game: Scores365Game): boolean {
  const status = classifyScores365MatchStatus(game);
  return ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'].includes(status.short);
}

function calendarDateFromStart(
  startTime?: string,
  timezone = process.env.SCORES365_TIMEZONE || 'Africa/Cairo',
): string | null {
  if (!startTime) return null;
  const d = new Date(startTime);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

async function loadBaseFixture(fixtureId: number): Promise<FixtureFromAPI | null> {
  const dbRow = await prisma.cachedFixture.findUnique({ where: { fixtureId } });
  if (dbRow) {
    return matchCacheService.convertDbMatchToApiFormat(dbRow);
  }
  return null;
}

async function loadWorldCupDbFixtures(leagueId: number, season: number) {
  const ttlMs = 5 * 60_000;
  if (
    cachedWorldCupDbRows &&
    cachedWorldCupDbRows.leagueId === leagueId &&
    cachedWorldCupDbRows.season === season &&
    Date.now() - cachedWorldCupDbRows.fetchedAt < ttlMs
  ) {
    return cachedWorldCupDbRows.rows;
  }

  const rows = await prisma.cachedFixture.findMany({
    where: { leagueId, leagueSeason: season },
    orderBy: { matchDate: 'asc' },
  });
  cachedWorldCupDbRows = { leagueId, season, fetchedAt: Date.now(), rows };
  return rows;
}

function kickoffMs(iso?: string): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function resolveDbFixtureFor365Game(
  game: Scores365Game,
  dbRows: Awaited<ReturnType<typeof loadWorldCupDbFixtures>>,
) {
  const gameMs = kickoffMs(game.startTime);
  if (gameMs == null) return null;

  let best: (typeof dbRows)[number] | null = null;
  let bestDelta = Number.POSITIVE_INFINITY;

  for (const row of dbRows) {
    const rowMs = row.matchTimestamp
      ? row.matchTimestamp * 1000
      : row.matchDate.getTime();
    const delta = Math.abs(rowMs - gameMs);
    if (delta <= 3 * 60 * 60 * 1000 && delta < bestDelta) {
      best = row;
      bestDelta = delta;
    }
  }

  return best;
}

function memberNameLookup(game: Scores365Game): Map<number, Scores365Member> {
  const map = new Map<number, Scores365Member>();
  for (const m of game.members ?? []) {
    map.set(m.id, m);
  }
  return map;
}

function posFrom365(shortName?: string): string | null {
  if (!shortName) return null;
  const s = shortName.toLowerCase();
  if (s.includes('goalkeeper') || s.includes('حارس')) return 'G';
  if (s.includes('back') || s.includes('defender') || s.includes('دفاع') || s.includes('مداف')) return 'D';
  if (s.includes('mid') || s.includes('وسط')) return 'M';
  if (s.includes('forward') || s.includes('attacker') || s.includes('هجوم') || s.includes('مهاج')) return 'F';
  return null;
}

export function mapScores365Events(game: Scores365Game, base: FixtureFromAPI): any[] {
  const home365 = game.homeCompetitor?.id;
  const members = memberNameLookup(game);

  return (game.events ?? []).map((ev) => {
    const isHome = ev.competitorId === home365;
    const team = isHome ? base.teams.home : base.teams.away;
    const player = ev.playerId ? members.get(ev.playerId) : undefined;
    const elapsed = Math.floor(ev.gameTime ?? 0);
    const typeId = ev.eventType?.id;

    let type = 'Var';
    let detail = ev.eventType?.name ?? 'Event';
    if (typeId === 1) {
      type = 'Goal';
      detail = ev.eventType?.subTypeName ?? 'Normal Goal';
    } else if (typeId === 2) {
      type = 'Card';
      detail = 'Yellow Card';
    } else if (typeId === 3) {
      type = 'Card';
      detail = 'Red Card';
    } else if (typeId === 4) {
      type = 'subst';
      detail = 'Substitution 1';
    }

    return {
      time: { elapsed, extra: null },
      team: {
        id: team.id,
        name: (isHome ? game.homeCompetitor?.name : game.awayCompetitor?.name) ?? team.name,
        logo: team.logo,
      },
      player: {
        id: ev.playerId ?? 0,
        name: player?.shortName || player?.name || '—',
      },
      assist: { id: null, name: null },
      type,
      detail,
      comments: null,
      _source: 'scores365-experiment',
    };
  });
}

export function mapScores365Lineups(game: Scores365Game, base: FixtureFromAPI): any[] {
  const members = memberNameLookup(game);

  const mapSide = (side: Scores365Competitor | undefined, team: FixtureFromAPI['teams']['home']) => {
    if (!side?.lineups?.members?.length) return null;
    const starters = side.lineups.members.filter((m) => m.status === 1);
    return {
      team: { id: team.id, name: side?.name ?? team.name, logo: team.logo, colors: null },
      coach: { id: null, name: null, photo: null },
      formation: side.lineups.formation ?? null,
      startXI: starters.map((m) => {
        const meta = members.get(m.id);
        const grid =
          m.yardFormation?.line != null && m.yardFormation?.fieldPosition != null
            ? `${m.yardFormation.line}:${m.yardFormation.fieldPosition}`
            : null;
        return {
          player: {
            id: m.id,
            name: meta?.name ?? meta?.shortName ?? '—',
            number: meta?.jerseyNumber ?? 0,
            pos: posFrom365(m.formation?.shortName),
            grid,
            photo: null,
          },
        };
      }),
      substitutes: side.lineups.members
        .filter((m) => m.status === 2)
        .map((m) => {
          const meta = members.get(m.id);
          return {
            player: {
              id: m.id,
              name: meta?.name ?? meta?.shortName ?? '—',
              number: meta?.jerseyNumber ?? 0,
              pos: posFrom365(m.formation?.shortName),
              grid: null,
              photo: null,
            },
          };
        }),
      _source: 'scores365-experiment',
    };
  };

  const home = mapSide(game.homeCompetitor, base.teams.home);
  const away = mapSide(game.awayCompetitor, base.teams.away);
  return [home, away].filter(Boolean);
}

export async function mapScores365ToApiFootballFixture(
  game: Scores365Game,
  baseInput?: FixtureFromAPI | null,
  fixtureIdOverride?: number,
): Promise<FixtureFromAPI | null> {
  const fixtureId =
    fixtureIdOverride ?? baseInput?.fixture?.id ?? getScores365ExperimentConfig().fixtureId;
  const base = baseInput ?? (await loadBaseFixture(fixtureId));
  if (!base) return null;

  registerScores365FixtureMapping(fixtureId, game.id);

  const status = map365Status(game);
  const homeScore = normalize365Score(game.homeCompetitor?.score) ?? base.goals.home ?? null;
  const awayScore = normalize365Score(game.awayCompetitor?.score) ?? base.goals.away ?? null;
  const kickoff = game.startTime ?? base.fixture.date;

  return {
    ...base,
    fixture: {
      ...base.fixture,
      id: fixtureId,
      date: kickoff,
      timestamp: Math.floor(new Date(kickoff).getTime() / 1000),
      status: {
        long: status.long,
        short: status.short,
        elapsed: status.elapsed,
      },
      venue: {
        id: game.venue?.id ?? base.fixture.venue?.id ?? null,
        name: game.venue?.name ?? base.fixture.venue?.name ?? null,
        city: base.fixture.venue?.city ?? null,
      },
    },
    goals: {
      home: homeScore,
      away: awayScore,
    },
    teams: {
      home: {
        ...base.teams.home,
        name: game.homeCompetitor?.name ?? base.teams.home.name,
        winner:
          status.short === 'FT' && homeScore != null && awayScore != null
            ? homeScore > awayScore
              ? true
              : homeScore < awayScore
                ? false
                : null
            : null,
      },
      away: {
        ...base.teams.away,
        name: game.awayCompetitor?.name ?? base.teams.away.name,
        winner:
          status.short === 'FT' && homeScore != null && awayScore != null
            ? awayScore > homeScore
              ? true
              : awayScore < homeScore
                ? false
                : null
            : null,
      },
    },
    league: {
      ...base.league,
      name: game.competitionDisplayName ?? base.league.name,
      round: game.groupName ? `${game.roundName ?? ''} - ${game.groupName}`.trim() : base.league.round,
    },
    _scores365GameId: game.id,
    _experiment: 'scores365',
  } as FixtureFromAPI;
}

export async function getScores365ExperimentEvents(
  fixtureId: number,
  force = false,
  language?: string | null,
): Promise<any[]> {
  const gameId = getScores365GameIdForFixture(fixtureId);
  if (!gameId) return [];

  const game = await fetchScores365GameById(gameId, { force, language });
  if (!game) return [];

  const base = await loadBaseFixture(fixtureId);
  if (!base) return [];

  return mapScores365Events(game, base);
}

export async function getScores365ExperimentFixture(
  fixtureId: number,
  language?: string | null,
): Promise<FixtureFromAPI | null> {
  const gameId = getScores365GameIdForFixture(fixtureId);
  if (!gameId) return null;

  const game = await fetchScores365GameById(gameId, { language });
  if (!game) return null;

  const base = await loadBaseFixture(fixtureId);
  return mapScores365ToApiFootballFixture(game, base, fixtureId);
}

export async function getScores365ExperimentBundle(
  fixtureId: number,
  language?: string | null,
): Promise<{
  fixture: FixtureFromAPI | null;
  lineups: any[];
  statistics: any[];
  events: any[];
  venue: any | null;
  source: 'scores365-experiment';
} | null> {
  const gameId = getScores365GameIdForFixture(fixtureId);
  if (!gameId) return null;

  const game = await fetchScores365GameById(gameId, { language });
  if (!game) return null;

  const base = await loadBaseFixture(fixtureId);
  if (!base) return null;

  const fixture = await mapScores365ToApiFootballFixture(game, base, fixtureId);
  if (!fixture) return null;

  return {
    fixture,
    lineups: mapScores365Lineups(game, base),
    events: mapScores365Events(game, base),
    statistics: (base as any).statistics ?? [],
    venue: fixture.fixture.venue ?? null,
    source: 'scores365-experiment',
  };
}

/**
 * World Cup calendar day from 365Scores fixtures feed (paginated, all 72 matches).
 * Team/status names follow `language` (ar → langId 27, en → langId 1).
 */
export async function getScores365MatchesForDate(
  dateString: string,
  leagueId: number,
  season: number,
  language?: string | null,
): Promise<any[]> {
  if (!isScores365ExperimentEnabled()) return [];

  const dbRows = await loadWorldCupDbFixtures(leagueId, season);
  const games = await fetchScores365WorldCupFixtures({ language });
  if (!games.length) return [];

  const todayKey = new Intl.DateTimeFormat('en-CA', {
    timeZone: process.env.SCORES365_TIMEZONE || 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const mapped: any[] = [];
  for (const game of games) {
    const matchDate = calendarDateFromStart(game.startTime);
    const live = is365Live(game);
    if (dateString !== matchDate && !(live && dateString === todayKey)) {
      continue;
    }

    const dbRow = resolveDbFixtureFor365Game(game, dbRows);
    if (!dbRow) continue;

    const base = matchCacheService.convertDbMatchToApiFormat(dbRow);
    const fixture = await mapScores365ToApiFootballFixture(game, base, dbRow.fixtureId);
    if (fixture) mapped.push(fixture);
  }

  mapped.sort((a, b) => (a.fixture?.timestamp ?? 0) - (b.fixture?.timestamp ?? 0));

  if (mapped.length > 0) {
    logger.info(
      `[Scores365Experiment] ${mapped.length} fixtures on ${dateString} (lang=${resolveScores365LangId(language)})`,
    );
  }

  return mapped;
}

/** Overlay 365Scores live data on a World Cup day list. */
export async function applyScores365ExperimentToWorldCupList(
  matches: any[],
  dateString: string,
  language?: string | null,
): Promise<any[]> {
  if (!isScores365ExperimentEnabled()) return matches;

  const fromList = await getScores365MatchesForDate(
    dateString,
    getScores365ExperimentConfig().leagueId,
    getScores365ExperimentConfig().season,
    language,
  );
  if (fromList.length > 0) {
    const ids = new Set(fromList.map((m) => m?.fixture?.id));
    const rest = matches.filter((m) => !ids.has(m?.fixture?.id));
    return [...fromList, ...rest];
  }

  const gameId = getScores365ExperimentConfig().gameId;
  const game = await fetchScores365GameById(gameId, { language });
  if (!game) return matches;

  const dbRow = resolveDbFixtureFor365Game(
    game,
    await loadWorldCupDbFixtures(
      getScores365ExperimentConfig().leagueId,
      getScores365ExperimentConfig().season,
    ),
  );
  const base = dbRow ? matchCacheService.convertDbMatchToApiFormat(dbRow) : null;
  const fixture = await mapScores365ToApiFootballFixture(
    game,
    base,
    dbRow?.fixtureId ?? getScores365ExperimentConfig().fixtureId,
  );
  if (!fixture) return matches;

  const matchDate = calendarDateFromStart(game.startTime);
  const todayKey = new Intl.DateTimeFormat('en-CA', {
    timeZone: process.env.SCORES365_TIMEZONE || 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const live = is365Live(game);
  const shouldShow = dateString === matchDate || (live && dateString === todayKey);
  if (!shouldShow) return matches;

  const id = fixture.fixture.id;
  const without = matches.filter((m) => m?.fixture?.id !== id);
  return [{ ...fixture, _experiment: 'scores365' }, ...without];
}

export function getScores365ExperimentFeatureState(): {
  enabled: boolean;
  fixtureId: number;
  gameId: number;
  label: string;
} {
  const cfg = getScores365ExperimentConfig();
  return {
    enabled: cfg.enabled,
    fixtureId: cfg.fixtureId,
    gameId: cfg.gameId,
    label: '365Scores Live Experiment',
  };
}
