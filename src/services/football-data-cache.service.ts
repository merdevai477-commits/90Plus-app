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
import prisma from '../lib/prisma';
import { getRedisClient } from '../lib/redis';
import { footballService } from './football.service';
import { matchCacheService } from './match-cache.service';
import { playerCacheService } from './player-cache.service';
import { leagueCacheService } from './league-cache.service';

// Memory cache for frequently accessed data
interface MemoryCacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number;
}

import { redisCacheService } from './redis-cache.service';

class FootballDataCacheService {
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

    // TTL values
    private readonly TTL = {
        STANDINGS: 60 * 60 * 1000,      // 1 hour
        LIVE_MATCH: 30 * 1000,          // 30 seconds
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
    async getMatchesByDate(dateString: string): Promise<any[]> {
        try {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
                throw new Error(`Invalid date: ${dateString}`);
            }

            // UTC day bounds — aligns with API-Football date=YYYY-MM-DD queries
            const startOfDay = new Date(`${dateString}T00:00:00.000Z`);
            const endOfDay = new Date(`${dateString}T23:59:59.999Z`);

            const todayKey = new Date().toISOString().split('T')[0];
            const isPastDate = dateString < todayKey;
            const isToday = dateString === todayKey;

            // Calendar past days: serve from DB when we already have fixtures (any status)
            if (isPastDate) {
                try {
                    const dbMatches = await matchCacheService.getMatchesFromDbByDateRange(startOfDay, endOfDay);
                    if (dbMatches.length > 0) {
                        logger.debug(`📦 [${dateString}] ${dbMatches.length} matches from DB (calendar cache)`);
                        return dbMatches.map((m) => matchCacheService.convertDbMatchToApiFormat(m));
                    }
                } catch (dbError) {
                    logger.warn(`[${dateString}] DB read failed, falling back to API:`, dbError);
                }
            }

            logger.debug(`📡 [${dateString}] Fetching matches from API...`);
            const apiMatches = await footballService.getFixtures({ date: dateString });

            if (apiMatches.length > 0) {
                try {
                    await matchCacheService.upsertFixtures(apiMatches);
                    logger.debug(`💾 [${dateString}] Upserted ${apiMatches.length} fixtures to DB`);
                } catch (archiveError) {
                    logger.warn(`[${dateString}] Error upserting matches to DB:`, archiveError);
                }
            }

            // Today: merge Redis live snapshot over scheduled API rows for fresher scores
            if (isToday) {
                return this.mergeLiveFromRedis(apiMatches);
            }

            return apiMatches;
        } catch (error) {
            logger.error(`[${dateString}] Error in getMatchesByDate:`, error);
            throw error;
        }
    }

    /** Overlay live scores from Redis (written by live-fixture-sync) onto today's fixture list. */
    private async mergeLiveFromRedis(apiMatches: any[]): Promise<any[]> {
        const redis = getRedisClient();
        if (!redis || apiMatches.length === 0) return apiMatches;

        try {
            const raw = await redis.get('football:live_matches');
            if (!raw) return apiMatches;

            const liveFixtures: any[] = JSON.parse(raw);
            if (!Array.isArray(liveFixtures) || liveFixtures.length === 0) return apiMatches;

            const byId = new Map<number, any>();
            for (const m of apiMatches) {
                const id = m?.fixture?.id;
                if (id != null) byId.set(id, m);
            }
            for (const live of liveFixtures) {
                const id = live?.fixture?.id;
                if (id != null) byId.set(id, live);
            }
            return Array.from(byId.values());
        } catch (err) {
            logger.warn('Redis live merge failed, using API payload:', err);
            return apiMatches;
        }
    }

    // ============================================
    // PLAYER DATA
    // ============================================

    /**
     * Get player by ID with full statistics
     */
    async getPlayer(playerId: number, season: number = 2024): Promise<any> {
        return playerCacheService.getPlayer(playerId, async () => {
            return footballService.getPlayerById(playerId, season);
        });
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
        const cacheKey = `${leagueId}_${season}`;

        // Check memory cache
        const cached = this.standingsCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < cached.ttl) {
            logger.debug(`📦 Standings ${cacheKey} from memory cache`);
            return cached.data;
        }

        // Fetch from API
        logger.debug(`📡 Fetching standings for league ${leagueId}`);
        const standings = await footballService.getStandings(leagueId, season);

        // Cache in memory
        this.standingsCache.set(cacheKey, {
            data: standings,
            timestamp: Date.now(),
            ttl: this.TTL.STANDINGS,
        });

        // Cache teams from standings
        if (standings?.length) {
            for (const standing of standings) {
                if (standing.team) {
                    await this.cacheTeamFromStanding(standing.team);
                }
            }
        }

