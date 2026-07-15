/**
 * Match Cache Service
 * 
 * Provides intelligent caching for football matches:
 * - Finished matches → Stored permanently in PostgreSQL
 * - Live matches → Cached in memory with short TTL
 * - Scheduled matches → Cached in memory with medium TTL
 * 
 * This minimizes API calls by:
 * 1. Never re-fetching finished matches from API
 * 2. Sharing cached data across all users
 * 3. Using single batch requests with from/to parameters
 */

import { CachedFixture } from '@prisma/client';
import { logger } from '../utils/logger';
import prisma from '../lib/prisma'; // ✅ Use centralized singleton

// Status codes for finished matches
const FINISHED_STATUSES = ['FT', 'AET', 'PEN', 'PST', 'CANC', 'ABD', 'AWD', 'WO'];

// Status codes for live matches
const LIVE_STATUSES = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT'];

// Cache TTL values
const CACHE_TTL = {
    LIVE: 3 * 1000,           // 3 seconds — aligned with matches tab + WS
    SCHEDULED: 5 * 60 * 1000, // 5 minutes for scheduled matches
    FINISHED: 24 * 60 * 60 * 1000, // 24h in RAM — durable copy lives in DB
};

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number;
}

interface FixtureFromAPI {
    fixture: {
        id: number;
        referee: string | null;
        timezone: string;
        date: string;
        timestamp: number;
        periods: {
            first: number | null;
            second: number | null;
        };
        venue: {
            id: number | null;
            name: string | null;
            city: string | null;
        };
        status: {
            long: string;
            short: string;
            elapsed: number | null;
        };
    };
    league: {
        id: number;
        name: string;
        country: string;
        logo: string;
        flag: string | null;
        season: number;
        round: string;
    };
    teams: {
        home: {
            id: number;
            name: string;
            logo: string;
            winner: boolean | null;
        };
        away: {
            id: number;
            name: string;
            logo: string;
            winner: boolean | null;
        };
    };
    goals: {
        home: number | null;
        away: number | null;
    };
    score: {
        halftime: {
            home: number | null;
            away: number | null;
        };
        fulltime: {
            home: number | null;
            away: number | null;
        };
        extratime: {
            home: number | null;
            away: number | null;
        };
        penalty: {
            home: number | null;
            away: number | null;
        };
    };
}

import { redisCacheService } from './redis-cache.service';

class MatchCacheService {
    // In-memory cache for live and scheduled matches (fallback)
    private memoryCache = new Map<string, CacheEntry<any>>();
    private readonly MAX_MEMORY_ENTRIES = 200;

    // Track which fixture IDs are already in database
    private dbFixtureIds = new Set<number>();

    // Last time we synced DB fixture IDs
    private lastDbSync = 0;
    private readonly DB_SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes

    // ✅ Request deduplication: prevent multiple simultaneous API calls for the same data
    private pendingRequests = new Map<string, Promise<FixtureFromAPI[]>>();

    private putMemory(key: string, entry: CacheEntry<any>): void {
        // Never hold Infinity TTL in process RAM
        if (!Number.isFinite(entry.ttl) || entry.ttl <= 0) {
            entry = { ...entry, ttl: CACHE_TTL.FINISHED };
        }
        if (!this.memoryCache.has(key) && this.memoryCache.size >= this.MAX_MEMORY_ENTRIES) {
            const oldest = this.memoryCache.keys().next().value;
            if (oldest !== undefined) this.memoryCache.delete(oldest);
        }
        this.memoryCache.set(key, entry);
    }

    constructor() {
        // Initial DB sync
        this.syncDbFixtureIds();
    }

