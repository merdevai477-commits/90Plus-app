/**
 * Player Cache Service
 * 
 * Caches player, team, and H2H data in PostgreSQL to reduce API calls.
 * Similar to MatchCacheService but for player/team data.
 */

import { CachedPlayer, CachedTeam, CachedH2H } from '@prisma/client';
import { logger } from '../utils/logger';
import prisma from '../lib/prisma'; // ✅ Use centralized singleton

// Cache TTL for in-memory cache
// ✅ OPTIMIZATION 1: Increased cache duration for teams (24 hours) - teams rarely change
const MEMORY_CACHE_TTL = 60 * 60 * 1000; // 1 hour for players
const TEAM_MEMORY_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours for teams (optimization)

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

interface PlayerFromAPI {
    player: {
        id: number;
        name: string;
        firstname: string | null;
        lastname: string | null;
        age: number | null;
        birth: {
            date: string | null;
            place: string | null;
            country: string | null;
        };
        nationality: string | null;
        height: string | null;
        weight: string | null;
        injured: boolean;
        photo: string | null;
    };
    statistics: Array<{
        team: {
            id: number;
            name: string;
            logo: string;
        };
        league: {
            id: number;
            name: string;
            country: string;
            logo: string;
            flag: string | null;
            season: number;
        };
        games: {
            appearences: number | null;
            lineups: number | null;
            minutes: number | null;
            number: number | null;
            position: string | null;
            rating: string | null;
            captain: boolean;
        };
        goals: {
            total: number | null;
            conceded: number | null;
            assists: number | null;
            saves: number | null;
        };
        cards: {
            yellow: number | null;
            yellowred: number | null;
            red: number | null;
        };
    }>;
}

interface TeamFromAPI {
    team: {
        id: number;
        name: string;
        code: string | null;
        country: string | null;
        founded: number | null;
        national: boolean;
        logo: string | null;
    };
    venue: {
        id: number | null;
        name: string | null;
        address: string | null;
        city: string | null;
        capacity: number | null;
        surface: string | null;
        image: string | null;
    };
}

import { redisCacheService } from './redis-cache.service';

class PlayerCacheService {
    // In-memory cache for fast access (fallback)
    private playerCache = new Map<number, CacheEntry<any>>();
    private teamCache = new Map<number, CacheEntry<any>>();
    private h2hCache = new Map<string, CacheEntry<any>>();

    // ✅ Request deduplication: prevent multiple simultaneous API calls for the same player/team
    private pendingPlayerRequests = new Map<number, Promise<PlayerFromAPI | null>>();
    private pendingTeamRequests = new Map<number, Promise<TeamFromAPI | null>>();

    /**
     * Get H2H cache key
     */
    private getH2HKey(team1Id: number, team2Id: number): string {
        // Always use smaller ID first for consistency
        const [id1, id2] = team1Id < team2Id ? [team1Id, team2Id] : [team2Id, team1Id];
        return `${id1}_${id2}`;
    }

