/**
 * Football Calendar Sync — authoritative scheduler for match lists.
 *
 * One API call per tick (`fixtures?date=YYYY-MM-DD`) → memory cache + Redis + PostgreSQL.
 * User HTTP requests never trigger upstream calls for calendar days covered here.
 *
 * Tuned for low user counts: fewer ticks, instant responses from DB/cache.
 */

import { logger } from '../utils/logger';
import { footballDataCacheService } from './football-data-cache.service';
import { isFootballQuotaExhausted } from './football.service';
import { tryAcquireSyncLeader } from './football-sync-leader.service';
import {
    isWorldCupOnlyMode,
    logWorldCupOnlyModeStartup,
} from '../config/world-cup-only-mode.config';
import {
    calendarTodayKey,
    offsetCalendarDateKey,
} from '../utils/calendar-day-bounds.util';

function calendarSyncIntervalMs(): number {
    // Default 60s so kickoff status on the matches list catches up faster.
    const fromEnv = parseInt(process.env.FOOTBALL_CALENDAR_SYNC_MS || '60000', 10);
    return Math.max(60_000, Number.isFinite(fromEnv) ? fromEnv : 60_000);
}

function prefetchIntervalMs(): number {
    const fromEnv = parseInt(process.env.FOOTBALL_CALENDAR_PREFETCH_MS || '1800000', 10);
    return Math.max(300_000, Number.isFinite(fromEnv) ? fromEnv : 1_800_000);
}

/** App calendar day (Africa/Cairo by default) — must match HTTP matches-by-date keys. */
function appDateKey(offsetDays = 0): string {
    return offsetCalendarDateKey(calendarTodayKey(), offsetDays);
}

class FootballCalendarSyncService {
    private todayInterval: NodeJS.Timeout | null = null;
    private prefetchInterval: NodeJS.Timeout | null = null;
    private running = false;

    start(): void {
        if (!process.env.FOOTBALL_API_KEY) {
            logger.warn('[CalendarSync] Disabled — FOOTBALL_API_KEY not set');
            return;
        }
        if (this.running) return;

        const todayMs = calendarSyncIntervalMs();
        const prefetchMs = prefetchIntervalMs();

        this.running = true;
        logWorldCupOnlyModeStartup();
        logger.info(
            `[CalendarSync] Started — today every ${todayMs / 1000}s, prefetch every ${prefetchMs / 1000}s (leader-elected)${isWorldCupOnlyMode() ? ' [World Cup only]' : ''}`,
        );

        const runToday = () => {
            void this.syncToday().catch((err) =>
                logger.warn('[CalendarSync] today sync failed:', err),
            );
        };

        const runPrefetch = () => {
            void this.syncUpcomingDays().catch((err) =>
                logger.warn('[CalendarSync] prefetch failed:', err),
            );
        };

        setTimeout(runToday, 8_000);
        setTimeout(runPrefetch, 20_000);

        if (isWorldCupOnlyMode()) {
            setTimeout(() => {
                void this.runWorldCupBackfill().catch((err) =>
                    logger.warn('[CalendarSync] World Cup backfill failed:', err),
                );
            }, 5_000);
        }

        this.todayInterval = setInterval(runToday, todayMs);
        this.prefetchInterval = setInterval(runPrefetch, prefetchMs);
    }

    /**
     * One-time tournament-wide fixture seed (leader-elected). Populates every WC
     * matchday in cachedFixture, then re-runs the 365Scores bulk mapping tick so
     * fixture↔game mapping has rows to match against immediately.
     */
    private async runWorldCupBackfill(): Promise<void> {
        if (isFootballQuotaExhausted()) {
            logger.debug('[CalendarSync] World Cup backfill skipped — quota exhausted');
            return;
        }

        const isLeader = await tryAcquireSyncLeader('calendar-sync');
        if (!isLeader) {
            logger.debug('[CalendarSync] World Cup backfill skipped — not sync leader');
            return;
        }

        const count = await footballDataCacheService.backfillWorldCupFixtures();
        logger.info(`[CalendarSync] World Cup backfill: ${count} fixtures seeded`);

        if (count > 0) {
            try {
                const { runBulkFixtureSyncTick } = await import('../workers/worldCupSync.service');
                await runBulkFixtureSyncTick();
            } catch (err) {
                logger.warn('[CalendarSync] post-backfill 365 bulk sync failed:', err);
            }
        }
    }

    stop(): void {
        if (this.todayInterval) {
            clearInterval(this.todayInterval);
            this.todayInterval = null;
        }
        if (this.prefetchInterval) {
            clearInterval(this.prefetchInterval);
            this.prefetchInterval = null;
        }
        this.running = false;
        logger.info('[CalendarSync] Stopped');
    }

    /** One upstream call for today → cache + DB. */
    async syncToday(): Promise<number> {
        return this.syncDate(appDateKey(0));
    }

    /** Warm tomorrow (+ optional yesterday) with one call each. */
    async syncUpcomingDays(): Promise<number> {
        const tomorrow = await this.syncDate(appDateKey(1));
        const yesterday = await this.syncDate(appDateKey(-1));
        return tomorrow + yesterday;
    }

    async syncDate(dateString: string): Promise<number> {
        if (isFootballQuotaExhausted()) {
            logger.debug(`[CalendarSync] Skipping ${dateString} — quota exhausted`);
            return 0;
        }

        const isLeader = await tryAcquireSyncLeader('calendar-sync');
        if (!isLeader) {
            logger.debug(`[CalendarSync] Skipping ${dateString} — not sync leader`);
            return 0;
        }

        const count = await footballDataCacheService.syncCalendarDateFromApi(dateString);
        if (count > 0) {
            logger.info(`[CalendarSync] ${dateString}: ${count} fixtures synced (1 API call)`);
        } else {
            logger.debug(`[CalendarSync] ${dateString}: no fixtures or quota skip`);
        }
        return count;
    }
}

export const footballCalendarSyncService = new FootballCalendarSyncService();
export default footballCalendarSyncService;
