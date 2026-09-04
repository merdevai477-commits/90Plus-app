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
import { hasLineupData, isAuthoritativeLineupData, is365LineupIdMappingStale, buildFallbackLineupsFromEvents } from '../utils/lineups-fallback';
import prisma from '../lib/prisma';
import { getRedisClient } from '../lib/redis';
import { footballService, isFootballQuotaExhausted } from './football.service';
import { matchCacheService, TERMINAL_LATCH_STATUSES } from './match-cache.service';
import { isTerminalLatched } from './live-fixture-cache.service';
import {
    shouldSkipEmptyUpstreamPoll,
    recordEmptyUpstreamResult,
    recordNonEmptyUpstreamResult,
} from './empty-upstream-backoff.service';
import { playerCacheService } from './player-cache.service';
import { leagueCacheService } from './league-cache.service';
import {
    isWorldCupHistoricalOnlyMode,
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
    ensureScores365GameMapping,
    getScores365ExperimentBundle,
    is365StoreDetailsHotfix,
    getScores365ExperimentEvents,
    getScores365ExperimentStatistics,
    getScores365GameIdForFixture,
    getScores365MatchesForDate,
    getScores365WorldCupPhaseFixtures,
    isScores365ExperimentEnabled,
    isScores365ExperimentFixture,
    posFrom365,
    resolveApiFixtureIdFor365GameId,
    resolveScores365AppLanguage,
    resolveScores365LangId,
    SCORES365_LEAGUE_ID_OFFSET,
} from './scores365-experiment.service';
import { isNative365FixtureId } from '../utils/native-365-fixture-id';
import { canQueryApiFootballFixtureId } from '../utils/api-football-identity.util';
import { isScores365OnlyMode } from '../config/scores365-only-mode.config';
import { readLiveFixtureById } from './live-fixture-cache.service';

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
    type ThreeSixFivePlayerLookupResult,
    type ThreeSixFivePlayerMatchReport,
    type ThreeSixFiveSearchAthlete,
    type ThreeSixFiveResult,
    type ThreeSixFiveStandingRow,
    type ThreeSixFiveFixtureItem,
    type ThreeSixFiveCompetitorInfo,
    type ThreeSixFiveCompetitorMatches,
    type ThreeSixFiveCompetitorTransfers,
    type ThreeSixFiveCompetitorStats,
    type ThreeSixFiveCompetitorSquad,
    type ThreeSixFiveSearchResults,
    type ThreeSixFiveCoach,
    type ThreeSixFiveAthleteProfile,
    type ThreeSixFiveCompetitionProfile,
    type ThreeSixFiveCompetitionTransfers,
} from './threeSixFiveScores.service';
import { redisCacheService } from './redis-cache.service';
import { buildMomentumPayload, type MomentumApiPayload } from './match-momentum.service';
import { footballMomentumRedisKey, footballFixtureDetailCacheKeys, footballDetailsLangRedisKey, footballDetailsRedisKey } from '../utils/football-cache-keys.util';
import {
    buildFallbackStatisticsFromEvents,
    hasApiStatistics,
    hasRichStatistics,
} from '../utils/match-stats-fallback';
import { buildTeamStatisticsFrom365Players } from '../utils/scores365-player-stats';
import {
    calendarDayBounds,
    calendarDateFromKickoff,
    calendarTodayKey,
    offsetCalendarDateKey,
} from '../utils/calendar-day-bounds.util';
import { map365StandingRowsToApiGroups } from '../utils/scores365-standings-mapper';
import { buildScores365AthletePhotoUrl } from '../utils/scores365-athlete-photo';
import { getWorldCupLeagueId, getWorldCupSeason } from '../config/world-cup-only-mode.config';
import { getScores365CompetitionId } from './scores365-experiment.service';
import { withSyncLeaderLease } from './football-sync-leader.service';
import {
    isHistoricalHttpDbOnlyEnabled,
    isStandingsSwrEnabled,
    matchesByDateLocalMaxEntries,
    standingsFreshMs,
    standingsStaleMs,
} from '../config/football-reliability-rollout.config';
import { isMajorLeagueId } from '../utils/fixture-importance';

const HISTORICAL_WORLD_CUP_STATUSES = ['FT', 'AET', 'PEN', 'CANC', 'ABD', 'AWD', 'WO'];

export function isPastOrFinishedFixture(
    status: string | null | undefined,
    matchDate: Date | string | null | undefined,
    now = new Date(),
): boolean {
    if (status && HISTORICAL_WORLD_CUP_STATUSES.includes(status)) return true;
    if (!matchDate) return false;
    const date = matchDate instanceof Date ? matchDate : new Date(matchDate);
    return !Number.isNaN(date.getTime()) && date.getTime() < now.getTime();
}