    /**
     * Get player from cache or API
     * ✅ Request deduplication: If 1000 users request the same player, only 1 API call is made
     * ✅ All users share the same cached data from database
     */
    async getPlayer(
        playerId: number,
        fetchFromApi: () => Promise<PlayerFromAPI[]>
    ): Promise<PlayerFromAPI | null> {
        // 1. Check Redis cache first, then memory cache
        const redisKey = `player:${playerId}`;
        const redisCached = await redisCacheService.get<CacheEntry<any>>(redisKey);
        if (redisCached && Date.now() - redisCached.timestamp < MEMORY_CACHE_TTL) {
            logger.debug(`📦 Player ${playerId} from Redis cache (shared for all users)`);
            // Update memory cache
            this.playerCache.set(playerId, redisCached);
            return redisCached.data;
        }

        // Check memory cache
        const memoryCached = this.playerCache.get(playerId);
        if (memoryCached && Date.now() - memoryCached.timestamp < MEMORY_CACHE_TTL) {
            logger.debug(`📦 Player ${playerId} from memory cache (shared for all users)`);
            return memoryCached.data;
        }

        // 2. Check database (shared for all users)
        const dbPlayer = await prisma.cachedPlayer.findUnique({
            where: { playerId },
        });

        if (dbPlayer) {
            const playerData = dbPlayer.fullData as unknown as PlayerFromAPI;
            const cacheEntry: CacheEntry<any> = { data: playerData, timestamp: Date.now() };
            
            // Update Redis cache
            await redisCacheService.set(redisKey, cacheEntry, MEMORY_CACHE_TTL);
            
            // Update memory cache
            this.playerCache.set(playerId, cacheEntry);
            logger.debug(`📦 Player ${playerId} from database (shared for all users)`);
            return playerData;
        }

        // ✅ 3. Request deduplication: Check if there's already a pending request for this player
        const pendingRequest = this.pendingPlayerRequests.get(playerId);
        if (pendingRequest) {
            logger.debug(`⏳ Waiting for pending player request ${playerId} (${this.pendingPlayerRequests.size} concurrent requests)`);
            return await pendingRequest;
        }

        // ✅ 4. Create new API request and share it with all concurrent requests
        logger.debug(`📡 Fetching player ${playerId} from API (this request will be shared with all concurrent users)`);
        const apiRequestPromise = (async () => {
            try {
                const apiData = await fetchFromApi();
                if (apiData && apiData.length > 0) {
                    const player = apiData[0];

                    // Cache in database (shared for all users)
                    await this.cachePlayer(player);

                    // Cache in Redis and memory
                    const cacheEntry: CacheEntry<any> = { data: player, timestamp: Date.now() };
                    await redisCacheService.set(redisKey, cacheEntry, MEMORY_CACHE_TTL);
                    this.playerCache.set(playerId, cacheEntry);

                    logger.debug(`✅ Player ${playerId} cached (shared for all users)`);
                    return player;
                }
                return null;
            } catch (error) {
                logger.error(`Failed to fetch player ${playerId}:`, error);
                return null;
            } finally {
                // Remove from pending requests after completion
                this.pendingPlayerRequests.delete(playerId);
            }
        })();

        // Store the promise so other concurrent requests can wait for it
        this.pendingPlayerRequests.set(playerId, apiRequestPromise);

        // Wait for the API request to complete
        return await apiRequestPromise;
    }

    /**
     * Cache player in database
     * ✅ Uses most recent season statistics for current team info
     */
    async cachePlayer(player: PlayerFromAPI): Promise<void> {
        // ✅ Get current season
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        const currentSeason = currentMonth >= 6 ? currentYear : currentYear - 1;
        
        // ✅ Find statistics from current season, or most recent season
        let stats = player.statistics.find(s => s.league?.season === currentSeason);
        if (!stats && player.statistics.length > 0) {
            // Sort by season descending and take the most recent
            const sortedStats = [...player.statistics].sort((a, b) => {
                const seasonA = a.league?.season || 0;
                const seasonB = b.league?.season || 0;
                return seasonB - seasonA;
            });
            stats = sortedStats[0];
        }
        
        // Fallback to first statistics if none found
        if (!stats && player.statistics.length > 0) {
            stats = player.statistics[0];
        }

        try {
            await prisma.cachedPlayer.upsert({
                where: { playerId: player.player.id },
                update: {
                    name: player.player.name,
                    firstname: player.player.firstname,
                    lastname: player.player.lastname,
                    photo: player.player.photo,
                    nationality: player.player.nationality,
                    age: player.player.age,
                    birthDate: player.player.birth?.date,
                    birthPlace: player.player.birth?.place,
                    birthCountry: player.player.birth?.country,
                    height: player.player.height,
                    weight: player.player.weight,
                    teamId: stats?.team?.id,
                    teamName: stats?.team?.name,
                    teamLogo: stats?.team?.logo,
                    position: stats?.games?.position,
                    seasonStats: stats as any,
                    fullData: player as any,
                    updatedAt: new Date(),
                },
                create: {
                    playerId: player.player.id,
                    name: player.player.name,
                    firstname: player.player.firstname,
                    lastname: player.player.lastname,
                    photo: player.player.photo,
                    nationality: player.player.nationality,
                    age: player.player.age,
                    birthDate: player.player.birth?.date,
                    birthPlace: player.player.birth?.place,
                    birthCountry: player.player.birth?.country,
                    height: player.player.height,
                    weight: player.player.weight,
                    teamId: stats?.team?.id,
                    teamName: stats?.team?.name,
                    teamLogo: stats?.team?.logo,
                    position: stats?.games?.position,
                    seasonStats: stats as any,
                    fullData: player as any,
                },
            });

            logger.debug(`✅ Cached player ${player.player.id}: ${player.player.name}`);
        } catch (error) {
            logger.error(`Failed to cache player ${player.player.id}:`, error);
        }
    }

