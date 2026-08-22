/**
 * Football Calendar Sync — authoritative scheduler for match lists.
 *
 * One API call per tick (`fixtures?date=YYYY-MM-DD`) → memory cache + Redis + PostgreSQL.
 * User HTTP requests never trigger upstream calls for calendar days covered here.
 *
 * Tuned for low user counts: fewer ticks, instant responses from DB/cache.
 * Near kickoff: today interval drops to 15–30s so NS→LIVE appears on the list sooner.
 */

import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { footballDataCacheService } from './football-data-cache.service';
import { isFootballQuotaExhausted } from './football.service';
import { withSyncLeaderLease } from './football-sync-leader.service';
import {
    isWorldCupOnlyMode,
    logWorldCupOnlyModeStartup,
} from '../config/world-cup-only-mode.config';
import {
    calendarTodayKey,
    offsetCalendarDateKey,
} from '../utils/calendar-day-bounds.util';
import { isNsNearKickoff } from './live-fixture-cache.service';

function calendarSyncIntervalMs(): number {
    // Default 60s so kickoff status on the matches list catches up faster.
    const fromEnv = parseInt(process.env.FOOTBALL_CALENDAR_SYNC_MS || '60000', 10);
    return Math.max(60_000, Number.isFinite(fromEnv) ? fromEnv : 60_000);
}

function calendarNearKickoffIntervalMs(): number {
    const fromEnv = parseInt(process.env.FOOTBALL_CALENDAR_NEAR_KICKOFF_MS || '20000', 10);
    const value = Number.isFinite(fromEnv) ? fromEnv : 20_000;
    return Math.max(15_000, Math.min(value, 30_000));
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
    private todayTimeout: NodeJS.Timeout | null = null;
    private prefetchInterval: NodeJS.Timeout | null = null;
    private running = false;
    private backfillRunning = false;
    private syncingDates = new Set<string>();
    private lastNearKickoff = false;

    start(): void {
        if (!process.env.FOOTBALL_API_KEY) {
            logger.warn('[CalendarSync] Disabled — FOOTBALL_API_KEY not set');
            return;
        }
        if (this.running) return;

        const prefetchMs = prefetchIntervalMs();

        this.running = true;
        logWorldCupOnlyModeStartup();
        logger.info(
            `[CalendarSync] Started — today adaptive 15–60s, prefetch every ${prefetchMs / 1000}s (leader-elected)${isWorldCupOnlyMode() ? ' [World Cup only]' : ''}`,
        );

        const runPrefetch = () => {
            void this.syncUpcomingDays().catch((err) =>
                logger.warn('[CalendarSync] prefetch failed:', err),
            );
        };

        setTimeout(() => this.scheduleTodayTick(), 8_000);
        setTimeout(runPrefetch, 20_000);

        if (isWorldCupOnlyMode()) {
            setTimeout(() => {
                void this.runWorldCupBackfill().catch((err) =>
                    logger.warn('[CalendarSync] World Cup backfill failed:', err),
                );
            }, 5_000);
        }

        this.prefetchInterval = setInterval(runPrefetch, prefetchMs);
    }

    private scheduleTodayTick(): void {
        if (!this.running) return;
        void this.runTodayTick();
    }

    private async runTodayTick(): Promise<void> {
        if (!this.running) return;
        try {
            await this.syncToday();
        } catch (err) {
            logger.warn('[CalendarSync] today sync failed:', err);
        }

        const nearKickoff = await this.hasNearKickoffNsToday();
        if (nearKickoff !== this.lastNearKickoff) {
            logger.info(
                `[CalendarSync] today interval → ${nearKickoff ? 'near-kickoff 15–30s' : 'default ~60s'}`,
            );
            this.lastNearKickoff = nearKickoff;
        }
        const delay = nearKickoff ? calendarNearKickoffIntervalMs() : calendarSyncIntervalMs();
        this.todayTimeout = setTimeout(() => this.scheduleTodayTick(), delay);
    }

    private async hasNearKickoffNsToday(): Promise<boolean> {
        try {
            const nowSec = Math.floor(Date.now() / 1000);
            const rows = await prisma.cachedFixture.findMany({
                where: {
                    status: { in: ['NS', 'TBD', '1H', '2H', 'HT', 'LIVE', 'ET', 'BT', 'P', 'INT'] },
                    matchTimestamp: {
                        gte: nowSec - 30 * 60,
                        lte: nowSec + 25 * 60,
                    },
                },
                select: { status: true, matchDate: true, matchTimestamp: true },
                take: 40,
            });
            return rows.some(
                (row) =>
                    ['1H', '2H', 'HT', 'LIVE', 'ET', 'BT', 'P', 'INT'].includes(row.status) ||
                    isNsNearKickoff(row.status, row.matchDate, row.matchTimestamp),
            );
        } catch {
            return false;
        }
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
        if (this.backfillRunning) {
            logger.debug('[CalendarSync] World Cup backfill skipped — already running locally');
            return;
        }
        this.backfillRunning = true;
        try {
            const lease = await withSyncLeaderLease('calendar-backfill', async ({ signal }) => {
                signal.throwIfAborted();
                const count = await footballDataCacheService.backfillWorldCupFixtures();
                signal.throwIfAborted();
                logger.info(`[CalendarSync] World Cup backfill: ${count} fixtures seeded`);

                if (count > 0) {
                    try {
                        const { runBulkFixtureSyncTick } = await import('../workers/worldCupSync.service');
                        await runBulkFixtureSyncTick();
                    } catch (err) {
                        logger.warn('[CalendarSync] post-backfill 365 bulk sync failed:', err);
                    }
                }
            }, { ttlSec: 300 });
            if (!lease.acquired) {
                logger.debug('[CalendarSync] World Cup backfill skipped — lease busy');
            }
        } finally {
            this.backfillRunning = false;
        }
    }

    stop(): void {
        if (this.todayTimeout) {
            clearTimeout(this.todayTimeout);
            this.todayTimeout = null;
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
        if (this.syncingDates.has(dateString)) {
            logger.debug(`[CalendarSync] Skipping ${dateString} — already running locally`);
            return 0;
        }
        this.syncingDates.add(dateString);
        try {
            const lease = await withSyncLeaderLease('calendar-sync', async ({ signal }) => {
                signal.throwIfAborted();
                const count = await footballDataCacheService.syncCalendarDateFromApi(dateString);
                signal.throwIfAborted();
                if (count > 0) {
                    logger.info(`[CalendarSync] ${dateString}: ${count} fixtures synced (1 API call)`);
                } else {
                    logger.debug(`[CalendarSync] ${dateString}: no fixtures or quota skip`);
                }
                return count;
            }, { ttlSec: 90 });
            if (!lease.acquired) {
                logger.debug(`[CalendarSync] Skipping ${dateString} — lease busy`);
            }
            return lease.value ?? 0;
        } finally {
            this.syncingDates.delete(dateString);
        }
    }
}

export const footballCalendarSyncService = new FootballCalendarSyncService();
export default footballCalendarSyncService;