    /**
     * Sync fixture IDs from database to memory for fast lookup.
     *
     * Performance: we only pull fixtures from the last 180 days — that's the
     * only window where an incoming API fixture could already be in the DB
     * (older ones are finished and won't get re-fetched). Capping this avoids
     * scanning the entire table on cold start.
     */
    private async syncDbFixtureIds(): Promise<void> {
        const now = Date.now();
        if (now - this.lastDbSync < this.DB_SYNC_INTERVAL) {
            return;
        }

        try {
            const cutoff = new Date(now - 180 * 24 * 60 * 60 * 1000); // 180 days ago
            const fixtures = await prisma.cachedFixture.findMany({
                where: { matchDate: { gte: cutoff } },
                select: { fixtureId: true },
                take: 5000,
            });

            this.dbFixtureIds.clear();
            fixtures.forEach((f) => this.dbFixtureIds.add(f.fixtureId));
            this.lastDbSync = now;

            logger.debug(`📦 Synced ${this.dbFixtureIds.size} fixture IDs from database (last 180d)`);
        } catch (error) {
            logger.error('Failed to sync fixture IDs from database:', error);
        }
    }

    /**
     * Check if a fixture is already stored in database
     */
    isFixtureInDb(fixtureId: number): boolean {
        return this.dbFixtureIds.has(fixtureId);
    }

    /**
     * Check if a fixture status indicates it's finished
     */
    isFinishedStatus(status: string): boolean {
        return FINISHED_STATUSES.includes(status);
    }

    /**
     * Check if a fixture status indicates it's live
     */
    isLiveStatus(status: string): boolean {
        return LIVE_STATUSES.includes(status);
    }

    /**
     * Get matches from cache (memory first, then Redis).
     */
    async getFromMemoryCache<T>(key: string): Promise<T | null> {
        const entry = this.memoryCache.get(key);
        if (entry) {
            if (Date.now() - entry.timestamp <= entry.ttl) {
                return entry.data;
            }
            this.memoryCache.delete(key);
        }

        const redisKey = `match:${key}`;
        try {
            const cached = await redisCacheService.get<CacheEntry<T>>(redisKey);
            if (cached) {
                return cached.data;
            }
        } catch {
            /* fall through */
        }

        return null;
    }

    /**
     * Set matches in cache (Redis first, then memory fallback)
     */
    async setInMemoryCache<T>(key: string, data: T, ttl: number): Promise<void> {
        const entry: CacheEntry<T> = {
            data,
            timestamp: Date.now(),
            ttl,
        };

        // In-process first so the next request on this instance never waits on Redis I/O.
        this.putMemory(key, entry);

        const redisKey = `match:${key}`;
        const redisTtl = Number.isFinite(ttl) && ttl > 0 ? ttl : CACHE_TTL.FINISHED;
        redisCacheService.set(redisKey, entry, redisTtl).catch((err) => {
            logger.warn(`match cache Redis set failed for ${key}:`, err);
        });
    }

    /**
     * Build Prisma create/update payloads from API fixture (full snapshot in fullData).
     */
    private buildFixtureDbPayload(fixture: FixtureFromAPI): { create: Record<string, unknown>; update: Record<string, unknown> } {
        const status = fixture.fixture.status.short;
        // A malformed fixture.date would make `new Date(...)` Invalid, which
        // Prisma rejects when writing the DateTime column (failing the whole
        // upsert). Fall back to the numeric timestamp, then to now.
        const parsedMatchDate = new Date(fixture.fixture.date);
        const matchDate = !Number.isNaN(parsedMatchDate.getTime())
            ? parsedMatchDate
            : fixture.fixture.timestamp
                ? new Date(fixture.fixture.timestamp * 1000)
                : new Date();
        const safeMatchDate = Number.isNaN(matchDate.getTime()) ? new Date() : matchDate;
        const base = {
            fixtureId: fixture.fixture.id,
            leagueId: fixture.league.id,
            leagueName: fixture.league.name,
            leagueLogo: fixture.league.logo,
            leagueCountry: fixture.league.country,
            leagueSeason: fixture.league.season,
            leagueRound: fixture.league.round,
            homeTeamId: fixture.teams.home.id,
            homeTeamName: fixture.teams.home.name,
            homeTeamLogo: fixture.teams.home.logo,
            awayTeamId: fixture.teams.away.id,
            awayTeamName: fixture.teams.away.name,
            awayTeamLogo: fixture.teams.away.logo,
            homeScore: fixture.goals.home,
            awayScore: fixture.goals.away,
            homeHalftimeScore: fixture.score?.halftime?.home ?? null,
            awayHalftimeScore: fixture.score?.halftime?.away ?? null,
            matchDate: safeMatchDate,
            matchTimestamp: fixture.fixture.timestamp,
            status,
            statusLong: fixture.fixture.status.long,
            elapsed: fixture.fixture.status.elapsed ?? null,
            venue: fixture.fixture.venue?.name ?? null,
            referee: fixture.fixture.referee,
            fullData: fixture as any,
        };
        return {
            create: base,
            update: { ...base, updatedAt: new Date() },
        };
    }