    /**
     * Get team from cache or API
     */
    async getTeam(
        teamId: number,
        fetchFromApi: () => Promise<TeamFromAPI[]>
    ): Promise<TeamFromAPI | null> {
        // 1. Check Redis cache first, then memory cache
        const redisKey = `team:${teamId}`;
        const redisCached = await redisCacheService.get<CacheEntry<any>>(redisKey);
        if (redisCached && Date.now() - redisCached.timestamp < TEAM_MEMORY_CACHE_TTL) {
            logger.debug(`📦 Team ${teamId} from Redis cache (shared for all users)`);
            // Update memory cache
            this.teamCache.set(teamId, redisCached);
            return redisCached.data;
        }

        // Check memory cache
        const memoryCached = this.teamCache.get(teamId);
        if (memoryCached && Date.now() - memoryCached.timestamp < TEAM_MEMORY_CACHE_TTL) {
            logger.debug(`📦 Team ${teamId} from memory cache (shared for all users)`);
            return memoryCached.data;
        }

        // 2. Check database (shared for all users)
        const dbTeam = await prisma.cachedTeam.findUnique({
            where: { teamId },
        });

        if (dbTeam) {
            const teamData = dbTeam.fullData as unknown as TeamFromAPI;
            const cacheEntry: CacheEntry<any> = { data: teamData, timestamp: Date.now() };
            
            // Update Redis cache
            await redisCacheService.set(redisKey, cacheEntry, TEAM_MEMORY_CACHE_TTL);
            
            // Update memory cache
            this.teamCache.set(teamId, cacheEntry);
            logger.debug(`📦 Team ${teamId} from database (shared for all users)`);
            return teamData;
        }

        // ✅ 3. Request deduplication: Check if there's already a pending request for this team
        const pendingRequest = this.pendingTeamRequests.get(teamId);
        if (pendingRequest) {
            logger.debug(`⏳ Waiting for pending team request ${teamId} (${this.pendingTeamRequests.size} concurrent requests)`);
            return await pendingRequest;
        }

        // ✅ 4. Create new API request and share it with all concurrent requests
        logger.debug(`📡 Fetching team ${teamId} from API (this request will be shared with all concurrent users)`);
        const apiRequestPromise = (async () => {
            try {
                const apiData = await fetchFromApi();
                if (apiData && apiData.length > 0) {
                    const team = apiData[0];
                    await this.cacheTeam(team);
                    
                    // Cache in Redis and memory
                    const cacheEntry: CacheEntry<any> = { data: team, timestamp: Date.now() };
                    await redisCacheService.set(redisKey, cacheEntry, TEAM_MEMORY_CACHE_TTL);
                    this.teamCache.set(teamId, cacheEntry);
                    logger.debug(`✅ Team ${teamId} cached (shared for all users)`);
                    return team;
                }
                return null;
            } catch (error) {
                logger.error(`Failed to fetch team ${teamId}:`, error);
                return null;
            } finally {
                // Remove from pending requests after completion
                this.pendingTeamRequests.delete(teamId);
            }
        })();

        // Store the promise so other concurrent requests can wait for it
        this.pendingTeamRequests.set(teamId, apiRequestPromise);

        // Wait for the API request to complete
        return await apiRequestPromise;
    }

    /**
     * Cache team in database
     */
    async cacheTeam(team: TeamFromAPI): Promise<void> {
        try {
            await prisma.cachedTeam.upsert({
                where: { teamId: team.team.id },
                update: {
                    name: team.team.name,
                    code: team.team.code,
                    logo: team.team.logo,
                    country: team.team.country,
                    founded: team.team.founded,
                    venueName: team.venue?.name,
                    venueAddress: team.venue?.address,
                    venueCity: team.venue?.city,
                    venueCapacity: team.venue?.capacity,
                    venueImage: team.venue?.image,
                    fullData: team as any,
                    updatedAt: new Date(),
                },
                create: {
                    teamId: team.team.id,
                    name: team.team.name,
                    code: team.team.code,
                    logo: team.team.logo,
                    country: team.team.country,
                    founded: team.team.founded,
                    venueName: team.venue?.name,
                    venueAddress: team.venue?.address,
                    venueCity: team.venue?.city,
                    venueCapacity: team.venue?.capacity,
                    venueImage: team.venue?.image,
                    fullData: team as any,
                },
            });

            logger.debug(`✅ Cached team ${team.team.id}: ${team.team.name}`);
        } catch (error) {
            logger.error(`Failed to cache team ${team.team.id}:`, error);
        }
    }

