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
    
    // Request deduplication for transfers
    private pendingTransfersRequests = new Map<string, Promise<any[]>>();
    private topAssistsCache = new Map<string, MemoryCacheEntry<any>>();
    private injuriesCache = new Map<number, MemoryCacheEntry<any>>();
    private transfersCache = new Map<string, MemoryCacheEntry<any>>();
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
        INJURIES: 30 * 60 * 1000,       // 30 minutes
        TRANSFERS: 24 * 60 * 60 * 1000, // 24 hours
        TROPHIES: 7 * 24 * 60 * 60 * 1000, // 7 days
        COACHES: 7 * 24 * 60 * 60 * 1000,  // 7 days
        VENUES: 30 * 24 * 60 * 60 * 1000,  // 30 days
        ROUNDS: 60 * 60 * 1000,         // 1 hour
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
        const date = new Date(dateString);
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const isPastDate = date < today;

        // ✅ For past dates, try database first (permanent, shared for all users, no API call)
        if (isPastDate) {
            const dbMatches = await matchCacheService.getFinishedMatchesFromDb(startOfDay, endOfDay);
            if (dbMatches.length > 0) {
                logger.debug(`📦 [${dateString}] Got ${dbMatches.length} matches from DB (shared for all users, no API call)`);
                return dbMatches.map(m => matchCacheService.convertDbMatchToApiFormat(m));
            }
        }

        // ✅ Fetch from API (with request deduplication - if 1000 users request, only 1 API call)
        logger.debug(`📡 [${dateString}] Fetching matches from API (request will be shared with concurrent users)...`);
        const apiMatches = await footballService.getFixtures({ date: dateString });

        // ✅ Archive finished matches to database (permanent, shared for all users)
        if (apiMatches.length > 0) {
            await matchCacheService.archiveFinishedMatches(apiMatches);
            logger.debug(`💾 [${dateString}] Archived finished matches to DB (shared for all users)`);
        }

        return apiMatches;
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

                // Cache in Redis and memory
                const ttl = isFinished ? this.TTL.FINISHED : this.TTL.UPCOMING_MATCH;
                const cacheEntry: MemoryCacheEntry<any> = {
                    data: lineups,
                    timestamp: Date.now(),
                    ttl,
                };
                await redisCacheService.set(redisKey, cacheEntry, ttl === Infinity ? 7 * 24 * 60 * 60 * 1000 : ttl);
                this.lineupsCache.set(fixtureId, cacheEntry);

                // ✅ If finished, update fullData in DB (permanent, shared for all users)
                if (isFinished && lineups?.length) {
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

        // Cache in Redis and memory
        const ttl = isFinished ? this.TTL.FINISHED : this.TTL.LIVE_MATCH;
        const cacheEntry: MemoryCacheEntry<any> = {
            data: statistics,
            timestamp: Date.now(),
            ttl,
        };
        await redisCacheService.set(redisKey, cacheEntry, ttl === Infinity ? 7 * 24 * 60 * 60 * 1000 : ttl);
        this.statisticsCache.set(fixtureId, cacheEntry);

        if (isFinished && statistics?.length) {
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

                // Cache in Redis and memory
                const ttl = isFinished ? this.TTL.FINISHED : this.TTL.LIVE_MATCH;
                const cacheEntry: MemoryCacheEntry<any> = {
                    data: events,
                    timestamp: Date.now(),
                    ttl,
                };
                await redisCacheService.set(redisKey, cacheEntry, ttl === Infinity ? 7 * 24 * 60 * 60 * 1000 : ttl);
                this.eventsCache.set(fixtureId, cacheEntry);

                // ✅ If finished, update fullData in DB (permanent, shared for all users)
                if (isFinished && events?.length) {
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
        this.injuriesCache.clear();
        this.transfersCache.clear();
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
     * Helper function to convert API transfer to CachedTransfer format
     */
    private async saveTransfersToDatabase(transfers: any[]): Promise<void> {
        try {
            for (const transfer of transfers) {
                if (!transfer.player?.id) continue;

                for (const t of transfer.transfers || []) {
                    const transferDate = t.date || transfer.update || new Date().toISOString().split('T')[0];
                    
                    // Check if transfer already exists
                    const existing = await prisma.cachedTransfer.findFirst({
                        where: {
                            playerId: transfer.player.id,
                            transferDate: transferDate,
                            teamInId: t.teams?.in?.id || null,
                            teamOutId: t.teams?.out?.id || null,
                        },
                    });

                    if (!existing) {
                        await prisma.cachedTransfer.create({
                            data: {
                                playerId: transfer.player.id,
                                playerName: transfer.player.name || '',
                                playerPhoto: transfer.player.photo || null,
                                teamInId: t.teams?.in?.id || null,
                                teamInName: t.teams?.in?.name || null,
                                teamInLogo: t.teams?.in?.logo || null,
                                teamOutId: t.teams?.out?.id || null,
                                teamOutName: t.teams?.out?.name || null,
                                teamOutLogo: t.teams?.out?.logo || null,
                                transferType: t.type || null,
                                transferDate: transferDate,
                                transferValue: t.value ? parseFloat(t.value.toString().replace(/[^0-9.]/g, '')) : null,
                                leagueId: transfer.league?.id || null,
                                leagueName: transfer.league?.name || null,
                                leagueLogo: transfer.league?.logo || null,
                            },
                        });
                    }
                }
            }
        } catch (error) {
            logger.error('Error saving transfers to database:', error);
        }
    }

    /**
     * Get transfers with caching (Database first, then Redis, then Memory, then API)
     */
    async getTransfers(params: { team?: number; player?: number; date?: string }): Promise<any[]> {
        const cacheKey = `transfers_${params.team || 'all'}_${params.player || 'all'}_${params.date || 'all'}`;
        
        try {
            // Check Database first (for permanent storage)
            const dbTransfers = await prisma.cachedTransfer.findMany({
                where: {
                    ...(params.player ? { playerId: params.player } : {}),
                    ...(params.team ? { OR: [{ teamInId: params.team }, { teamOutId: params.team }] } : {}),
                    ...(params.date ? { transferDate: params.date } : {}),
                },
                orderBy: { transferDate: 'desc' },
                take: 1000, // Limit to prevent huge queries
            });

            if (dbTransfers.length > 0) {
                logger.debug(`📦 Transfers from Database (${dbTransfers.length} records)`);
                
                // Convert database format to API format
                const transfersMap = new Map<number, any>();
                for (const dbTransfer of dbTransfers) {
                    if (!transfersMap.has(dbTransfer.playerId)) {
                        transfersMap.set(dbTransfer.playerId, {
                            player: {
                                id: dbTransfer.playerId,
                                name: dbTransfer.playerName,
                                photo: dbTransfer.playerPhoto,
                            },
                            transfers: [],
                            league: dbTransfer.leagueId ? {
                                id: dbTransfer.leagueId,
                                name: dbTransfer.leagueName,
                                logo: dbTransfer.leagueLogo,
                            } : null,
                            update: dbTransfer.transferDate,
                        });
                    }
                    
                    const transfer = transfersMap.get(dbTransfer.playerId)!;
                    transfer.transfers.push({
                        date: dbTransfer.transferDate,
                        type: dbTransfer.transferType,
                        teams: {
                            in: dbTransfer.teamInId ? {
                                id: dbTransfer.teamInId,
                                name: dbTransfer.teamInName,
                                logo: dbTransfer.teamInLogo,
                            } : null,
                            out: dbTransfer.teamOutId ? {
                                id: dbTransfer.teamOutId,
                                name: dbTransfer.teamOutName,
                                logo: dbTransfer.teamOutLogo,
                            } : null,
                        },
                    });
                }

                const result = Array.from(transfersMap.values());
                
                // Cache in Redis and Memory
                const entry: MemoryCacheEntry<any[]> = {
                    data: result,
                    timestamp: Date.now(),
                    ttl: this.TTL.TRANSFERS,
                };
                this.transfersCache.set(cacheKey, entry);
                await redisCacheService.set(`transfers:${cacheKey}`, entry, this.TTL.TRANSFERS);
                
                return result;
            }
        } catch (error) {
            logger.warn('Error querying database for transfers, falling back to cache/API:', error);
        }
        
        // Check Redis cache
        const redisKey = `transfers:${cacheKey}`;
        const redisCached = await redisCacheService.get<MemoryCacheEntry<any[]>>(redisKey);
        if (redisCached && Date.now() - redisCached.timestamp < redisCached.ttl) {
            logger.debug(`📦 Transfers from Redis cache`);
            this.transfersCache.set(cacheKey, redisCached);
            return redisCached.data;
        }

        // Check memory cache
        const cached = this.transfersCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < cached.ttl) {
            logger.debug(`📦 Transfers from memory cache`);
            return cached.data;
        }

        // Check for pending request (deduplication)
        const pendingRequest = this.pendingTransfersRequests.get(cacheKey);
        if (pendingRequest) {
            logger.debug(`📦 Waiting for pending transfer request: ${cacheKey}`);
            return pendingRequest;
        }

        // Create new request
        const requestPromise = (async () => {
            try {
                // Fetch from API
                const data = await footballService.getTransfers(params);
                
                // Save to database (async, don't wait)
                this.saveTransfersToDatabase(data).catch(err => {
                    logger.error('Failed to save transfers to database:', err);
                });
                
                const entry: MemoryCacheEntry<any[]> = {
                    data,
                    timestamp: Date.now(),
                    ttl: this.TTL.TRANSFERS,
                };

                // Store in both caches
                this.transfersCache.set(cacheKey, entry);
                await redisCacheService.set(redisKey, entry, this.TTL.TRANSFERS);

                return data;
            } finally {
                // Remove from pending requests
                this.pendingTransfersRequests.delete(cacheKey);
            }
        })();

        // Store pending request
        this.pendingTransfersRequests.set(cacheKey, requestPromise);
        return requestPromise;
    }

    /**
     * Get transfers by leagues with date range
     * Fetches transfers for all teams in specified leagues over a date range
     */
    async getTransfersByLeagues(
        leagueIds?: number[], 
        dateRange?: { from: string; to: string }
    ): Promise<Array<{ leagueId: number; leagueName: string; leagueLogo?: string; transfers: any[] }>> {
        // Generate cache key
        const leaguesKey = leagueIds ? leagueIds.sort().join(',') : 'all';
        const dateKey = dateRange ? `${dateRange.from}_${dateRange.to}` : 'all';
        const cacheKey = `transfers_by_leagues_${leaguesKey}_${dateKey}`;

        // Check Redis cache
        const redisKey = `transfers:by_leagues:${cacheKey}`;
        const redisCached = await redisCacheService.get<MemoryCacheEntry<Array<{ leagueId: number; leagueName: string; leagueLogo?: string; transfers: any[] }>>>(redisKey);
        if (redisCached && Date.now() - redisCached.timestamp < redisCached.ttl) {
            logger.debug(`📦 Transfers by leagues from Redis cache`);
            return redisCached.data;
        }

        // Check memory cache
        const cached = this.transfersCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < cached.ttl) {
            logger.debug(`📦 Transfers by leagues from memory cache`);
            return cached.data;
        }

        try {
            // Get all leagues or specified leagues
            const allLeagues = await leagueCacheService.getAllLeagues();
            const targetLeagues = leagueIds 
                ? allLeagues.filter(l => {
                    const leagueId = l.league?.id || l.id;
                    return leagueIds.includes(leagueId);
                })
                : allLeagues;

            logger.debug(`📡 Fetching transfers for ${targetLeagues.length} leagues...`);

            // Calculate date range (default: last year)
            const now = new Date();
            const oneYearAgo = new Date(now);
            oneYearAgo.setFullYear(now.getFullYear() - 1);
            
            const fromDate = dateRange?.from || oneYearAgo.toISOString().split('T')[0];
            const toDate = dateRange?.to || now.toISOString().split('T')[0];

            // Generate date list (monthly chunks for performance)
            const dates: string[] = [];
            const start = new Date(fromDate);
            const end = new Date(toDate);
            const current = new Date(start);
            
            // Add dates monthly to reduce API calls
            while (current <= end) {
                dates.push(current.toISOString().split('T')[0]);
                current.setMonth(current.getMonth() + 1);
            }
            // Add the end date
            if (dates[dates.length - 1] !== toDate) {
                dates.push(toDate);
            }

            const result: Array<{ leagueId: number; leagueName: string; leagueLogo?: string; transfers: any[] }> = [];
            const teamTransfersMap = new Map<number, any[]>(); // Cache transfers per team

            // Process leagues in batches to avoid overwhelming the API
            const batchSize = 5;
            for (let i = 0; i < targetLeagues.length; i += batchSize) {
                const leagueBatch = targetLeagues.slice(i, i + batchSize);
                
                await Promise.all(leagueBatch.map(async (league) => {
                    const leagueId = league.league?.id || league.id;
                    const leagueName = league.league?.name || league.name;
                    const leagueLogo = league.league?.logo || league.logo;

                    try {
                        // Get teams in this league from standings
                        let teamIds: number[] = [];
                        try {
                            const standings = await this.getStandings(leagueId, 2024);
                            teamIds = standings
                                ?.map((s: any) => s.team?.id)
                                .filter((id: any) => id !== undefined) as number[] || [];
                        } catch (standingsError) {
                            // Some leagues (like cups) may not have standings
                            logger.debug(`⚠️ Could not get standings for league ${leagueId}, skipping...`);
                            return;
                        }

                        if (teamIds.length === 0) {
                            logger.debug(`⚠️ No teams found for league ${leagueId}`);
                            return;
                        }

                        logger.debug(`📡 Fetching transfers for ${teamIds.length} teams in ${leagueName}...`);

                        // Fetch transfers for all teams in parallel (with rate limiting)
                        const teamTransferPromises = teamIds.map(async (teamId) => {
                            // Check if we already have transfers for this team
                            if (teamTransfersMap.has(teamId)) {
                                return teamTransfersMap.get(teamId)!;
                            }

                            // Fetch transfers for this team across date range
                            const allTeamTransfers: any[] = [];
                            
                            // Fetch transfers for each date (in smaller batches)
                            const dateBatchSize = 3;
                            for (let j = 0; j < dates.length; j += dateBatchSize) {
                                const dateBatch = dates.slice(j, j + dateBatchSize);
                                
                                const datePromises = dateBatch.map(async (date) => {
                                    try {
                                        const transfers = await this.getTransfers({ team: teamId, date });
                                        return transfers || [];
                                    } catch (error) {
                                        logger.warn(`Failed to fetch transfers for team ${teamId} on ${date}:`, error);
                                        return [];
                                    }
                                });

                                const dateResults = await Promise.all(datePromises);
                                allTeamTransfers.push(...dateResults.flat());
                                
                                // Small delay to respect rate limits
                                if (j + dateBatchSize < dates.length) {
                                    await new Promise(resolve => setTimeout(resolve, 200));
                                }
                            }

                            // Cache team transfers
                            teamTransfersMap.set(teamId, allTeamTransfers);
                            return allTeamTransfers;
                        });

                        // Wait for all teams in this league
                        const teamResults = await Promise.all(teamTransferPromises);
                        const leagueTransfers = teamResults.flat();

                        // Add league info to each transfer
                        const transfersWithLeague = leagueTransfers.map(transfer => ({
                            ...transfer,
                            league: {
                                id: leagueId,
                                name: leagueName,
                                logo: leagueLogo
                            }
                        }));

                        if (transfersWithLeague.length > 0) {
                            result.push({
                                leagueId,
                                leagueName,
                                leagueLogo,
                                transfers: transfersWithLeague
                            });
                        }

                        // Rate limiting delay between leagues
                        if (i + batchSize < targetLeagues.length) {
                            await new Promise(resolve => setTimeout(resolve, 300));
                        }
                    } catch (error) {
                        logger.error(`Error fetching transfers for league ${leagueId}:`, error);
                    }
                }));
            }

            // Cache the result
            const entry: MemoryCacheEntry<Array<{ leagueId: number; leagueName: string; leagueLogo?: string; transfers: any[] }>> = {
                data: result,
                timestamp: Date.now(),
                ttl: this.TTL.TRANSFERS,
            };

            this.transfersCache.set(cacheKey, entry);
            await redisCacheService.set(redisKey, entry, this.TTL.TRANSFERS);

            logger.debug(`✅ Fetched transfers for ${result.length} leagues`);
            return result;
        } catch (error) {
            logger.error('Error in getTransfersByLeagues:', error);
            return [];
        }
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
