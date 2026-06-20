/**
 * worldCupSync.service.ts
 *
 * Worker A — World Cup only.
 * Polls 365Scores for lineup completeness + live statistics.
 * Runs on its own schedule, fully isolated from otherLeaguesSync.
 *
 * Config (env):
 *   WC_SYNC_ENABLED         — enable/disable this worker (default: true when SCORES365_EXPERIMENT_ENABLED)
 *   WC_LINEUP_SYNC_MS       — lineup poll interval ms (default 30 000 live / 300 000 non-live)
 *   WC_STATS_SYNC_MS        — stats poll interval ms for live matches (default 45 000)
 */

import cron from 'node-cron';
import { logger } from '../utils/logger';
import {
  isScores365ExperimentEnabled,
  fetchScores365WorldCupFixtures,
  ensureScores365GameMapping,
  getScores365ExperimentConfig,
} from '../services/scores365-experiment.service';
import { footballDataCacheService } from '../services/football-data-cache.service';
import { hasLineupData } from '../utils/lineups-fallback';

// ─── Constants ────────────────────────────────────────────────────────────────

const WORKER = 'WC-Sync';
const LIVE_STATUSES = new Set(['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT']);
const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN']);

function isEnabled(): boolean {
  const raw = process.env.WC_SYNC_ENABLED?.trim();
  if (raw === 'false' || raw === '0') return false;
  return isScores365ExperimentEnabled();
}

function lineupSyncMs(): number {
  return Math.max(10_000, parseInt(process.env.WC_LINEUP_SYNC_MS || '30000', 10) || 30_000);
}

function statsSyncMs(): number {
  return Math.max(10_000, parseInt(process.env.WC_STATS_SYNC_MS || '45000', 10) || 45_000);
}

// ─── State ────────────────────────────────────────────────────────────────────

const isRunning = { lineups: false, stats: false };
let lineupTimer: ReturnType<typeof setInterval> | null = null;
let statsTimer: ReturnType<typeof setInterval> | null = null;

// ─── Lineup sync tick ─────────────────────────────────────────────────────────

async function runLineupSyncTick(): Promise<void> {
  if (!isEnabled()) return;
  if (isRunning.lineups) {
    logger.debug(`[${WORKER}][lineups] previous tick still running — skipping`);
    return;
  }
  isRunning.lineups = true;

  try {
    const cfg = getScores365ExperimentConfig();
    const games = await fetchScores365WorldCupFixtures({ language: 'en', liveRefresh: true });

    if (!games.length) {
      logger.debug(`[${WORKER}][lineups] no WC fixtures returned`);
      return;
    }

    const liveOrRecent = games.filter((g) => {
      const statusText = (g.shortStatusText ?? g.statusText ?? '').toUpperCase();
      // include live + recently-finished (FT) so we capture lineups for just-ended matches
      return LIVE_STATUSES.has(statusText) || statusText === 'FT';
    });

    logger.info(`[${WORKER}][lineups] tick: ${games.length} total WC fixtures, ${liveOrRecent.length} live/recent`);

    for (const game of liveOrRecent) {
      try {
        // Resolve fixtureId ↔ gameId mapping
        const fixtureId = await resolveFixtureIdForGame(game.id, cfg);
        if (!fixtureId) continue;

        await ensureScores365GameMapping(fixtureId);

        const lineups = await footballDataCacheService.get365LineupsMerged(
          fixtureId,
          'en',
          undefined,
          true, // force refresh
        );

        const startersHome = (lineups[0]?.startXI ?? []).length;
        const startersAway = (lineups[1]?.startXI ?? []).length;
        const incomplete = lineups.some((s: any) => s?._incomplete);
        const confirmed = lineups.some((s: any) => s?._lineupsConfirmed);

        if (incomplete || (confirmed && (startersHome < 11 || startersAway < 11))) {
          logger.warn(
            `[${WORKER}][lineups] ⚠️ fixture=${fixtureId} game=${game.id}: incomplete confirmed lineup after retry (home=${startersHome}, away=${startersAway})`,
            { worker: 'worldcup-sync', fixtureId, gameId: game.id, startersHome, startersAway, ts: new Date().toISOString() },
          );
        } else if (hasLineupData(lineups)) {
          logger.info(
            `[${WORKER}][lineups] ✅ fixture=${fixtureId} game=${game.id}: home=${startersHome} away=${startersAway} confirmed=${confirmed}`,
            { worker: 'worldcup-sync', fixtureId, gameId: game.id, startersHome, startersAway },
          );
        }
      } catch (err: unknown) {
        logger.warn(`[${WORKER}][lineups] error on game ${game.id}:`, (err as Error)?.message);
      }
    }
  } catch (err: unknown) {
    logger.error(`[${WORKER}][lineups] tick fatal (recovered):`, (err as Error)?.message);
  } finally {
    isRunning.lineups = false;
  }
}