    /**
     * Get H2H from cache or API
     */
    async getH2H(
        team1Id: number,
        team2Id: number,
        fetchFromApi: () => Promise<any[]>
    ): Promise<{ summary: any; matches: any[] } | null> {
        const cacheKey = this.getH2HKey(team1Id, team2Id);

        // 1. Check memory cache
        const memoryCached = this.h2hCache.get(cacheKey);
        if (memoryCached && Date.now() - memoryCached.timestamp < MEMORY_CACHE_TTL) {
            logger.debug(`📦 H2H ${cacheKey} from memory cache`);
            return memoryCached.data;
        }

        // 2. Check database
        const [id1, id2] = team1Id < team2Id ? [team1Id, team2Id] : [team2Id, team1Id];
        const dbH2H = await prisma.cachedH2H.findUnique({
            where: {
                team1Id_team2Id: { team1Id: id1, team2Id: id2 },
            },
        });

        if (dbH2H) {
            const h2hData = {
                summary: {
                    totalMatches: dbH2H.totalMatches,
                    team1Wins: dbH2H.team1Wins,
                    team2Wins: dbH2H.team2Wins,
                    draws: dbH2H.draws,
                },
                matches: dbH2H.lastMatches as any[],
            };
            this.h2hCache.set(cacheKey, { data: h2hData, timestamp: Date.now() });
            logger.debug(`📦 H2H ${cacheKey} from database`);
            return h2hData;
        }

        // 3. Fetch from API
        logger.debug(`📡 Fetching H2H ${cacheKey} from API`);
        try {
            const apiData = await fetchFromApi();
            if (apiData && apiData.length > 0) {
                await this.cacheH2H(team1Id, team2Id, apiData);

                // Calculate summary
                let team1Wins = 0, team2Wins = 0, draws = 0;
                apiData.forEach((match: any) => {
                    if (match.teams.home.winner === true) {
                        if (match.teams.home.id === team1Id) team1Wins++;
                        else team2Wins++;
                    } else if (match.teams.away.winner === true) {
                        if (match.teams.away.id === team1Id) team1Wins++;
                        else team2Wins++;
                    } else {
                        draws++;
                    }
                });

                const h2hData = {
                    summary: {
                        totalMatches: apiData.length,
                        team1Wins,
                        team2Wins,
                        draws,
                    },
                    matches: apiData,
                };

                this.h2hCache.set(cacheKey, { data: h2hData, timestamp: Date.now() });
                return h2hData;
            }
        } catch (error) {
            logger.error(`Failed to fetch H2H ${cacheKey}:`, error);
        }

        return null;
    }

    /**
     * Cache H2H in database
     */
    async cacheH2H(team1Id: number, team2Id: number, matches: any[]): Promise<void> {
        const [id1, id2] = team1Id < team2Id ? [team1Id, team2Id] : [team2Id, team1Id];

        // Calculate summary
        let t1Wins = 0, t2Wins = 0, draws = 0;
        matches.forEach((match: any) => {
            if (match.teams.home.winner === true) {
                if (match.teams.home.id === id1) t1Wins++;
                else t2Wins++;
            } else if (match.teams.away.winner === true) {
                if (match.teams.away.id === id1) t1Wins++;
                else t2Wins++;
            } else {
                draws++;
            }
        });

        try {
            await prisma.cachedH2H.upsert({
                where: {
                    team1Id_team2Id: { team1Id: id1, team2Id: id2 },
                },
                update: {
                    totalMatches: matches.length,
                    team1Wins: t1Wins,
                    team2Wins: t2Wins,
                    draws,
                    lastMatches: matches as any,
                    fullData: matches as any,
                    updatedAt: new Date(),
                },
                create: {
                    team1Id: id1,
                    team2Id: id2,
                    totalMatches: matches.length,
                    team1Wins: t1Wins,
                    team2Wins: t2Wins,
                    draws,
                    lastMatches: matches as any,
                    fullData: matches as any,
                },
            });

            logger.debug(`✅ Cached H2H ${id1} vs ${id2}`);
        } catch (error) {
            logger.error(`Failed to cache H2H:`, error);
        }
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            playersInMemory: this.playerCache.size,
            teamsInMemory: this.teamCache.size,
            h2hInMemory: this.h2hCache.size,
        };
    }
}

export const playerCacheService = new PlayerCacheService();
export { PlayerCacheService, PlayerFromAPI, TeamFromAPI };
