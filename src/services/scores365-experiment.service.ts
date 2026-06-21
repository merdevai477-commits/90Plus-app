/**
 * 365Scores live experiment — single-match feed for all users.
 * Maps webws.365scores.com game payload → API-Football shapes the app already consumes.
 */

import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { isWorldCupOnlyMode } from '../config/world-cup-only-mode.config';
import { matchCacheService } from './match-cache.service';
import type { FixtureFromAPI } from './match-cache.service';
import { buildFallbackStatisticsFromEvents, hasApiStatistics } from '../utils/match-stats-fallback';

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
  lineupsStatus?: number;
  lineupsStatusText?: string;
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
  yardFormation?: { line?: number; fieldPosition?: number; fieldLine?: number; fieldSide?: number };
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
  addedTime?: number;
  order?: number;
  num?: number;
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
/** Last successful payload per game+lang — avoids cross-language stale fallback. */
let lastGoodGameByKey = new Map<string, Scores365Game>();
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

/**
 * Temporary backend hotfix for store builds that still call /fixtures/:id/* directly.
 * ON by default while WORLD_CUP_ONLY_MODE + SCORES365 are enabled.
 * Set WC_STORE_HOTFIX=false after the next store release.
 */
export function is365StoreDetailsHotfix(): boolean {
  const raw = process.env.WC_STORE_HOTFIX?.trim();
  if (raw === 'false' || raw === '0') return false;
  if (raw === 'true' || raw === '1') return true;
  return isScores365ExperimentEnabled() && isWorldCupOnlyMode();
}

