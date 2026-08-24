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
 *   OTHER_LEAGUES_API_FOOTBALL_JOBS_ENABLED — legacy duplicate API jobs (default: false)
 *   OTHER_LEAGUES_SYNC_CRON      — cron expression (default: every 5 min)
 *   OTHER_LEAGUES_LIVE_CRON      — cron for live-match refresh (default: every 2 min)
 *   OTHER_LEAGUES_ALLSCORES_CRON — cron for 365 /allscores/ calendar sync (default: every 10 min)
 *   OTHER_LEAGUES_365_LIVE_CRON  — cron for 365 per-game live overlay refresh (default: every 2 min)
 *   SCORES365_ALLSCORES_LIVE_MS  — hot allscores live tick that REPLACES Redis live list (default: 20s)
 */

import cron from 'node-cron';
import { logger } from '../utils/logger';
import { shouldSkipHeavyJob } from '../utils/memory-guard.util';
import { isWorldCupOnlyMode } from '../config/world-cup-only-mode.config';
import { areLegacyOtherLeagueApiJobsEnabled } from '../config/football-sync-ownership.config';
import { isStartupSyncDisabled } from '../config/startup-sync.config';
import { footballDataCacheService } from '../services/football-data-cache.service';
import { threeSixFiveScoresService } from '../services/threeSixFiveScores.service';
import { startupJobQueue } from '../services/startup-job-queue.service';
import { isScores365ExperimentEnabled, sync365SyntheticLiveSnapshots } from '../services/scores365-experiment.service';
import { withSyncLeaderLease } from '../services/football-sync-leader.service';
import { readLiveFixturesList } from '../services/live-fixture-cache.service';
import {
  calendarTodayKey,
  offsetCalendarDateKey,
} from '../utils/calendar-day-bounds.util';

// ─── Constants ────────────────────────────────────────────────────────────────

const WORKER = 'OtherLeagues-Sync';
const LIVE_STATUSES = new Set(['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT', 'SUSP']);

/** Master kill-switch shared by both data paths. */
function isWorkerEnabled(): boolean {
  const raw = process.env.OTHER_LEAGUES_SYNC_ENABLED?.trim();
  return raw !== 'false' && raw !== '0';
}

/**
 * Legacy API-Football calendar/live ticks. Disabled by default because the
 * dedicated calendar/live services own those feeds; explicit opt-in is retained
 * only as a rollback switch.
 */
export function isApiFootballSyncEnabled(): boolean {
  if (!isWorkerEnabled()) return false;
  if (isWorldCupOnlyMode()) return false;
  return areLegacyOtherLeagueApiJobsEnabled();
}

/**
 * 365Scores all-scores tick. Independent of WORLD_CUP_ONLY_MODE so non-WC leagues
 * are sourced from 365 exactly like the World Cup, even when API-Football is
 * suspended/restricted. Gated only by the 365 experiment master flag.
 */
function isAllScoresEnabled(): boolean {
  if (!isWorkerEnabled()) return false;
  return isScores365ExperimentEnabled();
}

// ─── State ────────────────────────────────────────────────────────────────────

const isRunning = { calendar: false, live: false, allScores: false, scores365Live: false, allScoresLive: false, catalog: false, fixturesBatch: false };
let scores365FavoriteHotTimer: ReturnType<typeof setInterval> | null = null;
let scores365AllScoresLiveTimer: ReturnType<typeof setInterval> | null = null;

/** App-calendar YYYY-MM-DD offset by `days` from today (Cairo by default). */
function dateKeyOffset(days: number): string {
  return offsetCalendarDateKey(calendarTodayKey(), days);
}

// ─── Calendar sync tick ───────────────────────────────────────────────────────

