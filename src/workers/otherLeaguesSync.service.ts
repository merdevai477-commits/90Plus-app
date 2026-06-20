/**
 * otherLeaguesSync.service.ts
 *
 * Worker B — all non-World-Cup competitions.
 * Standard cron sync for live fixture refresh; applies defensive lineup
 * parsing (inherited from footballDataCacheService) without the aggressive
 * completeness gate used in the WC worker.
 *
 * Config (env):
 *   OTHER_LEAGUES_SYNC_ENABLED   — enable/disable (default: true)
 *   OTHER_LEAGUES_SYNC_CRON      — cron expression (default: every 5 min)
 *   OTHER_LEAGUES_LIVE_CRON      — cron for live-match refresh (default: every 1 min)
 */

import cron from 'node-cron';
import { logger } from '../utils/logger';
import { isWorldCupOnlyMode } from '../config/world-cup-only-mode.config';
import { footballDataCacheService } from '../services/football-data-cache.service';
import { getRedisClient } from '../lib/redis';

// ─── Constants ────────────────────────────────────────────────────────────────

const WORKER = 'OtherLeagues-Sync';
const LIVE_STATUSES = new Set(['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT']);

function isEnabled(): boolean {
  const raw = process.env.OTHER_LEAGUES_SYNC_ENABLED?.trim();
  if (raw === 'false' || raw === '0') return false;
  // In WC-only mode this worker is silent — WC worker handles the WC fixtures.
  if (isWorldCupOnlyMode()) return false;
  return true;
}

// ─── State ────────────────────────────────────────────────────────────────────

const isRunning = { calendar: false, live: false };

// ─── Calendar sync tick ───────────────────────────────────────────────────────

async function runCalendarSyncTick(): Promise<void> {
  if (!isEnabled()) return;
  if (isRunning.calendar) {
    logger.debug(`[${WORKER}][calendar] previous tick still running — skipping`);
    return;
  }
  isRunning.calendar = true;

  try {
    const today = new Date().toISOString().split('T')[0];
    const count = await footballDataCacheService.syncCalendarDateFromApi(today);
    logger.info(`[${WORKER}][calendar] synced today ${today}: ${count} fixtures`, {
      worker: 'other-leagues-sync',
      date: today,
      count,
    });
  } catch (err: unknown) {
    logger.error(`[${WORKER}][calendar] tick fatal (recovered):`, (err as Error)?.message);
  } finally {
    isRunning.calendar = false;
  }
}

// ─── Live match refresh tick ──────────────────────────────────────────────────

async function runLiveRefreshTick(): Promise<void> {
  if (!isEnabled()) return;
  if (isRunning.live) {
    logger.debug(`[${WORKER}][live] previous tick still running — skipping`);
    return;
  }
  isRunning.live = true;

  try {
    const redis = getRedisClient();
    if (!redis) return;

    const raw = await redis.get('football:live_matches');
    if (!raw) return;

    let liveFixtures: any[];
    try {
      liveFixtures = JSON.parse(raw) as any[];
    } catch {
      return;
    }
    if (!Array.isArray(liveFixtures) || liveFixtures.length === 0) return;

    const liveIds = liveFixtures
      .filter((f) => LIVE_STATUSES.has(f?.fixture?.status?.short ?? ''))
      .map((f) => f?.fixture?.id as number)
      .filter(Boolean);

    if (!liveIds.length) return;

    logger.info(`[${WORKER}][live] ${liveIds.length} live fixtures to refresh`, {
      worker: 'other-leagues-sync',
      count: liveIds.length,
    });

    for (const fixtureId of liveIds) {
      try {
        // Refresh lineups (defensive parsing inherited) + events
        await Promise.all([
          footballDataCacheService.getMatchLineups(fixtureId, { forceRefresh: false }),
          footballDataCacheService.getMatchEvents(fixtureId, { forceRefresh: false }),
        ]);
        logger.debug(`[${WORKER}][live] refreshed fixture=${fixtureId}`);
      } catch (err: unknown) {
        logger.warn(`[${WORKER}][live] error on fixture ${fixtureId}:`, (err as Error)?.message);
      }
    }
  } catch (err: unknown) {
    logger.error(`[${WORKER}][live] tick fatal (recovered):`, (err as Error)?.message);
  } finally {
    isRunning.live = false;
  }
}

// ─── Registration ─────────────────────────────────────────────────────────────

/**
 * Start the other-leagues sync worker.
 * Completely independent of the WC worker; a crash or slowdown in one
 * never affects the other.
 */
export function startOtherLeaguesSyncWorker(): void {
  if (!isEnabled()) {
    logger.info(`[${WORKER}] disabled (OTHER_LEAGUES_SYNC_ENABLED=false or WORLD_CUP_ONLY_MODE=true)`);
    return;
  }

  const calendarCron = process.env.OTHER_LEAGUES_SYNC_CRON?.trim() || '*/5 * * * *';
  const liveCron = process.env.OTHER_LEAGUES_LIVE_CRON?.trim() || '* * * * *';

  // Calendar refresh every N minutes
  cron.schedule(calendarCron, () => {
    void runCalendarSyncTick();
  });

  // Live fixture refresh every minute
  cron.schedule(liveCron, () => {
    void runLiveRefreshTick();
  });

  logger.info(
    `[${WORKER}] started — calendar cron="${calendarCron}", live cron="${liveCron}"`,
  );
}
