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
  ensureScores365GameMapping,
  getScores365ExperimentConfig,
  getScores365CompetitionId,
  registerScores365FixtureMapping,
  resolveDbFixtureFor365Game,
  loadWorldCupDbFixtures,
} from '../services/scores365-experiment.service';
import { footballDataCacheService } from '../services/football-data-cache.service';
import { hasLineupData } from '../utils/lineups-fallback';
import { threeSixFiveScoresService } from '../services/threeSixFiveScores.service';

// ─── Constants ────────────────────────────────────────────────────────────────

const WORKER = 'WC-Sync';

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

const isRunning = { lineups: false, stats: false, bulk: false, standings: false };
let lineupTimer: ReturnType<typeof setInterval> | null = null;
let statsTimer: ReturnType<typeof setInterval> | null = null;
const liveGameIds = new Set<number>();
const recentGameIds = new Set<number>();

// ─── Bulk Fixture Sync ────────────────────────────────────────────────────────

export async function runBulkFixtureSyncTick(): Promise<void> {
  if (!isEnabled()) return;
  if (isRunning.bulk) {
    logger.debug(`[${WORKER}][bulk] previous tick still running — skipping`);
    return;
  }
  isRunning.bulk = true;

  try {
    const cfg = getScores365ExperimentConfig();
    const result = await threeSixFiveScoresService.getFixtures(getScores365CompetitionId(), 'en');
    const items = result.data;
    
    if (!items || !items.length) {
      logger.debug(`[${WORKER}][bulk] no WC fixtures returned from getFixtures`);
      return;
    }

    const dbRows = await loadWorldCupDbFixtures(cfg.leagueId, cfg.season);

    let mappedCount = 0;
    const newLive = new Set<number>();
    const newRecent = new Set<number>();

    for (const item of items) {
      const row = resolveDbFixtureFor365Game(item.raw as any, dbRows);
      if (row) {
        registerScores365FixtureMapping(row.fixtureId, item.gameId);
        mappedCount++;
      }

      if (item.phase === 'live') {
        newLive.add(item.gameId);
      } else if (item.phase === 'finished') {
        const statusText = (item.raw.shortStatusText ?? item.raw.statusText ?? '').toUpperCase();
        if (statusText === 'FT') {
            newRecent.add(item.gameId);
        }
      }
    }

    liveGameIds.clear();
    for (const id of newLive) liveGameIds.add(id);

    recentGameIds.clear();
    for (const id of newRecent) recentGameIds.add(id);

    const upcomingCount = items.length - newLive.size - newRecent.size; // approximate

    logger.info(
      `[WC-BulkSync] ${mappedCount}/${items.length} fixtures mapped, ${newLive.size} live, ${upcomingCount} upcoming`
    );
  } catch (err: unknown) {
    logger.error(`[${WORKER}][bulk] tick fatal:`, (err as Error)?.message);
  } finally {
    isRunning.bulk = false;
  }
}

// ─── Group standings sync ─────────────────────────────────────────────────────

async function runStandingsSyncTick(): Promise<void> {
  if (!isEnabled()) return;
  if (isRunning.standings) {
    logger.debug(`[${WORKER}][standings] previous tick still running — skipping`);
    return;
  }
  isRunning.standings = true;

  try {
    const count = await footballDataCacheService.syncWorldCupStandingsFrom365('en');
    if (count > 0) {
      logger.debug(`[${WORKER}][standings] synced ${count} WC group rows`, {
        worker: 'worldcup-sync',
        count,
      });
    }
  } catch (err: unknown) {
    logger.error(`[${WORKER}][standings] tick fatal:`, (err as Error)?.message);
  } finally {
    isRunning.standings = false;
  }
}

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
    const liveOrRecent = [...liveGameIds, ...recentGameIds];

    if (!liveOrRecent.length) return;

    logger.info(`[${WORKER}][lineups] tick: ${liveOrRecent.length} live/recent games`);

    for (const gameId of liveOrRecent) {
      try {
        const fixtureId = await resolveFixtureIdForGame(gameId, cfg);
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
            `[${WORKER}][lineups] ⚠️ fixture=${fixtureId} game=${gameId}: incomplete confirmed lineup after retry (home=${startersHome}, away=${startersAway})`,
            { worker: 'worldcup-sync', fixtureId, gameId, startersHome, startersAway, ts: new Date().toISOString() },
          );
        } else if (hasLineupData(lineups)) {
          logger.info(
            `[${WORKER}][lineups] ✅ fixture=${fixtureId} game=${gameId}: home=${startersHome} away=${startersAway} confirmed=${confirmed}`,
            { worker: 'worldcup-sync', fixtureId, gameId, startersHome, startersAway },
          );
        }
      } catch (err: unknown) {
        logger.warn(`[${WORKER}][lineups] error on game ${gameId}:`, (err as Error)?.message);
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
    const liveGamesList = [...liveGameIds];

    if (!liveGamesList.length) return;

    logger.info(`[${WORKER}][stats] tick: ${liveGamesList.length} live WC fixtures`);

    for (const gameId of liveGamesList) {
      try {
        const fixtureId = await resolveFixtureIdForGame(gameId, cfg);
        if (!fixtureId) continue;

        const stats = await footballDataCacheService.getMatchStatistics(fixtureId);
        const hasStats = Array.isArray(stats) && stats.length > 0;

        logger.debug(
          `[${WORKER}][stats] fixture=${fixtureId} game=${gameId}: ${hasStats ? stats.length + ' stat entries' : 'no stats yet'}`,
          { worker: 'worldcup-sync', fixtureId, gameId, hasStats },
        );
      } catch (err: unknown) {
        logger.warn(`[${WORKER}][stats] error on game ${gameId}:`, (err as Error)?.message);
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

  // Search the reverse mapping populated by ensureScores365GameMapping / runBulkFixtureSyncTick
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

  // Mapping sync: cron-based (every 5 minutes)
  cron.schedule('*/5 * * * *', () => {
    void runBulkFixtureSyncTick();
  });

  cron.schedule('*/10 * * * *', () => {
    void runStandingsSyncTick();
  });

  // Lineup sync: interval-based (tight for live matches)
  lineupTimer = setInterval(() => {
    void runLineupSyncTick();
  }, lMs);

  // Stats sync: interval-based (slightly looser)
  statsTimer = setInterval(() => {
    void runStatsSyncTick();
  }, sMs);

  // Kick off after a short delay so boot + warmup don't overlap with WC sync.
  const startupDelayMs = Math.max(
    10_000,
    parseInt(process.env.WC_SYNC_STARTUP_DELAY_MS || '20000', 10) || 20_000,
  );
  setTimeout(() => {
    runBulkFixtureSyncTick().finally(() => {
      void runStandingsSyncTick();
      void runLineupSyncTick();
    });
  }, startupDelayMs);

  logger.info(
    `[${WORKER}] started — bulk sync every 5m (first in ${startupDelayMs / 1000}s), standings every 10m, lineup every ${lMs / 1000}s, stats every ${sMs / 1000}s`,
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
