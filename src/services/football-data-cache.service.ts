/**
 * Football Data Cache Service
 * 
 * Comprehensive caching system that stores ALL football data from API permanently.
 * This service acts as a proxy layer between the API and the application.
 * 
 * Data Types Cached:
 * - Matches/Fixtures (finished = permanent, live/upcoming = short TTL)
 * - Players (permanent with periodic updates)
 * - Teams (permanent with periodic updates)
 * - Leagues (permanent)
 * - Standings (1 hour TTL)
 * - H2H (permanent)
 * - Lineups (permanent for finished matches)
 * - Match Statistics (permanent for finished matches)
 * - Match Events (permanent for finished matches)
 * 
 * Benefits:
 * 1. Reduces API calls significantly
 * 2. All users share the same cached data
 * 3. Instant response for historical data
 * 4. Offline-capable for cached data
 */

import { logger } from '../utils/logger';
import { hasLineupData, isAuthoritativeLineupData, buildFallbackLineupsFromEvents } from '../utils/lineups-fallback';
import prisma from '../lib/prisma';
import { getRedisClient } from '../lib/redis';
import { footballService, isFootballQuotaExhausted } from './football.service';
import { matchCacheService } from './match-cache.service';
import { playerCacheService } from './player-cache.service';
import { leagueCacheService } from './league-cache.service';
import {
    isWorldCupOnlyMode,
    logSkippingNonWorldCup,
} from '../config/world-cup-only-mode.config';
import { getWorldCupTabState } from './app-features.service';

// Memory cache for frequently accessed data
interface MemoryCacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number;
}

import {
    applyScores365ExperimentToWorldCupList,
    ensureScores365GameMapping,
    getScores365ExperimentBundle,
    is365StoreDetailsHotfix,
    getScores365ExperimentEvents,
    getScores365GameIdForFixture,
    getScores365MatchesForDate,
    getScores365WorldCupPhaseFixtures,
    isScores365ExperimentEnabled,
    isScores365ExperimentFixture,
    resolveScores365AppLanguage,
    resolveScores365LangId,
    SCORES365_LEAGUE_ID_OFFSET,
} from './scores365-experiment.service';

/** 365 player career rows are refreshed once a week (stats change slowly). */
const CAREER_DB_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
import {
    threeSixFiveScoresService,
    type ThreeSixFiveHeadToHeadForm,
    type ThreeSixFiveLineupPlayer,
    type ThreeSixFiveLiveGameDetails,
    type ThreeSixFivePlayerBasicInfo,
    type ThreeSixFivePlayerCareer,
    type ThreeSixFivePlayerCareerShotChart,
    type ThreeSixFivePlayerMatchReport,
    type ThreeSixFiveResult,
    type ThreeSixFiveStandingRow,
    type ThreeSixFiveFixtureItem,
} from './threeSixFiveScores.service';
import { redisCacheService } from './redis-cache.service';
import { buildFallbackStatisticsFromEvents, hasApiStatistics } from '../utils/match-stats-fallback';
import { buildTeamStatisticsFrom365Players } from '../utils/scores365-player-stats';
import {
    calendarDayBounds,
    calendarDateFromKickoff,
    calendarTodayKey,
    offsetCalendarDateKey,
} from '../utils/calendar-day-bounds.util';
import { map365StandingRowsToApiGroups } from '../utils/scores365-standings-mapper';
import { getWorldCupLeagueId, getWorldCupSeason } from '../config/world-cup-only-mode.config';
import { getScores365CompetitionId } from './scores365-experiment.service';

class FootballDataCacheService {
    /** Hot in-process cache for matches-by-date (avoids Redis round-trip per request). */
    private matchesByDateLocal = new Map<string, { data: any[]; expiresAt: number }>();

    /** Serve expired local entries while revalidating (avoids 8s API/DB spikes). */
    private readonly MATCHES_STALE_GRACE_MS = 15 * 60 * 1000;

    /** In-process cache for football:live_matches Redis payload. */
    private liveOverlayCache: { fixtures: any[]; expiresAt: number } | null = null;

    // In-memory caches (fallback)
    private standingsCache = new Map<string, MemoryCacheEntry<any>>();
    private lineupsCache = new Map<number, MemoryCacheEntry<any>>();
    private statisticsCache = new Map<number, MemoryCacheEntry<any>>();
    private eventsCache = new Map<number, MemoryCacheEntry<any>>();
    private teamStatisticsCache = new Map<string, MemoryCacheEntry<any>>();
    private topScorersCache = new Map<string, MemoryCacheEntry<any>>();
    

    private topAssistsCache = new Map<string, MemoryCacheEntry<any>>();
    private topYellowCardsCache = new Map<string, MemoryCacheEntry<any>>();
    private topRedCardsCache = new Map<string, MemoryCacheEntry<any>>();
    private injuriesCache = new Map<number, MemoryCacheEntry<any[]>>();
    private trophiesCache = new Map<number, MemoryCacheEntry<any>>();
    private coachesCache = new Map<number, MemoryCacheEntry<any>>();
    private venuesCache = new Map<number, MemoryCacheEntry<any>>();
    private roundsCache = new Map<string, MemoryCacheEntry<any>>();

    // ✅ Request deduplication: prevent multiple simultaneous API calls for the same data
    private pendingLineupRequests = new Map<number, Promise<any[]>>();
    private pendingStatisticsRequests = new Map<number, Promise<any[]>>();
    private pendingEventsRequests = new Map<number, Promise<any[]>>();
    private pendingMatchesByDate = new Map<string, Promise<any[]>>();
    private backgroundRefreshDates = new Set<string>();

    // TTL values
    private readonly TTL = {
        STANDINGS: 60 * 60 * 1000,      // 1 hour
        LIVE_MATCH: 30 * 1000,          // 30s — shared across all users via Redis
        LIVE_EVENT_INGEST: 20 * 1000,   // sync-triggered ingest refresh window
        UPCOMING_MATCH: 5 * 60 * 1000,  // 5 minutes
        FINISHED: Infinity,              // Permanent
        TEAM_STATISTICS: 60 * 60 * 1000, // 1 hour
        TOP_SCORERS: 60 * 60 * 1000,     // 1 hour
        TOP_ASSISTS: 60 * 60 * 1000,    // 1 hour
        INJURIES: 24 * 60 * 60 * 1000, // 24 hours
        TROPHIES: 7 * 24 * 60 * 60 * 1000, // 7 days
        COACHES: 7 * 24 * 60 * 60 * 1000,  // 7 days
        VENUES: 30 * 24 * 60 * 60 * 1000,  // 30 days
        ROUNDS: 60 * 60 * 1000,         // 1 hour
        // ✅ Empty-result TTL: when API returns no lineups/events/stats for a
        // match (often the case for lower-tier leagues, or transiently when
        // the API quota is exhausted), we cache the empty array briefly so we
        // don't poison long-lived caches. The next request after this window
        // will re-hit the API.
        EMPTY: 2 * 60 * 1000, // 2 minutes
        MATCHES_BY_DATE_TODAY: 3 * 60 * 1000,
        MATCHES_BY_DATE_FUTURE: 15 * 60 * 1000,
        MATCHES_BY_DATE_PAST: 24 * 60 * 60 * 1000,
        TODAY_API_REFRESH: 3 * 60 * 1000,
    };

    // ============================================
    // MATCHES BY DATE
    // ============================================

    /**
     * Get matches for a specific date
     * ✅ Uses database for finished matches (shared for all users, no API call)
     * ✅ Uses API for live/upcoming (with request deduplication)
     * ✅ All finished matches are permanently stored and shared
     */
    /**
     * Pre-warm today's (and optional) date on server startup / keep-alive.
     */
    async warmMatchesByDate(dateString?: string): Promise<number> {
        const target = dateString ?? new Date().toISOString().split('T')[0];
        const matches = await this.getMatchesByDate(target);
        logger.info(`🔥 Warmed matches-by-date cache for ${target}: ${matches.length} fixtures`);
        return matches.length;
    }

    /**
     * Authoritative calendar refresh for background jobs only.
     * Exactly one upstream `fixtures?date=` call → memory + DB (+ live merge for today).
     */
    async syncCalendarDateFromApi(dateString: string): Promise<number> {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return 0;
        if (isFootballQuotaExhausted()) return 0;

        if (isWorldCupOnlyMode()) {
            return this.syncWorldCupCalendarDateFromApi(dateString);
        }

        const todayKey = new Date().toISOString().split('T')[0];
        const isPastDate = dateString < todayKey;
        const isToday = dateString === todayKey;
        const cacheKey = `by_date_${dateString}`;
        const responseTtl = isPastDate
            ? this.TTL.MATCHES_BY_DATE_PAST
            : isToday
              ? this.TTL.MATCHES_BY_DATE_TODAY
              : this.TTL.MATCHES_BY_DATE_FUTURE;

        try {
            const matches = await this.fetchMatchesByDateFromApi(
                dateString,
                cacheKey,
                responseTtl,
                isToday,
            );
            return matches.length;
        } catch (err) {
            logger.warn(`[CalendarSync] syncCalendarDateFromApi ${dateString} failed:`, err);
            return 0;
        }
    }

    /** WORLD_CUP_ONLY_MODE: one league-scoped fixtures?date= call per tick. */
    private async syncWorldCupCalendarDateFromApi(dateString: string): Promise<number> {
        const wc = getWorldCupTabState();
        const cacheKey = `wc_${wc.leagueId}_${wc.season}_${dateString}`;
        const todayKey = new Date().toISOString().split('T')[0];
        const isToday = dateString === todayKey;
        const responseTtl =
            dateString < todayKey
                ? this.TTL.MATCHES_BY_DATE_PAST
                : isToday
                  ? this.TTL.MATCHES_BY_DATE_TODAY
                  : this.TTL.MATCHES_BY_DATE_FUTURE;

        try {
            const fixtures = await footballService.getFixtures(
                { date: dateString, league: wc.leagueId, season: wc.season },
                { source: 'job' },
            );
            const list = Array.isArray(fixtures) ? fixtures : [];

            if (list.length > 0) {
                matchCacheService.upsertFixtures(list).catch((archiveError) => {
                    logger.warn(`[WC ${dateString}] Background DB upsert failed:`, archiveError);
                });
                void matchCacheService.setInMemoryCache(cacheKey, list, responseTtl);
                this.storeLocalMatchesByDate(dateString, list, responseTtl);
                if (isToday) {
                    await this.markTodayApiFetched(dateString);
                }
                logger.info(`[Football Sync] World Cup calendar ${dateString}: ${list.length} fixtures synced`);
            }
            return list.length;
        } catch (err) {
            logger.warn(`[CalendarSync] syncWorldCupCalendarDateFromApi ${dateString} failed:`, err);
            return 0;
        }
    }