    /**
     * Upsert ALL fixtures (live, scheduled, finished) with complete API payload.
     * Calendar + match list can read historical dates from DB.
     */
    async upsertFixtures(
        fixtures: FixtureFromAPI[],
        options?: { fetchDetails?: boolean },
    ): Promise<number> {
        if (!fixtures.length) return 0;

        const fetchDetails =
            options?.fetchDetails === true && process.env.FETCH_MATCH_DETAILS === 'true';

        let upserted = 0;
        const CHUNK_SIZE = 25;
        for (let i = 0; i < fixtures.length; i += CHUNK_SIZE) {
            const chunk = fixtures.slice(i, i + CHUNK_SIZE);
            try {
                await prisma.$transaction(
                    chunk.map((fixture) => {
                        const { create, update } = this.buildFixtureDbPayload(fixture);
                        return prisma.cachedFixture.upsert({
                            where: { fixtureId: fixture.fixture.id },
                            create: create as any,
                            update: update as any,
                        });
                    }),
                );
                for (const fixture of chunk) {
                    this.dbFixtureIds.add(fixture.fixture.id);
                    upserted++;
                    if (fetchDetails && this.isFinishedStatus(fixture.fixture.status.short)) {
                        this.fetchAndStoreMatchDetails(fixture.fixture.id).catch((error) => {
                            logger.error(`Failed to fetch match details for fixture ${fixture.fixture.id}:`, error);
                        });
                    }
                }
            } catch (error) {
                logger.error(`Failed to upsert fixture chunk (${chunk.length} rows):`, error);
            }
        }

        if (upserted > 0) {
            logger.debug(`💾 Upserted ${upserted} fixtures to DB (live + scheduled + finished)`);
        }
        return upserted;
    }

    /**
     * All matches in DB for a calendar day (any status).
     * @param lightweight When true (default), omits fullData JSON — ~10x faster for list endpoints.
     */
    async getMatchesFromDbByDateRange(
        from: Date,
        to: Date,
        options: { lightweight?: boolean } = {},
    ): Promise<CachedFixture[]> {
        const lightweight = options.lightweight !== false;
        try {
            const matches = lightweight
                ? await prisma.cachedFixture.findMany({
                    where: { matchDate: { gte: from, lte: to } },
                    orderBy: { matchTimestamp: 'asc' },
                    select: {
                        id: true,
                        fixtureId: true,
                        leagueId: true,
                        leagueName: true,
                        leagueLogo: true,
                        leagueCountry: true,
                        leagueSeason: true,
                        leagueRound: true,
                        homeTeamId: true,
                        homeTeamName: true,
                        homeTeamLogo: true,
                        awayTeamId: true,
                        awayTeamName: true,
                        awayTeamLogo: true,
                        homeScore: true,
                        awayScore: true,
                        homeHalftimeScore: true,
                        awayHalftimeScore: true,
                        matchDate: true,
                        matchTimestamp: true,
                        status: true,
                        statusLong: true,
                        elapsed: true,
                        venue: true,
                        referee: true,
                        createdAt: true,
                        updatedAt: true,
                    },
                })
                : await prisma.cachedFixture.findMany({
                    where: { matchDate: { gte: from, lte: to } },
                    orderBy: { matchTimestamp: 'asc' },
                });
            logger.debug(
                `📦 Retrieved ${matches.length} fixtures from DB (${lightweight ? 'lightweight' : 'full'})`,
            );
            return matches as CachedFixture[];
        } catch (error) {
            logger.error('Failed to get matches from database by date:', error);
            return [];
        }
    }

