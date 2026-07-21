/**
 * WORLD_CUP_ONLY_MODE — when true, outbound API-Football calls are limited to
 * the configured World Cup competition (WORLD_CUP_LEAGUE_ID / WORLD_CUP_SEASON).
 * DB/Redis/memory cache reads are unchanged.
 */

import { logger } from '../utils/logger';
import { getWorldCupTabState } from '../services/app-features.service';

let startupLogged = false;

export function isWorldCupOnlyMode(): boolean {
  const raw = process.env.WORLD_CUP_ONLY_MODE?.trim();
  return raw === 'true' || raw === '1';
}

/**
 * Keep completed/past World Cup reads on durable PostgreSQL snapshots.
 * This is independent of WORLD_CUP_ONLY_MODE and does not affect other leagues.
 */
export function isWorldCupHistoricalOnlyMode(): boolean {
  const raw = process.env.WORLD_CUP_HISTORICAL_ONLY?.trim();
  return raw === 'true' || raw === '1';
}

export function getWorldCupLeagueId(): number {
  return getWorldCupTabState().leagueId;
}

export function getWorldCupSeason(): number {
  return getWorldCupTabState().season;
}

export function isWorldCupFixture(fixture: unknown): boolean {
  const f = fixture as { league?: { id?: number; season?: number | null } } | null | undefined;
  const leagueId = f?.league?.id;
  if (leagueId == null) return false;
  const season = f?.league?.season;
  const targetSeason = getWorldCupSeason();
  return leagueId === getWorldCupLeagueId() && (season === targetSeason || season == null);
}

export function filterWorldCupFixtures<T>(fixtures: T[]): T[] {
  return (fixtures ?? []).filter((f) => isWorldCupFixture(f));
}

export function logWorldCupOnlyModeStartup(): void {
  if (!isWorldCupOnlyMode() || startupLogged) return;
  startupLogged = true;
  const wc = getWorldCupTabState();
  logger.info(
    `[Football Sync] World Cup sync enabled (league=${wc.leagueId}, season=${wc.season})`,
  );
}

export function logSkippingNonWorldCup(context: string): void {
  if (!isWorldCupOnlyMode()) return;
  logger.info(`[Football Sync] Skipping non World Cup competition (${context})`);
}

function leagueParamMatches(params: Record<string, unknown>): boolean {
  const leagueId = getWorldCupLeagueId();
  const raw = params.league;
  return raw === leagueId || raw === String(leagueId);
}

function extractFixtureId(endpoint: string, params: Record<string, unknown>): number | null {
  if (params.id != null) {
    const id = parseInt(String(params.id), 10);
    return Number.isFinite(id) && id > 0 ? id : null;
  }
  if (params.fixture != null) {
    const id = parseInt(String(params.fixture), 10);
    return Number.isFinite(id) && id > 0 ? id : null;
  }
  if (endpoint === '/fixtures' && params.ids != null) {
    const first = String(params.ids).split('-')[0];
    const id = parseInt(first, 10);
    return Number.isFinite(id) && id > 0 ? id : null;
  }
  return null;
}

export async function isWorldCupFixtureIdAllowed(fixtureId: number): Promise<boolean> {
  const prisma = (await import('../lib/prisma')).default;
  const row = await prisma.cachedFixture.findUnique({
    where: { fixtureId },
    select: { leagueId: true },
  });
  if (row) {
    return row.leagueId === getWorldCupLeagueId();
  }
  return false;
}

/**
 * Returns true if the request may proceed to upstream API-Football (before fixture-id check).
 */
export function isAllowedApiFootballParams(endpoint: string, params: Record<string, unknown>): boolean {
  if (!isWorldCupOnlyMode()) return true;

  if (endpoint === '/fixtures') {
    if (leagueParamMatches(params)) return true;
    if (params.live === 'all' && params.team == null && params.date == null) return true;
    if (params.id != null || params.ids != null) return true;
    if (params.date != null && params.league == null) {
      logSkippingNonWorldCup(`fixtures?date=${params.date} without league scope`);
      return false;
    }
    if (params.team != null) {
      logSkippingNonWorldCup(`fixtures?team=${params.team}`);
      return false;
    }
    logSkippingNonWorldCup(`fixtures params=${JSON.stringify(params)}`);
    return false;
  }

  if (
    endpoint === '/fixtures/lineups' ||
    endpoint === '/fixtures/statistics' ||
    endpoint === '/fixtures/events' ||
    endpoint === '/fixtures/players'
  ) {
    return true;
  }

  if (endpoint === '/standings') {
    if (leagueParamMatches(params)) return true;
    logSkippingNonWorldCup(`standings league=${params.league}`);
    return false;
  }

  logSkippingNonWorldCup(endpoint);
  return false;
}

export function requiresWorldCupFixtureIdCheck(
  endpoint: string,
  params: Record<string, unknown>,
): boolean {
  if (!isWorldCupOnlyMode()) return false;
  if (
    endpoint === '/fixtures/lineups' ||
    endpoint === '/fixtures/statistics' ||
    endpoint === '/fixtures/events' ||
    endpoint === '/fixtures/players'
  ) {
    return true;
  }
  if (endpoint === '/fixtures' && (params.id != null || params.ids != null)) {
    return true;
  }
  return false;
}

export async function assertWorldCupFixtureApiAllowed(
  endpoint: string,
  params: Record<string, unknown>,
): Promise<boolean> {
  if (!requiresWorldCupFixtureIdCheck(endpoint, params)) return true;
  const fixtureId = extractFixtureId(endpoint, params);
  if (fixtureId == null) {
    logSkippingNonWorldCup(`${endpoint} missing fixture id`);
    return false;
  }
  const allowed = await isWorldCupFixtureIdAllowed(fixtureId);
  if (!allowed) {
    logSkippingNonWorldCup(`fixture ${fixtureId}`);
  }
  return allowed;
}