    /**
     * WORLD_CUP_ONLY_MODE: one-shot backfill of the entire tournament.
     * A single league+season `fixtures` call (no date) returns all WC fixtures,
     * which are upserted into DB + grouped into per-date memory/local caches.
     * This is the authoritative seed so 365Scores mapping has rows to match against.
     */
    async backfillWorldCupFixtures(): Promise<number> {
        if (isFootballQuotaExhausted()) {
            logger.debug('[Football Sync] World Cup backfill skipped — quota exhausted');
            return 0;
        }

        const wc = getWorldCupTabState();
        try {
            const fixtures = await footballService.getFixtures(
                { league: wc.leagueId, season: wc.season },
                { source: 'job' },
            );
            const list = Array.isArray(fixtures) ? fixtures : [];
            if (list.length === 0) {
                logger.warn(
                    `[Football Sync] World Cup backfill: league-scoped fixtures returned 0 (league=${wc.leagueId}, season=${wc.season})`,
                );
                return 0;
            }

            await matchCacheService.upsertFixtures(list).catch((archiveError) => {
                logger.warn('[Football Sync] World Cup backfill DB upsert failed:', archiveError);
            });

            const byDate = new Map<string, any[]>();
            for (const fixture of list) {
                const iso = fixture?.fixture?.date;
                if (typeof iso !== 'string') continue;
                const dateString = iso.split('T')[0];
                if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) continue;
                const bucket = byDate.get(dateString);
                if (bucket) {
                    bucket.push(fixture);
                } else {
                    byDate.set(dateString, [fixture]);
                }
            }

            const todayKey = new Date().toISOString().split('T')[0];
            for (const [dateString, dayFixtures] of byDate) {
                const responseTtl =
                    dateString < todayKey
                        ? this.TTL.MATCHES_BY_DATE_PAST
                        : dateString === todayKey
                          ? this.TTL.MATCHES_BY_DATE_TODAY
                          : this.TTL.MATCHES_BY_DATE_FUTURE;
                const cacheKey = `wc_${wc.leagueId}_${wc.season}_${dateString}`;
                void matchCacheService.setInMemoryCache(cacheKey, dayFixtures, responseTtl);
                this.storeLocalMatchesByDate(dateString, dayFixtures, responseTtl);
            }

            logger.info(
                `[Football Sync] World Cup backfill: ${list.length} fixtures synced across ${byDate.size} matchdays`,
            );
            return list.length;
        } catch (err) {
            logger.warn('[CalendarSync] backfillWorldCupFixtures failed:', err);
            return 0;
        }
    }

    private storeLocalMatchesByDate(
        dateString: string,
        data: any[],
        responseTtl: number,
    ): void {
        this.matchesByDateLocal.set(dateString, {
            data,
            expiresAt: Date.now() + responseTtl,
        });
    }

    private tryLocalMatchesByDate(
        dateString: string,
        isToday: boolean,
        cacheKey: string,
        responseTtl: number,
    ): any[] | null {
        const localHit = this.matchesByDateLocal.get(dateString);
        if (!localHit || localHit.data.length === 0) return null;

        const fresh = localHit.expiresAt > Date.now();
        const staleOk = Date.now() < localHit.expiresAt + this.MATCHES_STALE_GRACE_MS;

        if (fresh || staleOk) {
            if (!fresh) {
                void this.scheduleMatchesByDateRevalidate(dateString, cacheKey, responseTtl, isToday);
            }
            return localHit.data;
        }

        return null;
    }

    private scheduleMatchesByDateRevalidate(
        dateString: string,
        cacheKey: string,
        responseTtl: number,
        isToday: boolean,
    ): void {
        if (this.backgroundRefreshDates.has(dateString)) return;
        this.backgroundRefreshDates.add(dateString);

        (async () => {
            try {
                if (isToday) {
                    this.refreshMatchesByDateFromApi(dateString, cacheKey, responseTtl);
                    return;
                }
                await this.fetchMatchesByDateFromApi(dateString, cacheKey, responseTtl, isToday);
            } catch (err) {
                logger.warn(`[${dateString}] Background revalidate failed:`, err);
            } finally {
                this.backgroundRefreshDates.delete(dateString);
            }
        })();
    }

    async getMatchesByDate(dateString: string): Promise<any[]> {
        try {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
                throw new Error(`Invalid date: ${dateString}`);
            }

            const { start: startOfDay, end: endOfDay } = calendarDayBounds(dateString);

            const todayKey = calendarTodayKey();
            const isPastDate = dateString < todayKey;
            const isToday = dateString === todayKey;
            const cacheKey = `by_date_${dateString}`;
            const responseTtl = isPastDate
                ? this.TTL.MATCHES_BY_DATE_PAST
                : isToday
                    ? this.TTL.MATCHES_BY_DATE_TODAY
                    : this.TTL.MATCHES_BY_DATE_FUTURE;

            const localData = this.tryLocalMatchesByDate(dateString, isToday, cacheKey, responseTtl);
            if (localData) {
                const scoped = this.filterFixturesToCalendarDay(localData, dateString);
                return isToday ? this.mergeCalendarWithLiveSources(scoped) : scoped;
            }

            const cached = await matchCacheService.getFromMemoryCache<any[]>(cacheKey);
            if (cached && cached.length > 0) {
                this.storeLocalMatchesByDate(dateString, cached, responseTtl);
                logger.debug(`📦 [${dateString}] ${cached.length} matches from shared cache`);
                const scoped = this.filterFixturesToCalendarDay(cached, dateString);
                return isToday ? this.mergeCalendarWithLiveSources(scoped) : scoped;
            }

            let fromDb = await this.loadMatchesFromDbForDate(
                startOfDay,
                endOfDay,
                cacheKey,
                dateString,
                responseTtl,
            );
            fromDb = this.filterFixturesToCalendarDay(fromDb, dateString);

            if (fromDb.length === 0 && isScores365ExperimentEnabled()) {
                await this.ensure365CalendarDate(dateString);
                fromDb = await this.loadMatchesFromDbForDate(
                    startOfDay,
                    endOfDay,
                    cacheKey,
                    dateString,
                    responseTtl,
                );
                fromDb = this.filterFixturesToCalendarDay(fromDb, dateString);
            }

            if (fromDb.length === 0 && isScores365ExperimentEnabled()) {
                await threeSixFiveScoresService.supplementCalendarDateFromCompetitionFixtures(
                    dateString,
                    'en',
                );
                fromDb = await this.loadMatchesFromDbForDate(
                    startOfDay,
                    endOfDay,
                    cacheKey,
                    dateString,
                    responseTtl,
                );
                fromDb = this.filterFixturesToCalendarDay(fromDb, dateString);
            }

            if (fromDb.length > 0) {
                if (isToday) {
                    const merged = await this.mergeCalendarWithLiveSources(fromDb);
                    if (!isWorldCupOnlyMode() && !(await this.isTodayApiFresh(dateString))) {
                        void this.refreshMatchesByDateFromApi(dateString, cacheKey, responseTtl);
                    }
                    logger.debug(`📦 [${dateString}] ${merged.length} matches from DB + live merge (fast path)`);
                    return merged;
                }
                logger.debug(`📦 [${dateString}] ${fromDb.length} matches from DB (calendar cache)`);
                return fromDb;
            }

            // Today with empty DB: try 365 first, then optional API refresh in background.
            if (isToday) {
                if (isWorldCupOnlyMode()) {
                    const synced = await this.syncWorldCupCalendarDateFromApi(dateString);
                    if (synced > 0) {
                        const seeded = this.matchesByDateLocal.get(dateString)?.data ?? [];
                        return this.mergeCalendarWithLiveSources(seeded);
                    }
                    return [];
                }
                if (!isScores365ExperimentEnabled()) {
                    void this.fetchMatchesByDateFromApi(dateString, cacheKey, responseTtl, true);
                    logger.warn(`📦 [${dateString}] No DB/cache rows — returning empty; API refresh started in background`);
                }
                return [];
            }

            if (isWorldCupOnlyMode()) {
                const synced = await this.syncWorldCupCalendarDateFromApi(dateString);
                if (synced > 0) {
                    return this.matchesByDateLocal.get(dateString)?.data ?? [];
                }
                return [];
            }

            if (isScores365ExperimentEnabled()) {
                return [];
            }

            return this.fetchMatchesByDateFromApi(dateString, cacheKey, responseTtl, isToday);
        } catch (error) {
            logger.error(`[${dateString}] Error in getMatchesByDate:`, error);
            throw error;
        }
    }

    private filterWorldCupFixtures(
        fixtures: any[],
        leagueId: number,
        season: number,
    ): any[] {
        return fixtures.filter(
            (f) =>
                f?.league?.id === leagueId &&
                (f?.league?.season === season || f?.league?.season == null),
        );
    }

    /** Live status left in DB after quota outage on a calendar day that already passed. */
    private isStaleLiveOnPastDay(status: string, matchDate?: Date | string | null): boolean {
        const liveShorts = new Set(['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT']);
        if (!liveShorts.has(status)) return false;
        if (!matchDate) return false;
        const d = typeof matchDate === 'string' ? new Date(matchDate) : matchDate;
        if (Number.isNaN(d.getTime())) return false;
        const fixtureDay = d.toISOString().split('T')[0];
        const todayKey = new Date().toISOString().split('T')[0];
        return fixtureDay < todayKey;
    }

    private normalizePastCalendarFixtures(fixtures: any[], dateString: string): any[] {
        const todayKey = new Date().toISOString().split('T')[0];
        if (dateString >= todayKey) return fixtures;

        const liveShorts = new Set(['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT']);
        return fixtures.map((f) => {
            const short = f?.fixture?.status?.short;
            if (!short || !liveShorts.has(short)) return f;
            return {
                ...f,
                fixture: {
                    ...f.fixture,
                    status: {
                        ...f.fixture.status,
                        short: 'FT',
                        long: 'Match Finished',
                        elapsed: f.fixture.status?.elapsed ?? 90,
                    },
                },
            };
        });
    }

    /**
     * World Cup fixtures for a calendar day (league + season scoped).
     * Falls back to the all-fixtures-by-date path when the league-scoped API
     * returns empty (quota negative-cache or upstream miss).
     */
    async getWorldCupMatchesByDate(
        dateString: string,
        leagueId: number,
        season: number,
        language?: string | null,
    ): Promise<any[]> {
        const scores365Lang = resolveScores365AppLanguage(language);
        const cacheKey = `wc_${leagueId}_${season}_${dateString}_${scores365Lang}`;
        const todayKey = new Date().toISOString().split('T')[0];
        const ttl =
            dateString < todayKey
                ? this.TTL.MATCHES_BY_DATE_PAST
                : dateString === todayKey
                  ? 4 * 1000
                  : this.TTL.MATCHES_BY_DATE_FUTURE;

        try {
            if (isScores365ExperimentEnabled()) {
                const from365 = await getScores365MatchesForDate(
                    dateString,
                    leagueId,
                    season,
                    scores365Lang,
                );
                if (from365.length > 0) {
                    await matchCacheService.setInMemoryCache(cacheKey, from365, ttl);
                    return from365;
                }
            }

            const cached = await matchCacheService.getFromMemoryCache<any[]>(cacheKey);
            if (cached && cached.length > 0) {
                const normalized = this.normalizePastCalendarFixtures(cached, dateString);
                return applyScores365ExperimentToWorldCupList(normalized, dateString, scores365Lang);
            }

            // DB / by-date cache first — avoids a league-scoped API call per calendar day.
            const byDate = await this.getMatchesByDate(dateString);
            let list = this.filterWorldCupFixtures(byDate, leagueId, season);

            if (list.length === 0) {
                const { footballService } = await import('./football.service');
                const fixtures = await footballService.getFixtures(
                    { date: dateString, league: leagueId, season },
                    { source: 'internal' },
                );
                list = Array.isArray(fixtures) ? fixtures : [];
                if (list.length > 0) {
                    logger.info(
                        `[WC ${dateString}] by-date empty — ${list.length} fixtures from league-scoped API`,
                    );
                }
            }

            if (list.length > 0) {
                list = this.normalizePastCalendarFixtures(list, dateString);
                await matchCacheService.setInMemoryCache(cacheKey, list, ttl);
            }
            return applyScores365ExperimentToWorldCupList(list, dateString, scores365Lang);
        } catch (error) {
            logger.error(`[WC ${dateString}] getWorldCupMatchesByDate failed:`, error);
            try {
                const byDate = await this.getMatchesByDate(dateString);
                return applyScores365ExperimentToWorldCupList(
                    this.normalizePastCalendarFixtures(
                        this.filterWorldCupFixtures(byDate, leagueId, season),
                        dateString,
                    ),
                    dateString,
                    scores365Lang,
                );
            } catch {
                return [];
            }
        }
    }

    /** World Cup fixtures by phase (upcoming/live/finished) from full 365 tournament list. */
    async getWorldCupMatchesByPhase(
        phase: 'upcoming' | 'live' | 'finished' | 'all',
        language?: string | null,
    ): Promise<any[]> {
        if (!isScores365ExperimentEnabled()) return [];
        const scores365Lang = resolveScores365AppLanguage(language);
        const cacheKey = `wc_phase_${phase}_${scores365Lang}`;
        const ttl = phase === 'live' ? 4_000 : phase === 'upcoming' ? 60_000 : 300_000;

        const cached = await matchCacheService.getFromMemoryCache<any[]>(cacheKey);
        if (cached && cached.length > 0) return cached;

        const from365 = await getScores365WorldCupPhaseFixtures(scores365Lang, phase);
        if (from365.length > 0) {
            await matchCacheService.setInMemoryCache(cacheKey, from365, ttl);
        }
        return from365;
    }

    /**
     * Fixtures for a single league on a calendar day (includes lower-tier leagues).
     */
    async getLeagueMatchesByDate(leagueId: number, dateString: string): Promise<any[]> {
        const season = new Date(`${dateString}T12:00:00.000Z`).getUTCFullYear();
        const cacheKey = `league_${leagueId}_${season}_${dateString}`;
        const todayKey = new Date().toISOString().split('T')[0];
        const ttl = dateString < todayKey ? this.TTL.MATCHES_BY_DATE_PAST : this.TTL.MATCHES_BY_DATE_FUTURE;

        try {
            const cached = await matchCacheService.getFromMemoryCache<any[]>(cacheKey);
            if (cached && cached.length > 0) {
                return cached;
            }

            const byDate = await this.getMatchesByDate(dateString);
            let list = byDate.filter(
                (f) =>
                    f?.league?.id === leagueId &&
                    (f?.league?.season === season || f?.league?.season == null),
            );

            if (list.length === 0) {
                const { footballService } = await import('./football.service');
                if (leagueId >= SCORES365_LEAGUE_ID_OFFSET && isScores365ExperimentEnabled()) {
                    const competitionId = leagueId - SCORES365_LEAGUE_ID_OFFSET;
                    await threeSixFiveScoresService.syncCompetitionFixtures(competitionId, 'en');
                    const byDate = await this.getMatchesByDate(dateString);
                    list = byDate.filter(
                        (f) =>
                            f?.league?.id === leagueId &&
                            (f?.league?.season === season || f?.league?.season == null),
                    );
                } else {
                    const fixtures = await footballService.getFixtures({
                        date: dateString,
                        league: leagueId,
                        season,
                    });
                    list = Array.isArray(fixtures) ? fixtures : [];
                }
            }
            await matchCacheService.setInMemoryCache(cacheKey, list, ttl);
            return list;
        } catch (error) {
            logger.warn(`[League ${leagueId} ${dateString}] getLeagueMatchesByDate failed:`, error);
            return [];
        }
    }

    private async loadMatchesFromDbForDate(
        startOfDay: Date,
        endOfDay: Date,
        cacheKey: string,
        dateString: string,
        responseTtl: number,
    ): Promise<any[]> {
        const dbMatches = await matchCacheService.getMatchesFromDbByDateRange(startOfDay, endOfDay, {
            lightweight: true,
        });
        if (dbMatches.length === 0) return [];

        const fromDb = dbMatches.map((m) => matchCacheService.convertDbMatchToApiFormat(m));
        void matchCacheService.setInMemoryCache(cacheKey, fromDb, responseTtl);
        this.storeLocalMatchesByDate(dateString, fromDb, responseTtl);
        return fromDb;
    }

    private async isTodayApiFresh(dateString: string): Promise<boolean> {
        const redis = getRedisClient();
        if (!redis) return false;
        try {
            const lastFetch = await redis.get(`football:date_api:${dateString}`);
            if (!lastFetch) return false;
            return Date.now() - parseInt(lastFetch, 10) < this.TTL.TODAY_API_REFRESH;
        } catch {
            return false;
        }
    }

    private async markTodayApiFetched(dateString: string): Promise<void> {
        const redis = getRedisClient();
        if (!redis) return;
        try {
            await redis.setex(`football:date_api:${dateString}`, 120, String(Date.now()));
        } catch {
            /* non-fatal */
        }
    }

    private async fetchMatchesByDateFromApi(
        dateString: string,
        cacheKey: string,
        responseTtl: number,
        mergeLive: boolean,
    ): Promise<any[]> {
        if (isWorldCupOnlyMode()) {
            logSkippingNonWorldCup(`matches-by-date API fetch ${dateString}`);
            return [];
        }

        const pending = this.pendingMatchesByDate.get(dateString);
        if (pending) {
            logger.debug(`⏳ [${dateString}] waiting for in-flight API fetch`);
            const shared = await pending;
            return mergeLive ? this.mergeCalendarWithLiveSources(shared) : shared;
        }

        const fetchPromise = (async () => {
            logger.debug(`📡 [${dateString}] Fetching matches from API...`);
            const apiMatches = await footballService.getFixtures({ date: dateString });

            if (apiMatches.length > 0) {
                matchCacheService.upsertFixtures(apiMatches).catch((archiveError) => {
                    logger.warn(`[${dateString}] Background DB upsert failed:`, archiveError);
                });
            }

            void matchCacheService.setInMemoryCache(cacheKey, apiMatches, responseTtl);
            this.storeLocalMatchesByDate(dateString, apiMatches, responseTtl);
            if (mergeLive) {
                await this.markTodayApiFetched(dateString);
            }
            return apiMatches;
        })().finally(() => {
            this.pendingMatchesByDate.delete(dateString);
        });

        this.pendingMatchesByDate.set(dateString, fetchPromise);
        const apiMatches = await fetchPromise;
        return mergeLive ? this.mergeCalendarWithLiveSources(apiMatches) : apiMatches;
    }

    private refreshMatchesByDateFromApi(
        dateString: string,
        cacheKey: string,
        responseTtl: number,
    ): void {
        if (isWorldCupOnlyMode()) {
            logSkippingNonWorldCup(`matches-by-date background refresh ${dateString}`);
            return;
        }

        if (this.backgroundRefreshDates.has(dateString)) return;
        this.backgroundRefreshDates.add(dateString);

        (async () => {
            try {
                logger.debug(`🔄 [${dateString}] Background API refresh for today's fixtures`);
                const apiMatches = await footballService.getFixtures({ date: dateString });
                if (apiMatches.length > 0) {
                    matchCacheService.upsertFixtures(apiMatches).catch((err) => {
                        logger.warn(`[${dateString}] Background refresh upsert failed:`, err);
                    });
                    void matchCacheService.setInMemoryCache(cacheKey, apiMatches, responseTtl);
                    this.storeLocalMatchesByDate(dateString, apiMatches, responseTtl);
                }
                await this.markTodayApiFetched(dateString);
            } catch (err) {
                logger.warn(`[${dateString}] Background API refresh failed:`, err);
            } finally {
                this.backgroundRefreshDates.delete(dateString);
            }
        })();
    }

    /** Overlay live scores from Redis (written by live-fixture-sync) onto today's fixture list. */
    private async mergeLiveFromRedis(apiMatches: any[]): Promise<any[]> {
        if (apiMatches.length === 0) return apiMatches;

        const now = Date.now();
        if (this.liveOverlayCache && this.liveOverlayCache.expiresAt > now) {
            return this.applyLiveOverlay(apiMatches, this.liveOverlayCache.fixtures);
        }

        const redis = getRedisClient();
        if (!redis) return apiMatches;

        try {
            const raw = await redis.get('football:live_matches');
            if (!raw) return apiMatches;

            const liveFixtures: any[] = JSON.parse(raw);
            if (!Array.isArray(liveFixtures) || liveFixtures.length === 0) return apiMatches;

            this.liveOverlayCache = {
                fixtures: liveFixtures,
                expiresAt: now + 5_000,
            };
            return this.applyLiveOverlay(apiMatches, liveFixtures);
        } catch (err) {
            logger.warn('Redis live merge failed, using API payload:', err);
            return apiMatches;
        }
    }

    /** Redis live overlay + 365Scores synthetic live rows for today's calendar. */
    private async mergeCalendarWithLiveSources(apiMatches: any[]): Promise<any[]> {
        let merged = await this.mergeLiveFromRedis(apiMatches);
        if (!isScores365ExperimentEnabled()) return merged;

        try {
            const { resolveLiveFixturesForClient } = await import('./live-fixture-cache.service');
            const live365 = await resolveLiveFixturesForClient();
            if (!live365.fixtures.length) return merged;

            const byId = new Map<number, any>();
            for (const m of merged) {
                const id = m?.fixture?.id;
                if (id != null) byId.set(id, m);
            }
            for (const f of live365.fixtures) {
                const id = f?.fixture?.id;
                if (id != null) byId.set(id, f);
            }
            return Array.from(byId.values()).sort(
                (a, b) => (a?.fixture?.timestamp ?? 0) - (b?.fixture?.timestamp ?? 0),
            );
        } catch (err) {
            logger.warn('365 live calendar merge failed:', err);
            return merged;
        }
    }

    /** On-demand 365 allscores fetch for a single calendar day (upcoming/live leagues). */
    private async ensure365CalendarDate(dateString: string): Promise<number> {
        if (!isScores365ExperimentEnabled()) return 0;
        try {
            const start = offsetCalendarDateKey(dateString, -2);
            const end = offsetCalendarDateKey(dateString, 7);
            const res = await threeSixFiveScoresService.getAllScores(start, end, 'en', {
                force: true,
            });
            const count = res.data?.length ?? 0;
            if (count > 0) {
                logger.info(`[365Calendar] synced ${count} allscores fixtures for window ${start}..${end}`);
            }
            return count;
        } catch (err: unknown) {
            logger.warn(`[365Calendar] ensure failed for ${dateString}:`, (err as Error)?.message);
            return 0;
        }
    }

    private filterFixturesToCalendarDay(fixtures: any[], dateString: string): any[] {
        if (!fixtures.length) return fixtures;
        return fixtures.filter(
            (f) => calendarDateFromKickoff(f?.fixture?.date) === dateString,
        );
    }

    private applyLiveOverlay(apiMatches: any[], liveFixtures: any[]): any[] {
        const byId = new Map<number, any>();
        for (const m of apiMatches) {
            const id = m?.fixture?.id;
            if (id != null) byId.set(id, m);
        }
        for (const live of liveFixtures) {
            const id = live?.fixture?.id;
            if (id != null) byId.set(id, live);
        }
        return Array.from(byId.values()).sort(
            (a, b) => (a?.fixture?.timestamp ?? 0) - (b?.fixture?.timestamp ?? 0),
        );
    }

    // ============================================
    // PLAYER DATA
    // ============================================

    /**
     * Get player by ID with full statistics
     */
    async getPlayer(
        playerId: number,
        season: number = 2024,
        options?: { forceRefresh?: boolean },
    ): Promise<any> {
        return playerCacheService.getPlayer(
            playerId,
            async () => footballService.getPlayerById(playerId, season),
            options,
        );
    }

    /**
     * Search players by name
     * NOTE: API-Football Free Plan doesn't support player search without team/league ID
     * So we only search in the database (players are cached when viewing profiles)
     */
    async searchPlayers(query: string): Promise<any[]> {
        if (!query || query.length < 2) return [];

        // Search in database only - API Free Plan doesn't support player search
        const dbPlayers = await prisma.cachedPlayer.findMany({
            where: {
                OR: [
                    { name: { contains: query, mode: 'insensitive' } },
                    { firstname: { contains: query, mode: 'insensitive' } },
                    { lastname: { contains: query, mode: 'insensitive' } },
                ],
            },
            take: 20,
        });

        logger.debug(`📦 Found ${dbPlayers.length} players in DB for "${query}"`);
        return dbPlayers.map(p => p.fullData);
    }

    // ============================================
    // TEAM DATA
    // ============================================

    /**
     * Get team by ID
     */
    async getTeam(teamId: number): Promise<any> {
        return playerCacheService.getTeam(teamId, async () => {
            return footballService.getTeamById(teamId);
        });
    }

    /**
     * ✅ OPTIMIZATION 2: Batch get multiple teams
     * Fetches multiple teams efficiently using batch API calls
     */
    async getTeams(teamIds: number[]): Promise<Map<number, any>> {
        const teamMap = new Map<number, any>();
        
        if (teamIds.length === 0) return teamMap;

        // Filter out teams already in memory cache
        const uncachedIds: number[] = [];
        for (const teamId of teamIds) {
            const cached = await playerCacheService.getTeam(teamId, async () => {
                return [];
            });
            if (cached) {
                teamMap.set(teamId, cached);
            } else {
                uncachedIds.push(teamId);
            }
        }

        // Batch fetch uncached teams
        if (uncachedIds.length > 0) {
            try {
                const batchTeams = await footballService.getTeamsByIds(uncachedIds);
                
                // Cache and add to map
                for (const team of batchTeams) {
                    if (team?.team?.id) {
                        const teamId = team.team.id;
                        await playerCacheService.cacheTeam(team);
                        teamMap.set(teamId, team);
                    }
                }
            } catch (error) {
                logger.error('Error batch fetching teams:', error);
                // Fallback to individual requests
                for (const teamId of uncachedIds) {
                    try {
                        const team = await this.getTeam(teamId);
                        if (team) {
                            teamMap.set(teamId, team);
                        }
                    } catch (err) {
                        logger.error(`Failed to fetch team ${teamId}:`, err);
                    }
                }
            }
        }

        return teamMap;
    }

    /**
     * Search teams by name
     */
    async searchTeams(query: string): Promise<any[]> {
        if (!query || query.length < 2) return [];

        // Search in database first
        const dbTeams = await prisma.cachedTeam.findMany({
            where: {
                OR: [
                    { name: { contains: query, mode: 'insensitive' } },
                    { code: { contains: query, mode: 'insensitive' } },
                ],
            },
            take: 20,
        });

        if (dbTeams.length >= 5) {
            logger.debug(`📦 Found ${dbTeams.length} teams in DB for "${query}"`);
            return dbTeams.map(t => t.fullData);
        }

        // Fetch from API
        logger.debug(`📡 Searching teams from API for "${query}"`);
        const apiTeams = await footballService.searchTeams(query);

        // Cache all results
        for (const team of apiTeams) {
            await playerCacheService.cacheTeam(team);
        }

        return apiTeams;
    }

    // ============================================
    // LEAGUE DATA
    // ============================================

    /**
     * Get all leagues
     */
    async getAllLeagues(): Promise<any[]> {
        return leagueCacheService.getAllLeagues();
    }

    /**
     * Get standings for a league
     */
    async getStandings(leagueId: number, season: number = 2024): Promise<any> {
        return (await this.getStandingsParsed(leagueId, season)).flat;
    }

    async getStandingsParsed(
        leagueId: number,
        season: number = 2024,
    ): Promise<{ flat: any[]; groups: Array<{ group: string; standings: any[] }> }> {
        const cacheKey = `${leagueId}_${season}`;

        const cached = this.standingsCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < cached.ttl) {
            logger.debug(`📦 Standings ${cacheKey} from memory cache`);
            const data = cached.data;
            if (data?.groups) return data;
            if (Array.isArray(data)) {
                return {
                    flat: data,
                    groups: data.length ? [{ group: 'Table', standings: data }] : [],
                };
            }
            return { flat: [], groups: [] };
        }

        if (
            leagueId === getWorldCupLeagueId() &&
            isScores365ExperimentEnabled()
        ) {
            const from365 = await this.getStandingsParsedFrom365(getScores365CompetitionId());
            if (from365.groups.length > 0) {
                this.standingsCache.set(cacheKey, {
                    data: from365,
                    timestamp: Date.now(),
                    ttl: this.TTL.STANDINGS,
                });
                return from365;
            }
        }

        logger.debug(`📡 Fetching standings for league ${leagueId}`);
        const parsed = await footballService.getStandingsParsed(leagueId, season);

        this.standingsCache.set(cacheKey, {
            data: parsed,
            timestamp: Date.now(),
            ttl: this.TTL.STANDINGS,
        });

        if (parsed.flat?.length) {
            for (const standing of parsed.flat) {
                if (standing.team) {
                    await this.cacheTeamFromStanding(standing.team);
                }
            }
        }

        return parsed;
    }

    /** World Cup / 365 competition group tables from /web/standings/. */
    async getStandingsParsedFrom365(
        competitionId: number = getScores365CompetitionId(),
        language?: string | null,
    ): Promise<{ flat: any[]; groups: Array<{ group: string; standings: any[] }> }> {
        const result = await threeSixFiveScoresService.getStandings(competitionId, language);
        if (!result.data?.length) {
            return { flat: [], groups: [] };
        }
        const mapped = map365StandingRowsToApiGroups(result.data);
        for (const standing of mapped.flat) {
            const team = standing.team as { id?: number; name?: string; logo?: string } | undefined;
            if (team?.id) {
                await this.cacheTeamFromStanding(team);
            }
        }
        return mapped;
    }

    async syncWorldCupStandingsFrom365(language?: string | null): Promise<number> {
        if (!isScores365ExperimentEnabled()) return 0;
        const parsed = await this.getStandingsParsedFrom365(
            getScores365CompetitionId(),
            language ?? 'en',
        );
        const wcLeagueId = getWorldCupLeagueId();
        const season = getWorldCupSeason();
        const cacheKey = `${wcLeagueId}_${season}`;
        if (parsed.groups.length > 0) {
            this.standingsCache.set(cacheKey, {
                data: parsed,
                timestamp: Date.now(),
                ttl: this.TTL.STANDINGS,
            });
            logger.info(
                `[365Standings] synced ${parsed.flat.length} rows across ${parsed.groups.length} WC groups`,
            );
        }
        return parsed.flat.length;
    }

    private async cacheTeamFromStanding(team: any): Promise<void> {
        try {
            await prisma.cachedTeam.upsert({
                where: { teamId: team.id },
                update: {
                    name: team.name,
                    logo: team.logo,
                    updatedAt: new Date(),
                },
                create: {
                    teamId: team.id,
                    name: team.name,
                    logo: team.logo,
                    fullData: { team },
                },
            });
        } catch (error) {
            // Ignore duplicate errors
        }
    }

    /**
     * Cache team details (saves logos)
     * Public method to allow external access
     */
    async cacheTeam(team: any): Promise<void> {
        try {
            if (!team?.id) return;
            
            await prisma.cachedTeam.upsert({
                where: { teamId: team.id },
                update: {
                    name: team.name || undefined,
                    logo: team.logo || undefined,
                    code: team.code || undefined,
                    country: team.country || undefined,
                    founded: team.founded || undefined,
                    updatedAt: new Date(),
                },
                create: {
                    teamId: team.id,
                    name: team.name || 'Unknown Team',
                    logo: team.logo || null,
                    code: team.code || null,
                    country: team.country || null,
                    founded: team.founded || null,
                    fullData: { team },
                },
            });
            logger.debug(`✅ Cached team: ${team.id} - ${team.name || 'Unknown'}`);
        } catch (error) {
            // Ignore duplicate errors
            logger.debug(`⚠️ Failed to cache team ${team?.id}:`, error);
        }
    }

    // ============================================
    // HEAD TO HEAD
    // ============================================

    /**
     * Get H2H between two teams
     */
    async getH2H(team1Id: number, team2Id: number, count: number = 10): Promise<any> {
        return playerCacheService.getH2H(team1Id, team2Id, async () => {
            return footballService.getHeadToHead(team1Id, team2Id, count);
        });
    }

    // ============================================
    // MATCH DETAILS (Lineups, Statistics, Events)
    // ============================================

    /**
     * Get match lineups
     * ✅ Request deduplication: If 1000 users request the same lineups, only 1 API call is made
     * ✅ Finished matches: permanently stored in DB, shared for all users, no API call
     */
    async getMatchLineups(
        fixtureId: number,
        options?: { forceRefresh?: boolean; language?: string | null },
    ): Promise<any[]> {
        const LIVE_STATUSES = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT'];
        const forceRefresh =
            options?.forceRefresh === true ||
            (isScores365ExperimentFixture(fixtureId) && is365StoreDetailsHotfix());
        const language = resolveScores365AppLanguage(options?.language ?? null);
        const redisKey = `lineups:${fixtureId}`;

        const cacheUsable = (data: unknown): boolean => {
            if (!hasLineupData(data)) return false;
            if (isScores365ExperimentFixture(fixtureId)) {
                return isAuthoritativeLineupData(data);
            }
            return true;
        };

        if (!forceRefresh) {
            const redisCached = await redisCacheService.get<MemoryCacheEntry<any>>(redisKey);
            if (
                redisCached &&
                Date.now() - redisCached.timestamp < redisCached.ttl &&
                cacheUsable(redisCached.data)
            ) {
                logger.debug(`📦 Lineups ${fixtureId} from Redis cache (shared for all users)`);
                this.lineupsCache.set(fixtureId, redisCached);
                return redisCached.data;
            }

            const cached = this.lineupsCache.get(fixtureId);
            if (
                cached &&
                Date.now() - cached.timestamp < cached.ttl &&
                cacheUsable(cached.data)
            ) {
                logger.debug(`📦 Lineups ${fixtureId} from memory cache (shared for all users)`);
                return cached.data;
            }
        } else {
            await redisCacheService.del(redisKey);
            this.lineupsCache.delete(fixtureId);
        }

        const dbMatch = await prisma.cachedFixture.findUnique({
            where: { fixtureId },
            select: {
                status: true,
                fullData: true,
                homeTeamId: true,
                homeTeamName: true,
                homeTeamLogo: true,
                awayTeamId: true,
                awayTeamName: true,
                awayTeamLogo: true,
            },
        });

        const isFinished = dbMatch && ['FT', 'AET', 'PEN'].includes(dbMatch.status);
        const isLive = dbMatch && LIVE_STATUSES.includes(dbMatch.status);
        const fullData = dbMatch?.fullData as any;

        await ensureScores365GameMapping(fixtureId);

        const dbLineupsHaveGrid = (lineups: unknown) =>
            Array.isArray(lineups) &&
            lineups.some((row: { startXI?: Array<{ player?: { grid?: string | null } }> }) =>
                row.startXI?.some((p) => p.player?.grid != null),
            );

        if (
            !forceRefresh &&
            isFinished &&
            hasLineupData(fullData?.lineups) &&
            (!isScores365ExperimentFixture(fixtureId) || dbLineupsHaveGrid(fullData.lineups))
        ) {
            logger.debug(`📦 Lineups ${fixtureId} from DB fullData (shared for all users, no API call)`);
            return fullData.lineups;
        }

        if (isScores365ExperimentFixture(fixtureId)) {
            const from365 = await this.get365LineupsMerged(
                fixtureId,
                language,
                undefined,
                forceRefresh,
            );
            if (hasLineupData(from365)) {
                const cacheEntry: MemoryCacheEntry<any> = {
                    data: from365,
                    timestamp: Date.now(),
                    ttl: isFinished ? this.TTL.FINISHED : isLive ? this.TTL.LIVE_MATCH : this.TTL.UPCOMING_MATCH,
                };
                const redisTtl =
                    cacheEntry.ttl === Infinity ? 7 * 24 * 60 * 60 * 1000 : cacheEntry.ttl;
                await redisCacheService.set(redisKey, cacheEntry, redisTtl);
                this.lineupsCache.set(fixtureId, cacheEntry);
                if (isFinished) {
                    await this.updateFixtureFullData(fixtureId, { lineups: from365 });
                }
                return from365;
            }
            return from365 ?? [];
        }

        const pendingRequest = this.pendingLineupRequests.get(fixtureId);
        if (pendingRequest) {
            logger.debug(`⏳ Waiting for pending lineup request ${fixtureId} (${this.pendingLineupRequests.size} concurrent requests)`);
            return await pendingRequest;
        }

        logger.debug(`📡 Fetching lineups for fixture ${fixtureId} (request will be shared with concurrent users)`);
        const apiRequestPromise = (async () => {
            try {
                let lineups = await footballService.getFixtureLineupsResolved(fixtureId);

                if (!hasLineupData(lineups) && !isScores365ExperimentFixture(fixtureId)) {
                    try {
                        const events = await footballService.getFixtureEvents(fixtureId, { source: 'job' });
                        const teams =
                            fullData?.teams ??
                            (dbMatch
                                ? {
                                      home: {
                                          id: dbMatch.homeTeamId,
                                          name: dbMatch.homeTeamName,
                                          logo: dbMatch.homeTeamLogo ?? '',
                                      },
                                      away: {
                                          id: dbMatch.awayTeamId,
                                          name: dbMatch.awayTeamName,
                                          logo: dbMatch.awayTeamLogo ?? '',
                                      },
                                  }
                                : null);
                        if (teams && Array.isArray(events) && events.length > 0) {
                            const fromEvents = buildFallbackLineupsFromEvents(teams, events);
                            if (hasLineupData(fromEvents)) {
                                logger.info(`[Lineups] Fixture ${fixtureId}: using events fallback`);
                                lineups = fromEvents as any[];
                            }
                        }
                    } catch {
                        // events fallback optional
                    }
                }

                const isEmpty = !hasLineupData(lineups);
                const ttl = isEmpty
                    ? (isLive ? 30 * 1000 : this.TTL.EMPTY)
                    : (isFinished ? this.TTL.FINISHED : (isLive ? this.TTL.LIVE_MATCH : this.TTL.UPCOMING_MATCH));
                const cacheEntry: MemoryCacheEntry<any> = {
                    data: lineups,
                    timestamp: Date.now(),
                    ttl,
                };
                await redisCacheService.set(redisKey, cacheEntry, ttl === Infinity ? 7 * 24 * 60 * 60 * 1000 : ttl);
                this.lineupsCache.set(fixtureId, cacheEntry);

                if (isFinished && !isEmpty && lineups?.length) {
                    await this.updateFixtureFullData(fixtureId, { lineups });
                    logger.debug(`💾 Lineups ${fixtureId} stored in DB (shared for all users)`);
                }

                return lineups;
            } finally {
                this.pendingLineupRequests.delete(fixtureId);
            }
        })();

        this.pendingLineupRequests.set(fixtureId, apiRequestPromise);

        return await apiRequestPromise;
    }

    /**
     * Get match statistics
     */
    async getMatchStatistics(fixtureId: number): Promise<any[]> {
        await ensureScores365GameMapping(fixtureId);
        if (isScores365ExperimentFixture(fixtureId)) {
            const dbMatch = await prisma.cachedFixture.findUnique({
                where: { fixtureId },
                select: { fullData: true, status: true },
            });
            const fullData = dbMatch?.fullData as any;

            // Primary: aggregate real team stats from 365 player-level stats.
            if (fullData?.teams) {
                const named = await this.getCached365LineupsWithNames(fixtureId);
                if (named.data?.length) {
                    const aggregated = buildTeamStatisticsFrom365Players(
                        named.data,
                        fullData.teams,
                    );
                    if (hasApiStatistics(aggregated)) {
                        const cacheEntry: MemoryCacheEntry<any> = {
                            data: aggregated,
                            timestamp: Date.now(),
                            ttl: this.TTL.LIVE_MATCH,
                        };
                        await redisCacheService.set(
                            `statistics:${fixtureId}`,
                            cacheEntry,
                            this.TTL.LIVE_MATCH,
                        );
                        this.statisticsCache.set(fixtureId, cacheEntry);
                        return aggregated;
                    }
                }
            }

            // Fallback: events-derived stats (shots/possession not derivable here).
            // Use cached events — avoid forceRefresh to break the blocking chain.
            const events = await this.getMatchEvents(fixtureId, { forceRefresh: false });
            if (events.length > 0 && fullData?.teams && fullData?.goals) {
                const derived = buildFallbackStatisticsFromEvents(
                    { teams: fullData.teams, goals: fullData.goals },
                    events,
                );
                if (hasApiStatistics(derived)) {
                    const cacheEntry: MemoryCacheEntry<any> = {
                        data: derived,
                        timestamp: Date.now(),
                        ttl: this.TTL.LIVE_MATCH,
                    };
                    await redisCacheService.set(`statistics:${fixtureId}`, cacheEntry, this.TTL.LIVE_MATCH);
                    this.statisticsCache.set(fixtureId, cacheEntry);
                    return derived;
                }
            }
            // Events empty or no team data — return explicit unavailable marker.
            logger.info(`[Stats365] fixture=${fixtureId}: events empty or teams missing — statistics unavailable yet`);
            return [];
        }

        // Check Redis cache first, then memory cache
        const redisKey = `statistics:${fixtureId}`;
        const redisCached = await redisCacheService.get<MemoryCacheEntry<any>>(redisKey);
        if (redisCached && Date.now() - redisCached.timestamp < redisCached.ttl) {
            logger.debug(`📦 Statistics ${fixtureId} from Redis cache`);
            // Update memory cache
            this.statisticsCache.set(fixtureId, redisCached);
            return redisCached.data;
        }

        // Check memory cache
        const cached = this.statisticsCache.get(fixtureId);
        if (cached && Date.now() - cached.timestamp < cached.ttl) {
            logger.debug(`📦 Statistics ${fixtureId} from memory cache`);
            return cached.data;
        }

        // Check if match is finished (or stale live on a past calendar day)
        const dbMatch = await prisma.cachedFixture.findUnique({
            where: { fixtureId },
            select: { status: true, fullData: true, matchDate: true },
        });

        const fullData = dbMatch?.fullData as any;
        const isFinished =
            !!dbMatch &&
            (['FT', 'AET', 'PEN'].includes(dbMatch.status) ||
                this.isStaleLiveOnPastDay(dbMatch.status, dbMatch.matchDate));

        if (isFinished && fullData?.statistics) {
            logger.debug(`📦 Statistics ${fixtureId} from DB fullData`);
            return fullData.statistics;
        }

        // Stale live on a past day — skip upstream API (quota + pointless refresh).
        if (dbMatch && this.isStaleLiveOnPastDay(dbMatch.status, dbMatch.matchDate)) {
            logger.debug(`📦 Statistics ${fixtureId} skipped — stale live on past day`);
            return Array.isArray(fullData?.statistics) ? fullData.statistics : [];
        }

        // Fetch from API (+ events-derived fallback for lower-tier leagues)
        logger.debug(`📡 Fetching statistics for fixture ${fixtureId}`);
        let statistics: any[] = [];
        try {
            statistics = await footballService.getFixtureStatistics(fixtureId);
        } catch (err) {
            logger.warn(`[Stats] Fixture ${fixtureId} upstream failed:`, err);
            if (Array.isArray(fullData?.statistics) && fullData.statistics.length > 0) {
                return fullData.statistics;
            }
            return [];
        }

        let isEmpty = !Array.isArray(statistics) || statistics.length === 0;
        if (isEmpty && fullData?.teams && fullData?.goals) {
            let events = fullData.events;
            if (!Array.isArray(events) || events.length === 0) {
                try {
                    events = await footballService.getFixtureEvents(fixtureId, { source: 'job' });
                } catch {
                    events = [];
                }
            }
            if (Array.isArray(events) && events.length > 0) {
                const derived = buildFallbackStatisticsFromEvents(
                    { teams: fullData.teams, goals: fullData.goals },
                    events,
                );
                if (hasApiStatistics(derived)) {
                    statistics = derived;
                    isEmpty = false;
                    logger.info(`[Stats] Fixture ${fixtureId}: using events-derived fallback`);
                }
            }
        }
        const isLive =
            !!dbMatch &&
            !isFinished &&
            !this.isStaleLiveOnPastDay(dbMatch.status, dbMatch.matchDate);
        const ttl = isEmpty
            ? (isLive ? 30 * 1000 : this.TTL.EMPTY)
            : (isFinished ? this.TTL.FINISHED : this.TTL.LIVE_MATCH);
        const cacheEntry: MemoryCacheEntry<any> = {
            data: statistics,
            timestamp: Date.now(),
            ttl,
        };
        await redisCacheService.set(redisKey, cacheEntry, ttl === Infinity ? 7 * 24 * 60 * 60 * 1000 : ttl);
        this.statisticsCache.set(fixtureId, cacheEntry);

        if (isFinished && !isEmpty && statistics?.length) {
            await this.updateFixtureFullData(fixtureId, { statistics });
        }

        return statistics;
    }

    /**
     * Get match events (goals, cards, substitutions)
     * ✅ Request deduplication: If 1000 users request the same events, only 1 API call is made
     * ✅ Finished matches: permanently stored in DB, shared for all users, no API call
     */
    async getMatchEvents(
        fixtureId: number,
        options?: { forceRefresh?: boolean; language?: string | null },
    ): Promise<any[]> {
        const forceRefresh =
            options?.forceRefresh === true ||
            (isScores365ExperimentFixture(fixtureId) && is365StoreDetailsHotfix());
        const language = resolveScores365AppLanguage(options?.language ?? null);

        // 365Scores experiment — single shared upstream fetch; never API-Football quota.
        await ensureScores365GameMapping(fixtureId);
        if (isScores365ExperimentFixture(fixtureId)) {
            let events = await getScores365ExperimentEvents(fixtureId, forceRefresh, language);
            if (!events.length) {
                events = await getScores365ExperimentEvents(fixtureId, true, language);
            }
            const ttl = Math.max(2_000, parseInt(process.env.SCORES365_CACHE_MS || '3000', 10) || 3_000);
            if (events.length > 0) {
                const cacheEntry: MemoryCacheEntry<any> = {
                    data: events,
                    timestamp: Date.now(),
                    ttl,
                };
                this.eventsCache.set(fixtureId, cacheEntry);
                await redisCacheService.set(`events:${fixtureId}`, cacheEntry, ttl);
            }
            return events;
        }

        const redisKey = `events:${fixtureId}`;

        if (!forceRefresh) {
        // 1. Check Redis cache first, then memory cache
        const redisCached = await redisCacheService.get<MemoryCacheEntry<any>>(redisKey);
        if (redisCached && Date.now() - redisCached.timestamp < redisCached.ttl) {
            logger.debug(`📦 Events ${fixtureId} from Redis cache (shared for all users)`);
            // Update memory cache
            this.eventsCache.set(fixtureId, redisCached);
            return redisCached.data;
        }

        // Check memory cache
        const cached = this.eventsCache.get(fixtureId);
        if (cached && Date.now() - cached.timestamp < cached.ttl) {
            logger.debug(`📦 Events ${fixtureId} from memory cache (shared for all users)`);
            return cached.data;
        }
        }

        // 2. Check if match is finished (permanent cache in DB, shared for all users)
        const dbMatch = await prisma.cachedFixture.findUnique({
            where: { fixtureId },
            select: { status: true, fullData: true },
        });

        const isFinished = dbMatch && ['FT', 'AET', 'PEN'].includes(dbMatch.status);
        const isLiveStatus =
            dbMatch &&
            ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT'].includes(dbMatch.status);
        const fullData = dbMatch?.fullData as any;

        // ✅ If finished and we have events in fullData, use them (no API call, shared for all users)
        if (!forceRefresh && isFinished && fullData?.events) {
            logger.debug(`📦 Events ${fixtureId} from DB fullData (shared for all users, no API call)`);
            return fullData.events;
        }

        // ✅ 3. Request deduplication: share in-flight fetches (skip when forceRefresh —
        // ingest/sync triggers need a fresh upstream read, not a stale pending promise).
        if (!forceRefresh) {
            const pendingRequest = this.pendingEventsRequests.get(fixtureId);
            if (pendingRequest) {
                logger.debug(`⏳ Waiting for pending events request ${fixtureId} (${this.pendingEventsRequests.size} concurrent requests)`);
                return await pendingRequest;
            }
        }

        // ✅ 4. Create new API request and share it with all concurrent requests
        logger.debug(`📡 Fetching events for fixture ${fixtureId} (request will be shared with concurrent users)`);
        const apiRequestPromise = (async () => {
            try {
                const events = await footballService.getFixtureEvents(fixtureId, { source: 'job' });

                const isEmpty = !Array.isArray(events) || events.length === 0;
                const ttl = isEmpty
                    ? (isLiveStatus ? this.TTL.LIVE_EVENT_INGEST : this.TTL.EMPTY)
                    : (isFinished ? this.TTL.FINISHED : this.TTL.LIVE_MATCH);
                const cacheEntry: MemoryCacheEntry<any> = {
                    data: events,
                    timestamp: Date.now(),
                    ttl,
                };
                await redisCacheService.set(redisKey, cacheEntry, ttl === Infinity ? 7 * 24 * 60 * 60 * 1000 : ttl);
                this.eventsCache.set(fixtureId, cacheEntry);

                // Persist only non-empty event sets for finished matches.
                if (isFinished && !isEmpty && events?.length) {
                    await this.updateFixtureFullData(fixtureId, { events });
                    logger.debug(`💾 Events ${fixtureId} stored in DB (shared for all users)`);
                }

                return events;
            } finally {
                // Remove from pending requests after completion
                this.pendingEventsRequests.delete(fixtureId);
            }
        })();

        // Store the promise so other concurrent requests can wait for it
        this.pendingEventsRequests.set(fixtureId, apiRequestPromise);

        // Wait for the API request to complete
        return await apiRequestPromise;
    }

    /**
     * Single round-trip bundle for match details screen — fixture, lineups,
     * statistics, events, and venue in parallel (deduped per sub-resource).
     */
    async getFixtureDetailsBundle(
        fixtureId: number,
        options?: { language?: string | null; forceRefresh?: boolean },
    ): Promise<{
        fixture: any | null;
        lineups: any[];
        statistics: any[];
        events: any[];
        venue: any | null;
    }> {
        await ensureScores365GameMapping(fixtureId);
        const forceRefresh =
            options?.forceRefresh === true ||
            (isScores365ExperimentFixture(fixtureId) && is365StoreDetailsHotfix());
        if (isScores365ExperimentFixture(fixtureId)) {
            const experiment = await getScores365ExperimentBundle(
                fixtureId,
                resolveScores365AppLanguage(options?.language ?? null),
                { force: forceRefresh },
            );
            if (experiment) {
                let statistics = experiment.statistics;
                if (!hasApiStatistics(statistics)) {
                    statistics = await this.getMatchStatistics(fixtureId);
                }
                let events = experiment.events;
                if (!events.length || forceRefresh) {
                    events = await this.getMatchEvents(fixtureId, {
                        forceRefresh: true,
                        language: resolveScores365AppLanguage(options?.language ?? null),
                    });
                }
                if (!hasApiStatistics(statistics) && events.length > 0 && experiment.fixture) {
                    statistics = buildFallbackStatisticsFromEvents(experiment.fixture, events);
                }
                const lineups = await this.get365LineupsMerged(
                    fixtureId,
                    resolveScores365AppLanguage(options?.language ?? null),
                    experiment.lineups,
                    forceRefresh,
                );
                const payload = {
                    fixture: experiment.fixture,
                    lineups: hasLineupData(lineups) ? lineups : experiment.lineups,
                    statistics: statistics ?? [],
                    events,
                    venue: experiment.venue,
                };
                const statusShort = experiment.fixture?.fixture?.status?.short ?? '';
                if (['FT', 'AET', 'PEN'].includes(statusShort)) {
                    await this.updateFixtureFullData(fixtureId, {
                        lineups: payload.lineups,
                        events: payload.events,
                        statistics: payload.statistics,
                    });
                }
                return payload;
            }
        }

        const bundleKey = `details:${fixtureId}`;
        const redisCached = await redisCacheService.get<MemoryCacheEntry<any>>(bundleKey);
        if (redisCached && Date.now() - redisCached.timestamp < redisCached.ttl) {
            return redisCached.data;
        }

        const [fixture, lineups, statistics, events] = await Promise.all([
            footballService.getFixtureById(fixtureId),
            this.getMatchLineups(fixtureId),
            this.getMatchStatistics(fixtureId),
            this.getMatchEvents(fixtureId),
        ]);

        let venue: any | null = fixture?.fixture?.venue ?? null;
        const venueId = venue?.id;
        if (venueId && (!venue?.name || !venue?.city)) {
            try {
                venue = (await footballService.getVenueInfo(venueId)) ?? venue;
            } catch {
                // non-fatal
            }
        }

        const payload = {
            fixture: fixture ?? null,
            lineups: lineups ?? [],
            statistics: statistics ?? [],
            events: events ?? [],
            venue,
        };

        const status = fixture?.fixture?.status?.short ?? '';
        const isLive = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT'].includes(status);
        const isFinished = ['FT', 'AET', 'PEN'].includes(status);
        const ttl = isLive ? 3_000 : isFinished ? this.TTL.FINISHED : this.TTL.UPCOMING_MATCH;
        const cacheEntry: MemoryCacheEntry<any> = {
            data: payload,
            timestamp: Date.now(),
            ttl,
        };
        await redisCacheService.set(bundleKey, cacheEntry, ttl === Infinity ? 7 * 24 * 60 * 60 * 1000 : ttl);

        return payload;
    }

    /**
     * Update fixture fullData with additional data
     */
    private async updateFixtureFullData(fixtureId: number, additionalData: any): Promise<void> {
        try {
            const existing = await prisma.cachedFixture.findUnique({
                where: { fixtureId },
                select: { fullData: true },
            });

            if (existing) {
                const currentData = existing.fullData as any || {};
                await prisma.cachedFixture.update({
                    where: { fixtureId },
                    data: {
                        fullData: { ...currentData, ...additionalData },
                        updatedAt: new Date(),
                    },
                });
            }
        } catch (error) {
            logger.error(`Failed to update fixture ${fixtureId} fullData:`, error);
        }
    }

    // ============================================
    // TEAM MATCHES
    // ============================================

    /**
     * Get team matches (live, upcoming, finished)
     * Fetches and caches all team data in one request
     */
    async getTeamMatches(teamId: number, count: number = 10): Promise<{
        live: any[];
        upcoming: any[];
        finished: any[];
        team: any;
    }> {
        // Get team info first (cached)
        const team = await this.getTeam(teamId);

        // Check DB for finished matches
        const dbFinished = await prisma.cachedFixture.findMany({
            where: {
                OR: [
                    { homeTeamId: teamId },
                    { awayTeamId: teamId },
                ],
                status: { in: ['FT', 'AET', 'PEN'] },
            },
            orderBy: { matchDate: 'desc' },
            take: count,
        });

        // Fetch from API for live and upcoming
        logger.debug(`📡 Fetching team ${teamId} matches from API`);
        const apiMatches = await footballService.getFixtures({ team: teamId, season: 2024 });

        // Categorize matches
        const live: any[] = [];
        const upcoming: any[] = [];
        const finished: any[] = [];

        for (const match of apiMatches) {
            const status = match.fixture?.status?.short;
            if (['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'].includes(status)) {
                live.push(match);
            } else if (['NS', 'TBD', 'PST'].includes(status)) {
                upcoming.push(match);
            } else if (['FT', 'AET', 'PEN'].includes(status)) {
                finished.push(match);
            }
        }

        // Archive all finished matches
        if (apiMatches.length > 0) {
            await matchCacheService.archiveFinishedMatches(apiMatches);
        }

        // Cache teams from matches
        for (const match of apiMatches) {
            if (match.teams?.home) {
                await this.cacheTeamFromStanding(match.teams.home);
            }
            if (match.teams?.away) {
                await this.cacheTeamFromStanding(match.teams.away);
            }
        }

        // Merge DB finished with API finished (remove duplicates)
        const dbFinishedFormatted = dbFinished.map(m => matchCacheService.convertDbMatchToApiFormat(m));
        const allFinished = [...finished];
        for (const dbMatch of dbFinishedFormatted) {
            if (!allFinished.find(m => m.fixture?.id === dbMatch.fixture?.id)) {
                allFinished.push(dbMatch);
            }
        }

        // Sort
        upcoming.sort((a, b) => a.fixture.timestamp - b.fixture.timestamp);
        allFinished.sort((a, b) => b.fixture.timestamp - a.fixture.timestamp);

        return {
            live,
            upcoming: upcoming.slice(0, count),
            finished: allFinished.slice(0, count),
            team: team ? {
                id: team.team?.id || team.teamId,
                name: team.team?.name || team.name,
                logo: team.team?.logo || team.logo,
                country: team.team?.country || team.country,
            } : null,
        };
    }

    // ============================================
    // UNIFIED SEARCH (Enhanced with matches)
    // ============================================

    /**
     * Search across players, teams, leagues, and get team matches
     */
    async unifiedSearch(query: string): Promise<{
        players: any[];
        teams: any[];
        leagues: any[];
        matches: any[];
    }> {
        if (!query || query.length < 2) {
            return { players: [], teams: [], leagues: [], matches: [] };
        }

        // Search in parallel
        const [players, teams, leagues] = await Promise.all([
            this.searchPlayers(query),
            this.searchTeams(query),
            this.searchLeagues(query),
        ]);

        // Format teams
        const formattedTeams = teams.slice(0, 10).map(t => ({
            id: t.team?.id || t.teamId,
            name: t.team?.name || t.name,
            logo: t.team?.logo || t.logo,
            country: t.team?.country || t.country,
            type: 'team',
        }));

        // Get matches for the first matching team (if any)
        let matches: any[] = [];
        if (formattedTeams.length > 0) {
            const firstTeamId = formattedTeams[0].id;
            try {
                const teamMatches = await this.getTeamMatches(firstTeamId, 5);
                // Combine live, upcoming, finished (prioritize live)
                matches = [
                    ...teamMatches.live,
                    ...teamMatches.upcoming.slice(0, 3),
                    ...teamMatches.finished.slice(0, 3),
                ].slice(0, 8);
            } catch (error) {
                logger.error('Failed to fetch team matches in search:', error);
            }
        }

        return {
            players: players.slice(0, 10).map(p => ({
                id: p.player?.id || p.playerId,
                name: p.player?.name || p.name,
                photo: p.player?.photo || p.photo,
                team: p.statistics?.[0]?.team?.name || p.teamName,
                type: 'player',
            })),
            teams: formattedTeams,
            leagues: leagues.slice(0, 10).map(l => ({
                id: l.league?.id || l.leagueId,
                name: l.league?.name || l.name,
                logo: l.league?.logo || l.logo,
                country: l.country?.name || l.country,
                type: 'league',
            })),
            matches,
        };
    }

    private async searchLeagues(query: string): Promise<any[]> {
        // Search in database
        const dbLeagues = await prisma.cachedLeague.findMany({
            where: {
                OR: [
                    { name: { contains: query, mode: 'insensitive' } },
                    { country: { contains: query, mode: 'insensitive' } },
                ],
            },
            take: 20,
        });

        if (dbLeagues.length >= 5) {
            return dbLeagues.map(l => l.fullData);
        }

        // Fetch from API
        return footballService.searchLeagues(query);
    }

    // ============================================
    // CACHE STATISTICS
    // ============================================

    /**
     * Get cache statistics
     */
    async getCacheStats(): Promise<{
        fixtures: number;
        players: number;
        teams: number;
        leagues: number;
        h2h: number;
        memoryCache: {
            standings: number;
            lineups: number;
            statistics: number;
            events: number;
        };
    }> {
        const [fixtures, players, teams, leagues, h2h] = await Promise.all([
            prisma.cachedFixture.count(),
            prisma.cachedPlayer.count(),
            prisma.cachedTeam.count(),
            prisma.cachedLeague.count(),
            prisma.cachedH2H.count(),
        ]);

        return {
            fixtures,
            players,
            teams,
            leagues,
            h2h,
            memoryCache: {
                standings: this.standingsCache.size,
                lineups: this.lineupsCache.size,
                statistics: this.statisticsCache.size,
                events: this.eventsCache.size,
            },
        };
    }

    /**
     * Clear memory caches
     */
    clearMemoryCache(): void {
        this.standingsCache.clear();
        this.lineupsCache.clear();
        this.statisticsCache.clear();
        this.eventsCache.clear();
        this.teamStatisticsCache.clear();
        this.topScorersCache.clear();
        this.topAssistsCache.clear();
        this.topYellowCardsCache.clear();
        this.topRedCardsCache.clear();
        this.injuriesCache.clear();
        this.trophiesCache.clear();
        this.coachesCache.clear();
        this.venuesCache.clear();
        this.roundsCache.clear();
        logger.info('🧹 Memory cache cleared');
    }

    // ============================================
    // NEW FEATURES CACHING
    // ============================================

    /**
     * Get team statistics with caching
     */
    async getTeamStatistics(teamId: number, leagueId: number, season: number): Promise<any> {
        const cacheKey = `team_stats_${teamId}_${leagueId}_${season}`;
        
        // Check Redis cache
        const redisKey = `team_stats:${cacheKey}`;
        const redisCached = await redisCacheService.get<MemoryCacheEntry<any>>(redisKey);
        if (redisCached && Date.now() - redisCached.timestamp < redisCached.ttl) {
            logger.debug(`📦 Team statistics from Redis cache`);
            this.teamStatisticsCache.set(cacheKey, redisCached);
            return redisCached.data;
        }

        // Check memory cache
        const cached = this.teamStatisticsCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < cached.ttl) {
            logger.debug(`📦 Team statistics from memory cache`);
            return cached.data;
        }

        // Fetch from API
        const data = await footballService.getTeamStatistics(teamId, leagueId, season);
        const entry: MemoryCacheEntry<any> = {
            data,
            timestamp: Date.now(),
            ttl: this.TTL.TEAM_STATISTICS,
        };

        // Store in both caches
        this.teamStatisticsCache.set(cacheKey, entry);
        await redisCacheService.set(redisKey, entry, this.TTL.TEAM_STATISTICS);

        return data;
    }

    /**
     * Get top scorers with caching
     */
    async getTopScorers(leagueId: number, season: number): Promise<any[]> {
        const cacheKey = `top_scorers_${leagueId}_${season}`;
        
        // Check Redis cache
        const redisKey = `top_scorers:${cacheKey}`;
        const redisCached = await redisCacheService.get<MemoryCacheEntry<any[]>>(redisKey);
        if (redisCached && Date.now() - redisCached.timestamp < redisCached.ttl) {
            logger.debug(`📦 Top scorers from Redis cache`);
            this.topScorersCache.set(cacheKey, redisCached);
            return redisCached.data;
        }

        // Check memory cache
        const cached = this.topScorersCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < cached.ttl) {
            logger.debug(`📦 Top scorers from memory cache`);
            return cached.data;
        }

        // Fetch from API
        const data = await footballService.getTopScorers(leagueId, season);
        const entry: MemoryCacheEntry<any[]> = {
            data,
            timestamp: Date.now(),
            ttl: this.TTL.TOP_SCORERS,
        };

        // Store in both caches
        this.topScorersCache.set(cacheKey, entry);
        await redisCacheService.set(redisKey, entry, this.TTL.TOP_SCORERS);

        return data;
    }

    /**
     * Get top assists with caching
     */
    async getTopAssists(leagueId: number, season: number): Promise<any[]> {
        const cacheKey = `top_assists_${leagueId}_${season}`;
        
        // Check Redis cache
        const redisKey = `top_assists:${cacheKey}`;
        const redisCached = await redisCacheService.get<MemoryCacheEntry<any[]>>(redisKey);
        if (redisCached && Date.now() - redisCached.timestamp < redisCached.ttl) {
            logger.debug(`📦 Top assists from Redis cache`);
            this.topAssistsCache.set(cacheKey, redisCached);
            return redisCached.data;
        }

        // Check memory cache
        const cached = this.topAssistsCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < cached.ttl) {
            logger.debug(`📦 Top assists from memory cache`);
            return cached.data;
        }

        // Fetch from API
        const data = await footballService.getTopAssists(leagueId, season);
        const entry: MemoryCacheEntry<any[]> = {
            data,
            timestamp: Date.now(),
            ttl: this.TTL.TOP_ASSISTS,
        };

        // Store in both caches
        this.topAssistsCache.set(cacheKey, entry);
        await redisCacheService.set(redisKey, entry, this.TTL.TOP_ASSISTS);

        return data;
    }

    /**
     * Get top yellow cards with caching
     */
    async getTopYellowCards(leagueId: number, season: number): Promise<any[]> {
        const cacheKey = `top_yellow_cards_${leagueId}_${season}`;
        
        // Check Redis cache
        const redisKey = `top_yellow_cards:${cacheKey}`;
        const redisCached = await redisCacheService.get<MemoryCacheEntry<any[]>>(redisKey);
        if (redisCached && Date.now() - redisCached.timestamp < redisCached.ttl) {
            logger.debug(`📦 Top yellow cards from Redis cache`);
            this.topYellowCardsCache.set(cacheKey, redisCached);
            return redisCached.data;
        }

        // Check memory cache
        const cached = this.topYellowCardsCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < cached.ttl) {
            logger.debug(`📦 Top yellow cards from memory cache`);
            return cached.data;
        }

        // Fetch from API
        const data = await footballService.getTopYellowCards(leagueId, season);
        const entry: MemoryCacheEntry<any[]> = {
            data,
            timestamp: Date.now(),
            ttl: this.TTL.TOP_SCORERS, // Same TTL as top scorers
        };

        // Store in both caches
        this.topYellowCardsCache.set(cacheKey, entry);
        await redisCacheService.set(redisKey, entry, this.TTL.TOP_SCORERS);

        return data;
    }

    /**
     * Get top red cards with caching
     */
    async getTopRedCards(leagueId: number, season: number): Promise<any[]> {
        const cacheKey = `top_red_cards_${leagueId}_${season}`;
        
        // Check Redis cache
        const redisKey = `top_red_cards:${cacheKey}`;
        const redisCached = await redisCacheService.get<MemoryCacheEntry<any[]>>(redisKey);
        if (redisCached && Date.now() - redisCached.timestamp < redisCached.ttl) {
            logger.debug(`📦 Top red cards from Redis cache`);
            this.topRedCardsCache.set(cacheKey, redisCached);
            return redisCached.data;
        }

        // Check memory cache
        const cached = this.topRedCardsCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < cached.ttl) {
            logger.debug(`📦 Top red cards from memory cache`);
            return cached.data;
        }

        // Fetch from API
        const data = await footballService.getTopRedCards(leagueId, season);
        const entry: MemoryCacheEntry<any[]> = {
            data,
            timestamp: Date.now(),
            ttl: this.TTL.TOP_SCORERS, // Same TTL as top scorers
        };

        // Store in both caches
        this.topRedCardsCache.set(cacheKey, entry);
        await redisCacheService.set(redisKey, entry, this.TTL.TOP_SCORERS);

        return data;
    }

    /**
     * Get team injuries with caching
     */
    async getTeamInjuries(teamId: number): Promise<any[]> {
        // Check Redis cache
        const redisKey = `injuries:${teamId}`;
        const redisCached = await redisCacheService.get<MemoryCacheEntry<any[]>>(redisKey);
        if (redisCached && Date.now() - redisCached.timestamp < redisCached.ttl) {
            logger.debug(`📦 Injuries from Redis cache`);
            this.injuriesCache.set(teamId, redisCached);
            return redisCached.data;
        }

        // Check memory cache
        const cached = this.injuriesCache.get(teamId);
        if (cached && Date.now() - cached.timestamp < cached.ttl) {
            logger.debug(`📦 Injuries from memory cache`);
            return cached.data;
        }

        // Fetch from API
        const data = await footballService.getTeamInjuries(teamId);
        const entry: MemoryCacheEntry<any[]> = {
            data,
            timestamp: Date.now(),
            ttl: this.TTL.INJURIES,
        };

        // Store in both caches
        this.injuriesCache.set(teamId, entry);
        await redisCacheService.set(redisKey, entry, this.TTL.INJURIES);

        return data;
    }



    /**
     * Get team trophies with caching
     */
    async getTeamTrophies(teamId: number): Promise<any[]> {
        // Check Redis cache
        const redisKey = `trophies:${teamId}`;
        const redisCached = await redisCacheService.get<MemoryCacheEntry<any[]>>(redisKey);
        if (redisCached && Date.now() - redisCached.timestamp < redisCached.ttl) {
            logger.debug(`📦 Trophies from Redis cache`);
            this.trophiesCache.set(teamId, redisCached);
            return redisCached.data;
        }

        // Check memory cache
        const cached = this.trophiesCache.get(teamId);
        if (cached && Date.now() - cached.timestamp < cached.ttl) {
            logger.debug(`📦 Trophies from memory cache`);
            return cached.data;
        }

        // Fetch from API
        const data = await footballService.getTeamTrophies(teamId);
        const entry: MemoryCacheEntry<any[]> = {
            data,
            timestamp: Date.now(),
            ttl: this.TTL.TROPHIES,
        };

        // Store in both caches
        this.trophiesCache.set(teamId, entry);
        await redisCacheService.set(redisKey, entry, this.TTL.TROPHIES);

        return data;
    }

    /**
     * Get team coaches with caching
     */
    async getTeamCoaches(teamId: number): Promise<any[]> {
        // Check Redis cache
        const redisKey = `coaches:${teamId}`;
        const redisCached = await redisCacheService.get<MemoryCacheEntry<any[]>>(redisKey);
        if (redisCached && Date.now() - redisCached.timestamp < redisCached.ttl) {
            logger.debug(`📦 Coaches from Redis cache`);
            this.coachesCache.set(teamId, redisCached);
            return redisCached.data;
        }

        // Check memory cache
        const cached = this.coachesCache.get(teamId);
        if (cached && Date.now() - cached.timestamp < cached.ttl) {
            logger.debug(`📦 Coaches from memory cache`);
            return cached.data;
        }

        // Fetch from API
        const data = await footballService.getTeamCoaches(teamId);
        const entry: MemoryCacheEntry<any[]> = {
            data,
            timestamp: Date.now(),
            ttl: this.TTL.COACHES,
        };

        // Store in both caches
        this.coachesCache.set(teamId, entry);
        await redisCacheService.set(redisKey, entry, this.TTL.COACHES);

        return data;
    }

    /**
     * Get venue info with caching
     */
    async getVenueInfo(venueId: number): Promise<any> {
        // Check Redis cache
        const redisKey = `venue:${venueId}`;
        const redisCached = await redisCacheService.get<MemoryCacheEntry<any>>(redisKey);
        if (redisCached && Date.now() - redisCached.timestamp < redisCached.ttl) {
            logger.debug(`📦 Venue from Redis cache`);
            this.venuesCache.set(venueId, redisCached);
            return redisCached.data;
        }

        // Check memory cache
        const cached = this.venuesCache.get(venueId);
        if (cached && Date.now() - cached.timestamp < cached.ttl) {
            logger.debug(`📦 Venue from memory cache`);
            return cached.data;
        }

        // Fetch from API
        const data = await footballService.getVenueInfo(venueId);
        const entry: MemoryCacheEntry<any> = {
            data,
            timestamp: Date.now(),
            ttl: this.TTL.VENUES,
        };

        // Store in both caches
        this.venuesCache.set(venueId, entry);
        await redisCacheService.set(redisKey, entry, this.TTL.VENUES);

        return data;
    }

    /**
     * Get league rounds with caching
     */
    async getLeagueRounds(leagueId: number, season: number, current?: boolean): Promise<string[]> {
        const cacheKey = `rounds_${leagueId}_${season}_${current || 'all'}`;
        
        // Check Redis cache
        const redisKey = `rounds:${cacheKey}`;
        const redisCached = await redisCacheService.get<MemoryCacheEntry<string[]>>(redisKey);
        if (redisCached && Date.now() - redisCached.timestamp < redisCached.ttl) {
            logger.debug(`📦 Rounds from Redis cache`);
            this.roundsCache.set(cacheKey, redisCached);
            return redisCached.data;
        }

        // Check memory cache
        const cached = this.roundsCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < cached.ttl) {
            logger.debug(`📦 Rounds from memory cache`);
            return cached.data;
        }

        // Fetch from API
        const data = await footballService.getLeagueRounds(leagueId, season, current);
        const entry: MemoryCacheEntry<string[]> = {
            data,
            timestamp: Date.now(),
            ttl: this.TTL.ROUNDS,
        };

        // Store in both caches
        this.roundsCache.set(cacheKey, entry);
        await redisCacheService.set(redisKey, entry, this.TTL.ROUNDS);

        return data;
    }

    // ============================================
    // 365SCORES — World Cup secondary source (wrappers)
    // Controllers must call these, not threeSixFiveScoresService directly.
    // ============================================

    private is365WorldCupSecondaryEnabled(): boolean {
        return isScores365ExperimentEnabled();
    }

    async getCached365Fixtures(
        competitionId?: number,
        language?: string | null,
    ): Promise<ThreeSixFiveResult<ThreeSixFiveFixtureItem[]>> {
        if (!this.is365WorldCupSecondaryEnabled()) {
            return { data: null, source: null };
        }
        return threeSixFiveScoresService.getFixtures(competitionId, language);
    }

    async getCached365LiveGameDetails(
        gameId: number,
        options?: { matchupId?: string; language?: string | null; force?: boolean },
    ): Promise<ThreeSixFiveResult<ThreeSixFiveLiveGameDetails>> {
        if (!this.is365WorldCupSecondaryEnabled()) {
            return { data: null, source: null };
        }
        threeSixFiveScoresService.touchLiveGameSubscription(gameId);
        return threeSixFiveScoresService.getLiveGameDetails(
            gameId,
            options?.matchupId,
            { language: options?.language, force: options?.force },
        );
    }

    async getCached365LineupsWithNames(
        fixtureIdOrGameId: number,
        language?: string | null,
    ): Promise<ThreeSixFiveResult<ThreeSixFiveLineupPlayer[]>> {
        if (!isScores365ExperimentEnabled()) {
            return { data: null, source: null };
        }
        const gameId =
            getScores365GameIdForFixture(fixtureIdOrGameId) ?? fixtureIdOrGameId;
        return threeSixFiveScoresService.getLineupsWithNames(gameId, language);
    }

    async getCached365Standings(
        competitionId?: number,
        language?: string | null,
    ): Promise<ThreeSixFiveResult<ThreeSixFiveStandingRow[]>> {
        if (!this.is365WorldCupSecondaryEnabled()) {
            return { data: null, source: null };
        }
        return threeSixFiveScoresService.getStandings(competitionId, language);
    }

    async getCached365HeadToHeadForm(
        gameId: number,
        language?: string | null,
    ): Promise<ThreeSixFiveResult<ThreeSixFiveHeadToHeadForm>> {
        if (!this.is365WorldCupSecondaryEnabled()) {
            return { data: null, source: null };
        }
        return threeSixFiveScoresService.getHeadToHeadForm(gameId, language);
    }

    async getCached365PlayerMatchReport(
        athleteId: number,
        gameId: number,
        language?: string | null,
    ): Promise<ThreeSixFiveResult<ThreeSixFivePlayerMatchReport>> {
        if (!this.is365WorldCupSecondaryEnabled()) {
            return { data: null, source: null };
        }
        return threeSixFiveScoresService.getPlayerMatchReport(athleteId, gameId, language);
    }

    async getCached365PlayerCareerShotChart(
        athleteId: number,
        language?: string | null,
    ): Promise<ThreeSixFiveResult<ThreeSixFivePlayerCareerShotChart>> {
        if (!this.is365WorldCupSecondaryEnabled()) {
            return { data: null, source: null };
        }
        return threeSixFiveScoresService.getPlayerCareerShotChart(athleteId, language);
    }

    async getCached365PlayerBasicInfo(
        athleteId: number,
        language?: string | null,
    ): Promise<ThreeSixFiveResult<ThreeSixFivePlayerBasicInfo>> {
        if (!this.is365WorldCupSecondaryEnabled()) {
            return { data: null, source: null };
        }
        return threeSixFiveScoresService.getPlayerBasicInfo(athleteId, language);
    }

    /**
     * Full 365 player career, persisted in Postgres so repeated views are cheap.
     * Tiers: Redis (in service) → Postgres (this method) → live 365 fetch.
     * DB rows older than {@link CAREER_DB_MAX_AGE_MS} are refreshed in the background.
     */
    async getCached365PlayerCareer(
        athleteId: number,
        language?: string | null,
    ): Promise<ThreeSixFiveResult<ThreeSixFivePlayerCareer>> {
        if (!this.is365WorldCupSecondaryEnabled()) {
            return { data: null, source: null };
        }

        const langId = resolveScores365LangId(language);

        // 1. Postgres — serve a fresh row immediately; refresh stale rows in background.
        try {
            const dbRow = await prisma.cached365PlayerCareer.findUnique({ where: { athleteId } });
            if (dbRow?.data && dbRow.langId === langId) {
                const age = Date.now() - dbRow.updatedAt.getTime();
                const data = dbRow.data as unknown as ThreeSixFivePlayerCareer;
                if (data.seasons?.length && age < CAREER_DB_MAX_AGE_MS) {
                    return { data, source: '365scores' };
                }
                if (data.seasons?.length) {
                    // Stale but valid: refresh in background, return cached data now.
                    this.refresh365PlayerCareer(athleteId, language, langId).catch((err) => {
                        logger.warn(`[365Career] background refresh ${athleteId} failed:`, err?.message);
                    });
                    return { data, source: '365scores' };
                }
                // Empty seasons cached from old bug — force refetch.
            }
        } catch (err: any) {
            logger.warn(`[365Career] DB read ${athleteId} failed:`, err?.message);
        }

        // 2. Cold path — fetch from 365 and persist.
        return this.refresh365PlayerCareer(athleteId, language, langId);
    }

    private async refresh365PlayerCareer(
        athleteId: number,
        language: string | null | undefined,
        langId: number,
    ): Promise<ThreeSixFiveResult<ThreeSixFivePlayerCareer>> {
        const result = await threeSixFiveScoresService.getPlayerCareer(athleteId, language);
        if (!result.data?.seasons?.length) return { data: null, source: null };

        try {
            await prisma.cached365PlayerCareer.upsert({
                where: { athleteId },
                update: {
                    name: result.data.profile.name,
                    photo: result.data.profile.imageUrl ?? null,
                    position: result.data.profile.position ?? null,
                    clubName: result.data.profile.clubName ?? null,
                    nationality: result.data.profile.nationality ?? null,
                    langId,
                    data: result.data as any,
                },
                create: {
                    athleteId,
                    name: result.data.profile.name,
                    photo: result.data.profile.imageUrl ?? null,
                    position: result.data.profile.position ?? null,
                    clubName: result.data.profile.clubName ?? null,
                    nationality: result.data.profile.nationality ?? null,
                    langId,
                    data: result.data as any,
                },
            });
        } catch (err: any) {
            logger.warn(`[365Career] DB upsert ${athleteId} failed:`, err?.message);
        }

        return result;
    }

    /** Merge 365 named players (athleteId, photo) into structured lineups (grid, formation). */
    private merge365NamesIntoLineups(
        lineups: any[],
        named: ThreeSixFiveLineupPlayer[],
        fixtureId?: number,
    ): any[] {
        if (!named.length || !lineups.length) return lineups;
        const norm = (s?: string) =>
            (s ?? '')
                .normalize('NFD')
                .replace(/\p{M}/gu, '')
                .toLowerCase()
                .trim();
        const byMemberId = new Map(named.map((n) => [n.memberId, n]));
        const byAthleteId = new Map(named.map((n) => [n.athleteId, n]));
        const byName = new Map(named.map((n) => [norm(n.name), n]));
        // Extra: index by shortName for better join coverage
        const byShortName = new Map(
            named
                .filter((n) => n.shortName && norm(n.shortName) !== norm(n.name))
                .map((n) => [norm(n.shortName), n]),
        );

        const enrich = (entry: { player?: Record<string, unknown> }) => {
            const p = entry.player;
            if (!p) return entry;
            const hit =
                byMemberId.get(p.id as number) ??
                byAthleteId.get(p.id as number) ??
                byName.get(norm(p.name as string)) ??
                byShortName.get(norm(p.name as string));
            if (!hit) {
                // Log the join miss — never silently drop the player.
                logger.warn(
                    `[Lineups365Join] fixture=${fixtureId ?? '?'} memberId=${p.id} name="${p.name}" — no match in named lineup (athleteId/name join miss); rendering with partial data`,
                );
                // Return the player as-is — preserve whatever name/data we already have.
                return entry;
            }
            return {
                ...entry,
                player: {
                    ...p,
                    id: hit.athleteId,
                    athleteId: hit.athleteId,
                    scores365MemberId: hit.memberId,
                    name: hit.name || p.name,
                    photo: hit.imageUrl ?? p.photo ?? null,
                    number: hit.jerseyNumber ?? p.number,
                    pos: hit.position?.charAt(0) ?? p.pos,
                    fieldLine: p.fieldLine ?? null,
                    fieldSide: p.fieldSide ?? null,
                    grid: p.grid ?? null,
                },
            };
        };

        return lineups.map((side) => ({
            ...side,
            startXI: side.startXI?.map(enrich) ?? [],
            substitutes: side.substitutes?.map(enrich) ?? [],
            _source: side._source ?? '365scores',
        }));
    }

    /** Fire-and-forget: persist lineup athletes for DB search (no live 365 player listing). */
    private queueCache365LineupPlayers(fixtureId: number, merged: any[]): void {
        const players: Array<{
            athleteId: number;
            name: string;
            photo?: string | null;
            position?: string | null;
            teamId?: number;
            teamName?: string;
            teamLogo?: string | null;
            fixtureId: number;
        }> = [];

        for (const side of merged) {
            const team = side?.team;
            const roster = [...(side?.startXI ?? []), ...(side?.substitutes ?? [])];
            for (const entry of roster) {
                const pl = entry?.player;
                if (!pl?.id || !pl?.name) continue;
                players.push({
                    athleteId: pl.id as number,
                    name: String(pl.name),
                    photo: (pl.photo as string | null | undefined) ?? null,
                    position: (pl.pos as string | null | undefined) ?? null,
                    teamId: team?.id as number | undefined,
                    teamName: team?.name as string | undefined,
                    teamLogo: (team?.logo as string | null | undefined) ?? null,
                    fixtureId,
                });
            }
        }

        if (!players.length) return;
        void playerCacheService.upsertScores365LineupPlayers(players).catch((err) =>
            logger.debug(
                `[365LineupsMerged] player DB cache failed fixture=${fixtureId}:`,
                (err as Error)?.message,
            ),
        );
    }

    private finalize365MergedLineups(fixtureId: number, merged: any[]): any[] {
        this.queueCache365LineupPlayers(fixtureId, merged);
        return merged;
    }

    /** Structured 365 lineups + named enrichment — keeps formation/grid; completeness gate before caching. */
    async get365LineupsMerged(
        fixtureId: number,
        language?: string | null,
        baseLineups?: any[],
        forceRefresh = false,
    ): Promise<any[]> {
        await ensureScores365GameMapping(fixtureId);
        if (!isScores365ExperimentFixture(fixtureId)) return [];

        let structured = baseLineups;
        if (!hasLineupData(structured) || forceRefresh) {
            const bundle = await getScores365ExperimentBundle(
                fixtureId,
                resolveScores365AppLanguage(language),
                { force: forceRefresh },
            );
            structured = bundle?.lineups;
        }
        if (!hasLineupData(structured)) return [];

        const named = await this.getCached365LineupsWithNames(fixtureId, language);
        const merged = named.data?.length
            ? this.merge365NamesIntoLineups(structured ?? [], named.data, fixtureId)
            : (structured ?? []);

        // — Completeness gate —
        const isConfirmed = (merged as any[]).some((side: any) => side?._lineupsConfirmed);
        const startersHome = (merged[0]?.startXI ?? []).length;
        const startersAway = (merged[1]?.startXI ?? []).length;

        if (isConfirmed && (startersHome < 11 || startersAway < 11)) {
            logger.warn(
                `[365LineupsMerged] fixture=${fixtureId}: confirmed lineup incomplete — home=${startersHome} away=${startersAway} — retrying once`,
            );
            // Retry once with a short delay (avoids caching a stale partial snapshot).
            await new Promise((r) => setTimeout(r, 3_000));
            const retryBundle = await getScores365ExperimentBundle(
                fixtureId,
                resolveScores365AppLanguage(language),
                { force: true },
            );
            const retryStructured = retryBundle?.lineups;
            if (hasLineupData(retryStructured)) {
                const retryNamed = await this.getCached365LineupsWithNames(fixtureId, language);
                const retryMerged = retryNamed.data?.length
                    ? this.merge365NamesIntoLineups(retryStructured!, retryNamed.data, fixtureId)
                    : retryStructured!;
                const retryHome = (retryMerged[0]?.startXI ?? []).length;
                const retryAway = (retryMerged[1]?.startXI ?? []).length;
                logger.info(
                    `[365LineupsMerged] fixture=${fixtureId}: retry result — home=${retryHome} away=${retryAway}`,
                );
                if (retryHome < 11 || retryAway < 11) {
                    logger.warn(
                        `[365LineupsMerged] fixture=${fixtureId}: still incomplete after retry (home=${retryHome}, away=${retryAway}) — marking _incomplete, skipping permanent cache`,
                        { fixtureId, retryHome, retryAway, ts: new Date().toISOString() },
                    );
                    // Mark incomplete in Redis briefly so frontend can show retry state.
                    await redisCacheService.set(`lineups:${fixtureId}:incomplete`, true, 60_000);
                    return this.finalize365MergedLineups(
                        fixtureId,
                        retryMerged.map((s: any) => ({ ...s, _incomplete: true })),
                    );
                }
                logger.info(`[365LineupsMerged] fixture=${fixtureId}: ✅ retry complete — home=${retryHome} away=${retryAway}`);
                return this.finalize365MergedLineups(fixtureId, retryMerged);
            }
            // Retry did not produce usable data — return original merged (partial) with flag.
            await redisCacheService.set(`lineups:${fixtureId}:incomplete`, true, 60_000);
            return this.finalize365MergedLineups(
                fixtureId,
                merged.map((s: any) => ({ ...s, _incomplete: true })),
            );
        }

        logger.info(
            `[365LineupsMerged] fixture=${fixtureId}: ✅ home=${startersHome} away=${startersAway} (confirmed=${isConfirmed})`,
        );
        return this.finalize365MergedLineups(fixtureId, merged);
    }

    /** 365Scores named lineups → API-Football shape with athleteId for player taps. */
    async resolve365LineupsForFixture(
        fixtureId: number,
        language?: string | null,
    ): Promise<any[]> {
        return this.get365LineupsMerged(fixtureId, language);
    }
}

export const footballDataCacheService = new FootballDataCacheService();