// ─── Stats sync tick ──────────────────────────────────────────────────────────

async function runStatsSyncTick(): Promise<void> {
  if (!isEnabled()) return;
  if (isRunning.stats) {
    logger.debug(`[${WORKER}][stats] previous tick still running — skipping`);
    return;
  }
  isRunning.stats = true;

  try {
    const cfg = getScores365ExperimentConfig();
    const games = await fetchScores365WorldCupFixtures({ language: 'en', liveRefresh: true });
    const liveGames = games.filter((g) =>
      LIVE_STATUSES.has((g.shortStatusText ?? g.statusText ?? '').toUpperCase()),
    );

    if (!liveGames.length) return;

    logger.info(`[${WORKER}][stats] tick: ${liveGames.length} live WC fixtures`);

    for (const game of liveGames) {
      try {
        const fixtureId = await resolveFixtureIdForGame(game.id, cfg);
        if (!fixtureId) continue;

        const stats = await footballDataCacheService.getMatchStatistics(fixtureId);
        const hasStats = Array.isArray(stats) && stats.length > 0;

        logger.debug(
          `[${WORKER}][stats] fixture=${fixtureId} game=${game.id}: ${hasStats ? stats.length + ' stat entries' : 'no stats yet'}`,
          { worker: 'worldcup-sync', fixtureId, gameId: game.id, hasStats },
        );
      } catch (err: unknown) {
        logger.warn(`[${WORKER}][stats] error on game ${game.id}:`, (err as Error)?.message);
      }
    }
  } catch (err: unknown) {
    logger.error(`[${WORKER}][stats] tick fatal (recovered):`, (err as Error)?.message);
  } finally {
    isRunning.stats = false;
  }
}

// ─── Fixture ID resolution ────────────────────────────────────────────────────

/**
 * Lazily map a 365 gameId → API-Football fixtureId.
 * Falls back to the configured experiment fixtureId for the default game.
 */
async function resolveFixtureIdForGame(
  gameId: number,
  cfg: ReturnType<typeof getScores365ExperimentConfig>,
): Promise<number | null> {
  if (gameId === cfg.gameId) return cfg.fixtureId;

  // Search the reverse mapping populated by ensureScores365GameMapping / syncScores365FixtureMappingsFromFixturesList
  const { getScores365GameIdForFixture } = await import('../services/scores365-experiment.service');
  // The map stores fixtureId → gameId; we need the reverse.
  // We iterate our WC DB fixtures via a lightweight import to find a match.
  const prisma = (await import('../lib/prisma')).default;
  const leagueId = cfg.leagueId;
  const season = cfg.season;

  // Check if the gameId maps to any registered fixtureId
  const dbRows = await prisma.cachedFixture.findMany({
    where: { leagueId, leagueSeason: season },
    select: { fixtureId: true },
  });

  for (const row of dbRows) {
    const mapped = getScores365GameIdForFixture(row.fixtureId);
    if (mapped === gameId) return row.fixtureId;
  }

  return null;
}

// ─── Registration ─────────────────────────────────────────────────────────────

/**
 * Start the World Cup sync worker.
 * Safe to call once at startup; no-op if WC_SYNC_ENABLED=false or SCORES365_EXPERIMENT_ENABLED=false.
 */
export function startWorldCupSyncWorker(): void {
  if (!isEnabled()) {
    logger.info(`[${WORKER}] disabled (SCORES365_EXPERIMENT_ENABLED=false or WC_SYNC_ENABLED=false)`);
    return;
  }

  const lMs = lineupSyncMs();
  const sMs = statsSyncMs();

  // Lineup sync: interval-based (tight for live matches)
  lineupTimer = setInterval(() => {
    void runLineupSyncTick();
  }, lMs);

  // Stats sync: interval-based (slightly looser)
  statsTimer = setInterval(() => {
    void runStatsSyncTick();
  }, sMs);

  // Kick off immediately on startup
  void runLineupSyncTick();

  logger.info(
    `[${WORKER}] started — lineup every ${lMs / 1000}s, stats every ${sMs / 1000}s`,
  );
}

/**
 * Stop both timers (for graceful shutdown or tests).
 */
export function stopWorldCupSyncWorker(): void {
  if (lineupTimer) { clearInterval(lineupTimer); lineupTimer = null; }
  if (statsTimer)  { clearInterval(statsTimer);  statsTimer  = null; }
  logger.info(`[${WORKER}] stopped`);
}