async function runCalendarSyncTick(): Promise<void> {
  if (!isApiFootballSyncEnabled()) return;
  if (isRunning.calendar) {
    logger.debug(`[${WORKER}][calendar] previous tick still running — skipping`);
    return;
  }
  isRunning.calendar = true;

  try {
    const today = calendarTodayKey();
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
  if (!isApiFootballSyncEnabled()) return;
  if (isRunning.live) {
    logger.debug(`[${WORKER}][live] previous tick still running — skipping`);
    return;
  }
  isRunning.live = true;

  try {
    const liveFixtures = await readLiveFixturesList();
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

// ─── All-scores (365Scores, all non-WC leagues) sync tick ──────────────────────

/**
 * Sync every non-WC competition from 365Scores' /allscores/ feed in a single call.
 * Builds league-agnostic synthetic cachedFixture rows for leagues API-Football
 * does not cover. Independent of the WC worker; disabled in WORLD_CUP_ONLY_MODE
 * via isEnabled().
 */
async function runAllScoresSyncTick(): Promise<void> {
  if (!isAllScoresEnabled()) return;
  if (shouldSkipHeavyJob('other-leagues-allscores')) return;
  if (isRunning.allScores) {
    logger.debug(`[${WORKER}][allscores] previous tick still running — skipping`);
    return;
  }
  isRunning.allScores = true;

  try {
    const lease = await withSyncLeaderLease('365-allscores', async ({ signal }) => {
      signal.throwIfAborted();
      // ~5 calendar days: yesterday → today+3 (was 16 days — OOM driver).
      const start = dateKeyOffset(-1);
      const end = dateKeyOffset(3);
      const res = await threeSixFiveScoresService.getAllScores(start, end, 'en');
      signal.throwIfAborted();
      const items = res.data ?? [];
      const competitions = new Set<number>();
      for (const item of items) {
        if (item.competitionId) competitions.add(item.competitionId);
      }
      logger.info(
        `[OtherLeagues-365] ${items.length} fixtures across ${competitions.size} competitions synced for ${start}..${end}`,
        { worker: 'other-leagues-sync', start, end, fixtures: items.length, competitions: competitions.size },
      );
    }, { ttlSec: 120 });
    if (!lease.acquired) {
      logger.debug(`[${WORKER}][allscores] distributed lease busy — skipping`);
    }
  } catch (err: unknown) {
    logger.error(`[${WORKER}][allscores] tick fatal (recovered):`, (err as Error)?.message);
  } finally {
    isRunning.allScores = false;
  }
}

// ─── 365 allscores live tick (authoritative Redis REPLACE) ───────────────────

async function run365AllScoresLiveTick(): Promise<void> {
  if (!isAllScoresEnabled()) return;
  if (isRunning.allScoresLive) {
    logger.debug(`[${WORKER}][365allscores-live] previous tick still running — skipping`);
    return;
  }
  isRunning.allScoresLive = true;

  try {
    const lease = await withSyncLeaderLease('365-allscores-live', async ({ signal }) => {
      signal.throwIfAborted();
      const result = await threeSixFiveScoresService.syncLiveSnapshotFromAllScores('en');
      signal.throwIfAborted();
      if (result.live > 0 || result.ended > 0 || result.retired > 0) {
        logger.debug(
          `[${WORKER}][365allscores-live] live=${result.live} ended=${result.ended} retired=${result.retired}`,
          { worker: 'other-leagues-sync', ...result },
        );
      }
    }, { ttlSec: 40 });
    if (!lease.acquired) {
      logger.debug(`[${WORKER}][365allscores-live] distributed lease busy — skipping`);
    }
  } catch (err: unknown) {
    logger.error(`[${WORKER}][365allscores-live] tick fatal (recovered):`, (err as Error)?.message);
  } finally {
    isRunning.allScoresLive = false;
  }
}

// ─── 365 live minute refresh (non-WC synthetic fixtures) ─────────────────────

/**
 * Poll GET /web/game/ for Redis-live synthetic fixtures so minutes/scores match 365
 * (same quality as WC liveRefresh). Independent of the allscores REPLACE tick.
 */
async function run365LiveRefreshTick(): Promise<void> {
  if (!isAllScoresEnabled()) return;
  if (isRunning.scores365Live) {
    logger.debug(`[${WORKER}][365live] previous tick still running — skipping`);
    return;
  }
  isRunning.scores365Live = true;

  try {
    const count = await sync365SyntheticLiveSnapshots({ language: 'en' });
    if (count > 0) {
      logger.debug(`[${WORKER}][365live] refreshed ${count} synthetic fixtures`, {
        worker: 'other-leagues-sync',
        count,
      });
    }
  } catch (err: unknown) {
    logger.error(`[${WORKER}][365live] tick fatal (recovered):`, (err as Error)?.message);
  } finally {
    isRunning.scores365Live = false;
  }
}

// ─── 365 competitions catalog (all leagues incl. 2nd/3rd tier) ───────────────

async function runCompetitionsCatalogSyncTick(force = false): Promise<void> {
  if (!isAllScoresEnabled()) return;
  if (shouldSkipHeavyJob('other-leagues-365catalog')) return;
  if (isRunning.catalog) {
    logger.debug(`[${WORKER}][365catalog] previous tick still running — skipping`);
    return;
  }
  isRunning.catalog = true;

  try {
    const lease = await withSyncLeaderLease('365-catalog', async ({ signal }) => {
      signal.throwIfAborted();
      const result = await threeSixFiveScoresService.syncCompetitionsCatalog('en', { force });
      signal.throwIfAborted();
      logger.info(
        `[${WORKER}][365catalog] ${result.competitions} competitions (${result.leaguesUpserted} upserted)`,
        { worker: 'other-leagues-sync', ...result },
      );
    }, { ttlSec: 300 });
    if (!lease.acquired) {
      logger.debug(`[${WORKER}][365catalog] distributed lease busy — skipping`);
    }
  } catch (err: unknown) {
    logger.error(`[${WORKER}][365catalog] tick fatal (recovered):`, (err as Error)?.message);
  } finally {
    isRunning.catalog = false;
  }
}

// ─── 365 per-competition fixtures batch (round-robin all leagues) ────────────

async function runCompetitionFixturesBatchTick(): Promise<void> {
  if (!isAllScoresEnabled()) return;
  if (shouldSkipHeavyJob('other-leagues-365fixtures')) return;
  if (isRunning.fixturesBatch) {
    logger.debug(`[${WORKER}][365fixtures] previous tick still running — skipping`);
    return;
  }
  isRunning.fixturesBatch = true;

  try {
    const lease = await withSyncLeaderLease('365-fixtures-batch', async ({ signal }) => {
      signal.throwIfAborted();
      const result = await threeSixFiveScoresService.syncCompetitionFixturesBatch('en');
      signal.throwIfAborted();
      if (result.fixtures > 0) {
        logger.info(
          `[${WORKER}][365fixtures] synced ${result.fixtures} fixtures (${result.batchSize}/${result.total} comps, cursor=${result.cursor})`,
          { worker: 'other-leagues-sync', ...result },
        );
      }
    }, { ttlSec: 180 });
    if (!lease.acquired) {
      logger.debug(`[${WORKER}][365fixtures] distributed lease busy — skipping`);
    }
  } catch (err: unknown) {
    logger.error(`[${WORKER}][365fixtures] tick fatal (recovered):`, (err as Error)?.message);
  } finally {
    isRunning.fixturesBatch = false;
  }
}

// ─── Registration ─────────────────────────────────────────────────────────────

/**
 * Start the other-leagues sync worker.
 * Completely independent of the WC worker; a crash or slowdown in one
 * never affects the other.
 */
export function startOtherLeaguesSyncWorker(): void {
  if (!isWorkerEnabled()) {
    logger.info(`[${WORKER}] disabled (OTHER_LEAGUES_SYNC_ENABLED=false)`);
    return;
  }

  const apiFootballEnabled = isApiFootballSyncEnabled();
  const allScoresEnabled = isAllScoresEnabled();

  if (!apiFootballEnabled && !allScoresEnabled) {
    logger.info(
      `[${WORKER}] idle — legacy API-Football jobs off and 365 allscores off (SCORES365_EXPERIMENT_ENABLED not set)`,
    );
    return;
  }

  const calendarCron = process.env.OTHER_LEAGUES_SYNC_CRON?.trim() || '1-59/5 * * * *';
  const liveCron = process.env.OTHER_LEAGUES_LIVE_CRON?.trim() || '2-59/5 * * * *';
  // Default every 10 min — NS/FT calendar coverage. Live set uses the 20s allscores tick.
  const allScoresCron = process.env.OTHER_LEAGUES_ALLSCORES_CRON?.trim() || '4-59/10 * * * *';
  const scores365LiveCron = process.env.OTHER_LEAGUES_365_LIVE_CRON?.trim() || '1-59/2 * * * *';
  const catalogCron = process.env.OTHER_LEAGUES_365_CATALOG_CRON?.trim() || '17 4 * * *';
  const fixturesBatchCron = process.env.OTHER_LEAGUES_365_FIXTURES_CRON?.trim() || '3-59/5 * * * *';

  // API-Football calendar/live ticks (skip entirely in WC-only mode).
  if (apiFootballEnabled) {
    cron.schedule(calendarCron, () => {
      void runCalendarSyncTick();
    });
    cron.schedule(liveCron, () => {
      void runLiveRefreshTick();
    });
  }

  // All non-WC leagues from 365Scores /allscores/ — single large request per tick.
  // Runs regardless of WORLD_CUP_ONLY_MODE so other leagues mirror the WC pipeline.
  if (allScoresEnabled) {
    cron.schedule(allScoresCron, () => {
      void runAllScoresSyncTick();
    });
    cron.schedule(scores365LiveCron, () => {
      void run365LiveRefreshTick();
    });
    cron.schedule(catalogCron, () => {
      void runCompetitionsCatalogSyncTick(true);
    });
    cron.schedule(fixturesBatchCron, () => {
      void runCompetitionFixturesBatchTick();
    });
    // Favorited synthetic live fixtures retain the 5s event/push cadence.
    // The broader non-favorite catalog refresh remains on its conservative cron.
    if (!scores365FavoriteHotTimer) {
      const hotIntervalMs = Math.max(
        5_000,
        parseInt(process.env.SCORES365_FAVORITE_LIVE_SYNC_MS || '5000', 10) || 5_000,
      );
      scores365FavoriteHotTimer = setInterval(() => {
        void sync365SyntheticLiveSnapshots({
          language: 'en',
          favoritedOnly: true,
        }).catch((err) =>
          logger.warn(`[${WORKER}][365hot] favorite refresh failed:`, err?.message),
        );
      }, hotIntervalMs);
      scores365FavoriteHotTimer.unref?.();
    }
    if (!scores365AllScoresLiveTimer) {
      const liveTickMs = Math.max(
        10_000,
        parseInt(process.env.SCORES365_ALLSCORES_LIVE_MS || '20000', 10) || 20_000,
      );
      scores365AllScoresLiveTimer = setInterval(() => {
        void run365AllScoresLiveTick();
      }, liveTickMs);
      scores365AllScoresLiveTimer.unref?.();
      void run365AllScoresLiveTick();
    }
    // Boot-time force syncs (catalog / allscores / 365live / fixtures) — gated.
    // With STARTUP_SYNC_DISABLED=true these are skipped; crons above still run.
    if (isStartupSyncDisabled()) {
      logger.warn(
        `[${WORKER}] STARTUP_SYNC_DISABLED=true — skipping boot catalog/allscores/365live/fixtures; crons remain active`,
      );
    } else {
      // Serial startup queue (max 1–2) — never fire catalog+allscores+live+fixtures together.
      const startupDelayMs = Math.max(
        15_000,
        parseInt(process.env.OTHER_LEAGUES_STARTUP_DELAY_MS || '30000', 10) || 30_000,
      );
      setTimeout(() => {
        startupJobQueue.enqueue('other-leagues-catalog', () => runCompetitionsCatalogSyncTick(true));
        startupJobQueue.enqueue('other-leagues-allscores', () => runAllScoresSyncTick());
        startupJobQueue.enqueue('other-leagues-365live', () => run365LiveRefreshTick());
        startupJobQueue.enqueue('other-leagues-365-allscores-live', () => run365AllScoresLiveTick());
        startupJobQueue.enqueue('other-leagues-fixtures', () => runCompetitionFixturesBatchTick());
      }, startupDelayMs);
      logger.info(
        `[${WORKER}] boot jobs queued (serial) after ${startupDelayMs / 1000}s`,
      );
    }
  }

  logger.info(
    `[${WORKER}] started — apiFootball=${apiFootballEnabled ? `on (calendar="${calendarCron}", live="${liveCron}")` : 'off'}, allscores365=${allScoresEnabled ? `on (allscores="${allScoresCron}", 365live="${scores365LiveCron}", catalog="${catalogCron}", fixtures="${fixturesBatchCron}", liveTick=${process.env.SCORES365_ALLSCORES_LIVE_MS || '20000'}ms)` : 'off'}`,
  );
}
