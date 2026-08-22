/**
 * 365Scores live experiment — single-match feed for all users.
 * Maps webws.365scores.com game payload → API-Football shapes the app already consumes.
 */

import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import {
  isWorldCupHistoricalOnlyMode,
} from '../config/world-cup-only-mode.config';
import { matchCacheService } from './match-cache.service';
import type { FixtureFromAPI } from './match-cache.service';
import { buildFallbackStatisticsFromEvents, hasApiStatistics } from '../utils/match-stats-fallback';
import { buildScores365AthletePhotoUrl, buildScores365CoachPhotoUrl } from '../utils/scores365-athlete-photo';
import { findCoachInLineup } from './coach-lookup.service';
import { buildTeamStatisticsFrom365Players } from '../utils/scores365-player-stats';
import { calendarTodayKey, calendarDateFromKickoff } from '../utils/calendar-day-bounds.util';
import { isNative365FixtureId } from '../utils/native-365-fixture-id';
import { extractScores365CrowdWinPrediction } from '../utils/scores365-crowd-prediction.util';
import { withSyncLeaderLease } from './football-sync-leader.service';
import {
  SCORES365_LEAGUE_ID_OFFSET,
  scores365CompetitionToLeagueId,
} from '../utils/scores365-league-id.util';

export { SCORES365_LEAGUE_ID_OFFSET, scores365CompetitionToLeagueId };

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

interface Scores365CrowdVoteOption {
  num?: number;
  name?: string;
  vote?: { count?: number; percentage?: number };
}

interface Scores365PromotedPrediction {
  id?: number;
  type?: number;
  title?: string;
  totalVotes?: number;
  options?: Scores365CrowdVoteOption[];
}

export interface Scores365CrowdPrediction {
  homePercent: number;
  drawPercent: number;
  awayPercent: number;
  totalVotes: number;
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
  stageNum?: number;
  roundNum?: number;
  groupNum?: number;
  lineupsStatus?: number;
  lineupsStatusText?: string;
  homeCompetitor?: Scores365Competitor;
  awayCompetitor?: Scores365Competitor;
  events?: Scores365Event[];
  members?: Scores365Member[];
  venue?: { id?: number; name?: string; shortName?: string; capacity?: number };
  hasStats?: boolean;
  promotedPredictions?: { predictions?: Scores365PromotedPrediction[] };
  /** SportRadar embeds (LMT pitch tracker, momentum, …). */
  widgets?: Scores365Widget[];
}

interface Scores365Widget {
  provider?: string;
  partnerId?: string | number;
  widgetUrl?: string;
  widgetRatio?: number;
  widgetType?: string;
}

interface Scores365Competitor {
  id: number;
  name: string;
  score?: number;
  /** Penalty shootout tally when 365 exposes it directly on the competitor. */
  penaltyScore?: number;
  /** Aggregate (two-leg) score when 365 exposes it. */
  aggregatedScore?: number;
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
  formation?: { id?: number; shortName?: string };
  yardFormation?: { line?: number; fieldPosition?: number; fieldLine?: number; fieldSide?: number };
  ranking?: number;
  stats?: Array<{ type?: number; value?: string }>;
}

interface Scores365Member {
  id: number;
  competitorId: number;
  athleteId?: number;
  name: string;
  shortName?: string;
  jerseyNumber?: number;
  imageVersion?: number;
}