export function mergeFixtureProviders(baseFixtures: any[], overlays: any[]): any[] {
    const merged = [...baseFixtures];
    const byId = new Map<number, number>();
    const normalize = (value: unknown) =>
        String(value ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const identity = (fixture: any) => {
        const timestamp = Number(fixture?.fixture?.timestamp ?? 0);
        const home = normalize(fixture?.teams?.home?.name);
        const away = normalize(fixture?.teams?.away?.name);
        return timestamp > 0 && home && away ? `${Math.round(timestamp / 300)}:${home}:${away}` : null;
    };
    const byIdentity = new Map<string, number>();

    merged.forEach((fixture, index) => {
        const id = fixture?.fixture?.id;
        if (Number.isFinite(id)) byId.set(id, index);
        const key = identity(fixture);
        if (key) byIdentity.set(key, index);
    });

    for (const overlay of overlays) {
        const id = overlay?.fixture?.id;
        const key = identity(overlay);
        const index =
            (Number.isFinite(id) ? byId.get(id) : undefined) ??
            (key ? byIdentity.get(key) : undefined);
        if (index == null) {
            const nextIndex = merged.push(overlay) - 1;
            if (Number.isFinite(id)) byId.set(id, nextIndex);
            if (key) byIdentity.set(key, nextIndex);
            continue;
        }

        const current = merged[index];
        const currentId = current?.fixture?.id;
        merged[index] = {
            ...current,
            ...overlay,
            fixture: {
                ...current?.fixture,
                ...overlay?.fixture,
                id: currentId ?? id,
                status: { ...current?.fixture?.status, ...overlay?.fixture?.status },
            },
            league: { ...current?.league, ...overlay?.league },
            teams: {
                home: { ...current?.teams?.home, ...overlay?.teams?.home },
                away: { ...current?.teams?.away, ...overlay?.teams?.away },
            },
            goals: { ...current?.goals, ...overlay?.goals },
            score: { ...current?.score, ...overlay?.score },
        };
    }
    return merged.sort(
        (a, b) => (a?.fixture?.timestamp ?? 0) - (b?.fixture?.timestamp ?? 0),
    );
}

/** Distinguishes "the wait ran out" from a genuine empty lineup result. */
const LINEUP_BUDGET_LAPSED = Symbol('lineup-budget-lapsed');
const STATS_BUDGET_LAPSED = Symbol('stats-budget-lapsed');

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
    private pendingWorldCupByDate = new Map<string, Promise<any[]>>();
    private backgroundRefreshDates = new Set<string>();
    private standingsRefreshes = new Set<string>();
    private detailsBundleLocal = new Map<string, MemoryCacheEntry<any>>();
    private pendingDetailsBundles = new Map<string, Promise<any>>();
    private detailsBackgroundRefresh = new Set<string>();
    private readonly DETAILS_KEEP_MS = 6 * 60 * 60 * 1000;
    private readonly DETAILS_UPSTREAM_BUDGET_MS = 2_500;

    /** Cap in-process detail caches so finished fixtures cannot grow RAM forever. */
    private readonly MAX_DETAIL_CACHE = 500;

    private setBoundedCache<K, V>(map: Map<K, V>, key: K, value: V): void {
        if (!map.has(key) && map.size >= this.MAX_DETAIL_CACHE) {
            const oldest = map.keys().next().value;
            if (oldest !== undefined) map.delete(oldest);
        }
        map.set(key, value);
    }

    // TTL values
    private readonly TTL = {
        STANDINGS: 60 * 60 * 1000,      // 1 hour
        LIVE_MATCH: 30 * 1000,          // 30s — shared across all users via Redis
        LIVE_EVENT_INGEST: 8 * 1000,   // empty LIVE events — retry quickly (was 20s)
        UPCOMING_MATCH: 5 * 60 * 1000,  // 5 minutes
        FINISHED: 6 * 60 * 60 * 1000,   // 6h in-process (durable copy lives in Redis/DB)
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
        // Short empty TTL so lineups/stats appear soon after providers populate them.
        EMPTY: 45 * 1000,
        MATCHES_BY_DATE_TODAY: 5 * 60 * 1000,
        MATCHES_BY_DATE_FUTURE: 15 * 60 * 1000,
        MATCHES_BY_DATE_PAST: 24 * 60 * 60 * 1000,
        TODAY_API_REFRESH: 30 * 1000,
        /** Near kickoff / just started — keep details hot without full LIVE status yet. */
        NEAR_KICKOFF_MATCH: 10 * 1000,
    };

    private readonly liveDetailWarmInFlight = new Map<number, Promise<void>>();

    /** One upstream lineup resolution per fixture, shared by all concurrent readers. */
    private readonly lineupResolveInFlight = new Map<number, Promise<any[]>>();

    /** How long a reader waits on a cold lineup resolution before giving up on it. */
    private readonly LINEUP_RESPONSE_BUDGET_MS = 4_000;

    /** One upstream 365 statistics resolution per fixture, shared by all concurrent readers. */
    private readonly statsResolveInFlight = new Map<number, Promise<any[]>>();

    /** How long a reader waits on a cold statistics resolution before settling for stale/empty. */
    private readonly STATS_RESPONSE_BUDGET_MS = 3_000;

    /** Empty live stats are retried on this cadence; finished fixtures without stats stay quiet longer. */
    private readonly STATS_EMPTY_LIVE_TTL_MS = 20_000;
    private readonly STATS_EMPTY_FINISHED_TTL_MS = 10 * 60 * 1000;

    /** Graduated detail TTL: live/near-kickoff seconds, finished hours, else upcoming. */
    private detailTtlMs(
        status: string | null | undefined,
        kickoffMs?: number | null,
        nowMs = Date.now(),
    ): number {
        const short = status ?? '';
        if (['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT', 'SUSP'].includes(short)) {
            return 8_000;
        }
        if (['FT', 'AET', 'PEN', 'CANC', 'ABD', 'AWD', 'WO'].includes(short)) {
            return this.TTL.FINISHED;
        }
        if (
            kickoffMs != null &&
            nowMs >= kickoffMs - 20 * 60 * 1000 &&
            nowMs <= kickoffMs + 30 * 60 * 1000
        ) {
            return this.TTL.NEAR_KICKOFF_MATCH;
        }
        return this.TTL.UPCOMING_MATCH;
    }

    /**
     * Actively drop lineups/events/statistics/momentum/details for a fixture
     * (Redis + in-process). Call on LIVE→FT / NS→LIVE so TTL alone cannot serve stale data.
     */
    async invalidateFixtureDetailCaches(
        fixtureId: number,
        reason = 'status_change',
    ): Promise<void> {
        const keys = footballFixtureDetailCacheKeys(fixtureId);
        await Promise.all(keys.map((key) => redisCacheService.del(key)));
        this.lineupsCache.delete(fixtureId);
        this.statisticsCache.delete(fixtureId);
        this.eventsCache.delete(fixtureId);
        for (const key of [...this.detailsBundleLocal.keys()]) {
            if (key.startsWith(`details:${fixtureId}`)) this.detailsBundleLocal.delete(key);
        }
        logger.info(
            `[CacheInvalidate] fixture=${fixtureId} reason=${reason} keys=${keys.join(',')}`,
        );
    }

    /**
     * Drop today's matches-by-date hot caches so the list sees NS→LIVE without
     * waiting for TTL (local map + shared match cache + Redis).
     */
    async invalidateMatchesByDateCache(
        dateString: string,
        reason = 'NS→LIVE',
    ): Promise<void> {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return;
        this.matchesByDateLocal.delete(dateString);
        this.liveOverlayCache = null;
        const cacheKey = `by_date_${dateString}`;
        try {
            await matchCacheService.invalidateKey(cacheKey);
        } catch {
            // best-effort
        }
        const redis = getRedisClient();
        if (redis) {
            try {
                await redis.del(`football:date_api:${dateString}`);
            } catch {
                // best-effort
            }
        }
        logger.info(`[CacheInvalidate] matches-by-date=${dateString} reason=${reason}`);
    }

    /**
     * Warm lineups/events/stats for LIVE fixtures (API-Football + 365), majors/favorites first.
     */
    async warmLiveFixtureDetails(
        fixtureIds: number[],
        options?: { concurrency?: number; language?: string | null },
    ): Promise<void> {
        const unique = [...new Set(fixtureIds)].filter((id) => id > 0);
        if (!unique.length) return;

        const concurrency = Math.max(1, Math.min(options?.concurrency ?? 3, 6));
        const rows = await prisma.cachedFixture.findMany({
            where: { fixtureId: { in: unique } },
            select: { fixtureId: true, leagueId: true },
        });
        const leagueById = new Map(rows.map((r) => [r.fixtureId, r.leagueId]));

        let favorited = new Set<number>();
        try {
            const favRows = await prisma.favoriteMatch.findMany({
                where: { apiMatchId: { in: unique }, notifiedEnd: false },
                select: { apiMatchId: true },
                distinct: ['apiMatchId'],
            });
            favorited = new Set(favRows.map((f) => f.apiMatchId));
        } catch {
            // optional
        }

        const ranked = [...unique].sort((a, b) => {
            const score = (id: number) =>
                (favorited.has(id) ? 1000 : 0) +
                (isMajorLeagueId(leagueById.get(id)) ? 100 : 0);
            return score(b) - score(a);
        });

        // Cap warm set but always keep majors/favorites at the front.
        const maxWarm = Math.max(
            8,
            parseInt(process.env.LIVE_DETAIL_WARM_MAX || '12', 10) || 12,
        );
        const targets = ranked.slice(0, maxWarm);
        let next = 0;
        await Promise.all(
            Array.from({ length: Math.min(concurrency, targets.length) }, async () => {
                for (;;) {
                    const index = next++;
                    if (index >= targets.length) return;
                    const fixtureId = targets[index];
                    const existing = this.liveDetailWarmInFlight.get(fixtureId);
                    if (existing) {
                        await existing;
                        continue;
                    }
                    const warm = Promise.allSettled([
                        this.getMatchLineups(fixtureId, { language: options?.language }),
                        this.getMatchStatistics(fixtureId),
                        this.getMatchEvents(fixtureId, {
                            forceRefresh: true,
                            language: options?.language,
                        }),
                    ]).then(() => undefined);
                    this.liveDetailWarmInFlight.set(fixtureId, warm);
                    try {
                        await warm;
                    } finally {
                        if (this.liveDetailWarmInFlight.get(fixtureId) === warm) {
                            this.liveDetailWarmInFlight.delete(fixtureId);
                        }
                    }
                }
            }),
        );
        logger.info(
            `[LiveDetailWarm] warmed ${targets.length}/${unique.length} live fixtures (majors/favorites first)`,
        );
    }

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

    /** Keep today's live match-detail payloads hot so opening a game is a cache hit. */
    async warmLiveMatchDetails(): Promise<void> {
        try {
            const rows = await prisma.cachedFixture.findMany({
                where: {
                    status: { in: ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT'] },
                },
                select: { fixtureId: true },
                take: 8,
                orderBy: { updatedAt: 'desc' },
            });
            await Promise.all(
                rows.map((row) =>
                    this.getFixtureDetailsBundle(row.fixtureId, { language: 'ar' }).catch(() => null),
                ),
            );
        } catch (err) {
            logger.warn('[DetailsSWR] warmLiveMatchDetails failed:', (err as Error)?.message);
        }
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
        if (this.matchesByDateLocal.has(dateString)) {
            this.matchesByDateLocal.delete(dateString);
        }
        while (this.matchesByDateLocal.size >= matchesByDateLocalMaxEntries()) {
            const oldest = this.matchesByDateLocal.keys().next().value;
            if (oldest === undefined) break;
            this.matchesByDateLocal.delete(oldest);
        }
        this.matchesByDateLocal.set(dateString, {
            data,
            expiresAt: Date.now() + responseTtl,
        });
    }

    private tryLocalMatchesByDate(
        dateString: string,
        isToday: boolean,
        isPastDate: boolean,
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

            const localData = this.tryLocalMatchesByDate(
                dateString,
                isToday,
                isPastDate,
                cacheKey,
                responseTtl,
            );
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

            if (fromDb.length > 0) {
                if (isToday) {
                    const merged = await this.mergeCalendarWithLiveSources(fromDb);
                    if (!isScores365OnlyMode() && !isWorldCupOnlyMode() && !(await this.isTodayApiFresh(dateString))) {
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

    private async getDurableWorldCupFixtures(
        leagueId: number,
        season: number,
        where: Record<string, unknown> = {},
    ): Promise<any[]> {
        const rows = await prisma.cachedFixture.findMany({
            where: {
                leagueId,
                leagueSeason: season,
                ...where,
            } as any,
            orderBy: { matchTimestamp: 'asc' },
        });
        return rows.map((row) => matchCacheService.convertDbMatchToApiFormat(row));
    }

    /** Live status left in DB after quota outage on a calendar day that already passed. */
    private isStaleLiveOnPastDay(status: string, matchDate?: Date | string | null): boolean {
        const liveShorts = new Set(['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT', 'SUSP']);
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

        const liveShorts = new Set(['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT', 'SUSP']);
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
        const todayKey = calendarTodayKey();
        const ttl =
            dateString < todayKey
                ? this.TTL.MATCHES_BY_DATE_PAST
                : dateString === todayKey
                  ? 8 * 1000
                  : this.TTL.MATCHES_BY_DATE_FUTURE;

        try {
            if (dateString < todayKey && isHistoricalHttpDbOnlyEnabled()) {
                const { start, end } = calendarDayBounds(dateString);
                const durable = await this.getDurableWorldCupFixtures(leagueId, season, {
                    matchDate: { gte: start, lte: end },
                });
                return this.normalizePastCalendarFixtures(durable, dateString);
            }

            if (isWorldCupHistoricalOnlyMode() && dateString < todayKey) {
                const { start, end } = calendarDayBounds(dateString);
                const durable = await this.getDurableWorldCupFixtures(leagueId, season, {
                    matchDate: { gte: start, lte: end },
                });
                return this.normalizePastCalendarFixtures(durable, dateString);
            }

            // Serve warm cache first — previously 365 was hit on every request
            // before the cache read, which made /cached/world-cup/:date ~1s+.
            const cached = await matchCacheService.getFromMemoryCache<any[]>(cacheKey);
            if (cached && cached.length > 0) {
                return this.normalizePastCalendarFixtures(cached, dateString);
            }

            const pending = this.pendingWorldCupByDate.get(cacheKey);
            if (pending) return pending;

            const fetchPromise = (async () => {
                try {
                    if (isScores365ExperimentEnabled()) {
                        const from365 = await getScores365MatchesForDate(
                            dateString,
                            leagueId,
                            season,
                            scores365Lang,
                        );
                        if (from365.length > 0) {
                            const normalized = this.normalizePastCalendarFixtures(from365, dateString);
                            await matchCacheService.setInMemoryCache(cacheKey, normalized, ttl);
                            return normalized;
                        }
                    }

                    // DB / by-date cache — avoids a league-scoped API call per calendar day.
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
                    // Do not call applyScores365ExperimentToWorldCupList here — it
                    // re-fetches the same 365 day list we already tried above.
                    return list;
                } finally {
                    this.pendingWorldCupByDate.delete(cacheKey);
                }
            })();

            this.pendingWorldCupByDate.set(cacheKey, fetchPromise);
            return await fetchPromise;
        } catch (error) {
            logger.error(`[WC ${dateString}] getWorldCupMatchesByDate failed:`, error);
            try {
                const byDate = await this.getMatchesByDate(dateString);
                return this.normalizePastCalendarFixtures(
                    this.filterWorldCupFixtures(byDate, leagueId, season),
                    dateString,
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
        const leagueId = getWorldCupLeagueId();
        const season = getWorldCupSeason();
        const durableFinished =
            phase === 'finished' || phase === 'all'
                ? await this.getDurableWorldCupFixtures(leagueId, season, {
                    status: { in: HISTORICAL_WORLD_CUP_STATUSES },
                })
                : [];
        if (phase === 'finished' && isWorldCupHistoricalOnlyMode()) {
            return durableFinished;
        }
        if (phase === 'all' && isWorldCupHistoricalOnlyMode()) {
            const durableAll = await this.getDurableWorldCupFixtures(leagueId, season);
            const expectedFixtureCount = season >= 2026 ? 104 : 64;
            const tournamentFullyFinished =
                durableAll.length >= expectedFixtureCount &&
                durableAll.every((fixture) =>
                    HISTORICAL_WORLD_CUP_STATUSES.includes(
                        String(fixture?.fixture?.status?.short ?? ''),
                    ),
                );
            if (tournamentFullyFinished) return durableAll;
        }
        if (!isScores365ExperimentEnabled()) return durableFinished;
        const scores365Lang = resolveScores365AppLanguage(language);
        const cacheKey = `wc_phase_${phase}_${scores365Lang}`;
        const ttl = phase === 'live' ? 4_000 : phase === 'upcoming' ? 60_000 : 300_000;

        const cached = await matchCacheService.getFromMemoryCache<any[]>(cacheKey);
        if (cached && cached.length > 0) {
            return phase === 'all'
                ? mergeFixtureProviders(durableFinished, cached)
                : cached;
        }

        const from365 = await getScores365WorldCupPhaseFixtures(scores365Lang, phase);
        if (from365.length > 0) {
            await matchCacheService.setInMemoryCache(cacheKey, from365, ttl);
        }
        return phase === 'all'
            ? mergeFixtureProviders(durableFinished, from365)
            : from365;
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
        if (isScores365OnlyMode()) {
            logger.debug(`📦 [${dateString}] API-Football calendar fetch skipped (365-only mode)`);
            return mergeLive ? this.mergeCalendarWithLiveSources([]) : [];
        }
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
        if (isScores365OnlyMode()) return;
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

        try {
            const { readLiveFixturesList } = await import('./live-fixture-cache.service');
            const liveFixtures = await readLiveFixturesList();
            if (!liveFixtures?.length) return apiMatches;

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

    /** Redis live overlay + terminal FT + 365Scores for today's calendar. */
    private async mergeCalendarWithLiveSources(apiMatches: any[]): Promise<any[]> {
        let merged = await this.mergeLiveFromRedis(apiMatches);
        merged = await this.mergeTerminalSnapshotsOntoCalendar(merged);

        if (!isScores365ExperimentEnabled()) return merged;

        try {
            const { resolveLiveFixturesForClient } = await import('./live-fixture-cache.service');
            const live365 = await resolveLiveFixturesForClient();
            if (live365.fixtures.length) {
                merged = mergeFixtureProviders(merged, live365.fixtures);
            }
        } catch (err) {
            logger.warn('365 live calendar merge failed:', err);
        }

        try {
            const { enrichFixturesWithCrowdPredictions } = await import(
                './scores365-crowd-prediction.service'
            );
            const withCachedCrowd = await enrichFixturesWithCrowdPredictions(merged, undefined, {
                cacheOnly: true,
            });
            // Fill Redis/memory in the background — never block the scores list on 365 HTTP.
            void enrichFixturesWithCrowdPredictions(merged).catch((err) => {
                logger.warn('365 crowd prediction background enrich failed:', err);
            });
            return withCachedCrowd;
        } catch (err) {
            logger.warn('365 crowd prediction enrich failed:', err);
            return merged;
        }
    }

    /** Overlay FT snapshots onto calendar rows still stuck on NS after kickoff. */
    private async mergeTerminalSnapshotsOntoCalendar(apiMatches: any[]): Promise<any[]> {
        if (!apiMatches.length) return apiMatches;

        const finishedStatuses = new Set(TERMINAL_LATCH_STATUSES);
        const nsLike = new Set(['NS', 'TBD', 'PST']);
        const now = Date.now();
        const staleIds: number[] = [];

        for (const row of apiMatches) {
            const id = row?.fixture?.id;
            const status = row?.fixture?.status?.short ?? '';
            if (!Number.isFinite(id) || finishedStatuses.has(status)) continue;
            if (!nsLike.has(status)) continue;

            const kickoffMs =
                row?.fixture?.timestamp != null && row.fixture.timestamp > 0
                    ? row.fixture.timestamp * 1000
                    : Date.parse(row?.fixture?.date ?? '');
            if (!Number.isFinite(kickoffMs) || now - kickoffMs < 90 * 60 * 1000) continue;
            staleIds.push(id);
        }

        if (!staleIds.length) return apiMatches;

        try {
            const { readTerminalFixturesForIds } = await import('./live-fixture-cache.service');
            const terminals = await readTerminalFixturesForIds(staleIds);
            if (!terminals.length) return apiMatches;
            return mergeFixtureProviders(apiMatches, terminals);
        } catch (err) {
            logger.warn('Terminal calendar merge failed:', err);
            return apiMatches;
        }
    }

    private filterFixturesToCalendarDay(fixtures: any[], dateString: string): any[] {
        if (!fixtures.length) return fixtures;
        return fixtures.filter(
            (f) => calendarDateFromKickoff(f?.fixture?.date) === dateString,
        );
    }

    private applyLiveOverlay(apiMatches: any[], liveFixtures: any[]): any[] {
        return mergeFixtureProviders(apiMatches, liveFixtures);
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

    private async loadDurableStandings(
        provider: string,
        competitionId: number,
        season: number,
        language: string,
    ): Promise<{
        data: { flat: any[]; groups: Array<{ group: string; standings: any[] }> };
        updatedAt: Date;
    } | null> {
        try {
            const row = await prisma.cachedStandings.findUnique({
                where: {
                    provider_competitionId_season_language: {
                        provider,
                        competitionId,
                        season,
                        language,
                    },
                },
                select: { payload: true, updatedAt: true },
            });
            const payload = row?.payload as any;
            const parsed = payload?.parsed ?? payload;
            return parsed?.flat && parsed?.groups && row?.updatedAt
                ? { data: parsed, updatedAt: row.updatedAt }
                : null;
        } catch (error) {
            logger.warn('[Standings] durable read unavailable:', error);
            return null;
        }
    }

    private async persistDurableStandings(
        provider: string,
        competitionId: number,
        leagueId: number,
        season: number,
        language: string,
        payload: { flat: any[]; groups: Array<{ group: string; standings: any[] }> },
        source: string,
    ): Promise<void> {
        if (!payload.flat?.length) return;
        try {
            const existing = await prisma.cachedStandings.findUnique({
                where: {
                    provider_competitionId_season_language: {
                        provider,
                        competitionId,
                        season,
                        language,
                    },
                },
                select: { payload: true },
            });
            const durablePayload = {
                ...((existing?.payload as Record<string, unknown> | null) ?? {}),
                parsed: payload,
            };
            await prisma.cachedStandings.upsert({
                where: {
                    provider_competitionId_season_language: {
                        provider,
                        competitionId,
                        season,
                        language,
                    },
                },
                create: {
                    provider,
                    competitionId,
                    leagueId,
                    season,
                    language,
                    payload: durablePayload,
                    source,
                },
                update: {
                    leagueId,
                    payload: durablePayload,
                    source,
                    updatedAt: new Date(),
                },
            });
        } catch (error) {
            logger.warn('[Standings] durable write unavailable:', error);
        }
    }

    async getStandingsParsed(
        leagueId: number,
        season: number = 2024,
        language?: string | null,
    ): Promise<{ flat: any[]; groups: Array<{ group: string; standings: any[] }> }> {
        const resolvedLanguage = resolveScores365AppLanguage(language);
        const uses365 =
            isScores365ExperimentEnabled() &&
            (leagueId === getWorldCupLeagueId() || leagueId >= SCORES365_LEAGUE_ID_OFFSET);
        const competitionId =
            leagueId === getWorldCupLeagueId()
                ? getScores365CompetitionId()
                : leagueId >= SCORES365_LEAGUE_ID_OFFSET
                  ? leagueId - SCORES365_LEAGUE_ID_OFFSET
                  : leagueId;
        const provider = uses365 ? '365scores' : 'api-football';
        const cacheKey = `${provider}_${leagueId}_${season}_${resolvedLanguage}`;

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

        const durable = await this.loadDurableStandings(
            provider,
            competitionId,
            season,
            resolvedLanguage,
        );
        if (
            durable &&
            leagueId === getWorldCupLeagueId() &&
            isWorldCupHistoricalOnlyMode()
        ) {
            return durable.data;
        }

        if (durable && isStandingsSwrEnabled()) {
            const age = Date.now() - durable.updatedAt.getTime();
            if (age <= standingsFreshMs()) {
                this.setBoundedCache(this.standingsCache, cacheKey, {
                    data: durable.data,
                    timestamp: Date.now(),
                    ttl: standingsFreshMs(),
                });
                return durable.data;
            }
            if (age <= standingsFreshMs() + standingsStaleMs()) {
                this.scheduleStandingsRefresh({
                    competitionId,
                    leagueId,
                    season,
                    language: resolvedLanguage,
                    cacheKey,
                    uses365,
                });
                return durable.data;
            }
        }

        let lease;
        try {
            lease = await withSyncLeaderLease(
                `standings:${provider}:${competitionId}:${season}:${resolvedLanguage}`,
                () => this.refreshParsedStandings({
                    competitionId,
                    leagueId,
                    season,
                    language: resolvedLanguage,
                    cacheKey,
                    uses365,
                }),
                { ttlSec: 30 },
            );
        } catch (error) {
            if (durable) return durable.data;
            throw error;
        }
        if (lease.acquired && lease.value?.flat?.length) return lease.value;
        if (durable) return durable.data;
        return lease.value ?? { flat: [], groups: [] };
    }

    private scheduleStandingsRefresh(input: {
        competitionId: number;
        leagueId: number;
        season: number;
        language: string;
        cacheKey: string;
        uses365: boolean;
    }): void {
        const provider = input.uses365 ? '365scores' : 'api-football';
        const refreshKey = `${provider}:${input.competitionId}:${input.season}:${input.language}`;
        if (this.standingsRefreshes.has(refreshKey)) return;
        this.standingsRefreshes.add(refreshKey);
        void withSyncLeaderLease(
            `standings:${refreshKey}`,
            () => this.refreshParsedStandings(input),
            { ttlSec: 30 },
        )
            .catch((error) => logger.warn(`[Standings] background refresh ${refreshKey} failed:`, error))
            .finally(() => this.standingsRefreshes.delete(refreshKey));
    }

    private async refreshParsedStandings(input: {
        competitionId: number;
        leagueId: number;
        season: number;
        language: string;
        cacheKey: string;
        uses365: boolean;
    }): Promise<{ flat: any[]; groups: Array<{ group: string; standings: any[] }> }> {
        logger.debug(`📡 Refreshing standings for competition ${input.competitionId}`);
        const parsed = input.uses365
            ? await this.getStandingsParsedFrom365(input.competitionId, input.language, true)
            : await footballService.getStandingsParsed(input.leagueId, input.season);
        if (!parsed.flat?.length) return { flat: [], groups: [] };

        await this.persistDurableStandings(
            input.uses365 ? '365scores' : 'api-football',
            input.competitionId,
            input.leagueId,
            input.season,
            input.language,
            parsed,
            input.uses365 ? '365scores' : 'api-football',
        );
        await this.cacheChangedTeamsFromStandings(parsed.flat);
        this.setBoundedCache(this.standingsCache, input.cacheKey, {
            data: parsed,
            timestamp: Date.now(),
            ttl: standingsFreshMs(),
        });
        return parsed;
    }

    /** World Cup / 365 competition group tables from /web/standings/. */
    async getStandingsParsedFrom365(
        competitionId: number = getScores365CompetitionId(),
        language?: string | null,
        force = false,
    ): Promise<{ flat: any[]; groups: Array<{ group: string; standings: any[] }> }> {
        const result = await threeSixFiveScoresService.getStandings(
            competitionId,
            language,
            { force },
        );
        if (!result.data?.length) {
            return { flat: [], groups: [] };
        }
        return map365StandingRowsToApiGroups(result.data);
    }

    async syncWorldCupStandingsFrom365(
        language?: string | null,
        competitionId = getScores365CompetitionId(),
    ): Promise<number> {
        if (!isScores365ExperimentEnabled()) return 0;
        const parsed = await this.getStandingsParsedFrom365(
            competitionId,
            language ?? 'en',
            true,
        );
        const leagueId =
            competitionId === getScores365CompetitionId()
                ? getWorldCupLeagueId()
                : SCORES365_LEAGUE_ID_OFFSET + competitionId;
        const season = getWorldCupSeason();
        const resolvedLanguage = resolveScores365AppLanguage(language ?? 'en');
        const cacheKey = `365scores_${leagueId}_${season}_${resolvedLanguage}`;
        if (parsed.groups.length > 0) {
            await this.persistDurableStandings(
                '365scores',
                competitionId,
                leagueId,
                season,
                resolvedLanguage,
                parsed,
                '365scores',
            );
            await this.cacheChangedTeamsFromStandings(parsed.flat);
            this.setBoundedCache(this.standingsCache, cacheKey, {
                data: parsed,
                timestamp: Date.now(),
                ttl: standingsFreshMs(),
            });
            logger.debug(
                `[365Standings] synced ${parsed.flat.length} rows across ${parsed.groups.length} groups for competition ${competitionId}`,
            );
        }
        return parsed.flat.length;
    }

    private async cacheChangedTeamsFromStandings(standings: any[]): Promise<void> {
        const teams = [
            ...new Map(
                standings
                    .map((standing) => standing?.team)
                    .filter((team) => Number.isFinite(team?.id) && team.id > 0)
                    .map((team) => [team.id, team]),
            ).values(),
        ] as any[];
        if (!teams.length) return;

        try {
            const existing = await prisma.cachedTeam.findMany({
                where: { teamId: { in: teams.map((team) => team.id) } },
                select: { teamId: true, name: true, logo: true },
            });
            const existingById = new Map(existing.map((team) => [team.teamId, team]));
            const changed = teams.filter((team) => {
                const current = existingById.get(team.id);
                return !current || current.name !== team.name || current.logo !== (team.logo ?? null);
            });
            if (!changed.length) return;

            await prisma.$transaction(
                changed.map((team) =>
                    prisma.cachedTeam.upsert({
                        where: { teamId: team.id },
                        update: {
                            name: team.name,
                            logo: team.logo ?? null,
                            updatedAt: new Date(),
                        },
                        create: {
                            teamId: team.id,
                            name: team.name,
                            logo: team.logo ?? null,
                            fullData: { team },
                        },
                    }),
                ),
            );
            logger.debug(`[Standings] persisted ${changed.length}/${teams.length} changed teams`);
        } catch (error) {
            logger.warn('[Standings] changed-team batch unavailable:', error);
        }
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
     *
     * 365 never publishes an XI for most fixtures outside the top leagues, so an
     * empty set is the correct answer rather than a miss. `cacheUsable` rejects it
     * either way, which is why it gets its own read path: otherwise every reader
     * repeats a round trip that regularly costs 5–10s and returns nothing.
     */
    async getMatchLineups(
        fixtureId: number,
        options?: { forceRefresh?: boolean; language?: string | null },
    ): Promise<any[]> {
        const forceRefresh =
            options?.forceRefresh === true ||
            (isScores365ExperimentFixture(fixtureId) && is365StoreDetailsHotfix());
        const language = resolveScores365AppLanguage(options?.language ?? null);
        const redisKey = `lineups:${fixtureId}`;

        const cacheUsable = (data: unknown): boolean => {
            if (!hasLineupData(data)) return false;
            if (is365LineupIdMappingStale(data)) return false;
            if (isScores365ExperimentFixture(fixtureId)) {
                return isAuthoritativeLineupData(data);
            }
            return true;
        };

        if (forceRefresh) {
            await redisCacheService.del(redisKey);
            this.lineupsCache.delete(fixtureId);
        } else {
            const redisCached = await redisCacheService.get<MemoryCacheEntry<any>>(redisKey);
            if (redisCached) this.setBoundedCache(this.lineupsCache, fixtureId, redisCached);

            const cached = redisCached ?? this.lineupsCache.get(fixtureId);
            const fresh = !!cached && Date.now() - cached.timestamp < cached.ttl;

            if (cached && fresh && cacheUsable(cached.data)) {
                logger.debug(`📦 Lineups ${fixtureId} from cache (shared for all users)`);
                return cached.data;
            }
            if (cached && !hasLineupData(cached.data)) {
                // Once the empty answer expires the refresh runs out of band, so a
                // late-published XI lands in cache for the client's next poll
                // instead of making this request wait on the provider.
                if (!fresh) this.refreshLineupsInBackground(fixtureId, language);
                return [];
            }
        }

        return await this.resolveMatchLineupsShared(fixtureId, language, forceRefresh);
    }

    /**
     * Shares one upstream resolution between concurrent readers and caps how long
     * any of them waits on it. A cold 365 lineup call can outlast the app's own
     * request budget, so past the cap we hand back an empty XI and let the
     * resolution finish into the cache for the next poll.
     */
    private async resolveMatchLineupsShared(
        fixtureId: number,
        language: 'ar' | 'en',
        forceRefresh: boolean,
    ): Promise<any[]> {
        let shared = this.lineupResolveInFlight.get(fixtureId);
        if (!shared) {
            shared = this.resolveMatchLineups(fixtureId, language, forceRefresh).finally(() => {
                this.lineupResolveInFlight.delete(fixtureId);
            });
            this.lineupResolveInFlight.set(fixtureId, shared);
        }

        let budgetTimer: ReturnType<typeof setTimeout> | undefined;
        const budgetLapsed = new Promise<typeof LINEUP_BUDGET_LAPSED>((resolve) => {
            budgetTimer = setTimeout(
                () => resolve(LINEUP_BUDGET_LAPSED),
                this.LINEUP_RESPONSE_BUDGET_MS,
            );
        });

        try {
            const settled = await Promise.race([
                shared.catch(() => [] as any[]),
                budgetLapsed,
            ]);
            if (settled === LINEUP_BUDGET_LAPSED) {
                logger.warn(`[Lineups] fixture=${fixtureId} reason=response_budget_exceeded`);
                return [];
            }
            return settled;
        } finally {
            if (budgetTimer) clearTimeout(budgetTimer);
        }
    }

    /** Refreshes an expired empty lineup entry without blocking the caller. */
    private refreshLineupsInBackground(fixtureId: number, language: 'ar' | 'en'): void {
        if (this.lineupResolveInFlight.has(fixtureId)) return;
        void this.resolveMatchLineupsShared(fixtureId, language, true).catch(() => undefined);
    }

    private async resolveMatchLineups(
        fixtureId: number,
        language: 'ar' | 'en',
        forceRefresh: boolean,
    ): Promise<any[]> {
        const LIVE_STATUSES = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT', 'SUSP'];
        const redisKey = `lineups:${fixtureId}`;

        const dbMatch = await prisma.cachedFixture.findUnique({
            where: { fixtureId },
            select: {
                status: true,
                leagueId: true,
                matchDate: true,
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
        const durableHistoricalOnly =
            isWorldCupHistoricalOnlyMode() &&
            dbMatch?.leagueId === getWorldCupLeagueId() &&
            isPastOrFinishedFixture(dbMatch.status, dbMatch.matchDate);

        if (durableHistoricalOnly) {
            return hasLineupData(fullData?.lineups) ? fullData.lineups : [];
        }

        // Rows mapped before grid data existed must be refreshed; rows that 365 itself
        // published without field positions are complete as they are.
        const dbLineupsHaveGrid = (lineups: unknown) =>
            Array.isArray(lineups) &&
            lineups.some(
                (row: {
                    _hasFieldPositions?: boolean;
                    startXI?: Array<{ player?: { grid?: string | null } }>;
                }) =>
                    row._hasFieldPositions === false ||
                    row.startXI?.some((p) => p.player?.grid != null),
            );

        if (
            !forceRefresh &&
            isFinished &&
            hasLineupData(fullData?.lineups) &&
            !is365LineupIdMappingStale(fullData.lineups) &&
            (!isScores365ExperimentFixture(fixtureId) || dbLineupsHaveGrid(fullData.lineups))
        ) {
            logger.debug(`📦 Lineups ${fixtureId} from DB fullData (shared for all users, no API call)`);
            return fullData.lineups;
        }

        await ensureScores365GameMapping(fixtureId);

        if (isScores365ExperimentFixture(fixtureId) || isNative365FixtureId(fixtureId)) {
            const from365 = await this.get365LineupsMerged(
                fixtureId,
                language,
                undefined,
                forceRefresh,
            );
            if (hasLineupData(from365)) {
                await recordNonEmptyUpstreamResult(fixtureId);
                const kickoffMs = dbMatch?.matchDate?.getTime() ?? null;
                const statusShort = dbMatch?.status ?? (isLive ? 'LIVE' : isFinished ? 'FT' : 'NS');
                const cacheEntry: MemoryCacheEntry<any> = {
                    data: from365,
                    timestamp: Date.now(),
                    ttl: this.detailTtlMs(statusShort, kickoffMs),
                };
                const redisTtl =
                    cacheEntry.ttl === Infinity ? 7 * 24 * 60 * 60 * 1000 : cacheEntry.ttl;
                await redisCacheService.set(redisKey, cacheEntry, redisTtl);
                this.setBoundedCache(this.lineupsCache, fixtureId, cacheEntry);
                if (isFinished) {
                    await this.updateFixtureFullData(fixtureId, { lineups: from365 });
                }
                return from365;
            }
            // P1-7: do not escalate empty lineups for latched terminal fixtures.
            if (await isTerminalLatched(fixtureId)) {
                const empty: any[] = from365 ?? [];
                // Never bury an empty lineup behind FINISHED TTL — providers often
                // publish XI shortly after FT / after NS→LIVE cache busts.
                const cacheEntry: MemoryCacheEntry<any> = {
                    data: empty,
                    timestamp: Date.now(),
                    ttl: this.TTL.EMPTY,
                };
                await redisCacheService.set(redisKey, cacheEntry, this.TTL.EMPTY);
                this.setBoundedCache(this.lineupsCache, fixtureId, cacheEntry);
                logger.debug(`[Lineups] fixture=${fixtureId} skip upstream (terminal latched)`);
                return empty;
            }
            const lineupsBackoff = await shouldSkipEmptyUpstreamPoll(fixtureId);
            if (lineupsBackoff.skip) {
                const empty: any[] = from365 ?? [];
                const ttlMs = lineupsBackoff.nextRetryInMs ?? 60_000;
                const cacheEntry: MemoryCacheEntry<any> = {
                    data: empty,
                    timestamp: Date.now(),
                    ttl: ttlMs,
                };
                await redisCacheService.set(redisKey, cacheEntry, ttlMs);
                this.setBoundedCache(this.lineupsCache, fixtureId, cacheEntry);
                return empty;
            }
            // 365 empty — try API-Football for mapped API ids only (never a 365 gameId).
            if (this.canQueryApiFootball(fixtureId)) {
                try {
                    const apiLineups = await footballService.getFixtureLineupsResolved(fixtureId);
                    if (hasLineupData(apiLineups)) {
                        await recordNonEmptyUpstreamResult(fixtureId);
                        logger.warn(
                            `[Lineups] fixture=${fixtureId} reason=365_empty_api_fallback`,
                        );
                        const kickoffMs = dbMatch?.matchDate?.getTime() ?? null;
                        const ttl = this.detailTtlMs(dbMatch?.status, kickoffMs);
                        const cacheEntry: MemoryCacheEntry<any> = {
                            data: apiLineups,
                            timestamp: Date.now(),
                            ttl,
                        };
                        await redisCacheService.set(redisKey, cacheEntry, ttl);
                        this.setBoundedCache(this.lineupsCache, fixtureId, cacheEntry);
                        return apiLineups;
                    }
                } catch (err) {
                    logger.warn(
                        `[Lineups] fixture=${fixtureId} reason=api_fallback_failed:`,
                        (err as Error)?.message,
                    );
                }
            }
            logger.warn(`[Lineups] fixture=${fixtureId} reason=upstream_empty source=365`);
            // P1-7: backoff live empty upstream polls; never latch empty lineups
            // under FINISHED TTL (6h) — that hid XI for whole sessions after LIVE→FT.
            if (isFinished || TERMINAL_LATCH_STATUSES.includes(dbMatch?.status ?? '')) {
                const empty = from365 ?? [];
                const cacheEntry: MemoryCacheEntry<any> = {
                    data: empty,
                    timestamp: Date.now(),
                    ttl: this.TTL.EMPTY,
                };
                await redisCacheService.set(redisKey, cacheEntry, this.TTL.EMPTY);
                this.setBoundedCache(this.lineupsCache, fixtureId, cacheEntry);
            } else if (isLive) {
                const { nextBackoffMs } = await recordEmptyUpstreamResult(fixtureId);
                const empty = from365 ?? [];
                const cacheEntry: MemoryCacheEntry<any> = {
                    data: empty,
                    timestamp: Date.now(),
                    ttl: nextBackoffMs,
                };
                await redisCacheService.set(redisKey, cacheEntry, nextBackoffMs);
                this.setBoundedCache(this.lineupsCache, fixtureId, cacheEntry);
            }
            return from365 ?? [];
        }

        const pendingRequest = this.pendingLineupRequests.get(fixtureId);
        if (pendingRequest) {
            logger.debug(`⏳ Waiting for pending lineup request ${fixtureId} (${this.pendingLineupRequests.size} concurrent requests)`);
            return await pendingRequest;
        }

        if (!this.canQueryApiFootball(fixtureId)) {
            logger.warn(`[Lineups] fixture=${fixtureId} skip API-Football (365-native or unconfigured)`);
            return [];
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
                this.setBoundedCache(this.lineupsCache, fixtureId, cacheEntry);

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
    async getMatchStatistics(
        fixtureId: number,
        options?: { forceRefresh?: boolean; language?: string | null },
    ): Promise<any[]> {
        const dbMatch = await prisma.cachedFixture.findUnique({
            where: { fixtureId },
            select: { status: true, fullData: true, matchDate: true, leagueId: true },
        });
        const fullData = dbMatch?.fullData as any;
        if (
            isWorldCupHistoricalOnlyMode() &&
            dbMatch?.leagueId === getWorldCupLeagueId() &&
            isPastOrFinishedFixture(dbMatch.status, dbMatch.matchDate)
        ) {
            return Array.isArray(fullData?.statistics) ? fullData.statistics : [];
        }

        await ensureScores365GameMapping(fixtureId);
        if (isScores365ExperimentFixture(fixtureId) || isNative365FixtureId(fixtureId)) {
            return this.get365Statistics(fixtureId, dbMatch, options);
        }

        // Check Redis cache first, then memory cache
        const redisKey = `statistics:${fixtureId}`;
        const redisCached = await redisCacheService.get<MemoryCacheEntry<any>>(redisKey);
        if (redisCached && Date.now() - redisCached.timestamp < redisCached.ttl) {
            logger.debug(`📦 Statistics ${fixtureId} from Redis cache`);
            // Update memory cache
            this.setBoundedCache(this.statisticsCache, fixtureId, redisCached);
            return redisCached.data;
        }

        // Check memory cache
        const cached = this.statisticsCache.get(fixtureId);
        if (cached && Date.now() - cached.timestamp < cached.ttl) {
            logger.debug(`📦 Statistics ${fixtureId} from memory cache`);
            return cached.data;
        }

        // Check if match is finished (or stale live on a past calendar day)
        const isFinished =
            !!dbMatch &&
            (['FT', 'AET', 'PEN'].includes(dbMatch.status) ||
                this.isStaleLiveOnPastDay(dbMatch.status, dbMatch.matchDate));

        if (isFinished && Array.isArray(fullData?.statistics) && fullData.statistics.length > 0) {
            logger.debug(`📦 Statistics ${fixtureId} from DB fullData`);
            return fullData.statistics;
        }

        // Stale live on a past day — skip upstream API (quota + pointless refresh).
        if (dbMatch && this.isStaleLiveOnPastDay(dbMatch.status, dbMatch.matchDate)) {
            logger.debug(`📦 Statistics ${fixtureId} skipped — stale live on past day`);
            return Array.isArray(fullData?.statistics) ? fullData.statistics : [];
        }

        if (!this.canQueryApiFootball(fixtureId)) {
            logger.warn(`[Stats] fixture=${fixtureId} skip API-Football (365-native or unconfigured)`);
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
        this.setBoundedCache(this.statisticsCache, fixtureId, cacheEntry);

        if (isFinished && !isEmpty && statistics?.length) {
            await this.updateFixtureFullData(fixtureId, { statistics });
        }

        return statistics;
    }

    private is365FixtureFinished(
        dbMatch: { status: string; matchDate: Date } | null,
    ): boolean {
        return (
            !!dbMatch &&
            (['FT', 'AET', 'PEN'].includes(dbMatch.status) ||
                this.isStaleLiveOnPastDay(dbMatch.status, dbMatch.matchDate))
        );
    }

    /**
     * 365 statistics read path: cache first (memory, then Redis), stale-while-revalidate,
     * one upstream resolution shared by every concurrent reader, and a hard cap on how
     * long any reader waits on a cold resolution. A throttled 365 must never turn the
     * stats tab into a 20s spinner.
     */
    private async get365Statistics(
        fixtureId: number,
        dbMatch: { status: string; fullData: unknown; matchDate: Date } | null,
        options?: { forceRefresh?: boolean; language?: string | null },
    ): Promise<any[]> {
        const redisKey = `statistics:${fixtureId}`;
        const forceRefresh = options?.forceRefresh === true;
        const fullData = dbMatch?.fullData as any;

        if (forceRefresh) {
            await redisCacheService.del(redisKey);
            this.statisticsCache.delete(fixtureId);
            return this.await365StatisticsWithinBudget(fixtureId, dbMatch, options?.language, true, []);
        }

        if (this.is365FixtureFinished(dbMatch) && hasRichStatistics(fullData?.statistics)) {
            return fullData.statistics;
        }

        let cached = this.statisticsCache.get(fixtureId) ?? null;
        if (!cached || Date.now() - cached.timestamp >= cached.ttl) {
            const fromRedis = await redisCacheService.get<MemoryCacheEntry<any>>(redisKey);
            if (fromRedis && (!cached || fromRedis.timestamp > cached.timestamp)) {
                cached = fromRedis;
                this.setBoundedCache(this.statisticsCache, fixtureId, fromRedis);
            }
        }

        if (cached) {
            const usable = hasApiStatistics(cached.data) ? cached.data : [];
            if (Date.now() - cached.timestamp < cached.ttl) return usable;
            // Expired: revalidate out of band and hand back what we have right now.
            this.start365StatisticsResolve(fixtureId, dbMatch, options?.language, false);
            return usable;
        }

        return this.await365StatisticsWithinBudget(fixtureId, dbMatch, options?.language, false, []);
    }

    private start365StatisticsResolve(
        fixtureId: number,
        dbMatch: { status: string; fullData: unknown; matchDate: Date } | null,
        language: string | null | undefined,
        force: boolean,
    ): Promise<any[]> {
        let shared = this.statsResolveInFlight.get(fixtureId);
        if (!shared) {
            shared = this.resolve365Statistics(fixtureId, dbMatch, language, force)
                .catch((err) => {
                    logger.warn(
                        `[Stats365] fixture=${fixtureId} resolve failed: ${
                            err instanceof Error ? err.message : String(err)
                        }`,
                    );
                    return [] as any[];
                })
                .finally(() => {
                    this.statsResolveInFlight.delete(fixtureId);
                });
            this.statsResolveInFlight.set(fixtureId, shared);
        }
        return shared;
    }

    private async await365StatisticsWithinBudget(
        fixtureId: number,
        dbMatch: { status: string; fullData: unknown; matchDate: Date } | null,
        language: string | null | undefined,
        force: boolean,
        fallback: any[],
    ): Promise<any[]> {
        const shared = this.start365StatisticsResolve(fixtureId, dbMatch, language, force);
        let budgetTimer: ReturnType<typeof setTimeout> | undefined;
        const budgetLapsed = new Promise<typeof STATS_BUDGET_LAPSED>((resolve) => {
            budgetTimer = setTimeout(() => resolve(STATS_BUDGET_LAPSED), this.STATS_RESPONSE_BUDGET_MS);
            budgetTimer.unref?.();
        });
        try {
            const settled = await Promise.race([shared, budgetLapsed]);
            if (settled === STATS_BUDGET_LAPSED) {
                logger.warn(`[Stats365] fixture=${fixtureId} reason=response_budget_exceeded`);
                return fallback;
            }
            return settled;
        } finally {
            if (budgetTimer) clearTimeout(budgetTimer);
        }
    }

    /**
     * The actual 365 statistics resolution: team-level `/web/game/stats` first
     * (possession, shots, corners…), then player aggregation, then events-derived
     * counts. Whatever comes back — including nothing — lands in cache so the next
     * reader (and the bundle) shares it.
     */
    private async resolve365Statistics(
        fixtureId: number,
        dbMatch: { status: string; fullData: unknown; matchDate: Date } | null,
        language: string | null | undefined,
        force: boolean,
    ): Promise<any[]> {
        const fullData = dbMatch?.fullData as any;
        const isFinished = this.is365FixtureFinished(dbMatch);
        let statistics: any[] = [];

        try {
            const teamStats = await getScores365ExperimentStatistics(fixtureId, { force, language });
            if (hasApiStatistics(teamStats)) statistics = teamStats;
        } catch (err) {
            logger.warn(
                `[Stats365] fixture=${fixtureId} team-stats failed: ${
                    err instanceof Error ? err.message : String(err)
                }`,
            );
        }

        if (!hasApiStatistics(statistics) && fullData?.teams) {
            const named = await this.getCached365LineupsWithNames(fixtureId);
            if (named.data?.length) {
                const aggregated = buildTeamStatisticsFrom365Players(named.data, fullData.teams);
                if (hasApiStatistics(aggregated)) statistics = aggregated;
            }
        }

        if (!hasApiStatistics(statistics) && fullData?.teams && fullData?.goals) {
            // Cached events only — a forced refresh here would rebuild the blocking chain.
            const events = await this.getMatchEvents(fixtureId, { forceRefresh: false });
            if (events.length > 0) {
                const derived = buildFallbackStatisticsFromEvents(
                    { teams: fullData.teams, goals: fullData.goals },
                    events,
                );
                if (hasApiStatistics(derived)) statistics = derived;
            }
        }

        await this.store365Statistics(fixtureId, statistics, isFinished);
        if (!hasApiStatistics(statistics)) {
            logger.info(`[Stats365] fixture=${fixtureId}: statistics unavailable yet`);
        }
        return statistics;
    }

    /** Latest cached statistics (fresh or stale) without touching upstream. */
    private async peek365Statistics(fixtureId: number): Promise<any[] | null> {
        const memory = this.statisticsCache.get(fixtureId);
        if (memory && hasApiStatistics(memory.data)) return memory.data;
        try {
            const fromRedis = await redisCacheService.get<MemoryCacheEntry<any>>(
                `statistics:${fixtureId}`,
            );
            if (fromRedis && hasApiStatistics(fromRedis.data)) {
                this.setBoundedCache(this.statisticsCache, fixtureId, fromRedis);
                return fromRedis.data;
            }
        } catch {
            // Redis is optional here.
        }
        return null;
    }

    /** Let the bundle's team stats feed the shared cache without downgrading a richer entry. */
    private mirror365BundleStatistics(
        fixtureId: number,
        statistics: any[],
        isFinished: boolean,
    ): void {
        if (!hasApiStatistics(statistics)) return;
        const cached = this.statisticsCache.get(fixtureId);
        if (!hasRichStatistics(statistics) && cached && hasRichStatistics(cached.data)) return;
        void this.store365Statistics(fixtureId, statistics, isFinished).catch(() => undefined);
    }

    /** Shared `statistics:${fixtureId}` writer for `/statistics`, the bundle, and the warmer. */
    async store365Statistics(
        fixtureId: number,
        statistics: any[],
        isFinished: boolean,
    ): Promise<void> {
        const usable = hasApiStatistics(statistics);
        const rich = hasRichStatistics(statistics);
        const ttl = !usable
            ? (isFinished ? this.STATS_EMPTY_FINISHED_TTL_MS : this.STATS_EMPTY_LIVE_TTL_MS)
            : isFinished && rich
                ? this.TTL.FINISHED
                : this.TTL.LIVE_MATCH;
        const cacheEntry: MemoryCacheEntry<any> = {
            data: usable ? statistics : [],
            timestamp: Date.now(),
            ttl,
        };
        this.setBoundedCache(this.statisticsCache, fixtureId, cacheEntry);
        try {
            await redisCacheService.set(`statistics:${fixtureId}`, cacheEntry, ttl);
        } catch {
            // Memory copy still serves this process.
        }
        if (isFinished && rich) {
            void this.updateFixtureFullData(fixtureId, { statistics }).catch(() => undefined);
        }
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
        const dbMatch = await prisma.cachedFixture.findUnique({
            where: { fixtureId },
            select: {
                status: true,
                fullData: true,
                leagueId: true,
                matchDate: true,
            },
        });
        const fullData = dbMatch?.fullData as any;
        if (
            isWorldCupHistoricalOnlyMode() &&
            dbMatch?.leagueId === getWorldCupLeagueId() &&
            isPastOrFinishedFixture(dbMatch.status, dbMatch.matchDate)
        ) {
            return Array.isArray(fullData?.events) ? fullData.events : [];
        }

        // 365Scores — single shared upstream fetch; never API-Football quota.
        await ensureScores365GameMapping(fixtureId);
        if (isScores365ExperimentFixture(fixtureId) || isNative365FixtureId(fixtureId)) {
            // In-flight deduplication for 365-path — mirrors the API-Football pendingEventsRequests
            // pattern below. Prevents N concurrent requests for the same fixture all hitting
            // 365Scores simultaneously (which was the root cause of 12s+ responses).
            // Fixes 90PLUS-BACKEND-B.
            if (!forceRefresh) {
                const pending365 = this.pendingEventsRequests.get(fixtureId);
                if (pending365) {
                    logger.debug(`[365Events] waiting for in-flight request ${fixtureId}`);
                    return await pending365;
                }
            }

            const events365Promise = (async () => {
                // P1-7: latched terminal fixtures — never escalate empty 365 results.
                if (await isTerminalLatched(fixtureId)) {
                    const redisCached = await redisCacheService.get<MemoryCacheEntry<any>>(
                        `events:${fixtureId}`,
                    );
                    if (redisCached && Date.now() - redisCached.timestamp < redisCached.ttl) {
                        return Array.isArray(redisCached.data) ? redisCached.data : [];
                    }
                    const mem = this.eventsCache.get(fixtureId);
                    if (mem && Date.now() - mem.timestamp < mem.ttl) {
                        return Array.isArray(mem.data) ? mem.data : [];
                    }
                    if (Array.isArray(fullData?.events)) {
                        return fullData.events;
                    }
                    const emptyEntry: MemoryCacheEntry<any> = {
                        data: [],
                        timestamp: Date.now(),
                        ttl: this.TTL.FINISHED,
                    };
                    this.setBoundedCache(this.eventsCache, fixtureId, emptyEntry);
                    await redisCacheService.set(`events:${fixtureId}`, emptyEntry, this.TTL.FINISHED);
                    logger.debug(
                        `[365Events] fixture=${fixtureId} skip upstream (terminal latched)`,
                    );
                    return [];
                }

                const statusShort = dbMatch?.status ?? '';
                const isTerminal = TERMINAL_LATCH_STATUSES.includes(statusShort);
                if (!isTerminal) {
                    const eventsBackoff = await shouldSkipEmptyUpstreamPoll(fixtureId);
                    if (eventsBackoff.skip) {
                        // Keep whatever the last resolve produced instead of blanking the tab
                        // while the empty-upstream backoff runs, and overlay any goal the live
                        // sync recorded since — feed-less leagues must not wait out the backoff.
                        const mem = this.eventsCache.get(fixtureId);
                        const redisCached = Array.isArray(mem?.data)
                            ? null
                            : await redisCacheService.get<MemoryCacheEntry<any>>(`events:${fixtureId}`);
                        const lastKnown: any[] = Array.isArray(mem?.data)
                            ? mem.data
                            : Array.isArray(redisCached?.data)
                              ? redisCached.data
                              : [];
                        const overlaid = await this.overlaySyntheticGoals(fixtureId, lastKnown);
                        if (overlaid.length > 0) return overlaid;
                        const ttlMs = eventsBackoff.nextRetryInMs ?? 60_000;
                        const emptyEntry: MemoryCacheEntry<any> = {
                            data: [],
                            timestamp: Date.now(),
                            ttl: ttlMs,
                        };
                        this.setBoundedCache(this.eventsCache, fixtureId, emptyEntry);
                        await redisCacheService.set(`events:${fixtureId}`, emptyEntry, ttlMs);
                        return [];
                    }
                }

                // The 365 game payload is stale-while-revalidate: an empty answer already has a
                // background refresh in flight, so forcing extra upstream round-trips here only
                // held the response for 12-24s. Events come from the EN structural payload, so
                // the language does not change them either.
                let events = await getScores365ExperimentEvents(fixtureId, forceRefresh, language);
                const hasProviderEvents = events.some((event: any) => event?._synthetic !== true);
                // API-Football fallback when 365 timeline is empty for a mapped API id.
                if (!hasProviderEvents && this.canQueryApiFootball(fixtureId)) {
                    try {
                        const apiEvents = await footballService.getFixtureEvents(fixtureId, {
                            source: 'job',
                        });
                        if (Array.isArray(apiEvents) && apiEvents.length > 0) {
                            await recordNonEmptyUpstreamResult(fixtureId);
                            logger.warn(
                                `[Events] fixture=${fixtureId} reason=365_empty_api_fallback count=${apiEvents.length}`,
                            );
                            events = apiEvents;
                        } else {
                            logger.debug(
                                `[Events] fixture=${fixtureId} reason=upstream_empty source=365+api count=0`,
                            );
                        }
                    } catch (err) {
                        logger.warn(
                            `[Events] fixture=${fixtureId} reason=api_fallback_failed:`,
                            (err as Error)?.message,
                        );
                    }
                } else if (!hasProviderEvents) {
                    const mapped = getScores365GameIdForFixture(fixtureId);
                    logger.debug(
                        `[Events] fixture=${fixtureId} reason=${mapped ? 'upstream_empty' : 'unmapped'} source=365 provider=0 synthetic=${events.length}`,
                    );
                }
                const providerEventCount = events.filter((event: any) => event?._synthetic !== true).length;
                // Raised default from 3s → 8s to reduce upstream hammering on empty results.
                // Override via SCORES365_CACHE_MS env var if needed.
                const ttl = isTerminal
                    ? this.TTL.FINISHED
                    : Math.max(2_000, parseInt(process.env.SCORES365_CACHE_MS || '8000', 10) || 8_000);
                if (providerEventCount > 0) {
                    await recordNonEmptyUpstreamResult(fixtureId);
                    const cacheEntry: MemoryCacheEntry<any> = {
                        data: events,
                        timestamp: Date.now(),
                        ttl,
                    };
                    this.setBoundedCache(this.eventsCache, fixtureId, cacheEntry);
                    await redisCacheService.set(`events:${fixtureId}`, cacheEntry, ttl);
                } else if (isTerminal) {
                    const cacheEntry: MemoryCacheEntry<any> = {
                        data: events,
                        timestamp: Date.now(),
                        ttl,
                    };
                    this.setBoundedCache(this.eventsCache, fixtureId, cacheEntry);
                    await redisCacheService.set(`events:${fixtureId}`, cacheEntry, ttl);
                } else {
                    const { nextBackoffMs } = await recordEmptyUpstreamResult(fixtureId);
                    const cacheEntry: MemoryCacheEntry<any> = {
                        data: events,
                        timestamp: Date.now(),
                        ttl: nextBackoffMs,
                    };
                    this.setBoundedCache(this.eventsCache, fixtureId, cacheEntry);
                    await redisCacheService.set(`events:${fixtureId}`, cacheEntry, nextBackoffMs);
                }
                logger.debug(
                    `[365Events] fixture=${fixtureId} source=365 count=${events.length}`,
                );
                return events;
            })();

            if (!forceRefresh) {
                this.pendingEventsRequests.set(fixtureId, events365Promise);
            }
            try {
                return await events365Promise;
            } finally {
                this.pendingEventsRequests.delete(fixtureId);
            }
        }

        const redisKey = `events:${fixtureId}`;

        if (!forceRefresh) {
        // 1. Check Redis cache first, then memory cache
        const redisCached = await redisCacheService.get<MemoryCacheEntry<any>>(redisKey);
        if (redisCached && Date.now() - redisCached.timestamp < redisCached.ttl) {
            logger.debug(`📦 Events ${fixtureId} from Redis cache (shared for all users)`);
            // Update memory cache
            this.setBoundedCache(this.eventsCache, fixtureId, redisCached);
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
        const isFinished = dbMatch && ['FT', 'AET', 'PEN'].includes(dbMatch.status);
        const isLiveStatus =
            dbMatch &&
            ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT'].includes(dbMatch.status);
        // ✅ If finished and we have non-empty events in fullData, use them (no API call).
        // Empty [] must NOT short-circuit — otherwise FT matches stay eventless forever.
        if (
            !forceRefresh &&
            isFinished &&
            Array.isArray(fullData?.events) &&
            fullData.events.length > 0
        ) {
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

        if (!this.canQueryApiFootball(fixtureId)) {
            logger.warn(`[Events] fixture=${fixtureId} skip API-Football (365-native or unconfigured)`);
            return Array.isArray(fullData?.events) ? fullData.events : [];
        }

        // ✅ 4. Create new API request and share it with all concurrent requests
        logger.debug(`📡 Fetching events for fixture ${fixtureId} (request will be shared with concurrent users)`);
        const apiRequestPromise = (async () => {
            try {
                let events = await footballService.getFixtureEvents(fixtureId, { source: 'job' });

                // 365 fallback when API-Football timeline is empty but a mapping exists.
                if (
                    (!Array.isArray(events) || events.length === 0) &&
                    isScores365ExperimentEnabled() &&
                    getScores365GameIdForFixture(fixtureId)
                ) {
                    try {
                        const from365 = await getScores365ExperimentEvents(
                            fixtureId,
                            true,
                            language,
                        );
                        if (from365.length > 0) {
                            logger.warn(
                                `[Events] fixture=${fixtureId} reason=api_empty_365_fallback count=${from365.length}`,
                            );
                            events = from365;
                        }
                    } catch (err) {
                        logger.warn(
                            `[Events] fixture=${fixtureId} reason=365_fallback_failed:`,
                            (err as Error)?.message,
                        );
                    }
                }

                const isEmpty = !Array.isArray(events) || events.length === 0;
                if (isEmpty) {
                    const reason = isFootballQuotaExhausted()
                        ? 'quota'
                        : !footballService.isConfigured()
                          ? 'unconfigured'
                          : 'upstream_empty';
                    logger.warn(`[Events] fixture=${fixtureId} reason=${reason} source=api-football count=0`);
                }
                const ttl = isEmpty
                    ? (isLiveStatus ? this.TTL.LIVE_EVENT_INGEST : this.TTL.EMPTY)
                    : (isFinished ? this.TTL.FINISHED : this.TTL.LIVE_MATCH);
                const cacheEntry: MemoryCacheEntry<any> = {
                    data: events,
                    timestamp: Date.now(),
                    ttl,
                };
                await redisCacheService.set(redisKey, cacheEntry, ttl === Infinity ? 7 * 24 * 60 * 60 * 1000 : ttl);
                this.setBoundedCache(this.eventsCache, fixtureId, cacheEntry);

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
     * Synthetic 0–90 momentum series derived from cached events.
     * Redis TTL matches events: live ~30s, finished ~6h, empty/short otherwise.
     */
    async getMatchMomentum(
        fixtureId: number,
        options?: { forceRefresh?: boolean; language?: string | null },
    ): Promise<MomentumApiPayload> {
        const redisKey = footballMomentumRedisKey(fixtureId);
        const forceRefresh = options?.forceRefresh === true;

        if (!forceRefresh) {
            const cached = await redisCacheService.get<MomentumApiPayload>(redisKey);
            if (cached && typeof cached === 'object' && 'available' in cached) {
                return cached;
            }
        }

        const dbMatch = await prisma.cachedFixture.findUnique({
            where: { fixtureId },
        });
        const isFinished = !!dbMatch && ['FT', 'AET', 'PEN'].includes(dbMatch.status);
        const isLiveStatus =
            !!dbMatch &&
            ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT'].includes(dbMatch.status);

        const events = await this.getMatchEvents(fixtureId, {
            forceRefresh,
            language: options?.language,
        });

        let fixture: any = null;
        if (dbMatch) {
            try {
                fixture = matchCacheService.convertDbMatchToApiFormat(dbMatch);
            } catch {
                fixture = null;
            }
        }

        const payload = buildMomentumPayload({
            events: events ?? [],
            homeTeamId: fixture?.teams?.home?.id ?? dbMatch?.homeTeamId ?? null,
            awayTeamId: fixture?.teams?.away?.id ?? dbMatch?.awayTeamId ?? null,
            homeGoals: fixture?.goals?.home ?? dbMatch?.homeScore ?? null,
            awayGoals: fixture?.goals?.away ?? dbMatch?.awayScore ?? null,
            matchElapsed: fixture?.fixture?.status?.elapsed ?? dbMatch?.elapsed ?? null,
            finished: isFinished,
        });

        const isEmpty = !payload.available;
        const ttl = isEmpty
            ? isLiveStatus
                ? this.TTL.LIVE_EVENT_INGEST
                : this.TTL.EMPTY
            : isFinished
              ? this.TTL.FINISHED
              : this.TTL.LIVE_MATCH;

        await redisCacheService.set(redisKey, payload, ttl);
        return payload;
    }

    private detailsBundleCacheKey(fixtureId: number, language?: string | null): string {
        return footballDetailsLangRedisKey(
            fixtureId,
            resolveScores365AppLanguage(language ?? null),
        );
    }

    private emptyDetailsBundle() {
        return {
            fixture: null,
            lineups: [] as any[],
            statistics: [] as any[],
            events: [] as any[],
            venue: null as any,
        };
    }

    /**
     * Re-merge score-delta goals into a cached events list. Provider goals win; when the
     * feed has none, the synthetic set is rebuilt from the live snapshot's current score.
     */
    private async overlaySyntheticGoals(fixtureId: number, events: any[]): Promise<any[]> {
        const provider = events.filter((event: any) => event?._synthetic !== true);
        try {
            const { feedHasGoalEvents, mergeSyntheticGoalsIntoEvents } = await import(
                './synthetic-goals.service'
            );
            if (feedHasGoalEvents(provider)) return provider;
            const live = await readLiveFixtureById(fixtureId);
            const home = live?.teams?.home;
            const away = live?.teams?.away;
            if (!home?.id || !away?.id) return events;
            const merged = await mergeSyntheticGoalsIntoEvents(
                fixtureId,
                provider,
                {
                    home: { id: home.id, name: home.name ?? 'Home', logo: (home as any).logo ?? '' },
                    away: { id: away.id, name: away.name ?? 'Away', logo: (away as any).logo ?? '' },
                },
                { home: live?.goals?.home ?? null, away: live?.goals?.away ?? null },
            );
            return merged.events;
        } catch {
            return events;
        }
    }

    private bundleFromDbRow(durableRow: any): {
        fixture: any;
        lineups: any[];
        statistics: any[];
        events: any[];
        venue: any;
        lineupsAvailable: boolean;
        lineupsStatus: string | null;
    } | null {
        if (!durableRow) return null;
        const fixture = matchCacheService.convertDbMatchToApiFormat(durableRow);
        if (!fixture) return null;
        const fullData = durableRow.fullData as any;
        const durableLineups = Array.isArray(fullData?.lineups) ? fullData.lineups : [];
        // Drop pre-athleteId lineups so the bundle refreshes instead of latching them.
        const lineups = is365LineupIdMappingStale(durableLineups) ? [] : durableLineups;
        const events = Array.isArray(fullData?.events) ? fullData.events : [];
        const statistics = Array.isArray(fullData?.statistics) ? fullData.statistics : [];
        return {
            fixture,
            lineups,
            statistics,
            events,
            venue: fixture.fixture?.venue ?? null,
            lineupsAvailable: hasLineupData(lineups),
            lineupsStatus: fullData?.lineupsStatus ?? null,
        };
    }

    private canQueryApiFootball(fixtureId: number): boolean {
        return (
            !isScores365OnlyMode() &&
            canQueryApiFootballFixtureId(fixtureId) &&
            footballService.isConfigured() &&
            !isFootballQuotaExhausted()
        );
    }

    /** 365 is the primary provider; native gameIds always go there even if the experiment flag is off. */
    private prefersScores365(fixtureId: number): boolean {
        return isNative365FixtureId(fixtureId) || isScores365ExperimentEnabled();
    }

    private async tryScores365DetailsBundle(
        fixtureId: number,
        language: string | null | undefined,
        forceRefresh: boolean,
    ): Promise<{
        fixture: any;
        lineups: any[];
        statistics: any[];
        events: any[];
        venue: any | null;
        lineupsAvailable?: boolean;
        lineupsStatus?: string | null;
        eventsFeedAvailable?: boolean | null;
    } | null> {
        if (!this.prefersScores365(fixtureId)) return null;
        await ensureScores365GameMapping(fixtureId);
        const experiment = await getScores365ExperimentBundle(
            fixtureId,
            resolveScores365AppLanguage(language ?? null),
            { force: forceRefresh },
        );
        if (!experiment?.fixture) return null;

        const statusShort = experiment.fixture?.fixture?.status?.short ?? '';
        const finished = ['FT', 'AET', 'PEN'].includes(statusShort);
        let statistics = experiment.statistics ?? [];
        const events = experiment.events ?? [];
        if (!hasRichStatistics(statistics)) {
            // The warmer or `/statistics` may already hold the rich payload.
            const shared = await this.peek365Statistics(fixtureId);
            if (hasRichStatistics(shared)) statistics = shared as any[];
        }
        if (!hasApiStatistics(statistics) && events.length > 0) {
            statistics = buildFallbackStatisticsFromEvents(experiment.fixture, events);
        }
        this.mirror365BundleStatistics(fixtureId, statistics, finished);
        const lineups = hasLineupData(experiment.lineups)
            ? experiment.lineups
            : await this.get365LineupsMerged(
                fixtureId,
                resolveScores365AppLanguage(language ?? null),
                experiment.lineups,
                false,
            );
        const mergedLineups = hasLineupData(lineups) ? lineups : experiment.lineups;
        const payload = {
            fixture: experiment.fixture,
            lineups: mergedLineups,
            statistics: statistics ?? [],
            events,
            venue: experiment.venue,
            lineupsAvailable: hasLineupData(mergedLineups) || experiment.lineupsAvailable,
            lineupsStatus: experiment.lineupsStatus,
            eventsFeedAvailable: experiment.eventsFeedAvailable,
        };
        if (finished) {
            void this.updateFixtureFullData(fixtureId, {
                lineups: payload.lineups,
                events: payload.events,
                statistics: payload.statistics,
                _scores365GameId: (experiment.fixture as any)._scores365GameId,
                ...((experiment.fixture as any)._lmt
                    ? { _lmt: (experiment.fixture as any)._lmt }
                    : {}),
            });
        }
        return payload;
    }

    private async tryApiFootballDetailsBundle(apiFixtureId: number): Promise<{
        fixture: any;
        lineups: any[];
        statistics: any[];
        events: any[];
        venue: any | null;
        lineupsAvailable?: boolean;
        lineupsStatus?: string | null;
    } | null> {
        if (!this.canQueryApiFootball(apiFixtureId)) return null;
        try {
            const [fixture, lineups, statistics, events] = await Promise.all([
                footballService.getFixtureById(apiFixtureId),
                footballService.getFixtureLineupsResolved(apiFixtureId),
                footballService.getFixtureStatistics(apiFixtureId),
                footballService.getFixtureEvents(apiFixtureId, { source: 'job' }),
            ]);
            if (!fixture) return null;

            let venue: any | null = fixture?.fixture?.venue ?? null;
            const venueId = venue?.id;
            if (venueId && (!venue?.name || !venue?.city)) {
                try {
                    venue = (await footballService.getVenueInfo(venueId)) ?? venue;
                } catch {
                    // non-fatal
                }
            }
            return {
                fixture,
                lineups: lineups ?? [],
                statistics: statistics ?? [],
                events: events ?? [],
                venue,
                lineupsAvailable: hasLineupData(lineups),
                lineupsStatus: null,
            };
        } catch (err) {
            logger.warn(
                `[Details] API-Football fallback failed fixture=${apiFixtureId}:`,
                (err as Error)?.message,
            );
            return null;
        }
    }

    private rememberDetailsBundle(cacheKey: string, payload: any): void {
        if (!payload?.fixture) return;
        const status = payload.fixture?.fixture?.status?.short ?? '';
        const kickoffMs =
            typeof payload.fixture?.fixture?.timestamp === 'number'
                ? payload.fixture.fixture.timestamp * 1000
                : null;
        const entry: MemoryCacheEntry<any> = {
            data: payload,
            timestamp: Date.now(),
            ttl: this.detailTtlMs(status, kickoffMs),
        };
        this.setBoundedCache(this.detailsBundleLocal, cacheKey, entry);
        void redisCacheService.set(cacheKey, entry, this.DETAILS_KEEP_MS);
        const id = Number(payload.fixture?.fixture?.id);
        if (Number.isFinite(id) && id > 0) {
            const unprefixed = footballDetailsRedisKey(id);
            if (unprefixed !== cacheKey) {
                this.setBoundedCache(this.detailsBundleLocal, unprefixed, entry);
                void redisCacheService.set(unprefixed, entry, this.DETAILS_KEEP_MS);
            }
        }
    }

    private async readCachedDetailsBundle(
        cacheKey: string,
    ): Promise<MemoryCacheEntry<any> | null> {
        const local = this.detailsBundleLocal.get(cacheKey);
        if (local?.data?.fixture && !is365LineupIdMappingStale(local.data.lineups)) return local;
        if (local) this.detailsBundleLocal.delete(cacheKey);
        const redisCached = await redisCacheService.get<MemoryCacheEntry<any>>(cacheKey);
        if (redisCached?.data?.fixture) {
            if (is365LineupIdMappingStale(redisCached.data.lineups)) {
                await redisCacheService.del(cacheKey);
                return null;
            }
            this.setBoundedCache(this.detailsBundleLocal, cacheKey, redisCached);
            return redisCached;
        }
        return null;
    }

    private scheduleDetailsRefresh(
        fixtureId: number,
        language: string | null | undefined,
        cacheKey: string,
    ): void {
        if (this.detailsBackgroundRefresh.has(cacheKey)) return;
        this.detailsBackgroundRefresh.add(cacheKey);
        void this.buildFreshDetailsBundle(fixtureId, { language, forceRefresh: false })
            .then((payload) => {
                if (payload?.fixture) this.rememberDetailsBundle(cacheKey, payload);
            })
            .catch((err) => {
                logger.warn(
                    `[DetailsSWR] background refresh ${fixtureId} failed:`,
                    (err as Error)?.message,
                );
            })
            .finally(() => this.detailsBackgroundRefresh.delete(cacheKey));
    }

    /**
     * Match details: always paint from last-good cache/DB within milliseconds.
     * 365/API refresh runs in the background (or up to 2.5s on a true cold miss).
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
        lineupsAvailable?: boolean;
        lineupsStatus?: string | null;
        eventsFeedAvailable?: boolean | null;
    }> {
        const language = resolveScores365AppLanguage(options?.language ?? null);
        const cacheKey = this.detailsBundleCacheKey(fixtureId, language);
        const forceRefresh =
            options?.forceRefresh === true ||
            (isScores365ExperimentFixture(fixtureId) && is365StoreDetailsHotfix());

        if (!forceRefresh) {
            const cached = await this.readCachedDetailsBundle(cacheKey);
            if (cached?.data?.fixture) {
                if (Date.now() - cached.timestamp >= cached.ttl) {
                    this.scheduleDetailsRefresh(fixtureId, language, cacheKey);
                }
                return cached.data;
            }
            const unprefixed = await this.readCachedDetailsBundle(
                footballDetailsRedisKey(fixtureId),
            );
            if (unprefixed?.data?.fixture) {
                this.scheduleDetailsRefresh(fixtureId, language, cacheKey);
                return unprefixed.data;
            }
        }

        const durableRow = await prisma.cachedFixture.findUnique({
            where: { fixtureId },
        });
        let stub = this.bundleFromDbRow(durableRow);
        try {
            const liveFx = await readLiveFixtureById(fixtureId);
            if (liveFx) {
                stub = stub
                    ? { ...stub, fixture: liveFx, venue: liveFx.fixture?.venue ?? stub.venue }
                    : {
                          fixture: liveFx,
                          lineups: [],
                          statistics: [],
                          events: [],
                          venue: liveFx.fixture?.venue ?? null,
                          lineupsAvailable: false,
                          lineupsStatus: null,
                      };
            }
        } catch {
            // Redis live snapshot is optional
        }

        if (!forceRefresh && stub?.fixture) {
            this.rememberDetailsBundle(cacheKey, stub);
            const statusShort =
                stub.fixture?.fixture?.status?.short ?? durableRow?.status ?? '';
            const finished = TERMINAL_LATCH_STATUSES.includes(statusShort);
            if (finished && (await isTerminalLatched(fixtureId))) {
                // P1-7: never schedule background refresh for latched terminal fixtures.
            } else if (!(finished && (hasLineupData(stub.lineups) || stub.events.length > 0))) {
                this.scheduleDetailsRefresh(fixtureId, language, cacheKey);
            }
            return stub;
        }

        let freshPromise = this.pendingDetailsBundles.get(cacheKey);
        if (!freshPromise) {
            freshPromise = this.buildFreshDetailsBundle(fixtureId, { language, forceRefresh }).finally(
                () => {
                    this.pendingDetailsBundles.delete(cacheKey);
                },
            );
            this.pendingDetailsBundles.set(cacheKey, freshPromise);
        }

        const budget = new Promise<null>((resolve) => {
            setTimeout(() => resolve(null), this.DETAILS_UPSTREAM_BUDGET_MS).unref?.();
        });
        const raced = await Promise.race([freshPromise, budget]);
        if (raced?.fixture) {
            this.rememberDetailsBundle(cacheKey, raced);
            return raced;
        }
        void freshPromise.then((payload) => {
            if (payload?.fixture) this.rememberDetailsBundle(cacheKey, payload);
        });
        return stub ?? this.emptyDetailsBundle();
    }

    private async buildFreshDetailsBundle(
        fixtureId: number,
        options?: { language?: string | null; forceRefresh?: boolean },
    ): Promise<{
        fixture: any | null;
        lineups: any[];
        statistics: any[];
        events: any[];
        venue: any | null;
        lineupsAvailable?: boolean;
        lineupsStatus?: string | null;
        eventsFeedAvailable?: boolean | null;
    }> {
        const durableRow = await prisma.cachedFixture.findUnique({
            where: { fixtureId },
        });
        if (
            isWorldCupHistoricalOnlyMode() &&
            durableRow?.leagueId === getWorldCupLeagueId() &&
            isPastOrFinishedFixture(durableRow.status, durableRow.matchDate)
        ) {
            const fullData = durableRow.fullData as any;
            const fixture = matchCacheService.convertDbMatchToApiFormat(durableRow);
            const lineups = Array.isArray(fullData?.lineups) ? fullData.lineups : [];
            return {
                fixture,
                lineups,
                statistics: Array.isArray(fullData?.statistics) ? fullData.statistics : [],
                events: Array.isArray(fullData?.events) ? fullData.events : [],
                venue: fixture.fixture?.venue ?? null,
                lineupsAvailable: hasLineupData(lineups),
                lineupsStatus: fullData?.lineupsStatus ?? null,
            };
        }

        const durableFull = durableRow?.fullData as any;
        const durableLineups = Array.isArray(durableFull?.lineups) ? durableFull.lineups : [];
        const durableEvents = Array.isArray(durableFull?.events) ? durableFull.events : [];
        if (
            !options?.forceRefresh &&
            !is365StoreDetailsHotfix() &&
            durableRow &&
            ['FT', 'AET', 'PEN'].includes(durableRow.status ?? '') &&
            (hasLineupData(durableLineups) || durableEvents.length > 0)
        ) {
            const fixture = matchCacheService.convertDbMatchToApiFormat(durableRow);
            return {
                fixture,
                lineups: durableLineups,
                statistics: Array.isArray(durableFull?.statistics) ? durableFull.statistics : [],
                events: durableEvents,
                venue: fixture.fixture?.venue ?? null,
                lineupsAvailable: hasLineupData(durableLineups),
                lineupsStatus: durableFull?.lineupsStatus ?? null,
            };
        }

        const langKey = this.detailsBundleCacheKey(fixtureId, options?.language);
        const forceRefresh =
            options?.forceRefresh === true ||
            (isScores365ExperimentFixture(fixtureId) && is365StoreDetailsHotfix());

        const from365 = await this.tryScores365DetailsBundle(
            fixtureId,
            options?.language,
            forceRefresh,
        );
        if (from365?.fixture) {
            logger.debug(`[Details] fixture=${fixtureId} source=365`);
            this.rememberDetailsBundle(langKey, from365);
            return from365;
        }

        let apiId: number | null = this.canQueryApiFootball(fixtureId) ? fixtureId : null;
        if (!apiId && isNative365FixtureId(fixtureId)) {
            const mapped = await resolveApiFixtureIdFor365GameId(fixtureId);
            if (mapped && mapped !== fixtureId && this.canQueryApiFootball(mapped)) {
                apiId = mapped;
            }
        }

        if (apiId) {
            logger.warn(
                `[Details] fixture=${fixtureId} 365 miss — API-Football fallback apiId=${apiId}`,
            );
            const fromApi = await this.tryApiFootballDetailsBundle(apiId);
            if (fromApi?.fixture) {
                if (apiId !== fixtureId && fromApi.fixture?.fixture) {
                    fromApi.fixture.fixture.id = fixtureId;
                    (fromApi.fixture as any)._scores365GameId = fixtureId;
                }
                this.rememberDetailsBundle(langKey, fromApi);
                return fromApi;
            }
        }

        if (durableRow) {
            const fixture = matchCacheService.convertDbMatchToApiFormat(durableRow);
            const fullData = durableRow.fullData as any;
            const payload = {
                fixture,
                lineups: Array.isArray(fullData?.lineups) ? fullData.lineups : [],
                statistics: Array.isArray(fullData?.statistics) ? fullData.statistics : [],
                events: Array.isArray(fullData?.events) ? fullData.events : [],
                venue: fixture.fixture?.venue ?? null,
                lineupsAvailable: hasLineupData(fullData?.lineups),
                lineupsStatus: fullData?.lineupsStatus ?? null,
            };
            if (payload.fixture) this.rememberDetailsBundle(langKey, payload);
            return payload;
        }

        return { fixture: null, lineups: [], statistics: [], events: [], venue: null };
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

    getInProcessCacheSizes(): {
        lineups: number;
        statistics: number;
        events: number;
        standings: number;
        matchesByDateLocal: number;
    } {
        return {
            lineups: this.lineupsCache.size,
            statistics: this.statisticsCache.size,
            events: this.eventsCache.size,
            standings: this.standingsCache.size,
            matchesByDateLocal: this.matchesByDateLocal.size,
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
        this.matchesByDateLocal.clear();
        this.standingsRefreshes.clear();
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
            this.setBoundedCache(this.teamStatisticsCache, cacheKey, redisCached);
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
        this.setBoundedCache(this.teamStatisticsCache, cacheKey, entry);
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
            this.setBoundedCache(this.topScorersCache, cacheKey, redisCached);
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
        this.setBoundedCache(this.topScorersCache, cacheKey, entry);
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
            this.setBoundedCache(this.topAssistsCache, cacheKey, redisCached);
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
        this.setBoundedCache(this.topAssistsCache, cacheKey, entry);
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
            this.setBoundedCache(this.topYellowCardsCache, cacheKey, redisCached);
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
        this.setBoundedCache(this.topYellowCardsCache, cacheKey, entry);
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
            this.setBoundedCache(this.topRedCardsCache, cacheKey, redisCached);
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
        this.setBoundedCache(this.topRedCardsCache, cacheKey, entry);
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
            this.setBoundedCache(this.injuriesCache, teamId, redisCached);
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
        this.setBoundedCache(this.injuriesCache, teamId, entry);
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
            this.setBoundedCache(this.trophiesCache, teamId, redisCached);
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
        this.setBoundedCache(this.trophiesCache, teamId, entry);
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
            this.setBoundedCache(this.coachesCache, teamId, redisCached);
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
        this.setBoundedCache(this.coachesCache, teamId, entry);
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
            this.setBoundedCache(this.venuesCache, venueId, redisCached);
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
        this.setBoundedCache(this.venuesCache, venueId, entry);
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
            this.setBoundedCache(this.roundsCache, cacheKey, redisCached);
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
        this.setBoundedCache(this.roundsCache, cacheKey, entry);
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

    private durable365StandingsSeason(competitionId: number): number {
        return competitionId === getScores365CompetitionId()
            ? getWorldCupSeason()
            : new Date().getUTCFullYear();
    }

    async getCached365Standings(
        competitionId?: number,
        language?: string | null,
        options?: { force?: boolean },
    ): Promise<ThreeSixFiveResult<ThreeSixFiveStandingRow[]>> {
        const resolvedCompetitionId = competitionId ?? getScores365CompetitionId();
        const resolvedLanguage = resolveScores365AppLanguage(language);
        const season = this.durable365StandingsSeason(resolvedCompetitionId);
        let durableRaw: ThreeSixFiveStandingRow[] | null = null;
        let durableUpdatedAt: Date | null = null;
        try {
            const row = await prisma.cachedStandings.findUnique({
                where: {
                    provider_competitionId_season_language: {
                        provider: '365scores',
                        competitionId: resolvedCompetitionId,
                        season,
                        language: resolvedLanguage,
                    },
                },
                select: { payload: true, updatedAt: true },
            });
            const raw = (row?.payload as { raw?: unknown } | null)?.raw;
            durableRaw = Array.isArray(raw) ? (raw as ThreeSixFiveStandingRow[]) : null;
            durableUpdatedAt = row?.updatedAt ?? null;
        } catch {
            // Migration may not be deployed yet; upstream behavior remains unchanged.
        }

        if (
            durableRaw?.length &&
            isWorldCupHistoricalOnlyMode() &&
            resolvedCompetitionId === getScores365CompetitionId()
        ) {
            return { data: durableRaw, source: '365scores' };
        }
        if (!this.is365WorldCupSecondaryEnabled()) {
            return durableRaw?.length
                ? { data: durableRaw, source: '365scores' }
                : { data: null, source: null };
        }

        if (
            !options?.force &&
            durableRaw?.length &&
            durableUpdatedAt &&
            isStandingsSwrEnabled()
        ) {
            const age = Date.now() - durableUpdatedAt.getTime();
            if (age <= standingsFreshMs()) {
                return { data: durableRaw, source: '365scores' };
            }
            if (age <= standingsFreshMs() + standingsStaleMs()) {
                this.scheduleRaw365StandingsRefresh(
                    resolvedCompetitionId,
                    season,
                    resolvedLanguage,
                );
                return { data: durableRaw, source: '365scores' };
            }
        }

        const lease = await withSyncLeaderLease(
            `standings:${resolvedCompetitionId}:${season}:${resolvedLanguage}`,
            () => this.refreshRaw365Standings(
                resolvedCompetitionId,
                season,
                resolvedLanguage,
            ),
            { ttlSec: 30 },
        );
        if (lease.acquired && lease.value?.data?.length) return lease.value;
        return durableRaw?.length
            ? { data: durableRaw, source: '365scores' }
            : (lease.value ?? { data: null, source: null });
    }

    private scheduleRaw365StandingsRefresh(
        competitionId: number,
        season: number,
        language: string,
    ): void {
        const refreshKey = `${competitionId}:${season}:${language}:raw`;
        if (this.standingsRefreshes.has(refreshKey)) return;
        this.standingsRefreshes.add(refreshKey);
        void withSyncLeaderLease(
            `standings:${competitionId}:${season}:${language}`,
            () => this.refreshRaw365Standings(competitionId, season, language),
            { ttlSec: 30 },
        )
            .catch((error) => logger.warn(`[365Standings] background refresh failed:`, error))
            .finally(() => this.standingsRefreshes.delete(refreshKey));
    }

    private async refreshRaw365Standings(
        competitionId: number,
        season: number,
        language: string,
    ): Promise<ThreeSixFiveResult<ThreeSixFiveStandingRow[]>> {
        const result = await threeSixFiveScoresService.getStandings(
            competitionId,
            language,
            { force: true },
        );
        if (result.data?.length) {
            try {
                const existing = await prisma.cachedStandings.findUnique({
                    where: {
                        provider_competitionId_season_language: {
                            provider: '365scores',
                            competitionId,
                            season,
                            language,
                        },
                    },
                    select: { payload: true },
                });
                const payload = {
                    ...((existing?.payload as Record<string, unknown> | null) ?? {}),
                    raw: result.data,
                };
                await prisma.cachedStandings.upsert({
                    where: {
                        provider_competitionId_season_language: {
                            provider: '365scores',
                            competitionId,
                            season,
                            language,
                        },
                    },
                    create: {
                        provider: '365scores',
                        competitionId,
                        leagueId:
                            competitionId === getScores365CompetitionId()
                                ? getWorldCupLeagueId()
                                : SCORES365_LEAGUE_ID_OFFSET + competitionId,
                        season,
                        language,
                        payload: payload as any,
                        source: '365scores',
                    },
                    update: {
                        payload: payload as any,
                        source: '365scores',
                        updatedAt: new Date(),
                    },
                });
                await this.cacheChangedTeamsFromStandings(
                    map365StandingRowsToApiGroups(result.data).flat,
                );
            } catch (error) {
                logger.warn('[365Standings] durable raw write unavailable:', error);
            }
        }
        return result;
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

    /**
     * Match-details form: H2H first, then competitor finished matches when
     * recentGames are empty or the fixture is unmapped.
     */
    async getCached365FixtureForm(
        fixtureId: number,
        language?: string | null,
    ): Promise<ThreeSixFiveResult<ThreeSixFiveHeadToHeadForm> & { scores365GameId?: number | null }> {
        const gameId =
            (await ensureScores365GameMapping(fixtureId)) ??
            getScores365GameIdForFixture(fixtureId);

        let form: ThreeSixFiveHeadToHeadForm | null = null;
        let source: '365scores' | null = null;
        if (gameId) {
            const h2h = await this.getCached365HeadToHeadForm(gameId, language);
            form = h2h.data;
            source = h2h.source;
            if (!form) {
                const retry = await this.getCached365HeadToHeadForm(gameId, language);
                form = retry.data;
                source = retry.source ?? source;
            }
        }

        const ids = await this.resolve365FormCompetitorIds(fixtureId, form);
        const homeEmpty = !(form?.home?.recentGames?.length);
        const awayEmpty = !(form?.away?.recentGames?.length);
        const meetingsEmpty = !(form?.meetings?.length);

        if ((homeEmpty || awayEmpty || meetingsEmpty) && (ids.home || ids.away)) {
            const [homePack, awayPack] = await Promise.all([
                ids.home
                    ? this.recent365GamesForCompetitor(ids.home, language)
                    : Promise.resolve({ games: [] as unknown[], finished: [] as ThreeSixFiveCompetitorMatches['finished'] }),
                ids.away
                    ? this.recent365GamesForCompetitor(ids.away, language)
                    : Promise.resolve({ games: [] as unknown[], finished: [] as ThreeSixFiveCompetitorMatches['finished'] }),
            ]);

            let meetings = form?.meetings ?? [];
            if (meetingsEmpty && ids.home && ids.away) {
                meetings = homePack.finished
                    .filter(
                        (f) =>
                            f.teams?.home?.id === ids.away ||
                            f.teams?.away?.id === ids.away,
                    )
                    .slice(0, 10)
                    .map((f) => this.apiFixtureToRecent365Game(f)) as typeof meetings;
            }

            form = {
                home: ids.home
                    ? {
                          teamId: ids.home,
                          teamName:
                              form?.home?.teamName ||
                              this.competitorNameFromFinished(homePack.finished, ids.home) ||
                              '—',
                          recentGames: (homeEmpty
                              ? homePack.games
                              : form?.home?.recentGames ?? []) as any,
                      }
                    : form?.home ?? null,
                away: ids.away
                    ? {
                          teamId: ids.away,
                          teamName:
                              form?.away?.teamName ||
                              this.competitorNameFromFinished(awayPack.finished, ids.away) ||
                              '—',
                          recentGames: (awayEmpty
                              ? awayPack.games
                              : form?.away?.recentGames ?? []) as any,
                      }
                    : form?.away ?? null,
                meetings,
                homeCompetitorId: ids.home,
                awayCompetitorId: ids.away,
            };
            source = source ?? '365scores';
        }

        const hasAnything =
            (form?.home?.recentGames?.length ?? 0) > 0 ||
            (form?.away?.recentGames?.length ?? 0) > 0 ||
            (form?.meetings?.length ?? 0) > 0;
        if (!hasAnything) {
            return { data: null, source, scores365GameId: gameId };
        }
        return { data: form, source: source ?? '365scores', scores365GameId: gameId };
    }

    private apiFixtureToRecent365Game(f: {
        fixture: { id: number; date: string };
        league?: { id?: number; name?: string | null };
        teams: {
            home: { id: number; name: string };
            away: { id: number; name: string };
        };
        goals?: { home: number | null; away: number | null };
    }) {
        const leagueId = f.league?.id ?? 0;
        const competitionId =
            leagueId >= SCORES365_LEAGUE_ID_OFFSET
                ? leagueId - SCORES365_LEAGUE_ID_OFFSET
                : 0;
        return {
            id: f.fixture.id,
            startTime: f.fixture.date,
            statusGroup: 4,
            competitionId,
            competitionDisplayName: f.league?.name ?? undefined,
            homeCompetitor: {
                id: f.teams.home.id,
                name: f.teams.home.name,
                score: f.goals?.home ?? 0,
            },
            awayCompetitor: {
                id: f.teams.away.id,
                name: f.teams.away.name,
                score: f.goals?.away ?? 0,
            },
        };
    }

    private competitorNameFromFinished(
        finished: ThreeSixFiveCompetitorMatches['finished'],
        competitorId: number,
    ): string | null {
        for (const f of finished) {
            if (f.teams?.home?.id === competitorId) return f.teams.home.name;
            if (f.teams?.away?.id === competitorId) return f.teams.away.name;
        }
        return null;
    }

    private async recent365GamesForCompetitor(
        competitorId: number,
        language?: string | null,
    ): Promise<{
        games: ReturnType<FootballDataCacheService['apiFixtureToRecent365Game']>[];
        finished: ThreeSixFiveCompetitorMatches['finished'];
    }> {
        const result = await this.getCached365CompetitorMatches(competitorId, language);
        const finished = result.data?.finished ?? [];
        return {
            games: finished.slice(0, 8).map((f) => this.apiFixtureToRecent365Game(f)),
            finished,
        };
    }

    private async resolve365FormCompetitorIds(
        fixtureId: number,
        form: ThreeSixFiveHeadToHeadForm | null,
    ): Promise<{ home: number | null; away: number | null }> {
        let home = form?.homeCompetitorId ?? form?.home?.teamId ?? null;
        let away = form?.awayCompetitorId ?? form?.away?.teamId ?? null;
        if (home && away) return { home, away };
        try {
            const row = await prisma.cachedFixture.findUnique({
                where: { fixtureId },
                select: { homeTeamId: true, awayTeamId: true, fullData: true },
            });
            const full = row?.fullData as {
                teams?: { home?: { id?: number }; away?: { id?: number } };
            } | null;
            home = home || row?.homeTeamId || full?.teams?.home?.id || null;
            away = away || row?.awayTeamId || full?.teams?.away?.id || null;
        } catch {
            // Mapping / DB miss is fine — competitor fallback just stays empty.
        }
        return { home: home || null, away: away || null };
    }

    // ─── 365 competitor (club / national team) profile wrappers ───────────────
    // These are a PRIMARY data source (not gated on the WC experiment): the
    // service layer owns Redis + Postgres caching; controllers call through here.

    async getCached365CompetitorInfo(
        competitorId: number,
        language?: string | null,
    ): Promise<ThreeSixFiveResult<ThreeSixFiveCompetitorInfo>> {
        return threeSixFiveScoresService.getCompetitorInfo(competitorId, language);
    }

    async getCached365CompetitorMatches(
        competitorId: number,
        language?: string | null,
    ): Promise<ThreeSixFiveResult<ThreeSixFiveCompetitorMatches>> {
        const startedAt = Date.now();
        try {
            const result = await threeSixFiveScoresService.getCompetitorMatches(competitorId, language);
            const { addBreadcrumb, captureMessage } = await import('../config/sentry.config');
            addBreadcrumb(
                'H2H competitor-matches lookup',
                'match-details.h2h',
                'info',
                {
                    competitorId,
                    cacheHit: result.cacheHit === true,
                    latencyMs: Date.now() - startedAt,
                    finished: result.data?.finished?.length ?? 0,
                },
            );
            if (!result.data) {
                captureMessage(
                    `[MatchDetails] competitor-matches empty/failed id=${competitorId}`,
                    'warning',
                );
            } else if (!result.cacheHit && Date.now() - startedAt > 3_000) {
                captureMessage(
                    `[MatchDetails] competitor-matches slow (${Date.now() - startedAt}ms) id=${competitorId}`,
                    'warning',
                );
            }
            return result;
        } catch (err: unknown) {
            const { captureException } = await import('../config/sentry.config');
            captureException(err instanceof Error ? err : new Error(String(err)), {
                competitorId,
                path: 'getCached365CompetitorMatches',
            });
            throw err;
        }
    }

    async getCached365CompetitorTransfers(
        competitorId: number,
        language?: string | null,
    ): Promise<ThreeSixFiveResult<ThreeSixFiveCompetitorTransfers>> {
        return threeSixFiveScoresService.getCompetitorTransfers(competitorId, language);
    }

    async getCached365CompetitorStats(
        competitorId: number,
        competitionId: number,
        language?: string | null,
    ): Promise<ThreeSixFiveResult<ThreeSixFiveCompetitorStats>> {
        return threeSixFiveScoresService.getCompetitorStats(competitorId, competitionId, language);
    }

    async getCached365CompetitorSquad(
        competitorId: number,
        language?: string | null,
    ): Promise<ThreeSixFiveResult<ThreeSixFiveCompetitorSquad>> {
        return threeSixFiveScoresService.getCompetitorSquad(competitorId, language);
    }

    async getCached365CompetitorCoach(
        competitorId: number,
        language?: string | null,
    ): Promise<ThreeSixFiveResult<ThreeSixFiveCoach>> {
        return threeSixFiveScoresService.getCompetitorCoach(competitorId, language);
    }

    async searchFootballEntities(
        query: string,
        language?: string | null,
    ): Promise<ThreeSixFiveResult<ThreeSixFiveSearchResults>> {
        return threeSixFiveScoresService.searchEntities(query, language);
    }

    async getCached365AthleteProfile(
        athleteId: number,
        language?: string | null,
    ): Promise<ThreeSixFiveResult<ThreeSixFiveAthleteProfile>> {
        return threeSixFiveScoresService.getAthleteProfile(athleteId, language);
    }

    async getCached365CompetitionProfile(
        competitionId: number,
        language?: string | null,
    ): Promise<ThreeSixFiveResult<ThreeSixFiveCompetitionProfile>> {
        return threeSixFiveScoresService.getCompetitionProfile(competitionId, language);
    }

    async getCached365CompetitionTransfers(
        competitionIds: number[],
        language?: string | null,
    ): Promise<ThreeSixFiveResult<ThreeSixFiveCompetitionTransfers[]>> {
        return threeSixFiveScoresService.getTransfersByCompetitions(competitionIds, language);
    }

    async getCached365PlayerMatchReport(
        athleteId: number,
        gameId: number,
        language?: string | null,
    ): Promise<ThreeSixFiveResult<ThreeSixFivePlayerMatchReport>> {
        if (!this.is365WorldCupSecondaryEnabled()) {
            return { data: null, source: null };
        }
        const result = await threeSixFiveScoresService.getPlayerMatchReport(athleteId, gameId, language);
        if (result.data) {
            void this.invalidate365PlayerCareer(athleteId, language);
        }
        return result;
    }

    /**
     * Drop cached career (Redis + Postgres) so the next view pulls fresh 365 data.
     *
     * Every language is invalidated, not just the caller's: this runs when the
     * player actually played — a new appearance, goals, maybe a trophy — and
     * that is equally true of the Arabic and the English payload. Passing a
     * langId here would have cleared one tier for one language and the table
     * for all of them.
     */
    async invalidate365PlayerCareer(athleteId: number, _language?: string | null): Promise<void> {
        try {
            await threeSixFiveScoresService.invalidatePlayerCareerCache(athleteId);
        } catch (err: any) {
            logger.warn(`[365Career] Redis invalidate ${athleteId} failed:`, err?.message);
        }
        try {
            await prisma.cached365PlayerCareer.deleteMany({ where: { athleteId } });
        } catch (err: any) {
            logger.warn(`[365Career] DB invalidate ${athleteId} failed:`, err?.message);
        }
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
        const langId = resolveScores365LangId(language);

        // 1. Postgres — serve a fresh row immediately; refresh stale rows in background.
        //    Keyed by (athleteId, langId): the row holds provider labels in one
        //    language, so the other language's row is a different row, not a
        //    miss to be overwritten.
        try {
            const dbRow = await prisma.cached365PlayerCareer.findUnique({
                where: { athleteId_langId: { athleteId, langId } },
            });
            if (dbRow?.data) {
                const age = Date.now() - dbRow.updatedAt.getTime();
                const data = dbRow.data as unknown as ThreeSixFivePlayerCareer;
                const hasNewShape = Array.isArray(data.currentSeasonHighlights);
                if (data.seasons?.length && hasNewShape && age < CAREER_DB_MAX_AGE_MS) {
                    return { data, source: '365scores' };
                }
                if (data.seasons?.length && hasNewShape) {
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

    /**
     * Fetch one athlete's career from 365 IN A GIVEN LANGUAGE and persist it.
     *
     * `langId` is passed through to the provider rather than re-derived from
     * `language`, so the row's `langId` column always describes the payload
     * actually stored. Public so a cache warmer can fill a language the app's
     * own traffic has not visited — see scripts/warm-365-career-cache.ts.
     */
    async refresh365PlayerCareer(
        athleteId: number,
        language: string | null | undefined,
        langId: number,
    ): Promise<ThreeSixFiveResult<ThreeSixFivePlayerCareer>> {
        const result = await threeSixFiveScoresService.getPlayerCareer(athleteId, language, { langId });
        if (!result.data?.seasons?.length) {
            try {
                // Language-scoped: an empty English fetch must not delete the
                // Arabic row (or the reverse), which is a different payload
                // from a different upstream call.
                await prisma.cached365PlayerCareer.deleteMany({ where: { athleteId, langId } });
            } catch {
                /* ignore purge errors */
            }
            return { data: null, source: null };
        }

        try {
            await prisma.cached365PlayerCareer.upsert({
                where: { athleteId_langId: { athleteId, langId } },
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

    /**
     * Search by name (or athleteId) and return 365 profile + career in one response.
     */
    async lookup365Player(
        query: string,
        language?: string | null,
        options?: {
            athleteId?: number;
            limit?: number;
            includeInfo?: boolean;
            includeCareer?: boolean;
        },
    ): Promise<ThreeSixFiveResult<ThreeSixFivePlayerLookupResult>> {
        const includeInfo = options?.includeInfo !== false;
        const includeCareer = options?.includeCareer !== false;
        const limit = Math.min(Math.max(options?.limit ?? 1, 1), 5);

        try {
            let candidates: ThreeSixFiveSearchAthlete[] = [];

            if (options?.athleteId != null && !Number.isNaN(options.athleteId)) {
                candidates = [
                    {
                        athleteId: options.athleteId,
                        name: '',
                        shortName: '',
                        clubName: null,
                        clubId: null,
                        nationalityId: null,
                        sportId: 1,
                        imageVersion: null,
                        imageUrl: buildScores365AthletePhotoUrl(options.athleteId, 68),
                    },
                ];
            } else {
                const trimmed = query.trim();
                if (trimmed.length < 2) {
                    return { data: { query: trimmed, players: [] }, source: '365scores' };
                }
                const search = await threeSixFiveScoresService.searchAthletes(trimmed, language);
                if (!search.data) {
                    return { data: null, source: null };
                }
                if (!search.data.length) {
                    return { data: { query: trimmed, players: [] }, source: '365scores' };
                }
                candidates = search.data.slice(0, limit);
            }

            const players = await Promise.all(
                candidates.map(async (candidate) => {
                    const [infoResult, careerResult] = await Promise.all([
                        includeInfo
                            ? this.getCached365PlayerBasicInfo(candidate.athleteId, language)
                            : Promise.resolve({ data: null, source: '365scores' as const }),
                        includeCareer
                            ? this.getCached365PlayerCareer(candidate.athleteId, language)
                            : Promise.resolve({ data: null, source: '365scores' as const }),
                    ]);

                    const info = infoResult.data;
                    const career = careerResult.data;

                    return {
                        athleteId: candidate.athleteId,
                        name: info?.name ?? candidate.name,
                        shortName: info?.shortName ?? candidate.shortName,
                        clubName: info?.club ?? candidate.clubName,
                        clubId: candidate.clubId,
                        nationalityId: candidate.nationalityId,
                        imageUrl:
                            info?.imageUrl ??
                            candidate.imageUrl ??
                            career?.profile.imageUrl ??
                            null,
                        info,
                        career,
                    };
                }),
            );

            return {
                data: { query: query.trim(), players },
                source: '365scores',
            };
        } catch (err: unknown) {
            logger.error('[365Scores] lookup365Player failed:', (err as Error)?.message);
            return { data: null, source: null };
        }
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
            // `p.id` already carries the athleteId from the structured mapper; the raw
            // roster row id survives as `scores365MemberId` for the member-side join.
            const memberId = (p.scores365MemberId ?? p.id) as number;
            const hit =
                byMemberId.get(memberId) ??
                byAthleteId.get(p.id as number) ??
                byName.get(norm(p.name as string)) ??
                byShortName.get(norm(p.name as string));
            if (!hit) {
                // Log the join miss — never silently drop the player.
                logger.warn(
                    `[Lineups365Join] fixture=${fixtureId ?? '?'} memberId=${memberId} name="${p.name}" — no match in named lineup (athleteId/name join miss); rendering with partial data`,
                );
                // Return the player as-is — preserve whatever name/data we already have.
                return entry;
            }
            const keepStructuredPhoto =
                hit.athleteId > 0 && p.athleteId === hit.athleteId && typeof p.photo === 'string';
            return {
                ...entry,
                player: {
                    ...p,
                    id: hit.athleteId,
                    athleteId: hit.athleteId,
                    scores365MemberId: hit.memberId,
                    name: hit.name || p.name,
                    photo: keepStructuredPhoto ? p.photo : (hit.imageUrl ?? p.photo ?? null),
                    number: hit.jerseyNumber ?? p.number,
                    // The structured mapper already resolved G/D/M/F; the named feed's
                    // label may be localized, so only parse it when nothing else exists.
                    pos: p.pos ?? posFrom365(hit.position) ?? null,
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
        if (!isScores365ExperimentFixture(fixtureId) && !isNative365FixtureId(fixtureId)) {
            return [];
        }

        let structured = baseLineups;
        if (!hasLineupData(structured) || forceRefresh) {
            // Lineups only need the game payload; team stats would just be another 365 call.
            const bundle = await getScores365ExperimentBundle(
                fixtureId,
                resolveScores365AppLanguage(language),
                { force: forceRefresh, skipTeamStats: true },
            );
            structured = bundle?.lineups;
        }
        if (!hasLineupData(structured)) return [];

        const appLang = resolveScores365AppLanguage(language);
        let named = await this.getCached365LineupsWithNames(fixtureId, language);
        if (!named.data?.length && appLang !== 'en') {
            named = await this.getCached365LineupsWithNames(fixtureId, 'en');
        }
        const merged = named.data?.length
            ? this.merge365NamesIntoLineups(structured ?? [], named.data, fixtureId)
            : (structured ?? []);

        const isConfirmed = (merged as any[]).some((side: any) => side?._lineupsConfirmed);
        const startersHome = (merged[0]?.startXI ?? []).length;
        const startersAway = (merged[1]?.startXI ?? []).length;

        if (isConfirmed && (startersHome < 11 || startersAway < 11)) {
            logger.warn(
                `[365LineupsMerged] fixture=${fixtureId}: confirmed lineup incomplete — home=${startersHome} away=${startersAway} — serving immediately`,
            );
            await redisCacheService.set(`lineups:${fixtureId}:incomplete`, true, 60_000);
            void import('../config/sentry.config').then(({ addBreadcrumb }) =>
                addBreadcrumb('lineups incomplete served', 'match-details.lineups', 'warning', {
                    fixtureId,
                    startersHome,
                    startersAway,
                }),
            );
            return this.finalize365MergedLineups(
                fixtureId,
                merged.map((s: any) => ({ ...s, _incomplete: true })),
            );
        }

        logger.debug(
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