    /**
     * Get finished matches from database for a date range
     */
    async getFinishedMatchesFromDb(from: Date, to: Date): Promise<CachedFixture[]> {
        try {
            const matches = await prisma.cachedFixture.findMany({
                where: {
                    matchDate: {
                        gte: from,
                        lte: to,
                    },
                    status: {
                        in: FINISHED_STATUSES,
                    },
                },
                orderBy: {
                    matchTimestamp: 'desc',
                },
            });

            logger.debug(`📦 Retrieved ${matches.length} finished matches from database`);
            return matches;
        } catch (error) {
            logger.error('Failed to get finished matches from database:', error);
            return [];
        }
    }

    /**
     * Archive finished matches to database
     * ✅ Automatically fetches and stores lineups, statistics, and events for finished matches
     * ✅ This ensures all match data is permanently cached (0 API calls for future requests)
     */
    async archiveFinishedMatches(fixtures: FixtureFromAPI[]): Promise<number> {
        const finished = fixtures.filter((f) => this.isFinishedStatus(f.fixture.status.short));
        return this.upsertFixtures(finished);
    }

    /**
     * ✅ Fetch and store match details (lineups, statistics, events) for finished matches
     * Retries up to 3 times with backoff when API returns empty payloads.
     */
    async handleMatchFinished(fixtureId: number): Promise<void> {
        await this.fetchAndStoreMatchDetailsWithRetry(fixtureId);
    }

    /**
     * Backfill FT fixtures missing events/lineups in fullData (rate-limited).
     */
    async backfillMissingMatchDetails(limit = 30): Promise<number> {
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const candidates = await prisma.cachedFixture.findMany({
            where: {
                status: { in: ['FT', 'AET', 'PEN'] },
                matchDate: { gte: weekAgo },
            },
            take: limit * 3,
            orderBy: { matchDate: 'desc' },
        });

        let processed = 0;
        for (const row of candidates) {
            if (processed >= limit) break;
            const fd = (row.fullData as Record<string, unknown>) || {};
            const hasEvents = Array.isArray(fd.events) && (fd.events as unknown[]).length > 0;
            const hasLineups = Array.isArray(fd.lineups) && (fd.lineups as unknown[]).length > 0;
            if (hasEvents && hasLineups) continue;

            await this.fetchAndStoreMatchDetailsWithRetry(row.fixtureId);
            processed++;
            // 365-aware path is heavier than raw API-Football — pace requests.
            await new Promise((r) => setTimeout(r, 700));
        }
        return processed;
    }