interface Scores365Event {
  competitorId: number;
  gameTime?: number;
  gameTimeDisplay?: string;
  addedTime?: number;
  order?: number;
  num?: number;
  playerId?: number;
  extraPlayers?: number[];
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

const MAX_365_GAME_CACHE = 300;

function setBoundedMapEntry<V>(map: Map<string, V>, key: string, value: V): void {
  if (!map.has(key) && map.size >= MAX_365_GAME_CACHE) {
    const oldest = map.keys().next().value;
    if (oldest !== undefined) map.delete(oldest);
  }
  map.set(key, value);
}

export function getScores365InProcessCacheSizes(): {
  cachedGameByKey: number;
  lastGoodGameByKey: number;
} {
  return {
    cachedGameByKey: cachedGameByKey.size,
    lastGoodGameByKey: lastGoodGameByKey.size,
  };
}

let cachedFixturesByLang = new Map<number, { fetchedAt: number; games: Scores365Game[] }>();
let inFlightFixturesFetch = new Map<number, Promise<Scores365Game[]>>();

/** fixtureId → 365Scores gameId (built from fixtures list sync). */
const fixtureToGameId = new Map<number, number>();
/** 365Scores gameId → API-Football fixtureId (reverse of fixtureToGameId). */
const gameIdToFixtureId = new Map<number, number>();

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
 * Emergency-only hotfix: force fresh 365 lineups/events/stats (bypass caches).
 * Defaults OFF. Requires an explicit opt-in value (`emergency`) so leftover
 * WC_STORE_HOTFIX=true from the store-launch era does not keep bypassing caches.
 */
export function is365StoreDetailsHotfix(): boolean {
  const raw = process.env.WC_STORE_HOTFIX?.trim()?.toLowerCase();
  return raw === 'emergency';
}

let storeHotfixLogged = false;
export function log365StoreHotfixStartup(): void {
  if (!is365StoreDetailsHotfix() || storeHotfixLogged) return;
  storeHotfixLogged = true;
  logger.info(
    '[Scores365] WC store hotfix ON (WC_STORE_HOTFIX=emergency) - forcing fresh 365 details',
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
  // Default OFF: 365Scores upstream is queried in the user's language (langId 27
  // for Arabic, 1 for English). Per-language caching is keyed by langId, so this
  // does not cause cross-language collisions. Set SCORES365_FORCE_ENGLISH=true to
  // force English everywhere (e.g. for debugging or legacy clients).
  return raw === 'true' || raw === '1';
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

/** True when the query contains Arabic script (365 search needs langId 27 for these). */
export function queryLooksArabic(query: string): boolean {
  return /[\u0600-\u06FF]/.test(query);
}

/**
 * Lang id for /web/search/ only — ignores SCORES365_FORCE_ENGLISH so Arabic names resolve.
 */
export function resolveScores365SearchLangId(query: string, appLanguage?: string | null): number {
  const langAr = parseInt(process.env.SCORES365_LANG_ID_AR || process.env.SCORES365_LANG_ID || '27', 10);
  const langEn = parseInt(process.env.SCORES365_LANG_ID_EN || '1', 10);
  if (queryLooksArabic(query)) return langAr;
  const lang = (appLanguage || process.env.SCORES365_DEFAULT_LANG || 'ar').trim().toLowerCase();
  return lang.startsWith('en') ? langEn : langAr;
}

export function getScores365CompetitionId(): number {
  return parseInt(process.env.SCORES365_COMPETITION_ID || '5930', 10);
}

export function registerScores365FixtureMapping(fixtureId: number, gameId: number): void {
  fixtureToGameId.set(fixtureId, gameId);
  gameIdToFixtureId.set(gameId, fixtureId);
}

export function readPersistedScores365GameId(fullData: unknown): number | null {
  if (!fullData || typeof fullData !== 'object') return null;
  const raw = (fullData as { _scores365GameId?: unknown })._scores365GameId;
  const gameId = typeof raw === 'number' ? raw : Number(raw);
  return Number.isInteger(gameId) && gameId > 0 ? gameId : null;
}

export type Scores365FixtureMetadataMapping = {
  fixtureId: number;
  game: Scores365Game;
};

/**
 * Merge provider identity and LMT metadata into the durable fixture JSON.
 * Scalar/full fixture data is preserved so reconciliation cannot erase details.
 */
export async function persistScores365FixtureMetadata(
  mappings: Scores365FixtureMetadataMapping[],
): Promise<number> {
  const byFixtureId = new Map(
    mappings
      .filter(({ fixtureId, game }) => fixtureId > 0 && Number.isInteger(game?.id))
      .map((mapping) => [mapping.fixtureId, mapping]),
  );
  if (!byFixtureId.size) return 0;

  const rows = await prisma.cachedFixture.findMany({
    where: { fixtureId: { in: [...byFixtureId.keys()] } },
    select: { fixtureId: true, fullData: true },
  });
  let updated = 0;
  await Promise.all(
    rows.map(async (row) => {
      const mapping = byFixtureId.get(row.fixtureId);
      if (!mapping) return;
      const existing = (row.fullData as Record<string, unknown> | null) ?? {};
      const widget = pickLmtWidget(mapping.game);
      const partnerId = widget ? partnerIdFromWidget(widget) : null;
      const existingLmt =
        existing._lmt && typeof existing._lmt === 'object'
          ? (existing._lmt as Record<string, unknown>)
          : {};
      const next = {
        ...existing,
        _scores365GameId: mapping.game.id,
        ...(partnerId
          ? {
              _lmt: {
                ...existingLmt,
                partnerId,
                provider: widget?.provider ?? null,
                widgetType: widget?.widgetType ?? 'LMT',
                widgetRatio:
                  typeof widget?.widgetRatio === 'number' ? widget.widgetRatio : null,
                sourceUrl: widget?.widgetUrl ?? null,
              },
            }
          : {}),
      };
      const alreadyCurrent =
        readPersistedScores365GameId(existing) === mapping.game.id &&
        (!partnerId || String(existingLmt.partnerId ?? '') === partnerId);
      if (alreadyCurrent) return;
      await prisma.cachedFixture.update({
        where: { fixtureId: row.fixtureId },
        data: { fullData: next as never },
      });
      registerScores365FixtureMapping(row.fixtureId, mapping.game.id);
      updated += 1;
    }),
  );
  if (updated > 0) cachedWorldCupDbRows = null;
  return updated;
}

/**
 * Resolve a 365Scores gameId to the API-Football fixtureId used in our DB/cache.
 * Returns null when the game is unknown or only exists as a synthetic 365-only row.
 */
export async function resolveApiFixtureIdFor365GameId(gameId: number): Promise<number | null> {
  if (!isScores365ExperimentEnabled()) return null;

  const cfg = getScores365ExperimentConfig();
  if (gameId === cfg.gameId) return cfg.fixtureId;

  const fromReverse = gameIdToFixtureId.get(gameId);
  if (fromReverse != null) return fromReverse;

  for (const [fixtureId, mappedGameId] of fixtureToGameId.entries()) {
    if (mappedGameId === gameId) {
      gameIdToFixtureId.set(gameId, fixtureId);
      return fixtureId;
    }
  }

  const wcRows = await loadWorldCupDbFixtures(cfg.leagueId, cfg.season);
  for (const row of wcRows) {
    const mapped =
      getScores365GameIdForFixture(row.fixtureId) ??
      readPersistedScores365GameId(row.fullData);
    if (mapped === gameId) {
      registerScores365FixtureMapping(row.fixtureId, gameId);
      return row.fixtureId;
    }
  }

  const persistedMapping = await prisma.cachedFixture.findFirst({
    where: {
      fullData: {
        path: ['_scores365GameId'],
        equals: gameId,
      },
    },
    select: { fixtureId: true },
  });
  if (persistedMapping) {
    registerScores365FixtureMapping(persistedMapping.fixtureId, gameId);
    return persistedMapping.fixtureId;
  }

  const dbRow = await prisma.cachedFixture.findUnique({
    where: { fixtureId: gameId },
    select: { leagueId: true },
  });
  if (dbRow && dbRow.leagueId >= SCORES365_LEAGUE_ID_OFFSET) {
    registerScores365FixtureMapping(gameId, gameId);
    return gameId;
  }

  return null;
}

export function getScores365GameIdForFixture(fixtureId: number): number | null {
  const cfg = getScores365ExperimentConfig();
  if (fixtureId === cfg.fixtureId) return cfg.gameId;
  const mapped = fixtureToGameId.get(fixtureId);
  if (mapped) return mapped;
  if (isNative365FixtureId(fixtureId)) return fixtureId;
  return null;
}

export { isNative365FixtureId } from '../utils/native-365-fixture-id';

export function isScores365ExperimentFixture(fixtureId: number): boolean {
  if (!isScores365ExperimentEnabled()) return false;
  return getScores365GameIdForFixture(fixtureId) != null;
}

const ON_DEMAND_REFRESH_MIN_INTERVAL_MS = 30_000;
const ON_DEMAND_DAY_MAP_MIN_INTERVAL_MS = 12_000;
let lastOnDemandRefresh = 0;
let lastOnDemandDayMap = 0;

/**
 * Find a 365 gameId for an API-Football (or cached) row via team names + kickoff.
 */
function find365GameIdForDbRow(
  row: {
    fixtureId: number;
    homeTeamName: string;
    awayTeamName: string;
    matchDate: Date;
    matchTimestamp: number | null;
  },
  games: Scores365Game[],
): number | null {
  const rowMs = row.matchTimestamp ? row.matchTimestamp * 1000 : row.matchDate.getTime();
  const maxDeltaMs = 3 * 60 * 60 * 1000;
  type Candidate = { gameId: number; delta: number; teamHits: number };
  const candidates: Candidate[] = [];

  for (const game of games) {
    if (typeof game?.id !== 'number') continue;
    const gameMs = kickoffMs(game.startTime);
    if (gameMs == null) continue;
    const delta = Math.abs(rowMs - gameMs);
    if (delta > maxDeltaMs) continue;
    const { direct, swapped } = scoreDbRowTeamsFor365Game(game, row);
    const teamHits = Math.max(direct, swapped);
    if (teamHits < 2) continue;
    candidates.push({ gameId: game.id, delta, teamHits });
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => a.delta - b.delta || b.teamHits - a.teamHits);
  const best = candidates[0];
  const tied = candidates.filter(
    (c) => c.delta === best.delta && c.teamHits === best.teamHits,
  );
  if (tied.length > 1) return null;
  return best.gameId;
}

/**
 * Map unmapped API fixtureIds by pulling that calendar day's /allscores/ feed
 * (cached) and fuzzy-matching team + kickoff. Works for NS/FT — not only live.
 */
async function tryMapFixtureViaDayAllScores(
  fixtureId: number,
  dbRow: {
    homeTeamName: string;
    awayTeamName: string;
    matchDate: Date;
    matchTimestamp: number | null;
  } | null,
): Promise<number | null> {
  if (!dbRow) return null;

  const dateKey =
    calendarDateFromKickoff(dbRow.matchDate.toISOString()) ??
    dbRow.matchDate.toISOString().slice(0, 10);

  const now = Date.now();
  const rateLimited = now - lastOnDemandDayMap < ON_DEMAND_DAY_MAP_MIN_INTERVAL_MS;

  try {
    const { threeSixFiveScoresService } = await import('./threeSixFiveScores.service');
    // Prefer cache when rate-limited; otherwise allow a fresh day pull.
    const result = await threeSixFiveScoresService.getAllScores(dateKey, dateKey, 'en', {
      force: !rateLimited,
    });
    if (!rateLimited) lastOnDemandDayMap = now;

    const mappedAfterPersist = getScores365GameIdForFixture(fixtureId);
    if (mappedAfterPersist) return mappedAfterPersist;

    const games = (result.data ?? [])
      .map((item) => item.raw)
      .filter((g): g is Scores365Game => !!g && typeof g.id === 'number');
    if (!games.length) return null;

    const gameId = find365GameIdForDbRow({ fixtureId, ...dbRow }, games);
    if (gameId) {
      registerScores365FixtureMapping(fixtureId, gameId);
      logger.info(
        `[Scores365] on-demand day map fixtureId=${fixtureId} → gameId=${gameId} (${dateKey})`,
      );
      return gameId;
    }
  } catch (err: unknown) {
    logger.debug(
      `[Scores365] day allscores map failed for fixture ${fixtureId}:`,
      (err as Error)?.message,
    );
  }
  return null;
}

/** Lazy map API-Football fixtureId → 365 gameId (passive check + rate-limited live fallback). */
export async function ensureScores365GameMapping(fixtureId: number): Promise<number | null> {
  const existing = getScores365GameIdForFixture(fixtureId);
  if (existing) return existing;
  if (isNative365FixtureId(fixtureId)) {
    registerScores365FixtureMapping(fixtureId, fixtureId);
    return fixtureId;
  }
  if (!isScores365ExperimentEnabled()) return null;

  logger.debug(`[Scores365] fixtureId=${fixtureId} not yet in map — checking if on-demand refresh is warranted`);

  const dbRow = await prisma.cachedFixture.findUnique({
    where: { fixtureId },
    select: {
      status: true,
      leagueId: true,
      homeTeamName: true,
      awayTeamName: true,
      matchDate: true,
      matchTimestamp: true,
      fullData: true,
    },
  });

  const persistedGameId = readPersistedScores365GameId(dbRow?.fullData);
  if (persistedGameId) {
    registerScores365FixtureMapping(fixtureId, persistedGameId);
    return persistedGameId;
  }
  if (
    isWorldCupHistoricalOnlyMode() &&
    dbRow &&
    dbRow.leagueId === getScores365ExperimentConfig().leagueId &&
    (['FT', 'AET', 'PEN', 'CANC', 'ABD', 'AWD', 'WO'].includes(dbRow.status) ||
      dbRow.matchDate.getTime() < Date.now())
  ) {
    return null;
  }

  // 365 gameIds stored as fixtureId (>= 4M) — resolve directly without waiting for bulk sync.
  if (fixtureId >= 4_000_000) {
    const direct = await fetchScores365GameById(fixtureId, { language: 'en' });
    if (direct?.id) {
      registerScores365FixtureMapping(fixtureId, direct.id);
      return direct.id;
    }
  }

  // Non-WC synthetic 365 fixtures store the 365 gameId AS the fixtureId and use
  // a namespaced leagueId (>= SCORES365_LEAGUE_ID_OFFSET). The fixture↔game map
  // is only built inside the sync worker process, so the web process never has
  // it — resolve directly here so events/lineups/stats work for every league.
  if (dbRow && dbRow.leagueId >= SCORES365_LEAGUE_ID_OFFSET) {
    registerScores365FixtureMapping(fixtureId, fixtureId);
    return fixtureId;
  }

  // Form-tab / deep links may pass a 365 gameId instead of API-Football fixtureId.
  const apiFixtureId = await resolveApiFixtureIdFor365GameId(fixtureId);
  if (apiFixtureId != null) {
    registerScores365FixtureMapping(apiFixtureId, fixtureId);
    return fixtureId;
  }

  const directGame = await fetchScores365GameById(fixtureId, { language: 'en' });
  if (directGame?.id) {
    registerScores365FixtureMapping(fixtureId, directGame.id);
    return directGame.id;
  }

  const cfg = getScores365ExperimentConfig();
  if (dbRow && dbRow.leagueId === cfg.leagueId) {
    const wcRows = await loadWorldCupDbFixtures(cfg.leagueId, cfg.season);
    const games = await fetchScores365WorldCupFixtures({ language: 'en' });
    for (const game of games) {
      const mapped = resolveDbFixtureFor365Game(game, wcRows);
      if (mapped?.fixtureId === fixtureId) {
        registerScores365FixtureMapping(fixtureId, game.id);
        return game.id;
      }
    }
  }

  // Any status (NS / live / FT): try calendar-day allscores fuzzy map so opening
  // match details on lower-tier API fixtures can still use 365 lineups/stats.
  const dayMapped = await tryMapFixtureViaDayAllScores(fixtureId, dbRow);
  if (dayMapped) return dayMapped;

  const LIVE_STATUSES = new Set(['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT', 'SUSP']);
  const isPlausiblyLive = !!dbRow && LIVE_STATUSES.has(dbRow.status);

  if (!isPlausiblyLive) {
    logger.debug(
      `[Scores365] fixtureId=${fixtureId} reason=not_live_waiting_bulk status=${dbRow?.status ?? 'unknown'}`,
    );
    return null;
  }

  if (Date.now() - lastOnDemandRefresh < ON_DEMAND_REFRESH_MIN_INTERVAL_MS) {
    logger.warn(
      `[Scores365] fixtureId=${fixtureId} reason=rate_skip status=LIVE missing_map`,
    );
    return null;
  }

  // WC-only bulk remap — never run for generic non-WC live fixtures (use day allscores above).
  const cfgLeagueId = cfg.leagueId;
  if (dbRow && dbRow.leagueId === cfgLeagueId) {
    logger.warn(
      `[Scores365] fixtureId=${fixtureId} is LIVE WC but missing from map — triggering WC bulk refresh`,
    );
    lastOnDemandRefresh = Date.now();
    const { runBulkFixtureSyncTick } = await import('../workers/worldCupSync.service');
    await runBulkFixtureSyncTick();
    return getScores365GameIdForFixture(fixtureId);
  }

  logger.warn(
    `[Scores365] fixtureId=${fixtureId} reason=unmapped status=LIVE leagueId=${dbRow?.leagueId ?? 'n/a'} (day allscores miss; skipped WC bulk)`,
  );
  return null;
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
  const durableMappings: Scores365FixtureMetadataMapping[] = [];
  for (const game of games) {
    const row = resolveDbFixtureFor365Game(game, dbRows);
    if (!row) continue;
    registerScores365FixtureMapping(row.fixtureId, game.id);
    durableMappings.push({ fixtureId: row.fixtureId, game });
    mapped += 1;
  }
  await persistScores365FixtureMetadata(durableMappings);

  const coverageRatio = dbRows.length > 0 ? mapped / dbRows.length : 1;
  const logMsg = `[Scores365] fixture↔game sync: ${mapped}/${games.length} games mapped (${dbRows.length} DB fixtures)`;

  if (coverageRatio < 0.8) {
    logger.warn(`⚠️ ${logMsg} — coverage is suspiciously low (${(coverageRatio * 100).toFixed(1)}%). Upstream feed may have changed or missing DB matches.`);
  } else {
    logger.info(`✅ ${logMsg}`);
  }

  return mapped;
}

/** Audit/backfill durable WC fixture↔365 and LMT metadata coverage. */
export async function auditAndBackfillWorldCup365Metadata(
  options?: { force?: boolean },
): Promise<{ fixtures: number; games: number; mapped: number; updated: number; missing: number }> {
  const cfg = getScores365ExperimentConfig();
  const dbRows = await loadWorldCupDbFixtures(cfg.leagueId, cfg.season);
  const games = await fetchScores365WorldCupFixtures({
    language: 'en',
    force: options?.force === true,
  });
  const mappings: Scores365FixtureMetadataMapping[] = [];
  for (const game of games) {
    const row = resolveDbFixtureFor365Game(game, dbRows);
    if (!row) continue;
    mappings.push({ fixtureId: row.fixtureId, game });
  }
  const updated = await persistScores365FixtureMetadata(mappings);
  return {
    fixtures: dbRows.length,
    games: games.length,
    mapped: mappings.length,
    updated,
    missing: Math.max(0, dbRows.length - mappings.length),
  };
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
      setBoundedMapEntry(lastGoodGameByKey, staleKey, game);
      setBoundedMapEntry(cachedGameByKey, gameCacheKey(gameId, langId), {
        fetchedAt: Date.now(),
        game,
      });
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
  if (!isScores365ExperimentEnabled() && !isNative365FixtureId(gameId)) return null;

  const langId = resolveScores365LangId(options?.language);
  const ttlMs = Math.max(2_000, parseInt(process.env.SCORES365_CACHE_MS || '3000', 10) || 3_000);
  const key = gameCacheKey(gameId, langId);
  const cached = cachedGameByKey.get(key);

  if (cached && Date.now() - cached.fetchedAt >= ttlMs * 30) {
    // Drop long-stale entries so the Map cannot retain forever across langs.
    cachedGameByKey.delete(key);
  } else if (!options?.force && cached && Date.now() - cached.fetchedAt < ttlMs) {
    return cached.game ?? lastGoodGameByKey.get(lastGoodGameKey(gameId, langId)) ?? null;
  }

  if (isWorldCupHistoricalOnlyMode()) {
    const durable = await prisma.cachedFixture.findFirst({
      where: {
        fullData: {
          path: ['_scores365GameId'],
          equals: gameId,
        },
      },
      select: { status: true, matchDate: true, leagueId: true },
    });
    const isHistorical =
      !!durable &&
      durable.leagueId === getScores365ExperimentConfig().leagueId &&
      (['FT', 'AET', 'PEN', 'CANC', 'ABD', 'AWD', 'WO'].includes(durable.status) ||
        durable.matchDate.getTime() < Date.now());
    if (isHistorical) return null;
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

/** Round label from 365 (group stage vs knockout). Never reuse stale DB round when 365 omits groupName. */
export function resolve365FixtureRound(game: Scores365Game): string {
  if (game.groupName?.trim()) {
    return [game.roundName, game.groupName].filter(Boolean).join(' - ').trim();
  }
  if (game.roundName?.trim()) return game.roundName.trim();
  const display = game.competitionDisplayName ?? '';
  for (const sep of [' - ', ' – ', ' — ']) {
    if (!display.includes(sep)) continue;
    const tail = display.split(sep).pop()?.trim();
    if (tail && tail !== display.trim()) return tail;
  }
  return '';
}

/** Prefer live 365 competition label (includes knockout round names). */
export function resolve365LeagueDisplayName(game: Scores365Game, fallback?: string): string {
  const display = game.competitionDisplayName?.trim();
  if (display) return display;
  const round = resolve365FixtureRound(game);
  const base = fallback?.trim() || 'FIFA World Cup';
  return round ? `${base} - ${round}` : base;
}

async function map365GameToFixture(
  game: Scores365Game,
  dbRows: Awaited<ReturnType<typeof loadWorldCupDbFixtures>>,
  language?: string | null,
  options?: { refreshIfLive?: boolean },
): Promise<any | null> {
  let gameForMap = game;
  if (options?.refreshIfLive && is365Live(game)) {
    const fresh = await fetchScores365GameById(game.id, {
      language: resolveScores365AppLanguage(language),
    });
    if (fresh) gameForMap = fresh;
  }
  const dbRow = resolveDbFixtureFor365Game(gameForMap, dbRows);
  const base = dbRow ? matchCacheService.convertDbMatchToApiFormat(dbRow) : null;
  return mapScores365ToApiFootballFixture(
    gameForMap,
    base,
    dbRow?.fixtureId ?? game.id,
  );
}

/** Parse injury/stoppage from 365 `gameTimeDisplay` like `90+4`, `45+2`, `+3'`. */
function parse365StoppageExtra(
  displayRaw: string,
  minute: number | null,
): number | null {
  const display = displayRaw.trim();
  if (!display) return null;
  const plusMatch = display.match(/(\d+)\s*\+\s*(\d+)/);
  if (plusMatch) {
    const n = Number(plusMatch[2]);
    return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 15) : null;
  }
  const barePlus = display.match(/^\+?\s*(\d+)\s*'?$/);
  if (barePlus && minute != null && (minute === 45 || minute === 90 || minute === 105 || minute === 120)) {
    const n = Number(barePlus[1]);
    return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 15) : null;
  }
  return null;
}

/** Status rules validated against 365Scores feed (statusGroup, score -1, statusText). */
export function classifyScores365MatchStatus(
  game: Scores365Game,
): { short: string; long: string; elapsed: number | null; extra: number | null } {
  const homeRaw = game.homeCompetitor?.score;
  const awayRaw = game.awayCompetitor?.score;
  const text = (game.statusText ?? '').toLowerCase();
  const shortCode = (game.shortStatusText ?? '').trim().toLowerCase();
  const displayRaw = (game.gameTimeDisplay ?? '').trim();
  const display = displayRaw.toLowerCase();
  const minuteRaw = game.gameTime;
  const minute =
    minuteRaw != null && minuteRaw >= 0 ? Math.floor(minuteRaw) : null;
  const statusGroup = game.statusGroup;
  const stoppageFromDisplay = parse365StoppageExtra(displayRaw, minute);

  // Combined haystack across all textual status hints (365 forces EN upstream by
  // default, so English matches are primary; Arabic kept as best-effort).
  const hay = `${text} ${shortCode} ${display}`;
  const has = (...subs: string[]): boolean => subs.some((s) => hay.includes(s));

  const withExtra = (
    short: string,
    long: string,
    elapsed: number | null,
    extra: number | null = null,
  ) => ({ short, long, elapsed, extra });

  // ── Special match states — detected BEFORE the score/-1/statusGroup rules,
  //    because these carry score -1 (cancelled/postponed) or statusGroup 4
  //    (after ET/penalties) and would otherwise be mislabelled NS/FT. ──

  // Cancelled — terminal, never played to a result.
  if (has('cancel', 'ملغا', 'ألغيت', 'الغيت') || shortCode === 'canc' || shortCode === 'cnc') {
    return withExtra('CANC', 'Match Cancelled', null);
  }

  // Postponed — rescheduled to a later date.
  if (
    has('postpon', 'مؤجل', 'أجلت', 'اجلت') ||
    shortCode === 'pp' ||
    shortCode === 'postp' ||
    shortCode === 'pst'
  ) {
    return withExtra('PST', 'Match Postponed', null);
  }

  // Abandoned — started but not resumed (distinct from cancelled).
  if (has('abandon', 'walkover', 'awarded', 'بالانسحاب') || shortCode === 'abd' || shortCode === 'wo') {
    const short = has('walkover', 'awarded', 'بالانسحاب') ? 'WO' : 'ABD';
    return withExtra(short, short === 'WO' ? 'Walkover' : 'Match Abandoned', null);
  }

  // Penalty shootout — must be checked before the generic finished/live rules.
  const mentionsPenalties =
    has('penalt', 'ترجيح', 'shootout', 'pso') ||
    shortCode === 'pen' ||
    shortCode === 'ap' ||
    shortCode === 'pens';
  if (mentionsPenalties) {
    // Finished after penalties vs. shootout currently in progress.
    if (statusGroup === 4 || has('after', 'ended', 'انته', 'full')) {
      return withExtra('PEN', 'Penalty Shootout - Finished', 120);
    }
    return withExtra('P', 'Penalty Shootout', 120);
  }

  // Extra time (live) / after extra time (finished) / break before ET.
  const mentionsExtraTime =
    has('extra time', 'extra-time', 'e.t.', 'after extra', 'إضاف', 'اضاف', 'وقت اضافي') ||
    shortCode === 'et' ||
    shortCode === 'aet' ||
    shortCode === 'et1' ||
    shortCode === 'et2' ||
    shortCode === 'aet1' ||
    shortCode === 'aet2';
  if (mentionsExtraTime) {
    if (statusGroup === 4 || has('after extra', 'ended', 'انته', 'full time')) {
      return withExtra('AET', 'After Extra Time', 120);
    }
    if (has('break', 'استراح', 'فاصل')) {
      return withExtra('BT', 'Extra Time Break', 105);
    }
    const el = minute != null ? Math.min(Math.max(minute, 91), 120) : 91;
    return withExtra('ET', 'Extra Time', el, stoppageFromDisplay);
  }

  // Interrupted — temporarily halted, expected to resume (kept live so the
  // client keeps polling and shows the last minute).
  if (has('interrupt', 'انقطع', 'انقطاع') || shortCode === 'int') {
    return withExtra('INT', 'Match Interrupted', minute, stoppageFromDisplay);
  }

  // Suspended — halted, may resume later (also kept polling).
  if (has('suspend', 'معلق', 'موقوف') || shortCode === 'susp' || shortCode === 'sus') {
    return withExtra('SUSP', 'Match Suspended', minute, stoppageFromDisplay);
  }

  // 365 statusGroup: 2 = scheduled, 3 = live, 4 = finished (verified on allscores).
  // Score placeholders of -1 are common right at kickoff / before the first
  // event. Only treat them as NS when the game is not already marked live —
  // otherwise statusGroup 3 never reaches the LIVE/1H/2H branches below.
  if ((homeRaw === -1 || awayRaw === -1) && statusGroup !== 3) {
    return withExtra('NS', 'Not Started', null);
  }

  if (statusGroup === 2) {
    return withExtra('NS', 'Not Started', null);
  }

  if (statusGroup === 4) {
    return withExtra('FT', 'Match Finished', 90);
  }

  if (
    text.includes('schedul') ||
    text.includes('postpon') ||
    shortCode === 'ns' ||
    shortCode === 'sched'
  ) {
    return withExtra('NS', 'Not Started', null);
  }

  const isFinishedText =
    text.includes('انته') ||
    text.includes('ended') ||
    text.includes('finish') ||
    text.includes('after pen') ||
    text.includes('full time') ||
    text.includes('fulltime') ||
    shortCode === 'ft' ||
    shortCode === 'aet' ||
    shortCode === 'pen' ||
    shortCode.includes('ended') ||
    display === 'ft' ||
    display.includes('ended');

  if (isFinishedText) {
    return withExtra('FT', 'Match Finished', 90);
  }

  // Stale/high clocks — finished matches sometimes keep gameTime > 90 without FT text.
  if (minute != null && minute > 120) {
    return withExtra('FT', 'Match Finished', 90);
  }
  if (statusGroup !== 3 && minute != null && minute >= 90) {
    return withExtra('FT', 'Match Finished', 90);
  }
  if (minute != null && minute > 105) {
    return withExtra('FT', 'Match Finished', 90);
  }

  if (
    text.includes('استراح') ||
    text.includes('halftime') ||
    text.includes('half time') ||
    text.includes('half-time') ||
    shortCode === 'ht'
  ) {
    return withExtra('HT', 'Halftime', 45);
  }

  // 2nd half — require live statusGroup OR explicit 2nd-half text (not minute > 45 alone).
  if (
    text.includes('second') ||
    text.includes('2nd') ||
    text.includes('الثاني') ||
    shortCode === '2' ||
    shortCode === '2h' ||
    (statusGroup === 3 && minute != null && minute > 45)
  ) {
    const elapsed =
      minute != null ? Math.min(Math.max(minute, 46), 105) : 46;
    // When clock is still at 90 but display is `90+4`, keep elapsed at 90 and set extra.
    const pinnedExtra =
      elapsed === 90 && stoppageFromDisplay != null
        ? stoppageFromDisplay
        : elapsed > 90
          ? null
          : stoppageFromDisplay;
    const displayElapsed =
      elapsed === 90 && pinnedExtra != null ? 90 : elapsed;
    return withExtra('2H', 'Second Half', displayElapsed, pinnedExtra);
  }

  if (
    text.includes('first') ||
    text.includes('1st') ||
    text.includes('الأول') ||
    shortCode === '1' ||
    shortCode === '1h' ||
    (statusGroup === 3 && minute != null && minute > 0 && minute <= 45)
  ) {
    const elapsed = minute;
    const pinnedExtra =
      elapsed === 45 && stoppageFromDisplay != null
        ? stoppageFromDisplay
        : elapsed != null && elapsed > 45
          ? null
          : stoppageFromDisplay;
    return withExtra('1H', 'First Half', elapsed, pinnedExtra);
  }

  if (statusGroup === 3) {
    return withExtra(
      'LIVE',
      'In Progress',
      minute != null ? Math.min(minute, 105) : null,
      stoppageFromDisplay,
    );
  }

  return withExtra('NS', 'Not Started', null);
}

function map365Status(
  game: Scores365Game,
): { short: string; long: string; elapsed: number | null; extra: number | null } {
  return classifyScores365MatchStatus(game);
}

function is365Live(game: Scores365Game): boolean {
  const status = classifyScores365MatchStatus(game);
  // INT/SUSP resume later — keep them in the live set so the client keeps
  // polling and picks up the restart without waiting for a bulk sync.
  return ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT', 'SUSP'].includes(status.short);
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
 * (Implementation: ../utils/scores365-league-id.util.ts — re-exported at module top.)
 */

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
  // Guard against missing/malformed 365 startTime: an invalid kickoff string
  // propagates to clients where `new Date(...).toISOString()` throws
  // `RangeError: Date value out of bounds` under Hermes.
  const kickoff = (() => {
    if (game.startTime) {
      const parsed = new Date(game.startTime);
      if (!Number.isNaN(parsed.getTime())) return game.startTime;
    }
    return new Date().toISOString();
  })();
  const home = game.homeCompetitor;
  const away = game.awayCompetitor;
  const homeScore = normalize365Score(home?.score);
  const awayScore = normalize365Score(away?.score);
  const round = resolve365FixtureRound(game);
  // Synthetic base is always non-swapped (teams taken straight from the 365 game).
  const { extratime, penalty } = resolve365ExtraAndPenalty(
    game,
    { swapped: false },
    status.short,
    { home: homeScore, away: awayScore },
  );

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
        extra: status.extra ?? null,
      },
    },
    league: {
      id: overrides?.leagueId ?? cfg.leagueId,
      name: overrides?.leagueName ?? resolve365LeagueDisplayName(game, 'FIFA World Cup'),
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
      extratime: extratime ?? { home: null, away: null },
      penalty: penalty ?? { home: null, away: null },
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
    .replace(/[^\p{L}\p{N}]/gu, '');
}

function teamNamesMatch(a?: string | null, b?: string | null): boolean {
  const na = normalizeTeamNameForMatch(a);
  const nb = normalizeTeamNameForMatch(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

type Scores365TeamAlignment = { swapped: boolean };

function synthesizeOverridesFromBase(
  base: FixtureFromAPI | null | undefined,
): SynthesizeBaseOverrides | undefined {
  if (!base?.league) return undefined;
  return {
    leagueId: base.league.id,
    season: base.league.season,
    leagueName: base.league.name,
    country: base.league.country,
    leagueLogo: base.league.logo,
  };
}

/**
 * Resolve the API-football base row + home/away alignment for a 365 game.
 * When a cached DB row exists but team labels differ from 365 (AR vs EN,
 * stale API-Football names), fall back to a synthetic base built from 365.
 */
async function resolve365BaseAndAlignment(
  game: Scores365Game,
  fixtureId: number,
  baseInput?: FixtureFromAPI | null,
): Promise<{ base: FixtureFromAPI; alignment: Scores365TeamAlignment } | null> {
  let base =
    baseInput ?? (await loadBaseFixture(fixtureId)) ?? null;
  let alignment = base ? detect365TeamAlignment(game, base) : null;

  if (!alignment) {
    const overrides = synthesizeOverridesFromBase(base);
    base = synthesizeBaseFrom365Game(game, fixtureId, overrides);
    alignment = detect365TeamAlignment(game, base);
  }

  if (!alignment || !base) return null;
  return { base, alignment };
}

function scoreDbRowTeamsFor365Game(
  game: Scores365Game,
  row: { homeTeamName: string; awayTeamName: string },
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
  const h365Id = game.homeCompetitor?.id;
  const a365Id = game.awayCompetitor?.id;
  const homeId = base.teams.home?.id;
  const awayId = base.teams.away?.id;

  if (h365Id && a365Id && homeId && awayId) {
    if (h365Id === homeId && a365Id === awayId) return { swapped: false };
    if (h365Id === awayId && a365Id === homeId) return { swapped: true };
  }

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

/**
 * Fetch 365 game for structural mapping (always EN) plus optional localized
 * payload for display-name overlay when the app language is Arabic.
 */
async function fetch365GamePair(
  gameId: number,
  appLang: 'ar' | 'en',
  force = false,
): Promise<{ structural: Scores365Game | null; localized: Scores365Game | null }> {
  const structural = await fetchScores365GameById(gameId, { language: 'en', force });
  if (!structural) return { structural: null, localized: null };
  const localized =
    appLang !== 'en'
      ? await fetchScores365GameById(gameId, { language: appLang, force })
      : null;
  return { structural, localized };
}

/** Shared EN-structural resolve used by bundle, events, and fixture mappers. */
async function resolve365ExperimentCore(
  fixtureId: number,
  gameId: number,
  language?: string | null,
  options?: { force?: boolean },
): Promise<{
  game: Scores365Game;
  gameLocalized: Scores365Game | null;
  base: FixtureFromAPI;
  alignment: Scores365TeamAlignment;
} | null> {
  const force = options?.force === true;
  const appLang = resolveScores365AppLanguage(language);
  const { structural, localized } = await fetch365GamePair(gameId, appLang, force);
  if (!structural) return null;

  const resolved = await resolve365BaseAndAlignment(structural, fixtureId);
  if (!resolved) return null;

  return {
    game: structural,
    gameLocalized: localized,
    base: resolved.base,
    alignment: resolved.alignment,
  };
}

function validate365MappedEvents(
  fixtureId: number,
  game: Scores365Game,
  base: FixtureFromAPI,
  alignment: Scores365TeamAlignment,
  events: any[],
  expectedHome: number | null,
  expectedAway: number | null,
): any[] {
  const homeId = base.teams.home?.id;
  const awayId = base.teams.away?.id;
  if (
    !homeId ||
    !awayId ||
    eventsMatch365ScoreLine(events, homeId, awayId, expectedHome, expectedAway)
  ) {
    return events;
  }
  if (shouldServe365EventsDespiteMismatch(game, events)) {
    logger.warn(
      `[Scores365Experiment] fixture ${fixtureId}: events/score tally mismatch — serving ${events.length} events anyway`,
    );
    return events;
  }
  logger.warn(
    `[Scores365Experiment] drop events for fixture ${fixtureId}: tally ${JSON.stringify(tallyGoalsFromMappedEvents(events, homeId, awayId))} ≠ 365 score ${expectedHome}-${expectedAway}`,
  );
  return [];
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

type ScorePair = { home: number | null; away: number | null };

/** Read a direct penalty-shootout tally from a 365 competitor when present. */
function readCompetitorPenaltyScore(competitor?: Scores365Competitor): number | null {
  const raw = competitor?.penaltyScore;
  if (typeof raw === 'number' && raw >= 0) return raw;
  return null;
}

/**
 * Count shootout penalties per team from the raw 365 events.
 * Only used while the match is in a shootout (P) or finished after penalties
 * (PEN); guarded to `gameTime >= 120` so in-play / extra-time penalties are not
 * mistaken for shootout kicks. "Missed"/"saved" kicks are not counted as scored.
 */
function tallyShootoutFromRawEvents(
  game: Scores365Game,
  alignment: Scores365TeamAlignment,
): ScorePair | null {
  const events = game.events ?? [];
  if (!events.length) return null;

  let home365 = 0;
  let away365 = 0;
  let found = false;
  for (const ev of events) {
    const name = `${ev.eventType?.name ?? ''} ${ev.eventType?.subTypeName ?? ''}`.toLowerCase();
    const isPenaltyKick = /penalt/.test(name) || /shootout/.test(name);
    if (!isPenaltyKick) continue;
    const gt = ev.gameTime ?? 0;
    if (gt < 120) continue; // exclude normal-time / extra-time penalties
    found = true;
    const scored = !/miss|saved|fail/.test(name);
    if (!scored) continue;
    if (ev.competitorId === game.homeCompetitor?.id) home365 += 1;
    else if (ev.competitorId === game.awayCompetitor?.id) away365 += 1;
  }
  if (!found) return null;
  return alignment.swapped
    ? { home: away365, away: home365 }
    : { home: home365, away: away365 };
}

/**
 * Resolve extra-time and penalty-shootout score lines for a 365 game.
 * - extratime: total goals after ET (365 does not split the 90' vs ET score,
 *   so we surface the aggregate goals which is what the app displays).
 * - penalty: from a direct competitor field if 365 exposes one, else tallied
 *   from shootout events. Only populated for ET/AET/P/PEN states.
 */
function resolve365ExtraAndPenalty(
  game: Scores365Game,
  alignment: Scores365TeamAlignment,
  statusShort: string,
  goals: ScorePair,
): { extratime: ScorePair | null; penalty: ScorePair | null } {
  const isExtraTime = statusShort === 'ET' || statusShort === 'AET' || statusShort === 'BT';
  const isShootout = statusShort === 'P' || statusShort === 'PEN';

  const extratime: ScorePair | null =
    isExtraTime || isShootout
      ? { home: goals.home, away: goals.away }
      : null;

  let penalty: ScorePair | null = null;
  if (isShootout) {
    const homeDirect = readCompetitorPenaltyScore(game.homeCompetitor);
    const awayDirect = readCompetitorPenaltyScore(game.awayCompetitor);
    if (homeDirect != null || awayDirect != null) {
      penalty = alignment.swapped
        ? { home: awayDirect, away: homeDirect }
        : { home: homeDirect, away: awayDirect };
    } else {
      penalty = tallyShootoutFromRawEvents(game, alignment);
    }
  }

  return { extratime, penalty };
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
  // Many 365 leagues publish score but no event timeline — empty events are valid.
  if (!events.length) return true;
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

const STAT_GOALS = 27;
const STAT_ASSISTS = 26;
const STAT_MINUTES = 30;

function parse365StatInt(stats: Scores365LineupMember['stats'], typeId: number): number {
  for (const row of stats ?? []) {
    if (row.type !== typeId) continue;
    const m = String(row.value ?? '').match(/\d+/);
    if (m) return Number(m[0]) || 0;
  }
  return 0;
}

function parse365StatText(stats: Scores365LineupMember['stats'], typeId: number): string | null {
  for (const row of stats ?? []) {
    if (row.type === typeId && row.value) return String(row.value);
  }
  return null;
}

function memberMatchStatsFromLineup(m: Scores365LineupMember): {
  rating: number | null;
  goals: number;
  assists: number;
  minutes: string | null;
} {
  const rating = typeof m.ranking === 'number' && m.ranking > 0 ? m.ranking : null;
  return {
    rating,
    goals: parse365StatInt(m.stats, STAT_GOALS),
    assists: parse365StatInt(m.stats, STAT_ASSISTS),
    minutes: parse365StatText(m.stats, STAT_MINUTES),
  };
}

function resolve365GoalDetail(subTypeName?: string): string {
  const sub = (subTypeName ?? 'Normal Goal').trim();
  if (/own\s*goal/i.test(sub)) return 'Own Goal';
  if (/penalty/i.test(sub)) return 'Penalty';
  if (/field\s*goal/i.test(sub)) return 'Normal Goal';
  if (/header/i.test(sub)) return 'Header';
  return sub || 'Normal Goal';
}

function resolve365EventType(ev: Scores365Event): { type: string; detail: string } {
  const typeId = ev.eventType?.id;
  const typeName = ev.eventType?.name ?? 'Event';
  if (typeId === 1) {
    return { type: 'Goal', detail: resolve365GoalDetail(ev.eventType?.subTypeName) };
  }
  if (typeId === 2) {
    return { type: 'Card', detail: 'Yellow Card' };
  }
  if (typeId === 3) {
    return { type: 'Card', detail: 'Red Card' };
  }
  if (typeId === 1000 || typeId === 4 || /subst/i.test(typeName)) {
    return { type: 'subst', detail: 'Substitution 1' };
  }
  if (/var|video\s*assist/i.test(typeName)) {
    return { type: 'Var', detail: typeName };
  }
  return { type: 'Var', detail: typeName };
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
    const primaryMember = ev.playerId ? members.get(ev.playerId) : undefined;
    const extraMemberId = ev.extraPlayers?.[0];
    const extraMember = extraMemberId ? members.get(extraMemberId) : undefined;
    const elapsed = Math.floor(ev.gameTime ?? 0);
    const extra = ev.addedTime != null && ev.addedTime > 0 ? ev.addedTime : null;
    const { type, detail } = resolve365EventType(ev);

    const isOwnGoal = (detail || '').toLowerCase().includes('own');
    // 365 uses competitorId = benefiting team on own goals; API-Football uses scorer's team.
    let teamCompetitorId = ev.competitorId;
    if (isOwnGoal) {
      if (primaryMember?.competitorId != null) {
        teamCompetitorId = primaryMember.competitorId;
      } else if (ev.competitorId === game.homeCompetitor?.id) {
        teamCompetitorId = game.awayCompetitor?.id ?? ev.competitorId;
      } else if (ev.competitorId === game.awayCompetitor?.id) {
        teamCompetitorId = game.homeCompetitor?.id ?? ev.competitorId;
      }
    }

    const team = map365CompetitorToBaseTeam(teamCompetitorId, game, base, resolvedAlignment);

    // API-Football: substitution player = IN, assist = OUT; goal player = scorer, assist = assister.
    const isSubstitution = type === 'subst';
    const playerId = isSubstitution ? (extraMemberId ?? 0) : (ev.playerId ?? 0);
    const playerName = isSubstitution
      ? extraMember?.shortName || extraMember?.name || '—'
      : primaryMember?.shortName || primaryMember?.name || '—';
    const assistId = isSubstitution
      ? (ev.playerId ?? null)
      : type === 'Goal' && extraMember
        ? extraMemberId ?? null
        : null;
    const assistName = isSubstitution
      ? primaryMember?.shortName || primaryMember?.name || null
      : type === 'Goal' && extraMember
        ? extraMember.shortName || extraMember.name || null
        : null;

    return {
      time: { elapsed, extra },
      team: {
        id: team.id,
        name: team.name,
        logo: team.logo,
      },
      player: {
        id: playerId,
        name: playerName,
      },
      assist: { id: assistId, name: assistName },
      type,
      detail,
      comments: null,
      _source: 'scores365-experiment',
    };
  });
}

/** Status values recognised as confirmed starters in the 365Scores lineups array. */
const STARTER_STATUSES = new Set([1, 0]); // 1 = confirmed starter; 0 = used for GK in some feeds
/** 2 = bench/sub, 3 = missing/injured, 4 = coach/management — excluded from starter XI, not errors. */
const KNOWN_LINEUP_SKIP_STATUSES = new Set([2, 3, 4]);

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
    const dropped = allMembers.filter(
      (m) => !STARTER_STATUSES.has(m.status) && !KNOWN_LINEUP_SKIP_STATUSES.has(m.status),
    );
    for (const d of dropped) {
      const meta = lookup.byId.get(d.id);
      logger.debug(
        `[Scores365Lineups] game ${game.id} ${sideLabel}: member id=${d.id} name="${meta?.name ?? '?'}" skipped — status=${d.status}`,
      );
    }

    const coachLineup =
      findCoachInLineup(allMembers as Parameters<typeof findCoachInLineup>[0])?.member ??
      allMembers.find((m) => m.status === 4);
    const coachMeta = coachLineup ? lookup.byId.get(coachLineup.id) : undefined;
    const coachAthleteId = coachMeta?.athleteId ?? null;
    const coachPhoto =
      coachAthleteId != null
        ? coachMeta?.imageVersion != null
          ? `https://imagecache.365scores.com/image/upload/f_png,w_80,h_80,c_limit,q_auto:eco,dpr_2/v${coachMeta.imageVersion}/Athletes/${coachAthleteId}`
          : buildScores365CoachPhotoUrl(coachAthleteId, 80)
        : null;

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
        id: coachAthleteId ?? coachLineup?.id ?? null,
        name: coachMeta?.name ?? coachMeta?.shortName ?? null,
        photo: coachPhoto,
      },
      formation: side.lineups.formation ?? null,
      startXI: starters.map((m) => {
        const meta = lookupMember(lookup, m.id);
        const matchStats = memberMatchStatsFromLineup(m);
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
            photo: buildScores365AthletePhotoUrl(m.id, 80),
            rating: matchStats.rating,
            goals: matchStats.goals,
            assists: matchStats.assists,
            minutes: matchStats.minutes,
            _stats365: m.stats ?? null,
          },
        };
      }),
      substitutes: allMembers
        .filter((m) => m.status === 2)
        .map((m) => {
          const meta = lookupMember(lookup, m.id);
          const matchStats = memberMatchStatsFromLineup(m);
          return {
            player: {
              id: m.id,
              name: meta?.name ?? meta?.shortName ?? `#${m.id}`,
              number: meta?.jerseyNumber ?? 0,
              pos: posFrom365(m.formation?.shortName),
              grid: null,
              photo: buildScores365AthletePhotoUrl(m.id, 80),
              rating: matchStats.rating,
              goals: matchStats.goals,
              assists: matchStats.assists,
              minutes: matchStats.minutes,
              _stats365: m.stats ?? null,
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
  const resolved = await resolve365BaseAndAlignment(game, fixtureId, baseInput);
  if (!resolved) {
    logger.warn(
      `[Scores365Experiment] refuse fixture map game ${game.id} → ${fixtureId}: team names mismatch (${game.homeCompetitor?.name}/${game.awayCompetitor?.name})`,
    );
    return null;
  }
  const { base, alignment } = resolved;

  registerScores365FixtureMapping(fixtureId, game.id);

  const status = map365Status(game);
  const scores = resolve365Scores(game, alignment);
  const homeScore = scores.home;
  const awayScore = scores.away;
  const { extratime, penalty } = resolve365ExtraAndPenalty(
    game,
    alignment,
    status.short,
    scores,
  );
  const kickoff = (() => {
    const raw = game.startTime ?? base.fixture.date;
    if (raw) {
      const parsed = new Date(raw);
      if (!Number.isNaN(parsed.getTime())) return raw;
    }
    return new Date().toISOString();
  })();
  const home365 = game.homeCompetitor;
  const away365 = game.awayCompetitor;
  const homeDisplay = alignment.swapped ? away365?.name : home365?.name;
  const awayDisplay = alignment.swapped ? home365?.name : away365?.name;
  const crowdPrediction = extractScores365CrowdWinPrediction(game, {
    swapped: alignment.swapped,
  });
  const lmtWidget = pickLmtWidget(game);
  const lmtPartnerId = lmtWidget ? partnerIdFromWidget(lmtWidget) : null;

  return {
    ...base,
    score: {
      halftime: base.score?.halftime ?? { home: null, away: null },
      fulltime: { home: homeScore, away: awayScore },
      extratime: extratime ?? base.score?.extratime ?? { home: null, away: null },
      penalty: penalty ?? base.score?.penalty ?? { home: null, away: null },
    },
    fixture: {
      ...base.fixture,
      id: fixtureId,
      date: kickoff,
      timestamp: Math.floor(new Date(kickoff).getTime() / 1000),
      status: {
        long: status.long,
        short: status.short,
        elapsed: status.elapsed,
        extra: status.extra ?? null,
      },
      venue: {
        id: game.venue?.id ?? base.fixture.venue?.id ?? null,
        name: game.venue?.name ?? base.fixture.venue?.name ?? null,
        city: base.fixture.venue?.city ?? null,
        image: game.venue?.id
          ? `https://imagecache.365scores.com/image/upload/f_jpg,w_800,h_450,c_fill,q_auto:eco/v1/Venues/${game.venue.id}`
          : (base.fixture.venue?.id
              ? `https://imagecache.365scores.com/image/upload/f_jpg,w_800,h_450,c_fill,q_auto:eco/v1/Venues/${base.fixture.venue.id}`
              : null),
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
      name: resolve365LeagueDisplayName(game, base.league.name),
      round: resolve365FixtureRound(game) || base.league.round || '',
    },
    _scores365GameId: game.id,
    _scores365TeamsSwapped: alignment.swapped,
    _experiment: 'scores365',
    ...(lmtWidget && lmtPartnerId
      ? {
          _lmt: {
            partnerId: lmtPartnerId,
            provider: lmtWidget.provider ?? null,
            widgetType: lmtWidget.widgetType ?? 'LMT',
            widgetRatio:
              typeof lmtWidget.widgetRatio === 'number' ? lmtWidget.widgetRatio : null,
            sourceUrl: lmtWidget.widgetUrl ?? null,
          },
        }
      : {}),
    ...(crowdPrediction ? { _crowdPrediction: crowdPrediction } : {}),
  } as FixtureFromAPI;
}

export async function getScores365ExperimentEvents(
  fixtureId: number,
  force = false,
  language?: string | null,
): Promise<any[]> {
  const gameId = (await ensureScores365GameMapping(fixtureId)) ?? getScores365GameIdForFixture(fixtureId);
  if (!gameId) {
    logger.warn(`[365Events] fixture=${fixtureId} reason=unmapped`);
    return [];
  }

  const core = await resolve365ExperimentCore(fixtureId, gameId, language, { force });
  if (!core) {
    logger.warn(`[365Events] fixture=${fixtureId} reason=upstream_empty gameId=${gameId}`);
    return [];
  }

  const { game, base, alignment } = core;
  const events = mapScores365Events(game, base, alignment);
  const scores = resolve365Scores(game, alignment);
  const validated = validate365MappedEvents(
    fixtureId,
    game,
    base,
    alignment,
    events,
    scores.home,
    scores.away,
  );
  if (!validated.length && !(game.events?.length)) {
    logger.warn(
      `[365Events] fixture=${fixtureId} reason=upstream_empty gameId=${gameId} rawEvents=0`,
    );
  }
  return validated;
}

export async function getScores365ExperimentFixture(
  fixtureId: number,
  language?: string | null,
): Promise<FixtureFromAPI | null> {
  const gameId =
    (await ensureScores365GameMapping(fixtureId)) ?? getScores365GameIdForFixture(fixtureId);
  if (!gameId) return null;

  const core = await resolve365ExperimentCore(fixtureId, gameId, language);
  if (!core) return null;

  let fixture = await mapScores365ToApiFootballFixture(
    core.game,
    core.base,
    fixtureId,
  );
  if (!fixture) return null;

  if (core.gameLocalized) {
    fixture = overlay365LocalizedFixtureNames(fixture, core.gameLocalized, core.alignment);
  }
  return fixture;
}

function overlay365LocalizedFixtureNames(
  fixture: FixtureFromAPI,
  localized: Scores365Game,
  alignment: Scores365TeamAlignment,
): FixtureFromAPI {
  const home365 = localized.homeCompetitor;
  const away365 = localized.awayCompetitor;
  const homeDisplay = alignment.swapped ? away365?.name : home365?.name;
  const awayDisplay = alignment.swapped ? home365?.name : away365?.name;
  return {
    ...fixture,
    teams: {
      home: {
        ...fixture.teams.home,
        name: homeDisplay ?? fixture.teams.home.name,
      },
      away: {
        ...fixture.teams.away,
        name: awayDisplay ?? fixture.teams.away.name,
      },
    },
    league: {
      ...fixture.league,
      name: resolve365LeagueDisplayName(localized, fixture.league.name),
    },
  };
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
  /** True once at least one side has a usable starting XI from 365. */
  lineupsAvailable: boolean;
  /** Raw 365 lineups status text (e.g. "Confirmed", "Probable") when present. */
  lineupsStatus: string | null;
  source: 'scores365-experiment';
} | null> {
  const gameId = (await ensureScores365GameMapping(fixtureId)) ?? getScores365GameIdForFixture(fixtureId);
  if (!gameId) return null;

  const force = options?.force === true;
  const core = await resolve365ExperimentCore(fixtureId, gameId, language, { force });
  if (!core) return null;

  const { game, gameLocalized, base, alignment } = core;

  let fixture = await mapScores365ToApiFootballFixture(game, base, fixtureId);
  if (!fixture) return null;

  if (gameLocalized) {
    fixture = overlay365LocalizedFixtureNames(fixture, gameLocalized, alignment);
  }

  let events = mapScores365Events(game, base, alignment);
  events = validate365MappedEvents(
    fixtureId,
    game,
    base,
    alignment,
    events,
    fixture.goals.home,
    fixture.goals.away,
  );

  const lineupData = mapScores365Lineups(game, base, alignment);

  let statistics = (base as any).statistics ?? [];
  if (!hasApiStatistics(statistics)) {
    // Try to aggregate full stats from player-level 365Scores data (shots, passes, fouls, xG…).
    const playersWithSide = [
      ...(lineupData[0]?.startXI ?? []).map((l: any) => ({ side: 'home' as const, stats: l.player._stats365 })),
      ...(lineupData[0]?.substitutes ?? []).map((l: any) => ({ side: 'home' as const, stats: l.player._stats365 })),
      ...(lineupData[1]?.startXI ?? []).map((l: any) => ({ side: 'away' as const, stats: l.player._stats365 })),
      ...(lineupData[1]?.substitutes ?? []).map((l: any) => ({ side: 'away' as const, stats: l.player._stats365 })),
    ];
    const teamRefs = {
      home: { id: base.teams.home?.id ?? 0, name: base.teams.home?.name ?? 'Home', logo: (base.teams.home as any)?.logo ?? '' },
      away: { id: base.teams.away?.id ?? 0, name: base.teams.away?.name ?? 'Away', logo: (base.teams.away as any)?.logo ?? '' },
    };
    const playerStats = buildTeamStatisticsFrom365Players(playersWithSide, teamRefs);
    if (playerStats.length > 0) {
      statistics = playerStats;
    } else if (events.length > 0) {
      statistics = buildFallbackStatisticsFromEvents(fixture, events);
    }
  }

  const lineupsAvailable = lineupData.some(
    (side: any) => Array.isArray(side?.startXI) && side.startXI.length > 0,
  );

  return {
    fixture,
    lineups: lineupData,
    events,
    statistics,
    venue: fixture.fixture.venue ?? null,
    lineupsAvailable,
    lineupsStatus: game.lineupsStatusText ?? null,
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

  const todayKey = calendarTodayKey();
  const isToday = dateString === todayKey;
  const lang = resolveScores365AppLanguage(language);
  const games = await fetchScores365WorldCupFixtures({ language, liveRefresh: isToday });
  if (!games.length) return [];

  const dayGames = games.filter((game) => {
    const matchDate = calendarDateFromStart(game.startTime);
    const live = is365Live(game);
    return dateString === matchDate || (live && isToday);
  });

  // List endpoint: fixtures list already refreshed for today — skip per-game
  // HTTP (was sequential and made /cached/world-cup/:date >1s).
  const mapped = (
    await Promise.all(
      dayGames.map((game) => map365GameToFixture(game, dbRows, lang, { refreshIfLive: false })),
    )
  ).filter(Boolean) as any[];

  mapped.sort((a, b) => (a.fixture?.timestamp ?? 0) - (b.fixture?.timestamp ?? 0));

  if (mapped.length > 0) {
    logger.info(
      `[Scores365Experiment] ${mapped.length} fixtures on ${dateString} (lang=${resolveScores365LangId(language)} liveRefresh=${isToday})`,
    );
  }

  const { enrichFixturesWithCrowdPredictions } = await import(
    './scores365-crowd-prediction.service'
  );
  return enrichFixturesWithCrowdPredictions(mapped, lang);
}

export type Scores365WorldCupPhaseFilter = 'upcoming' | 'live' | 'finished' | 'all';

/**
 * All World Cup fixtures from the paginated 365 list, optionally filtered by phase.
 * Used for the Upcoming tab (all knockout rounds ahead) without day-by-day gaps.
 */
export async function getScores365WorldCupPhaseFixtures(
  language?: string | null,
  phase: Scores365WorldCupPhaseFilter = 'all',
): Promise<any[]> {
  if (!isScores365ExperimentEnabled()) return [];

  const cfg = getScores365ExperimentConfig();
  const dbRows = await loadWorldCupDbFixtures(cfg.leagueId, cfg.season);
  const lang = resolveScores365AppLanguage(language);
  const games = await fetchScores365WorldCupFixtures({ language, liveRefresh: true });
  if (!games.length) return [];

  const filtered = games.filter((game) => {
    const gamePhase =
      game.statusGroup === 3 || is365Live(game)
        ? 'live'
        : game.statusGroup === 4
          ? 'finished'
          : 'upcoming';
    return phase === 'all' || gamePhase === phase;
  });

  // Parallel map; only refresh individual live games for the live phase tab.
  const mapped = (
    await Promise.all(
      filtered.map((game) =>
        map365GameToFixture(game, dbRows, lang, {
          refreshIfLive: phase === 'live',
        }),
      ),
    )
  ).filter(Boolean) as any[];

  mapped.sort((a, b) => (a.fixture?.timestamp ?? 0) - (b.fixture?.timestamp ?? 0));
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
  const todayKey = calendarTodayKey();
  const live = is365Live(game);
  const shouldShow = dateString === matchDate || (live && dateString === todayKey);
  if (!shouldShow) return matches;

  const id = fixture.fixture.id;
  const without = matches.filter((m) => m?.fixture?.id !== id);
  return [{ ...fixture, _experiment: 'scores365' }, ...without];
}

const SYNTHETIC_LIVE_STATUSES = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT', 'SUSP'] as const;
const SYNTHETIC_LIVE_BATCH = (() => {
  const raw = parseInt(process.env.SCORES365_SYNTHETIC_LIVE_BATCH || '10', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 80;
})();
const LIVE_DETAIL_MAX = (() => {
  // Raise default so major-league LIVE matches get lineups/events/stats warm, not only top-5.
  const raw = parseInt(process.env.SCORES365_LIVE_DETAIL_MAX || '12', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 12;
})();
const SYNTHETIC_LIVE_CONCURRENCY = (() => {
  const raw = parseInt(process.env.SCORES365_SYNTHETIC_LIVE_CONCURRENCY || '4', 10);
  return Number.isFinite(raw) && raw > 0 ? Math.min(raw, 12) : 4;
})();
const liveDetailWarms = new Map<number, Promise<void>>();

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      for (;;) {
        const index = next++;
        if (index >= items.length) return;
        results[index] = await worker(items[index], index);
      }
    }),
  );
  return results;
}

/**
 * Refresh non-WC 365 synthetic fixtures from GET /web/game/ — accurate minutes/scores
 * plus a prioritized warm of lineups/stats for live matches.
 * (allscores list lags ~30–60s; mirrors WC liveRefresh in getScores365MatchesForDate).
 * Writes live rows into Redis overlay so /fixtures/live and today's calendar stay fresh.
 */
type SyntheticLiveRefreshOptions = {
  language?: string | null;
  gameIds?: number[];
  favoritedOnly?: boolean;
};

async function sync365SyntheticLiveSnapshotsAsLeader(
  options?: SyntheticLiveRefreshOptions,
  signal?: AbortSignal,
): Promise<number> {
  if (!isScores365ExperimentEnabled()) return 0;
  signal?.throwIfAborted();

  const lang = resolveScores365AppLanguage(options?.language ?? null);
  const liveSet = new Set<string>(SYNTHETIC_LIVE_STATUSES);
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 1);

  let targetIds: number[];
  if (options?.gameIds?.length) {
    targetIds = [...new Set(options.gameIds)].slice(0, SYNTHETIC_LIVE_BATCH);
  } else if (options?.favoritedOnly) {
    const favorites = await prisma.favoriteMatch.findMany({
      where: { notifiedEnd: false },
      select: { apiMatchId: true },
      distinct: ['apiMatchId'],
      take: SYNTHETIC_LIVE_BATCH * 2,
    });
    const favoriteIds = favorites.map((row) => row.apiMatchId);
    if (!favoriteIds.length) return 0;
    const rows = await prisma.cachedFixture.findMany({
      where: {
        fixtureId: { in: favoriteIds },
        leagueId: { gte: SCORES365_LEAGUE_ID_OFFSET },
        status: { in: [...SYNTHETIC_LIVE_STATUSES] },
      },
      select: { fixtureId: true },
      orderBy: { updatedAt: 'asc' },
      take: SYNTHETIC_LIVE_BATCH,
    });
    targetIds = rows.map((row) => row.fixtureId);
  } else {
    const rows = await prisma.cachedFixture.findMany({
      where: {
        leagueId: { gte: SCORES365_LEAGUE_ID_OFFSET },
        matchDate: { gte: since },
        OR: [
          { status: { in: [...SYNTHETIC_LIVE_STATUSES] } },
          { status: '2H', elapsed: { gt: 100 } },
        ],
      },
      select: { fixtureId: true },
      orderBy: { updatedAt: 'asc' },
      take: SYNTHETIC_LIVE_BATCH * 2,
    });
    targetIds = rows.map((r) => r.fixtureId);

    try {
      const favRows = await prisma.favoriteMatch.findMany({
        where: { apiMatchId: { in: targetIds } },
        select: { apiMatchId: true },
        distinct: ['apiMatchId'],
      });
      const favSet = new Set(favRows.map((f) => f.apiMatchId));
      if (favSet.size > 0) {
        targetIds.sort((a, b) => Number(favSet.has(b)) - Number(favSet.has(a)));
      }
    } catch {
      // FavoriteMatch may be unavailable — keep updatedAt order.
    }
    targetIds = targetIds.slice(0, SYNTHETIC_LIVE_BATCH);
  }

  if (!targetIds.length) return 0;
  signal?.throwIfAborted();

  const dbRows = await prisma.cachedFixture.findMany({
    where: { fixtureId: { in: targetIds } },
  });
  const dbByFixtureId = new Map(dbRows.map((row) => [row.fixtureId, row]));
  const refreshedLive: FixtureFromAPI[] = [];
  const detailCandidates: number[] = [];
  const mappedResults = await mapWithConcurrency(
    targetIds,
    SYNTHETIC_LIVE_CONCURRENCY,
    async (fixtureId): Promise<FixtureFromAPI | null> => {
      try {
        const game = await fetchScores365GameById(fixtureId, { force: true, language: lang });
        if (!game) return null;
        const dbRow = dbByFixtureId.get(fixtureId);
        const base = dbRow ? matchCacheService.convertDbMatchToApiFormat(dbRow) : null;
        return await mapScores365ToApiFootballFixture(game, base, fixtureId);
      } catch (err: unknown) {
        logger.warn(`[365Live] refresh fixture ${fixtureId} failed:`, (err as Error)?.message);
        return null;
      }
    },
  );
  const mappedFixtures = mappedResults.filter((fixture): fixture is FixtureFromAPI => fixture != null);
  signal?.throwIfAborted();
  if (mappedFixtures.length > 0) {
    await matchCacheService.upsertFixtures(mappedFixtures, { preserveFullData: true });
  }
  signal?.throwIfAborted();

  const changedIds = mappedFixtures
    .filter((mapped) => {
      const previous = dbByFixtureId.get(mapped.fixture.id);
      return (
        !previous ||
        previous.homeScore !== mapped.goals.home ||
        previous.awayScore !== mapped.goals.away ||
        previous.status !== mapped.fixture.status.short
      );
    })
    .map((mapped) => mapped.fixture.id);
  if (changedIds.length > 0) {
    const favorites = await prisma.favoriteMatch.findMany({
      where: { apiMatchId: { in: changedIds }, notifiedEnd: false },
      select: { apiMatchId: true },
      distinct: ['apiMatchId'],
    });
    if (favorites.length > 0) {
      const { default: LiveMatchIngestorService } = await import('./live-match-ingestor.service');
      for (const favorite of favorites) {
        LiveMatchIngestorService.triggerFixtureIngest(favorite.apiMatchId);
      }
    }
  }
  for (const mapped of mappedFixtures) {
    const short = mapped.fixture?.status?.short ?? '';
    if (liveSet.has(short)) {
      refreshedLive.push(mapped);
      detailCandidates.push(mapped.fixture.id);
    }
  }
  const updated = mappedFixtures.length;

  if (mappedFixtures.length > 0) {
    const { mergeLiveFixturesIntoRedisSnapshot } = await import('./live-fixture-cache.service');
    // Include terminal transitions so only the 365-owned snapshot drops those ids.
    await mergeLiveFixturesIntoRedisSnapshot(mappedFixtures);
  }

  // Prioritize favorites + major leagues for the warm budget.
  let favoritedDetail = new Set<number>();
  try {
    const favRows = await prisma.favoriteMatch.findMany({
      where: { apiMatchId: { in: detailCandidates }, notifiedEnd: false },
      select: { apiMatchId: true },
      distinct: ['apiMatchId'],
    });
    favoritedDetail = new Set(favRows.map((f) => f.apiMatchId));
  } catch {
    // optional
  }
  const { isMajorLeagueId } = await import('../utils/fixture-importance');
  detailCandidates.sort((a, b) => {
    const score = (id: number) => {
      const row = dbByFixtureId.get(id);
      return (
        (favoritedDetail.has(id) ? 1000 : 0) +
        (isMajorLeagueId(row?.leagueId) ? 100 : 0)
      );
    };
    return score(b) - score(a);
  });

  const detailIds = detailCandidates.slice(0, LIVE_DETAIL_MAX);
  if (detailIds.length > 0) {
    try {
      const { footballDataCacheService } = await import('./football-data-cache.service');
      await mapWithConcurrency(detailIds, SYNTHETIC_LIVE_CONCURRENCY, async (fixtureId) => {
        const existing = liveDetailWarms.get(fixtureId);
        if (existing) return existing;
        const warm = Promise.allSettled([
          footballDataCacheService.getMatchLineups(fixtureId),
          footballDataCacheService.getMatchStatistics(fixtureId),
          footballDataCacheService.getMatchEvents(fixtureId, {
            forceRefresh: true,
            language: lang,
          }),
        ]).then(() => undefined);
        liveDetailWarms.set(fixtureId, warm);
        try {
          await warm;
        } finally {
          if (liveDetailWarms.get(fixtureId) === warm) liveDetailWarms.delete(fixtureId);
        }
      });
      logger.info(
        `[365Live] warmed lineups/stats/events for ${detailIds.length} live synthetic fixtures`,
      );
    } catch (err: unknown) {
      logger.warn(`[365Live] detail warm batch failed:`, (err as Error)?.message);
    }
  }

  if (updated > 0) {
    logger.info(
      `[365Live] refreshed ${updated} synthetic fixtures (${refreshedLive.length} live in Redis overlay)`,
    );
  }

  return updated;
}

type SyntheticRefreshState = {
  pendingGameIds: Set<number>;
  fullScanPending: boolean;
  favoriteScanPending: boolean;
  inFlight: Promise<number> | null;
};
const syntheticRefreshByLanguage = new Map<string, SyntheticRefreshState>();

export function getSyntheticLiveRefreshCoordinatorState(
  language?: string | null,
): { pendingGameIds: number[]; fullScanPending: boolean; favoriteScanPending: boolean; inFlight: boolean } {
  const resolved = resolveScores365AppLanguage(language ?? null);
  const state = syntheticRefreshByLanguage.get(resolved);
  return {
    pendingGameIds: state ? [...state.pendingGameIds] : [],
    fullScanPending: state?.fullScanPending ?? false,
    favoriteScanPending: state?.favoriteScanPending ?? false,
    inFlight: state?.inFlight != null,
  };
}

/**
 * Coalesce refreshes per language. IDs arriving during an active run are
 * unioned and drained by that same promise instead of being silently dropped.
 */
export function sync365SyntheticLiveSnapshots(
  options?: SyntheticLiveRefreshOptions,
): Promise<number> {
  const language = resolveScores365AppLanguage(options?.language ?? null);
  let state = syntheticRefreshByLanguage.get(language);
  if (!state) {
    state = {
      pendingGameIds: new Set<number>(),
      fullScanPending: false,
      favoriteScanPending: false,
      inFlight: null,
    };
    syntheticRefreshByLanguage.set(language, state);
  }
  if (options?.gameIds?.length) {
    for (const id of options.gameIds) {
      if (Number.isFinite(id) && id > 0) state.pendingGameIds.add(id);
    }
  } else if (options?.favoritedOnly) {
    state.favoriteScanPending = true;
  } else {
    state.fullScanPending = true;
  }
  if (state.inFlight) return state.inFlight;

  const currentState = state;
  const running = withSyncLeaderLease(
    `365-synthetic-live:${language}`,
    async ({ signal }) => {
      let total = 0;
      for (;;) {
        signal.throwIfAborted();
        const queuedGameIds = [...currentState.pendingGameIds];
        currentState.pendingGameIds.clear();
        const gameIds = queuedGameIds.slice(0, SYNTHETIC_LIVE_BATCH);
        for (const id of queuedGameIds.slice(SYNTHETIC_LIVE_BATCH)) {
          currentState.pendingGameIds.add(id);
        }
        const fullScan = currentState.fullScanPending;
        currentState.fullScanPending = false;
        const favoritedOnly = !fullScan && currentState.favoriteScanPending;
        currentState.favoriteScanPending = false;
        if (gameIds.length && fullScan) currentState.fullScanPending = true;
        if (gameIds.length && favoritedOnly) currentState.favoriteScanPending = true;

        if (!gameIds.length && !fullScan && !favoritedOnly) break;
        total += await sync365SyntheticLiveSnapshotsAsLeader(
          {
            language,
            ...(gameIds.length ? { gameIds } : {}),
            ...(!gameIds.length && favoritedOnly ? { favoritedOnly: true } : {}),
          },
          signal,
        );
      }
      return total;
    },
    { ttlSec: 60 },
  )
    .then((result) => result.value ?? 0)
    .finally(() => {
      if (currentState.inFlight === running) currentState.inFlight = null;
    });
  currentState.inFlight = running;
  return running;
}

const SCORES365_LMT_WIDGET_BASE = 'https://lmtsrcf.365scores.com/api/SportRadarLMT/GetWidget';

export type Scores365LmtWidgetInfo = {
  gameId: number;
  fixtureId: number | null;
  partnerId: string;
  langId: number;
  sportTypeId: number;
  widgetUrl: string;
  widgetType: string;
  widgetRatio: number | null;
  provider: string | null;
  homeName: string | null;
  awayName: string | null;
  statusText: string | null;
};

/** LMT widget from game.widgets — partnerId is NOT gameId. */
function pickLmtWidget(game: Scores365Game): Scores365Widget | null {
  const widgets = Array.isArray(game.widgets) ? game.widgets : [];
  const byType = widgets.find((w) => String(w.widgetType ?? '') === 'LMT');
  if (byType) return byType;
  return (
    widgets.find(
      (w) =>
        String(w.widgetType ?? '').toUpperCase() === 'LMT' ||
        String(w.provider ?? '').toLowerCase().includes('sportradarlmt'),
    ) ??
    widgets.find((w) => w.partnerId != null || w.widgetUrl) ??
    null
  );
}

function partnerIdFromWidget(widget: Scores365Widget): string | null {
  if (widget.partnerId != null && String(widget.partnerId).trim()) {
    return String(widget.partnerId).trim();
  }
  const url = widget.widgetUrl ?? '';
  try {
    const fromUrl = new URL(url).searchParams.get('partnerid');
    if (fromUrl) return fromUrl;
  } catch {
    const match = url.match(/[?&]partnerid=([^&]+)/i);
    if (match?.[1]) return decodeURIComponent(match[1]);
  }
  return null;
}

/** Official 365scores GetWidget URL. */
export function buildScores365LmtWidgetUrl(partnerId: string, langId: number, sportTypeId = 1): string {
  const params = new URLSearchParams({
    partnerid: String(partnerId),
    lang: String(langId),
    sportTypeId: String(sportTypeId),
  });
  return `${SCORES365_LMT_WIDGET_BASE}?${params.toString()}`;
}

/**
 * Resolve SportRadar Live Match Tracker widget for a 365 gameId.
 * partnerId comes from game.widgets — it is NOT the gameId.
 */
export async function getScores365LmtWidgetForGameId(
  gameId: number,
  options?: { language?: string | null; force?: boolean },
): Promise<Scores365LmtWidgetInfo | null> {
  if (!isScores365ExperimentEnabled()) return null;

  const language = options?.language ?? 'ar';
  const langId = resolveScores365LangId(language);
  const game = await fetchScores365GameById(gameId, {
    language,
    force: options?.force === true,
  });
  if (!game?.id) return null;

  const widget = pickLmtWidget(game);
  if (!widget) {
    logger.debug(`[Scores365LMT] game ${gameId} has no LMT widget/partnerId`);
    return null;
  }

  const partnerId = partnerIdFromWidget(widget);
  if (!partnerId) return null;

  // Canonical GetWidget URL — partnerId from widgets, never gameId.
  const sportTypeId = 1;
  const widgetUrl = buildScores365LmtWidgetUrl(partnerId, langId, sportTypeId);

  const mappedFixture =
    (await resolveApiFixtureIdFor365GameId(gameId)) ??
    (gameId >= 4_000_000 ? gameId : null);

  return {
    gameId: game.id,
    fixtureId: mappedFixture,
    partnerId,
    langId,
    sportTypeId,
    widgetUrl,
    widgetType: widget.widgetType ?? 'LMT',
    widgetRatio: typeof widget.widgetRatio === 'number' ? widget.widgetRatio : null,
    provider: widget.provider ?? null,
    homeName: game.homeCompetitor?.name ?? null,
    awayName: game.awayCompetitor?.name ?? null,
    statusText: game.statusText ?? game.shortStatusText ?? null,
  };
}

/** Resolve LMT widget via API-Football / synthetic fixtureId → 365 gameId map. */
export async function getScores365LmtWidgetForFixtureId(
  fixtureId: number,
  options?: { language?: string | null; force?: boolean },
): Promise<Scores365LmtWidgetInfo | null> {
  const durable = await prisma.cachedFixture.findUnique({
    where: { fixtureId },
    select: { fullData: true },
  });
  const fullData = durable?.fullData as {
    _scores365GameId?: unknown;
    _lmt?: {
      partnerId?: unknown;
      provider?: string | null;
      widgetType?: string;
      widgetRatio?: number | null;
    };
    teams?: { home?: { name?: string }; away?: { name?: string } };
    fixture?: { status?: { long?: string } };
  } | null;
  const persistedGameId = readPersistedScores365GameId(fullData);
  const persistedPartnerId = fullData?._lmt?.partnerId;
  if (
    persistedGameId &&
    persistedPartnerId != null &&
    String(persistedPartnerId).trim()
  ) {
    const langId = resolveScores365LangId(options?.language);
    const partnerId = String(persistedPartnerId).trim();
    return {
      gameId: persistedGameId,
      fixtureId,
      partnerId,
      langId,
      sportTypeId: 1,
      widgetUrl: buildScores365LmtWidgetUrl(partnerId, langId, 1),
      widgetType: fullData?._lmt?.widgetType ?? 'LMT',
      widgetRatio: fullData?._lmt?.widgetRatio ?? null,
      provider: fullData?._lmt?.provider ?? null,
      homeName: fullData?.teams?.home?.name ?? null,
      awayName: fullData?.teams?.away?.name ?? null,
      statusText: fullData?.fixture?.status?.long ?? null,
    };
  }

  const gameId =
    (await ensureScores365GameMapping(fixtureId)) ?? getScores365GameIdForFixture(fixtureId);
  if (!gameId) return null;
  const info = await getScores365LmtWidgetForGameId(gameId, options);
  if (!info) return null;
  return { ...info, fixtureId };
}

/** Proxy upstream LMT HTML (for WebView / embedding without hitting 365 directly). */
export async function fetchScores365LmtWidgetHtml(
  partnerId: string,
  langId: number,
  sportTypeId = 1,
): Promise<string | null> {
  const url = buildScores365LmtWidgetUrl(partnerId, langId, sportTypeId);
  try {
    const res = await fetch(url, {
      headers: scores365FetchHeaders(langId),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      logger.warn(`[Scores365LMT] GetWidget HTTP ${res.status} partnerId=${partnerId}`);
      return null;
    }
    return await res.text();
  } catch (err: unknown) {
    logger.warn(`[Scores365LMT] GetWidget failed:`, (err as Error)?.message);
    return null;
  }
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