let storeHotfixLogged = false;
export function log365StoreHotfixStartup(): void {
  if (!is365StoreDetailsHotfix() || storeHotfixLogged) return;
  storeHotfixLogged = true;
  logger.info(
    '[Scores365] WC store hotfix ON — 365 lineups/events/stats bypass stale caches for legacy app clients',
  );
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

export function isScores365ForceEnglish(): boolean {
  const raw = process.env.SCORES365_FORCE_ENGLISH?.trim();
  if (raw === 'false' || raw === '0') return false;
  // Default ON until app OTA ships i18n→365Scores locale sync.
  return true;
}

/** Language passed into 365Scores upstream (forced EN when isScores365ForceEnglish). */
export function resolveScores365AppLanguage(appLanguage?: string | null): 'ar' | 'en' {
  if (isScores365ForceEnglish()) return 'en';
  const lang = (appLanguage || process.env.SCORES365_DEFAULT_LANG || 'ar').trim().toLowerCase();
  return lang.startsWith('en') ? 'en' : 'ar';
}

export function resolveScores365LangId(appLanguage?: string | null): number {
  if (isScores365ForceEnglish()) {
    return parseInt(process.env.SCORES365_LANG_ID_EN || '1', 10);
  }
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

const ON_DEMAND_REFRESH_MIN_INTERVAL_MS = 30_000;
let lastOnDemandRefresh = 0;

/** Lazy map API-Football fixtureId → 365 gameId (passive check + rate-limited live fallback). */
export async function ensureScores365GameMapping(fixtureId: number): Promise<number | null> {
  const existing = getScores365GameIdForFixture(fixtureId);
  if (existing) return existing;
  if (!isScores365ExperimentEnabled()) return null;

  logger.debug(`[Scores365] fixtureId=${fixtureId} not yet in map — checking if on-demand refresh is warranted`);

  const dbRow = await prisma.cachedFixture.findUnique({
    where: { fixtureId },
    select: { status: true, leagueId: true },
  });

  // Non-WC synthetic 365 fixtures store the 365 gameId AS the fixtureId and use
  // a namespaced leagueId (>= SCORES365_LEAGUE_ID_OFFSET). The fixture↔game map
  // is only built inside the sync worker process, so the web process never has
  // it — resolve directly here so events/lineups/stats work for every league.
  if (dbRow && dbRow.leagueId >= SCORES365_LEAGUE_ID_OFFSET) {
    registerScores365FixtureMapping(fixtureId, fixtureId);
    return fixtureId;
  }

  const LIVE_STATUSES = new Set(['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT']);
  const isPlausiblyLive = !!dbRow && LIVE_STATUSES.has(dbRow.status);

  if (!isPlausiblyLive) {
    logger.debug(`[Scores365] fixtureId=${fixtureId} not live — waiting for next scheduled bulk sync`);
    return null;
  }

  if (Date.now() - lastOnDemandRefresh < ON_DEMAND_REFRESH_MIN_INTERVAL_MS) {
    logger.debug(`[Scores365] fixtureId=${fixtureId} is live but on-demand refresh was rate-limited — waiting`);
    return null;
  }

  logger.warn(
    `[Scores365] fixtureId=${fixtureId} is LIVE but missing from map — triggering immediate on-demand bulk refresh`,
  );
  lastOnDemandRefresh = Date.now();

  const { runBulkFixtureSyncTick } = await import('../workers/worldCupSync.service');
  await runBulkFixtureSyncTick();

  return getScores365GameIdForFixture(fixtureId);
}

/**
 * Map every WC fixture in DB to its 365 gameId via competitions=5930 fixtures feed.
 * Events + structured lineups come from GET /web/game/?gameId=…;
 * named lineups/photos from GET /web/athletes/games/lineups?gameId=…
 */
export async function syncScores365FixtureMappingsFromFixturesList(
  options?: { force?: boolean },
): Promise<number> {
  if (!isScores365ExperimentEnabled()) return 0;

  const cfg = getScores365ExperimentConfig();
  const dbRows = await loadWorldCupDbFixtures(cfg.leagueId, cfg.season);
  if (!dbRows.length) return 0;

  const games = await fetchScores365WorldCupFixtures({
    language: 'en',
    force: options?.force === true,
  });

  let mapped = 0;
  for (const game of games) {
    const row = resolveDbFixtureFor365Game(game, dbRows);
    if (!row) continue;
    registerScores365FixtureMapping(row.fixtureId, game.id);
    mapped += 1;
  }

  const coverageRatio = dbRows.length > 0 ? mapped / dbRows.length : 1;
  const logMsg = `[Scores365] fixture↔game sync: ${mapped}/${games.length} games mapped (${dbRows.length} DB fixtures)`;

  if (coverageRatio < 0.8) {
    logger.warn(`⚠️ ${logMsg} — coverage is suspiciously low (${(coverageRatio * 100).toFixed(1)}%). Upstream feed may have changed or missing DB matches.`);
  } else {
    logger.info(`✅ ${logMsg}`);
  }

  return mapped;
}

function is365FinishedGame(game: Scores365Game): boolean {
  const homeRaw = game.homeCompetitor?.score;
  const awayRaw = game.awayCompetitor?.score;
  if (homeRaw === -1 || awayRaw === -1) return false;
  const text = (game.statusText ?? '').toLowerCase();
  return (
    text.includes('انته') ||
    text.includes('ended') ||
    text.includes('finish') ||
    (game.shortStatusText ?? '').toLowerCase() === 'ft'
  );
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

function scores365FetchHeaders(langId: number): Record<string, string> {
  const enId = parseInt(process.env.SCORES365_LANG_ID_EN || '1', 10);
  const preferEn = langId === enId;
  return {
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': preferEn ? 'en,ar;q=0.9' : 'ar,en;q=0.9',
    'User-Agent':
      process.env.SCORES365_USER_AGENT?.trim() ||
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    Referer: 'https://www.365scores.com/',
    Origin: 'https://www.365scores.com',
  };
}

/** Force langId on pagination paths returned by 365Scores (may carry a stale langId). */
function rewriteScores365PagingPath(path: string, langId: number): string {
  try {
    const url = new URL(path.startsWith('http') ? path : `${SCORES365_WEB_ORIGIN}${path}`);
    url.searchParams.set('langId', String(langId));
    return `${url.pathname}${url.search}`;
  } catch {
    return path;
  }
}

function lastGoodGameKey(gameId: number, langId: number): string {
  return `${gameId}:${langId}`;
}

function gameCacheKey(gameId: number, langId: number): string {
  return `${gameId}:${langId}`;
}

async function fetchScores365GameOnce(gameId: number, langId: number): Promise<Scores365Game | null> {
  const staleKey = lastGoodGameKey(gameId, langId);
  const lastGood = lastGoodGameByKey.get(staleKey) ?? null;
  try {
    const res = await fetch(scores365GameUrl(gameId, langId), {
      headers: scores365FetchHeaders(langId),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      logger.warn(`[Scores365Experiment] HTTP ${res.status} for game ${gameId} lang=${langId}`);
      return lastGood;
    }
    const payload = (await res.json()) as Scores365GamePayload;
    const game = payload?.game ?? null;
    if (game) {
      lastGoodGameByKey.set(staleKey, game);
      cachedGameByKey.set(gameCacheKey(gameId, langId), { fetchedAt: Date.now(), game });
      logger.debug(
        `[Scores365Experiment] game ${gameId} lang=${langId}: ${game.homeCompetitor?.name} ${normalize365Score(game.homeCompetitor?.score)}-${normalize365Score(game.awayCompetitor?.score)} ${game.awayCompetitor?.name} (${game.gameTimeDisplay ?? game.statusText}) events=${game.events?.length ?? 0}`,
      );
    }
    return game ?? lastGood;
  } catch (err: any) {
    logger.warn(`[Scores365Experiment] fetch failed for game ${gameId} lang=${langId}:`, err?.message);
    return lastGood;
  }
}

export async function fetchScores365GameById(
  gameId: number,
  options?: { force?: boolean; language?: string | null },
): Promise<Scores365Game | null> {
  if (!isScores365ExperimentEnabled()) return null;

  const langId = resolveScores365LangId(options?.language);
  const ttlMs = Math.max(2_000, parseInt(process.env.SCORES365_CACHE_MS || '3000', 10) || 3_000);
  const key = gameCacheKey(gameId, langId);
  const cached = cachedGameByKey.get(key);

  if (!options?.force && cached && Date.now() - cached.fetchedAt < ttlMs) {
    return cached.game ?? lastGoodGameByKey.get(lastGoodGameKey(gameId, langId)) ?? null;
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

async function fetchScores365FixturesPage(pathOrUrl: string, langId: number): Promise<Scores365FixturesPayload> {
  const normalized = rewriteScores365PagingPath(pathOrUrl, langId);
  const url = normalized.startsWith('http')
    ? normalized
    : `${SCORES365_WEB_ORIGIN}${normalized}`;
  const res = await fetch(url, {
    headers: scores365FetchHeaders(langId),
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

  const first = await fetchScores365FixturesPage(scores365FixturesUrl(langId), langId);
  add(first.games);

  let prev = first.paging?.previousPage;
  for (let step = 0; prev && step < 40; step++) {
    const page = await fetchScores365FixturesPage(prev, langId);
    const before = all.length;
    add(page.games);
    if (all.length === before && !(page.games?.length)) break;
    prev = page.paging?.previousPage;
  }

  let next = first.paging?.nextPage;
  for (let step = 0; next && step < 40; step++) {
    const page = await fetchScores365FixturesPage(next, langId);
    const before = all.length;
    add(page.games);
    if (all.length === before && !(page.games?.length)) break;
    next = page.paging?.nextPage;
  }

  return all;
}

export async function fetchScores365WorldCupFixtures(
  options?: { force?: boolean; language?: string | null; liveRefresh?: boolean },
): Promise<Scores365Game[]> {
  if (!isScores365ExperimentEnabled()) return [];

  const langId = resolveScores365LangId(options?.language);
  const ttlMs = options?.liveRefresh
    ? Math.max(4_000, parseInt(process.env.SCORES365_FIXTURES_LIVE_CACHE_MS || '8000', 10) || 8_000)
    : Math.max(30_000, parseInt(process.env.SCORES365_FIXTURES_CACHE_MS || '60000', 10) || 60_000);
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
  const shortCode = (game.shortStatusText ?? '').trim().toLowerCase();
  const minute = Math.floor(game.gameTime ?? 0) || null;

  if (homeRaw === -1 || awayRaw === -1) {
    return { short: 'NS', long: 'Not Started', elapsed: null };
  }

  if (
    text.includes('انته') ||
    text.includes('finish') ||
    text.includes('ended') ||
    shortCode === 'ft'
  ) {
    return { short: 'FT', long: 'Match Finished', elapsed: 90 };
  }

  // 2nd / 1st half BEFORE generic "half" — "2nd Half".includes("half") must not map to HT.
  if (
    text.includes('second') ||
    text.includes('2nd') ||
    text.includes('الثاني') ||
    shortCode === '2' ||
    shortCode === '2h' ||
    (minute != null && minute > 45)
  ) {
    return {
      short: '2H',
      long: 'Second Half',
      elapsed: minute != null ? Math.max(minute, 46) : 46,
    };
  }

  if (
    text.includes('استراح') ||
    text.includes('halftime') ||
    text.includes('half time') ||
    text.includes('half-time') ||
    shortCode === 'ht'
  ) {
    return { short: 'HT', long: 'Halftime', elapsed: 45 };
  }

  if (
    text.includes('first') ||
    text.includes('1st') ||
    text.includes('الأول') ||
    shortCode === '1' ||
    shortCode === '1h' ||
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

/** 365Scores competitor (national team) crest URL. */
function build365CompetitorLogo(competitorId?: number): string {
  if (!competitorId) return '';
  return `https://imagecache.365scores.com/image/upload/f_png,w_68,h_68,c_limit,q_auto:eco,dpr_2/v3/Competitors/${competitorId}`;
}

/**
 * Offset applied to a 365Scores competitionId to derive a synthetic `leagueId`
 * for non-WC leagues. Keeps 365's ID space from colliding with API-Football
 * leagueIds (which are well below this offset) while staying internally
 * consistent for calendar grouping and per-league endpoints.
 */
export const SCORES365_LEAGUE_ID_OFFSET = 7_000_000;

export function scores365CompetitionToLeagueId(competitionId: number): number {
  return SCORES365_LEAGUE_ID_OFFSET + competitionId;
}

/** Optional league overrides for non-WC synthetic fixtures (defaults to WC). */
export interface SynthesizeBaseOverrides {
  leagueId?: number;
  season?: number;
  leagueName?: string;
  country?: string;
  leagueLogo?: string;
}

/**
 * Build a FixtureFromAPI base directly from a 365Scores game when no API-Football
 * cachedFixture row exists. Teams come straight from game.homeCompetitor/awayCompetitor
 * (so detect365TeamAlignment resolves to non-swapped). League defaults to the WC
 * league/season; pass `overrides` to synthesize non-WC leagues (allscores path).
 */
export function synthesizeBaseFrom365Game(
  game: Scores365Game,
  fixtureId: number,
  overrides?: SynthesizeBaseOverrides,
): FixtureFromAPI {
  const cfg = getScores365ExperimentConfig();
  const status = map365Status(game);
  const kickoff = game.startTime ?? new Date().toISOString();
  const home = game.homeCompetitor;
  const away = game.awayCompetitor;
  const homeScore = normalize365Score(home?.score);
  const awayScore = normalize365Score(away?.score);
  const round = game.groupName
    ? `${game.roundName ?? ''} - ${game.groupName}`.trim()
    : game.roundName ?? '';

  return {
    fixture: {
      id: fixtureId,
      referee: null,
      timezone: 'UTC',
      date: kickoff,
      timestamp: Math.floor(new Date(kickoff).getTime() / 1000),
      periods: { first: null, second: null },
      venue: {
        id: game.venue?.id ?? null,
        name: game.venue?.name ?? null,
        city: null,
      },
      status: {
        long: status.long,
        short: status.short,
        elapsed: status.elapsed,
      },
    },
    league: {
      id: overrides?.leagueId ?? cfg.leagueId,
      name: overrides?.leagueName ?? game.competitionDisplayName ?? 'FIFA World Cup',
      country: overrides?.country ?? 'World',
      logo: overrides?.leagueLogo ?? '',
      flag: null,
      season: overrides?.season ?? cfg.season,
      round,
    },
    teams: {
      home: {
        id: home?.id ?? 0,
        name: home?.name ?? 'Home',
        logo: build365CompetitorLogo(home?.id),
        winner: null,
      },
      away: {
        id: away?.id ?? 0,
        name: away?.name ?? 'Away',
        logo: build365CompetitorLogo(away?.id),
        winner: null,
      },
    },
    goals: { home: homeScore, away: awayScore },
    score: {
      halftime: { home: null, away: null },
      fulltime: { home: homeScore, away: awayScore },
      extratime: { home: null, away: null },
      penalty: { home: null, away: null },
    },
  };
}

export async function loadWorldCupDbFixtures(leagueId: number, season: number) {
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

/** Normalize team labels for fuzzy cross-provider matching (365Scores ↔ API-Football DB). */
function normalizeTeamNameForMatch(name?: string | null): string {
  if (!name) return '';
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function teamNamesMatch(a?: string | null, b?: string | null): boolean {
  const na = normalizeTeamNameForMatch(a);
  const nb = normalizeTeamNameForMatch(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

type Scores365TeamAlignment = { swapped: boolean };

function scoreDbRowTeamsFor365Game(
  game: Scores365Game,
  row: Awaited<ReturnType<typeof loadWorldCupDbFixtures>>[number],
): { direct: number; swapped: number } {
  const h365 = game.homeCompetitor?.name;
  const a365 = game.awayCompetitor?.name;
  let direct = 0;
  let swapped = 0;
  if (teamNamesMatch(h365, row.homeTeamName)) direct++;
  if (teamNamesMatch(a365, row.awayTeamName)) direct++;
  if (teamNamesMatch(h365, row.awayTeamName)) swapped++;
  if (teamNamesMatch(a365, row.homeTeamName)) swapped++;
  return { direct, swapped };
}

function detect365TeamAlignment(
  game: Scores365Game,
  base: FixtureFromAPI,
): Scores365TeamAlignment | null {
  const h365 = game.homeCompetitor?.name;
  const a365 = game.awayCompetitor?.name;
  const dbHome = base.teams.home?.name;
  const dbAway = base.teams.away?.name;

  const direct =
    (teamNamesMatch(h365, dbHome) ? 1 : 0) + (teamNamesMatch(a365, dbAway) ? 1 : 0);
  const swapped =
    (teamNamesMatch(h365, dbAway) ? 1 : 0) + (teamNamesMatch(a365, dbHome) ? 1 : 0);

  if (direct >= 2) return { swapped: false };
  if (swapped >= 2) return { swapped: true };
  if (direct === 1 && swapped === 0) return { swapped: false };
  if (swapped === 1 && direct === 0) return { swapped: true };
  return null;
}

export function resolveDbFixtureFor365Game(
  game: Scores365Game,
  dbRows: Awaited<ReturnType<typeof loadWorldCupDbFixtures>>,
) {
  const gameMs = kickoffMs(game.startTime);
  if (gameMs == null) return null;

  const maxDeltaMs = 3 * 60 * 60 * 1000;
  type Candidate = {
    row: (typeof dbRows)[number];
    delta: number;
    teamHits: number;
    swapped: boolean;
  };
  const candidates: Candidate[] = [];

  for (const row of dbRows) {
    const rowMs = row.matchTimestamp
      ? row.matchTimestamp * 1000
      : row.matchDate.getTime();
    const delta = Math.abs(rowMs - gameMs);
    if (delta > maxDeltaMs) continue;

    const { direct, swapped } = scoreDbRowTeamsFor365Game(game, row);
    const teamHits = Math.max(direct, swapped);
    if (teamHits < 2) continue;

    candidates.push({
      row,
      delta,
      teamHits,
      swapped: swapped > direct,
    });
  }

  if (!candidates.length) {
    // Expected now: callers fall back to a synthetic base built from 365 data.
    logger.debug(
      `[Scores365Experiment] no API-Football row for 365 game ${game.id} (${game.homeCompetitor?.name} vs ${game.awayCompetitor?.name}) — using synthetic fixture`,
    );
    return null;
  }

  candidates.sort((a, b) => a.delta - b.delta || b.teamHits - a.teamHits);
  const best = candidates[0];
  const tied = candidates.filter(
    (c) => c.delta === best.delta && c.teamHits === best.teamHits,
  );
  if (tied.length > 1) {
    logger.warn(
      `[Scores365Experiment] ambiguous DB mapping for 365 game ${game.id}: ${tied.map((c) => c.row.fixtureId).join(', ')}`,
    );
    return null;
  }

  return best.row;
}

function map365CompetitorToBaseTeam(
  competitorId: number,
  game: Scores365Game,
  base: FixtureFromAPI,
  alignment: Scores365TeamAlignment,
): FixtureFromAPI['teams']['home'] {
  const is365Home = competitorId === game.homeCompetitor?.id;
  const is365Away = competitorId === game.awayCompetitor?.id;
  const mapsToDbHome = alignment.swapped ? is365Away : is365Home;
  return mapsToDbHome ? base.teams.home : base.teams.away;
}

function resolve365Scores(
  game: Scores365Game,
  alignment: Scores365TeamAlignment,
): { home: number | null; away: number | null } {
  const home365 = normalize365Score(game.homeCompetitor?.score);
  const away365 = normalize365Score(game.awayCompetitor?.score);
  return alignment.swapped
    ? { home: away365, away: home365 }
    : { home: home365, away: away365 };
}

function tallyGoalsFromMappedEvents(
  events: Array<{ type?: string; detail?: string; team?: { id?: number } }>,
  homeId: number,
  awayId: number,
): { home: number; away: number } {
  let home = 0;
  let away = 0;
  for (const e of events) {
    if (e.type !== 'Goal') continue;
    const detail = (e.detail || '').toLowerCase();
    if (detail.includes('missed')) continue;
    const isOwn = detail.includes('own');
    const teamId = e.team?.id;
    if (teamId === homeId) {
      if (isOwn) away++;
      else home++;
    } else if (teamId === awayId) {
      if (isOwn) home++;
      else away++;
    }
  }
  return { home, away };
}

function eventsMatch365ScoreLine(
  events: Array<{ type?: string; detail?: string; team?: { id?: number } }>,
  homeId: number,
  awayId: number,
  expectedHome: number | null,
  expectedAway: number | null,
): boolean {
  if (expectedHome == null || expectedAway == null) return true;
  const tallied = tallyGoalsFromMappedEvents(events, homeId, awayId);
  const expectedTotal = expectedHome + expectedAway;
  const talliedTotal = tallied.home + tallied.away;
  if (talliedTotal === expectedTotal) return true;
  // Per-team exact match (strict)
  return tallied.home === expectedHome && tallied.away === expectedAway;
}

function shouldServe365EventsDespiteMismatch(
  game: Scores365Game,
  events: Array<{ type?: string }>,
): boolean {
  if (!events.length) return false;
  if (!is365FinishedGame(game)) return true;
  return true;
}

function normaliseNameKey(s?: string): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

interface MemberLookup {
  byId: Map<number, Scores365Member>;
  byNormName: Map<string, Scores365Member>;
}

function memberNameLookup(game: Scores365Game): Map<number, Scores365Member> {
  const map = new Map<number, Scores365Member>();
  for (const m of game.members ?? []) {
    map.set(m.id, m);
  }
  return map;
}

/** Extended lookup used in mapScores365Lineups — id + normalised name/shortName. */
function buildMemberLookup(game: Scores365Game): MemberLookup {
  const byId = new Map<number, Scores365Member>();
  const byNormName = new Map<string, Scores365Member>();
  for (const m of game.members ?? []) {
    byId.set(m.id, m);
    const nName = normaliseNameKey(m.name);
    const nShort = normaliseNameKey(m.shortName);
    if (nName) byNormName.set(nName, m);
    if (nShort && nShort !== nName) byNormName.set(nShort, m);
  }
  return { byId, byNormName };
}

function lookupMember(lookup: MemberLookup, id: number, rawName?: string): Scores365Member | undefined {
  return lookup.byId.get(id) ?? (rawName ? lookup.byNormName.get(normaliseNameKey(rawName)) : undefined);
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

export function mapScores365Events(
  game: Scores365Game,
  base: FixtureFromAPI,
  alignment?: Scores365TeamAlignment | null,
): any[] {
  const resolvedAlignment = alignment ?? detect365TeamAlignment(game, base);
  if (!resolvedAlignment) {
    logger.warn(
      `[Scores365Experiment] skip events for game ${game.id}: teams do not match fixture ${base.fixture.id}`,
    );
    return [];
  }

  const members = memberNameLookup(game);

  const sortedEvents = [...(game.events ?? [])].sort((a, b) => {
    const orderA = a.order ?? a.num ?? a.gameTime ?? 0;
    const orderB = b.order ?? b.num ?? b.gameTime ?? 0;
    if (orderA !== orderB) return orderA - orderB;
    return (a.gameTime ?? 0) - (b.gameTime ?? 0);
  });

  return sortedEvents.map((ev) => {
    const player = ev.playerId ? members.get(ev.playerId) : undefined;
    const elapsed = Math.floor(ev.gameTime ?? 0);
    const extra = ev.addedTime != null && ev.addedTime > 0 ? ev.addedTime : null;
    const typeId = ev.eventType?.id;

    let type = 'Var';
    let detail = ev.eventType?.name ?? 'Event';
    if (typeId === 1) {
      type = 'Goal';
      const sub = ev.eventType?.subTypeName ?? 'Normal Goal';
      detail = /field\s*goal/i.test(sub) ? 'Normal Goal' : sub;
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

    const isOwnGoal = (detail || '').toLowerCase().includes('own');
    // 365 uses competitorId = benefiting team on own goals; API-Football uses scorer's team.
    let teamCompetitorId = ev.competitorId;
    if (isOwnGoal) {
      if (player?.competitorId != null) {
        teamCompetitorId = player.competitorId;
      } else if (ev.competitorId === game.homeCompetitor?.id) {
        teamCompetitorId = game.awayCompetitor?.id ?? ev.competitorId;
      } else if (ev.competitorId === game.awayCompetitor?.id) {
        teamCompetitorId = game.homeCompetitor?.id ?? ev.competitorId;
      }
    }

    const team = map365CompetitorToBaseTeam(teamCompetitorId, game, base, resolvedAlignment);

    return {
      time: { elapsed, extra },
      team: {
        id: team.id,
        name: team.name,
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

/** Status values recognised as confirmed starters in the 365Scores lineups array. */
const STARTER_STATUSES = new Set([1, 0]); // 1 = confirmed starter; 0 = used for GK in some feeds

export function mapScores365Lineups(
  game: Scores365Game,
  base: FixtureFromAPI,
  alignment?: Scores365TeamAlignment | null,
): any[] {
  const resolvedAlignment = alignment ?? detect365TeamAlignment(game, base);
  if (!resolvedAlignment) return [];

  const lookup = buildMemberLookup(game);
  const lineupsConfirmed =
    game.lineupsStatus === 1 ||
    (game.lineupsStatusText ?? '').toLowerCase().includes('confirm') ||
    (game.lineupsStatusText ?? '').toLowerCase().includes('مؤك');

  const mapSide = (
    side: Scores365Competitor | undefined,
    team: FixtureFromAPI['teams']['home'],
    displayName?: string,
    sideLabel = 'unknown',
  ) => {
    if (!side?.lineups?.members?.length) {
      logger.debug(
        `[Scores365Lineups] game ${game.id} ${sideLabel}: no lineup members in payload`,
      );
      return null;
    }

    const allMembers = side.lineups.members;

    // Log every non-starter for full auditability.
    const dropped = allMembers.filter((m) => !STARTER_STATUSES.has(m.status) && m.status !== 2 && m.status !== 4);
    for (const d of dropped) {
      const meta = lookup.byId.get(d.id);
      logger.warn(
        `[Scores365Lineups] game ${game.id} ${sideLabel}: member id=${d.id} name="${meta?.name ?? '?'}" dropped — unexpected status=${d.status}`,
      );
    }

    const coachMember = allMembers.find((m) => m.status === 4);
    const coachMeta = coachMember ? lookup.byId.get(coachMember.id) : undefined;

    const starters = allMembers
      .filter((m) => STARTER_STATUSES.has(m.status))
      .sort((a, b) => {
        const al = a.yardFormation?.line ?? 99;
        const bl = b.yardFormation?.line ?? 99;
        if (al !== bl) return al - bl;
        return (a.yardFormation?.fieldPosition ?? 0) - (b.yardFormation?.fieldPosition ?? 0);
      });

    // Completeness warning — fire BEFORE returning so it always appears in logs.
    if (lineupsConfirmed && starters.length < 11) {
      logger.warn(
        `[Scores365Lineups] game ${game.id} ${sideLabel}: confirmed lineup but only ${starters.length}/11 starters resolved — potential partial data`,
        {
          gameId: game.id,
          side: sideLabel,
          starterCount: starters.length,
          totalMembers: allMembers.length,
          memberStatuses: allMembers.map((m) => ({ id: m.id, status: m.status })),
        },
      );
    }

    return {
      team: { id: team.id, name: displayName ?? team.name, logo: team.logo, colors: null },
      coach: {
        id: coachMember?.id ?? null,
        name: coachMeta?.name ?? coachMeta?.shortName ?? null,
        photo: null,
      },
      formation: side.lineups.formation ?? null,
      startXI: starters.map((m) => {
        const meta = lookupMember(lookup, m.id);
        const grid =
          m.yardFormation?.line != null && m.yardFormation?.fieldPosition != null
            ? `${m.yardFormation.line}:${m.yardFormation.fieldPosition}`
            : null;
        // Use raw name from lineup member if metadata lookup missed — never '—' here.
        const resolvedName = meta?.name ?? meta?.shortName ?? null;
        if (!resolvedName) {
          logger.warn(
            `[Scores365Lineups] game ${game.id} ${sideLabel}: member id=${m.id} has no name in game.members — rendering without name`,
          );
        }
        return {
          player: {
            id: m.id,
            name: resolvedName ?? `#${m.id}`,
            number: meta?.jerseyNumber ?? 0,
            pos: posFrom365(m.formation?.shortName),
            grid,
            fieldLine: m.yardFormation?.fieldLine ?? null,
            fieldSide: m.yardFormation?.fieldSide ?? null,
            photo: null,
            _stats365: (meta as any)?.stats ?? null,
          },
        };
      }),
      substitutes: allMembers
        .filter((m) => m.status === 2)
        .map((m) => {
          const meta = lookupMember(lookup, m.id);
          return {
            player: {
              id: m.id,
              name: meta?.name ?? meta?.shortName ?? `#${m.id}`,
              number: meta?.jerseyNumber ?? 0,
              pos: posFrom365(m.formation?.shortName),
              grid: null,
              photo: null,
              _stats365: (meta as any)?.stats ?? null,
            },
          };
        }),
      _source: 'scores365-experiment',
      _starterCount: starters.length,
      _lineupsConfirmed: lineupsConfirmed,
    };
  };

  const home365 = game.homeCompetitor;
  const away365 = game.awayCompetitor;
  const home = resolvedAlignment.swapped
    ? mapSide(away365, base.teams.home, away365?.name, 'away-as-home')
    : mapSide(home365, base.teams.home, home365?.name, 'home');
  const away = resolvedAlignment.swapped
    ? mapSide(home365, base.teams.away, home365?.name, 'home-as-away')
    : mapSide(away365, base.teams.away, away365?.name, 'away');
  return [home, away].filter(Boolean);
}

export async function mapScores365ToApiFootballFixture(
  game: Scores365Game,
  baseInput?: FixtureFromAPI | null,
  fixtureIdOverride?: number,
): Promise<FixtureFromAPI | null> {
  const fixtureId =
    fixtureIdOverride ?? baseInput?.fixture?.id ?? getScores365ExperimentConfig().fixtureId;
  const base =
    baseInput ?? (await loadBaseFixture(fixtureId)) ?? synthesizeBaseFrom365Game(game, fixtureId);

  const alignment = detect365TeamAlignment(game, base);
  if (!alignment) {
    logger.warn(
      `[Scores365Experiment] refuse fixture map game ${game.id} → ${fixtureId}: team names mismatch (${game.homeCompetitor?.name}/${game.awayCompetitor?.name} vs ${base.teams.home?.name}/${base.teams.away?.name})`,
    );
    return null;
  }

  registerScores365FixtureMapping(fixtureId, game.id);

  const status = map365Status(game);
  const scores = resolve365Scores(game, alignment);
  const homeScore = scores.home;
  const awayScore = scores.away;
  const kickoff = game.startTime ?? base.fixture.date;
  const home365 = game.homeCompetitor;
  const away365 = game.awayCompetitor;
  const homeDisplay = alignment.swapped ? away365?.name : home365?.name;
  const awayDisplay = alignment.swapped ? home365?.name : away365?.name;

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
        name: homeDisplay ?? base.teams.home.name,
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
        name: awayDisplay ?? base.teams.away.name,
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
  const gameId = (await ensureScores365GameMapping(fixtureId)) ?? getScores365GameIdForFixture(fixtureId);
  if (!gameId) return [];

  const game = await fetchScores365GameById(gameId, { force, language });
  if (!game) return [];

  const base = (await loadBaseFixture(fixtureId)) ?? synthesizeBaseFrom365Game(game, fixtureId);

  const alignment = detect365TeamAlignment(game, base);
  if (!alignment) return [];

  const events = mapScores365Events(game, base, alignment);
  const scores = resolve365Scores(game, alignment);
  const homeId = base.teams.home?.id;
  const awayId = base.teams.away?.id;
  if (
    homeId &&
    awayId &&
    !eventsMatch365ScoreLine(events, homeId, awayId, scores.home, scores.away)
  ) {
    if (shouldServe365EventsDespiteMismatch(game, events)) {
      logger.warn(
        `[Scores365Experiment] fixture ${fixtureId}: events/score tally mismatch — serving ${events.length} events anyway`,
      );
      return events;
    }
    logger.warn(
      `[Scores365Experiment] drop events for fixture ${fixtureId}: tally ${JSON.stringify(tallyGoalsFromMappedEvents(events, homeId, awayId))} ≠ 365 score ${scores.home}-${scores.away}`,
    );
    return [];
  }

  return events;
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
  options?: { force?: boolean },
): Promise<{
  fixture: FixtureFromAPI | null;
  lineups: any[];
  statistics: any[];
  events: any[];
  venue: any | null;
  source: 'scores365-experiment';
} | null> {
  const gameId = (await ensureScores365GameMapping(fixtureId)) ?? getScores365GameIdForFixture(fixtureId);
  if (!gameId) return null;

  const game = await fetchScores365GameById(gameId, {
    language,
    force: options?.force === true,
  });
  if (!game) return null;

  const base = (await loadBaseFixture(fixtureId)) ?? synthesizeBaseFrom365Game(game, fixtureId);

  const fixture = await mapScores365ToApiFootballFixture(game, base, fixtureId);
  if (!fixture) return null;

  const alignment = detect365TeamAlignment(game, base);
  if (!alignment) return null;

  let events = mapScores365Events(game, base, alignment);
  const homeId = base.teams.home?.id;
  const awayId = base.teams.away?.id;
  if (
    homeId &&
    awayId &&
    !eventsMatch365ScoreLine(events, homeId, awayId, fixture.goals.home, fixture.goals.away)
  ) {
    if (!shouldServe365EventsDespiteMismatch(game, events)) {
      logger.warn(
        `[Scores365Experiment] bundle ${fixtureId}: events/score mismatch — serving score only`,
      );
      events = [];
    } else {
      logger.warn(
        `[Scores365Experiment] bundle ${fixtureId}: events/score mismatch — keeping ${events.length} events`,
      );
    }
  }

  let statistics = (base as any).statistics ?? [];
  if (!hasApiStatistics(statistics) && events.length > 0) {
    statistics = buildFallbackStatisticsFromEvents(fixture, events);
  }

  return {
    fixture,
    lineups: mapScores365Lineups(game, base, alignment),
    events,
    statistics,
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

  const todayKey = new Intl.DateTimeFormat('en-CA', {
    timeZone: process.env.SCORES365_TIMEZONE || 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const isToday = dateString === todayKey;
  const lang = resolveScores365AppLanguage(language);
  const games = await fetchScores365WorldCupFixtures({ language, liveRefresh: isToday });
  if (!games.length) return [];

  const mapped: any[] = [];
  for (const game of games) {
    const matchDate = calendarDateFromStart(game.startTime);
    const live = is365Live(game);
    if (dateString !== matchDate && !(live && isToday)) {
      continue;
    }

    const dbRow = resolveDbFixtureFor365Game(game, dbRows);

    // Live matches on today: refresh from /web/game/ (fixtures list lags by ~30–60s).
    let gameForMap = game;
    if (live && isToday) {
      const fresh = await fetchScores365GameById(game.id, { language: lang });
      if (fresh) gameForMap = fresh;
    }

    // Build directly from 365 data when API-Football has no row (synthetic fixtureId = gameId).
    const base = dbRow ? matchCacheService.convertDbMatchToApiFormat(dbRow) : null;
    const fixture = await mapScores365ToApiFootballFixture(
      gameForMap,
      base,
      dbRow?.fixtureId ?? game.id,
    );
    if (fixture) mapped.push(fixture);
  }

  mapped.sort((a, b) => (a.fixture?.timestamp ?? 0) - (b.fixture?.timestamp ?? 0));

  if (mapped.length > 0) {
    logger.info(
      `[Scores365Experiment] ${mapped.length} fixtures on ${dateString} (lang=${resolveScores365LangId(language)} liveRefresh=${isToday})`,
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

const SYNTHETIC_LIVE_STATUSES = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT'] as const;
const SYNTHETIC_LIVE_BATCH = 40;

/**
 * Refresh non-WC 365 synthetic fixtures from GET /web/game/ — accurate minutes/scores
 * (allscores list lags ~30–60s; mirrors WC liveRefresh in getScores365MatchesForDate).
 * Writes live rows into Redis overlay so /fixtures/live and today's calendar stay fresh.
 */
export async function sync365SyntheticLiveSnapshots(
  options?: { language?: string | null; gameIds?: number[] },
): Promise<number> {
  if (!isScores365ExperimentEnabled()) return 0;

  const lang = resolveScores365AppLanguage(options?.language ?? null);
  const liveSet = new Set<string>(SYNTHETIC_LIVE_STATUSES);
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 1);

  let targetIds: number[];
  if (options?.gameIds?.length) {
    targetIds = [...new Set(options.gameIds)].slice(0, SYNTHETIC_LIVE_BATCH);
  } else {
    const rows = await prisma.cachedFixture.findMany({
      where: {
        leagueId: { gte: SCORES365_LEAGUE_ID_OFFSET },
        status: { in: [...SYNTHETIC_LIVE_STATUSES] },
        matchDate: { gte: since },
      },
      select: { fixtureId: true },
      orderBy: { updatedAt: 'asc' },
      take: SYNTHETIC_LIVE_BATCH,
    });
    targetIds = rows.map((r) => r.fixtureId);
  }

  if (!targetIds.length) return 0;

  const refreshedLive: FixtureFromAPI[] = [];
  let updated = 0;

  for (const fixtureId of targetIds) {
    try {
      const game = await fetchScores365GameById(fixtureId, { force: true, language: lang });
      if (!game) continue;

      const dbRow = await prisma.cachedFixture.findUnique({ where: { fixtureId } });
      const base = dbRow ? matchCacheService.convertDbMatchToApiFormat(dbRow) : null;
      const mapped = await mapScores365ToApiFootballFixture(game, base, fixtureId);
      if (!mapped) continue;

      await matchCacheService.upsertFixtures([mapped]);
      updated += 1;

      const short = mapped.fixture?.status?.short ?? '';
      if (liveSet.has(short)) {
        refreshedLive.push(mapped);
      }
    } catch (err: unknown) {
      logger.warn(`[365Live] refresh fixture ${fixtureId} failed:`, (err as Error)?.message);
    }
  }

  if (refreshedLive.length > 0) {
    const { mergeLiveFixturesIntoRedisSnapshot } = await import('./live-fixture-cache.service');
    await mergeLiveFixturesIntoRedisSnapshot(refreshedLive);
  }

  if (updated > 0) {
    logger.info(
      `[365Live] refreshed ${updated} synthetic fixtures (${refreshedLive.length} live in Redis overlay)`,
    );
  }

  return updated;
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
