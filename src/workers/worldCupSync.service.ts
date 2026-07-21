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
import { shouldSkipHeavyJob } from '../utils/memory-guard.util';
import { isStartupSyncDisabled } from '../config/startup-sync.config';
import {
  isScores365ExperimentEnabled,
  ensureScores365GameMapping,
  getScores365ExperimentConfig,
  getScores365CompetitionId,
  persistScores365FixtureMetadata,
  registerScores365FixtureMapping,
  resolveDbFixtureFor365Game,
  loadWorldCupDbFixtures,
} from '../services/scores365-experiment.service';
import { footballDataCacheService } from '../services/football-data-cache.service';
import { withSyncLeaderLease } from '../services/football-sync-leader.service';
import { startupJobQueue } from '../services/startup-job-queue.service';
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
  const lease = await withSyncLeaderLease(
    'wc-bulk-fixtures',
    ({ signal }) => runBulkFixtureSyncLocally(signal),
    { ttlSec: 180 },
  );
  if (!lease.acquired) {
    logger.debug(`[${WORKER}][bulk] distributed lease busy — skipping`);
  }
}

async function runBulkFixtureSyncLocally(signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted();
  if (!isEnabled()) return;
  if (shouldSkipHeavyJob('wc-bulk-fixtures')) return;
  if (isRunning.bulk) {
    logger.debug(`[${WORKER}][bulk] previous tick still running — skipping`);
    return;
  }
  isRunning.bulk = true;

  try {
    const cfg = getScores365ExperimentConfig();
    const result = await threeSixFiveScoresService.getFixtures(getScores365CompetitionId(), 'en');
    signal?.throwIfAborted();
    const items = result.data;

    if (!items || !items.length) {
      logger.debug(`[${WORKER}][bulk] no WC fixtures returned from getFixtures`);
      return;
    }

    const dbRows = await loadWorldCupDbFixtures(cfg.leagueId, cfg.season);
    signal?.throwIfAborted();

    let mappedCount = 0;
    const durableMappings: Array<{
      fixtureId: number;
      game: Parameters<typeof persistScores365FixtureMetadata>[0][number]['game'];
    }> = [];
    const newLive = new Set<number>();
    const newRecent = new Set<number>();

    for (const item of items) {
      const row = resolveDbFixtureFor365Game(item.raw as any, dbRows);
      if (row) {
        registerScores365FixtureMapping(row.fixtureId, item.gameId);
        durableMappings.push({ fixtureId: row.fixtureId, game: item.raw as any });
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

    const metadataUpdated = await persistScores365FixtureMetadata(durableMappings);
    signal?.throwIfAborted();

    const upcomingCount = items.length - newLive.size - newRecent.size; // approximate

    logger.info(
      `[WC-BulkSync] ${mappedCount}/${items.length} fixtures mapped (${metadataUpdated} metadata rows updated), ${newLive.size} live, ${upcomingCount} upcoming`,
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
  const lease = await withSyncLeaderLease(
    'wc-standings',
    ({ signal }) => runStandingsSyncLocally(signal),
    { ttlSec: 120 },
  );
  if (!lease.acquired) {
    logger.debug(`[${WORKER}][standings] distributed lease busy — skipping`);
  }
}

async function runStandingsSyncLocally(signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted();
  if (!isEnabled()) return;
  if (shouldSkipHeavyJob('wc-standings')) return;
  if (isRunning.standings) {
    logger.debug(`[${WORKER}][standings] previous tick still running — skipping`);
    return;
  }
  isRunning.standings = true;

  try {
    const count = await footballDataCacheService.syncWorldCupStandingsFrom365('en');
    signal?.throwIfAborted();
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
  const lease = await withSyncLeaderLease(
    'wc-lineups',
    ({ signal }) => runLineupSyncLocally(signal),
    { ttlSec: 120 },
  );
  if (!lease.acquired) {
    logger.debug(`[${WORKER}][lineups] distributed lease busy — skipping`);
  }
}

async function runLineupSyncLocally(signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted();
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
      signal?.throwIfAborted();
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
            {
              worker: 'worldcup-sync',
              fixtureId,
              gameId,
              startersHome,
              startersAway,
              ts: new Date().toISOString(),
            },
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
  const lease = await withSyncLeaderLease('wc-stats', ({ signal }) => runStatsSyncLocally(signal), {
    ttlSec: 90,
  });
  if (!lease.acquired) {
    logger.debug(`[${WORKER}][stats] distributed lease busy — skipping`);
  }
}

async function runStatsSyncLocally(signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted();
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
      signal?.throwIfAborted();
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
    logger.info(
      `[${WORKER}] disabled (SCORES365_EXPERIMENT_ENABLED=false or WC_SYNC_ENABLED=false)`,
    );
    return;
  }

  const lMs = lineupSyncMs();
  const sMs = statsSyncMs();

  // Mapping sync: cron-based (every 5 minutes)
  cron.schedule(process.env.WC_BULK_SYNC_CRON?.trim() || '4-59/5 * * * *', () => {
    void runBulkFixtureSyncTick();
  });

  cron.schedule(process.env.WC_STANDINGS_SYNC_CRON?.trim() || '7-59/10 * * * *', () => {
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

  // Immediate bulk+lineup kickoff on boot — gated (crons/intervals above still run).
  if (isStartupSyncDisabled()) {
    logger.warn(
      `[${WORKER}] STARTUP_SYNC_DISABLED=true — skipping boot bulk/standings/lineup kickoff; timers/crons remain active`,
    );
  } else {
    const startupDelayMs = Math.max(
      10_000,
      parseInt(process.env.WC_SYNC_STARTUP_DELAY_MS || '20000', 10) || 20_000,
    );
    setTimeout(() => {
      startupJobQueue.enqueue('wc-bulk', async () => {
        await runBulkFixtureSyncTick();
      });
      startupJobQueue.enqueue('wc-standings', () => runStandingsSyncTick());
      startupJobQueue.enqueue('wc-lineup', async () => {
        await runLineupSyncTick();
      });
    }, startupDelayMs);
    logger.info(
      `[${WORKER}] started — bulk sync every 5m (boot queued after ${startupDelayMs / 1000}s), standings every 10m, lineup every ${lMs / 1000}s, stats every ${sMs / 1000}s`,
    );
    return;
  }

  logger.info(
    `[${WORKER}] started — bulk cron every 5m, standings every 10m, lineup every ${lMs / 1000}s, stats every ${sMs / 1000}s (no boot kickoff)`,
  );
}

/**
 * Stop both timers (for graceful shutdown or tests).
 */
export function stopWorldCupSyncWorker(): void {
  if (lineupTimer) {
    clearInterval(lineupTimer);
    lineupTimer = null;
  }
  if (statsTimer) {
    clearInterval(statsTimer);
    statsTimer = null;
  }
  logger.info(`[${WORKER}] stopped`);
}
