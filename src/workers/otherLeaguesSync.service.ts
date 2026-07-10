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
import { threeSixFiveScoresService } from '../services/threeSixFiveScores.service';
import { isScores365ExperimentEnabled, sync365SyntheticLiveSnapshots } from '../services/scores365-experiment.service';
import { getRedisClient } from '../lib/redis';
import {
  calendarTodayKey,
  offsetCalendarDateKey,
} from '../utils/calendar-day-bounds.util';

// ─── Constants ────────────────────────────────────────────────────────────────

const WORKER = 'OtherLeagues-Sync';
const LIVE_STATUSES = new Set(['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT']);

/** Master kill-switch shared by both data paths. */
function isWorkerEnabled(): boolean {
  const raw = process.env.OTHER_LEAGUES_SYNC_ENABLED?.trim();
  return raw !== 'false' && raw !== '0';
}

/**
 * API-Football-based calendar/live ticks. Silent in WC-only mode (the WC worker
 * + 365 cover everything) and useless while the API-Football account is down.
 */
function isApiFootballSyncEnabled(): boolean {
  if (!isWorkerEnabled()) return false;
  if (isWorldCupOnlyMode()) return false;
  return true;
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

const isRunning = { calendar: false, live: false, allScores: false, scores365Live: false, catalog: false, fixturesBatch: false };

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

// ─── All-scores (365Scores, all non-WC leagues) sync tick ──────────────────────

/**
 * Sync every non-WC competition from 365Scores' /allscores/ feed in a single call.
 * Builds league-agnostic synthetic cachedFixture rows for leagues API-Football
 * does not cover. Independent of the WC worker; disabled in WORLD_CUP_ONLY_MODE
 * via isEnabled().
 */
async function runAllScoresSyncTick(): Promise<void> {
  if (!isAllScoresEnabled()) return;
  if (isRunning.allScores) {
    logger.debug(`[${WORKER}][allscores] previous tick still running — skipping`);
    return;
  }
  isRunning.allScores = true;

  try {
    const start = dateKeyOffset(-1); // yesterday (catch late-finished results)
    const end = dateKeyOffset(14); // today + 14 days (upcoming calendar)
    const res = await threeSixFiveScoresService.getAllScores(start, end, 'en');
    const items = res.data ?? [];
    const competitions = new Set<number>();
    for (const item of items) {
      if (item.competitionId) competitions.add(item.competitionId);
    }
    logger.info(
      `[OtherLeagues-365] ${items.length} fixtures across ${competitions.size} competitions synced for ${start}..${end}`,
      { worker: 'other-leagues-sync', start, end, fixtures: items.length, competitions: competitions.size },
    );
  } catch (err: unknown) {
    logger.error(`[${WORKER}][allscores] tick fatal (recovered):`, (err as Error)?.message);
  } finally {
    isRunning.allScores = false;
  }
}

// ─── 365 live minute refresh (non-WC synthetic fixtures) ─────────────────────

/**
 * Poll GET /web/game/ for DB-live synthetic fixtures so minutes/scores match 365
 * (same quality as WC liveRefresh). Runs every minute, independent of allscores cron.
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
  if (isRunning.catalog) {
    logger.debug(`[${WORKER}][365catalog] previous tick still running — skipping`);
    return;
  }
  isRunning.catalog = true;

  try {
    const result = await threeSixFiveScoresService.syncCompetitionsCatalog('en', { force });
    logger.info(
      `[${WORKER}][365catalog] ${result.competitions} competitions (${result.leaguesUpserted} upserted)`,
      { worker: 'other-leagues-sync', ...result },
    );
  } catch (err: unknown) {
    logger.error(`[${WORKER}][365catalog] tick fatal (recovered):`, (err as Error)?.message);
  } finally {
    isRunning.catalog = false;
  }
}

// ─── 365 per-competition fixtures batch (round-robin all leagues) ────────────

async function runCompetitionFixturesBatchTick(): Promise<void> {
  if (!isAllScoresEnabled()) return;
  if (isRunning.fixturesBatch) {
    logger.debug(`[${WORKER}][365fixtures] previous tick still running — skipping`);
    return;
  }
  isRunning.fixturesBatch = true;

  try {
    const result = await threeSixFiveScoresService.syncCompetitionFixturesBatch('en');
    if (result.fixtures > 0) {
      logger.info(
        `[${WORKER}][365fixtures] synced ${result.fixtures} fixtures (${result.batchSize}/${result.total} comps, cursor=${result.cursor})`,
        { worker: 'other-leagues-sync', ...result },
      );
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
      `[${WORKER}] idle — API-Football sync off (WORLD_CUP_ONLY_MODE) and 365 allscores off (SCORES365_EXPERIMENT_ENABLED not set)`,
    );
    return;
  }

  const calendarCron = process.env.OTHER_LEAGUES_SYNC_CRON?.trim() || '*/5 * * * *';
  const liveCron = process.env.OTHER_LEAGUES_LIVE_CRON?.trim() || '* * * * *';
  const allScoresCron = process.env.OTHER_LEAGUES_ALLSCORES_CRON?.trim() || '*/10 * * * *';
  const scores365LiveCron = process.env.OTHER_LEAGUES_365_LIVE_CRON?.trim() || '* * * * *';
  const catalogCron = process.env.OTHER_LEAGUES_365_CATALOG_CRON?.trim() || '0 4 * * *';
  const fixturesBatchCron = process.env.OTHER_LEAGUES_365_FIXTURES_CRON?.trim() || '*/5 * * * *';

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
    // Immediate pass on startup (don't wait for the first cron).
    void runCompetitionsCatalogSyncTick(true);
    void runAllScoresSyncTick();
    void run365LiveRefreshTick();
    void runCompetitionFixturesBatchTick();
  }

  logger.info(
    `[${WORKER}] started — apiFootball=${apiFootballEnabled ? `on (calendar="${calendarCron}", live="${liveCron}")` : 'off'}, allscores365=${allScoresEnabled ? `on (allscores="${allScoresCron}", 365live="${scores365LiveCron}", catalog="${catalogCron}", fixtures="${fixturesBatchCron}")` : 'off'}`,
  );
}