        return standings;
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
    async getMatchLineups(fixtureId: number): Promise<any[]> {
        // 1. Check Redis cache first, then memory cache
        const redisKey = `lineups:${fixtureId}`;
        const redisCached = await redisCacheService.get<MemoryCacheEntry<any>>(redisKey);
        if (redisCached && Date.now() - redisCached.timestamp < redisCached.ttl) {
            logger.debug(`📦 Lineups ${fixtureId} from Redis cache (shared for all users)`);
            // Update memory cache
            this.lineupsCache.set(fixtureId, redisCached);
            return redisCached.data;
        }

        // Check memory cache
        const cached = this.lineupsCache.get(fixtureId);
        if (cached && Date.now() - cached.timestamp < cached.ttl) {
            logger.debug(`📦 Lineups ${fixtureId} from memory cache (shared for all users)`);
            return cached.data;
        }

        // 2. Check if match is finished (permanent cache in DB, shared for all users)
        const dbMatch = await prisma.cachedFixture.findUnique({
            where: { fixtureId },
            select: { status: true, fullData: true },
        });

        const isFinished = dbMatch && ['FT', 'AET', 'PEN'].includes(dbMatch.status);
        const fullData = dbMatch?.fullData as any;

        // ✅ If finished and we have lineups in fullData, use them (no API call, shared for all users)
        if (isFinished && fullData?.lineups) {
            logger.debug(`📦 Lineups ${fixtureId} from DB fullData (shared for all users, no API call)`);
            return fullData.lineups;
        }

        // ✅ 3. Request deduplication: Check if there's already a pending request
        const pendingRequest = this.pendingLineupRequests.get(fixtureId);
        if (pendingRequest) {
            logger.debug(`⏳ Waiting for pending lineup request ${fixtureId} (${this.pendingLineupRequests.size} concurrent requests)`);
            return await pendingRequest;
        }

        // ✅ 4. Create new API request and share it with all concurrent requests
        logger.debug(`📡 Fetching lineups for fixture ${fixtureId} (request will be shared with concurrent users)`);
        const apiRequestPromise = (async () => {
            try {
                const lineups = await footballService.getFixtureLineups(fixtureId);

                // Cache in Redis and memory.
                // Empty results get a short TTL so we don't poison the cache
                // when the API is rate-limited or hasn't ingested data yet.
                const isEmpty = !Array.isArray(lineups) || lineups.length === 0;
                const ttl = isEmpty
                    ? this.TTL.EMPTY
                    : (isFinished ? this.TTL.FINISHED : this.TTL.UPCOMING_MATCH);
                const cacheEntry: MemoryCacheEntry<any> = {
                    data: lineups,
                    timestamp: Date.now(),
                    ttl,
                };
                await redisCacheService.set(redisKey, cacheEntry, ttl === Infinity ? 7 * 24 * 60 * 60 * 1000 : ttl);
                this.lineupsCache.set(fixtureId, cacheEntry);

                // ✅ If finished AND non-empty, update fullData in DB
                // (permanent, shared for all users). Don't persist empty
                // arrays — the API may backfill later.
                if (isFinished && !isEmpty && lineups?.length) {
                    await this.updateFixtureFullData(fixtureId, { lineups });
                    logger.debug(`💾 Lineups ${fixtureId} stored in DB (shared for all users)`);
                }

                return lineups;
            } finally {
                // Remove from pending requests after completion
                this.pendingLineupRequests.delete(fixtureId);
            }
        })();

        // Store the promise so other concurrent requests can wait for it
        this.pendingLineupRequests.set(fixtureId, apiRequestPromise);

        // Wait for the API request to complete
        return await apiRequestPromise;
    }

    /**
     * Get match statistics
     */
    async getMatchStatistics(fixtureId: number): Promise<any[]> {
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

        // Check if match is finished
        const dbMatch = await prisma.cachedFixture.findUnique({
            where: { fixtureId },
            select: { status: true, fullData: true },
        });

        const isFinished = dbMatch && ['FT', 'AET', 'PEN'].includes(dbMatch.status);
        const fullData = dbMatch?.fullData as any;

        if (isFinished && fullData?.statistics) {
            logger.debug(`📦 Statistics ${fixtureId} from DB fullData`);
            return fullData.statistics;
        }

        // Fetch from API
        logger.debug(`📡 Fetching statistics for fixture ${fixtureId}`);
        const statistics = await footballService.getFixtureStatistics(fixtureId);

        // Empty results get a short TTL so we re-hit the API soon. Otherwise
        // a single transient empty response (e.g. quota cooldown) would lock
        // the cache for hours.
        const isEmpty = !Array.isArray(statistics) || statistics.length === 0;
        const ttl = isEmpty
            ? this.TTL.EMPTY
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
    async getMatchEvents(fixtureId: number): Promise<any[]> {
        // 1. Check Redis cache first, then memory cache
        const redisKey = `events:${fixtureId}`;
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

        // 2. Check if match is finished (permanent cache in DB, shared for all users)
        const dbMatch = await prisma.cachedFixture.findUnique({
            where: { fixtureId },
            select: { status: true, fullData: true },
        });

        const isFinished = dbMatch && ['FT', 'AET', 'PEN'].includes(dbMatch.status);
        const fullData = dbMatch?.fullData as any;

        // ✅ If finished and we have events in fullData, use them (no API call, shared for all users)
        if (isFinished && fullData?.events) {
            logger.debug(`📦 Events ${fixtureId} from DB fullData (shared for all users, no API call)`);
            return fullData.events;
        }

        // ✅ 3. Request deduplication: Check if there's already a pending request
        const pendingRequest = this.pendingEventsRequests.get(fixtureId);
        if (pendingRequest) {
            logger.debug(`⏳ Waiting for pending events request ${fixtureId} (${this.pendingEventsRequests.size} concurrent requests)`);
            return await pendingRequest;
        }

        // ✅ 4. Create new API request and share it with all concurrent requests
        logger.debug(`📡 Fetching events for fixture ${fixtureId} (request will be shared with concurrent users)`);
        const apiRequestPromise = (async () => {
            try {
                const events = await footballService.getFixtureEvents(fixtureId);

                // Empty results get a short TTL — same reasoning as lineups.
                const isEmpty = !Array.isArray(events) || events.length === 0;
                const ttl = isEmpty
                    ? this.TTL.EMPTY
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
}

export const footballDataCacheService = new FootballDataCacheService();