    private async fetchAndStoreMatchDetailsWithRetry(fixtureId: number, maxAttempts = 3): Promise<void> {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            await this.fetchAndStoreMatchDetails(fixtureId);

            const row = await prisma.cachedFixture.findUnique({
                where: { fixtureId },
                select: { fullData: true },
            });
            const fd = (row?.fullData as Record<string, unknown>) || {};
            const hasEvents = Array.isArray(fd.events) && (fd.events as unknown[]).length > 0;
            const hasLineups = Array.isArray(fd.lineups) && (fd.lineups as unknown[]).length > 0;
            if (hasEvents || hasLineups || attempt === maxAttempts) return;

            await new Promise((r) => setTimeout(r, 800 * attempt));
        }
    }

    private async fetchAndStoreMatchDetails(fixtureId: number): Promise<void> {
        try {
            // Prefer the unified cache layer so synthetic/mapped 365 fixtures
            // get lineups/stats/events (API-Football alone misses most lower tiers).
            const { footballDataCacheService } = await import('./football-data-cache.service');
            const bundle = await footballDataCacheService.getFixtureDetailsBundle(fixtureId, {
                forceRefresh: true,
                language: 'en',
            });

            const existing = await prisma.cachedFixture.findUnique({
                where: { fixtureId },
                select: { fullData: true },
            });

            if (!existing) return;

            const currentData = (existing.fullData as Record<string, unknown>) || {};
            const updatedData: Record<string, unknown> = { ...currentData };

            if (Array.isArray(bundle.lineups) && bundle.lineups.length > 0) {
                updatedData.lineups = bundle.lineups;
            }
            if (Array.isArray(bundle.statistics) && bundle.statistics.length > 0) {
                updatedData.statistics = bundle.statistics;
            }
            if (Array.isArray(bundle.events) && bundle.events.length > 0) {
                updatedData.events = bundle.events;
            }

            await prisma.cachedFixture.update({
                where: { fixtureId },
                data: {
                    fullData: updatedData as object,
                    updatedAt: new Date(),
                },
            });

            logger.debug(
                `💾 Stored match details for fixture ${fixtureId} via cache/365 bundle (lineups/stats/events)`,
            );
        } catch (error) {
            logger.error(`Failed to fetch and store match details for fixture ${fixtureId}:`, error);
        }
    }

    /**
     * Convert CachedFixture from database to API-like format
     */
    convertDbMatchToApiFormat(dbMatch: CachedFixture): FixtureFromAPI {
        // If we have the full data stored, use it
        if (dbMatch.fullData && typeof dbMatch.fullData === 'object') {
            const fromJson = dbMatch.fullData as unknown as FixtureFromAPI & {
                _scores365GameId?: number;
                _experiment?: string;
            };
            if (dbMatch.elapsed != null && fromJson.fixture?.status) {
                fromJson.fixture.status.elapsed = dbMatch.elapsed;
            }
            if (dbMatch.leagueId >= 7_000_000 && fromJson._scores365GameId == null) {
                fromJson._scores365GameId = dbMatch.fixtureId;
                fromJson._experiment = fromJson._experiment ?? 'scores365';
            }
            return fromJson;
        }

        // Otherwise, reconstruct from individual fields
        const is365Synthetic = dbMatch.leagueId >= 7_000_000;
        return {
            fixture: {
                id: dbMatch.fixtureId,
                referee: dbMatch.referee,
                timezone: 'UTC',
                date: dbMatch.matchDate.toISOString(),
                timestamp: dbMatch.matchTimestamp,
                periods: { first: null, second: null },
                venue: {
                    id: null,
                    name: dbMatch.venue,
                    city: null,
                },
                status: {
                    long: dbMatch.statusLong || dbMatch.status,
                    short: dbMatch.status,
                    elapsed: dbMatch.elapsed ?? null,
                },
            },
            league: {
                id: dbMatch.leagueId,
                name: dbMatch.leagueName,
                country: dbMatch.leagueCountry || '',
                logo: dbMatch.leagueLogo || '',
                flag: null,
                season: dbMatch.leagueSeason || 2024,
                round: dbMatch.leagueRound || '',
            },
            teams: {
                home: {
                    id: dbMatch.homeTeamId,
                    name: dbMatch.homeTeamName,
                    logo: dbMatch.homeTeamLogo || '',
                    winner: dbMatch.homeScore !== null && dbMatch.awayScore !== null
                        ? dbMatch.homeScore > dbMatch.awayScore
                        : null,
                },
                away: {
                    id: dbMatch.awayTeamId,
                    name: dbMatch.awayTeamName,
                    logo: dbMatch.awayTeamLogo || '',
                    winner: dbMatch.homeScore !== null && dbMatch.awayScore !== null
                        ? dbMatch.awayScore > dbMatch.homeScore
                        : null,
                },
            },
            goals: {
                home: dbMatch.homeScore,
                away: dbMatch.awayScore,
            },
            score: {
                halftime: {
                    home: dbMatch.homeHalftimeScore,
                    away: dbMatch.awayHalftimeScore,
                },
                fulltime: {
                    home: dbMatch.homeScore,
                    away: dbMatch.awayScore,
                },
                extratime: { home: null, away: null },
                penalty: { home: null, away: null },
            },
            // Lightweight list queries omit fullData — stamp synthetic 365 ids so
            // crowd-prediction enrich can resolve gameId without the in-memory map.
            ...(is365Synthetic
                ? {
                    _scores365GameId: dbMatch.fixtureId,
                    _experiment: 'scores365',
                }
                : {}),
        } as FixtureFromAPI;
    }

    /**
     * Get optimized matches - combines DB (finished) + API (live/scheduled)
     * ✅ Request deduplication: If 1000 users request the same data, only 1 API call is made
     * ✅ All users share the same cached data from database
     * This is the main entry point for match data
     */
    async getOptimizedMatches(
        from: Date,
        to: Date,
        fetchFromApi: () => Promise<FixtureFromAPI[]>
    ): Promise<FixtureFromAPI[]> {
        // 1. All cached fixtures for range (any status) — calendar + finished history
        const dbMatches = await this.getMatchesFromDbByDateRange(from, to);
        const dbByFixtureId = new Map(
            dbMatches.map((m) => [m.fixtureId, this.convertDbMatchToApiFormat(m)]),
        );

        logger.debug(`📦 Got ${dbByFixtureId.size} fixtures from DB for range`);

        // 2. Check memory cache for live/scheduled matches
        const cacheKey = `matches_${from.toISOString()}_${to.toISOString()}`;
        const cachedApiMatches = await this.getFromMemoryCache<FixtureFromAPI[]>(cacheKey);

        if (cachedApiMatches) {
            logger.debug(`📦 Got ${cachedApiMatches.length} matches from memory cache (shared for all users)`);

            for (const m of cachedApiMatches) {
                dbByFixtureId.set(m.fixture.id, m);
            }
            return this.sortFixturesByKickoff(Array.from(dbByFixtureId.values()));
        }

        // ✅ 3. Request deduplication: Check if there's already a pending request for this data
        // If 1000 users request the same data simultaneously, they all wait for the same API call
        const pendingRequest = this.pendingRequests.get(cacheKey);
        if (pendingRequest) {
            logger.debug(`⏳ Waiting for pending API request (${this.pendingRequests.size} concurrent requests)`);
            const apiMatches = await pendingRequest;
            for (const m of apiMatches) {
                dbByFixtureId.set(m.fixture.id, m);
            }
            return this.sortFixturesByKickoff(Array.from(dbByFixtureId.values()));
        }

        // ✅ 4. Create new API request and share it with all concurrent requests
        logger.debug('📡 Fetching matches from API (this request will be shared with all concurrent users)...');
        const apiRequestPromise = (async () => {
            try {
                const apiMatches = await fetchFromApi();

                this.upsertFixtures(apiMatches).catch((err) => {
                    logger.warn('Background fixture upsert failed (non-fatal):', err);
                });

                const hasLive = apiMatches.some((m) => this.isLiveStatus(m.fixture.status.short));
                const ttl = hasLive ? CACHE_TTL.LIVE : CACHE_TTL.SCHEDULED;
                await this.setInMemoryCache(cacheKey, apiMatches, ttl);

                logger.debug(`✅ API request completed. ${apiMatches.length} fixtures upserted + memory cached`);
                return apiMatches;
            } finally {
                // Remove from pending requests after completion
                this.pendingRequests.delete(cacheKey);
            }
        })();

        // Store the promise so other concurrent requests can wait for it
        this.pendingRequests.set(cacheKey, apiRequestPromise);

        // Wait for the API request to complete
        const apiMatches = await apiRequestPromise;

        for (const m of apiMatches) {
            dbByFixtureId.set(m.fixture.id, m);
        }
        return this.sortFixturesByKickoff(Array.from(dbByFixtureId.values()));
    }

    private sortFixturesByKickoff(fixtures: FixtureFromAPI[]): FixtureFromAPI[] {
        return fixtures.sort((a, b) => a.fixture.timestamp - b.fixture.timestamp);
    }

    /**
     * Clear memory cache (useful for testing)
     */
    clearMemoryCache(): void {
        this.memoryCache.clear();
    }

    /**
     * Get cache statistics
     */
    getCacheStats(): {
        memoryCacheSize: number;
        dbFixtureCount: number;
        lastDbSync: number;
    } {
        return {
            memoryCacheSize: this.memoryCache.size,
            dbFixtureCount: this.dbFixtureIds.size,
            lastDbSync: this.lastDbSync,
        };
    }
}

export const matchCacheService = new MatchCacheService();
export { MatchCacheService, FixtureFromAPI, FINISHED_STATUSES, LIVE_STATUSES };
