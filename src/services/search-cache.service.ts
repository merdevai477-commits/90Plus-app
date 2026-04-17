/**
 * Search Cache Service
 * نظام البحث الذكي مع التخزين المؤقت
 * 
 * Features:
 * - Caches search results in PostgreSQL for instant retrieval
 * - All users share the same cached results
 * - Tracks popular searches for suggestions
 * - Returns teams, players, leagues, and matches
 */

import { logger } from '../utils/logger';
import { footballService } from './football.service';
import { matchCacheService } from './match-cache.service';
import prisma from '../lib/prisma'; // ✅ Use centralized singleton

// Cache TTL for search results (1 hour for general, 5 min for matches)
const SEARCH_CACHE_TTL = 60 * 60 * 1000; // 1 hour

interface SearchResult {
    teams: any[];
    players: any[];
    leagues: any[];
    matches: {
        live: any[];
        upcoming: any[];
        finished: any[];
    };
    fromCache: boolean;
    searchCount?: number;
}

class SearchCacheService {
    /**
     * Main search function - checks cache first, then fetches from API
     * Optimized for speed - returns cached results immediately
     */
    async search(query: string): Promise<SearchResult> {
        const normalizedQuery = this.normalizeQuery(query);
        
        if (!normalizedQuery || normalizedQuery.length < 2) {
            return this.emptyResult();
        }

        // 1. Check cache first - return immediately if found
        const cached = await this.getCachedSearch(normalizedQuery);
        if (cached) {
            logger.debug(`📦 Search cache hit for "${normalizedQuery}"`);
            // Update search count in background (don't wait)
            this.incrementSearchCount(normalizedQuery).catch(() => {});
            return {
                ...cached,
                fromCache: true,
            };
        }

        // 2. Fetch fresh data (optimized - parallel queries)
        logger.debug(`🔍 Fetching fresh search results for "${normalizedQuery}"`);
        const result = await this.fetchFreshResults(normalizedQuery);

        // 3. Cache the results in background (don't wait)
        this.cacheSearchResults(normalizedQuery, result).catch(() => {});

        // 4. Track popular search in background (don't wait)
        this.trackPopularSearch(normalizedQuery).catch(() => {});

        return {
            ...result,
            fromCache: false,
        };
    }

    /**
     * Get cached search results
     */
    private async getCachedSearch(query: string): Promise<SearchResult | null> {
        try {
            const cached = await prisma.cachedSearch.findUnique({
                where: { query },
            });

            if (!cached) return null;

            // Check if cache is still valid (1 hour for static data)
            const cacheAge = Date.now() - cached.updatedAt.getTime();
            if (cacheAge > SEARCH_CACHE_TTL) {
                // Cache expired, but still return it while refreshing in background
                this.refreshSearchInBackground(query).catch(console.error);
            }

            return {
                teams: (cached.teams as any[]) || [],
                players: (cached.players as any[]) || [],
                leagues: (cached.leagues as any[]) || [],
                matches: (cached.matches as any) || { live: [], upcoming: [], finished: [] },
                fromCache: true,
                searchCount: cached.searchCount,
            };
        } catch (error) {
            logger.error('Error getting cached search:', error);
            return null;
        }
    }

    /**
     * Fetch fresh results from API and database
     * Optimized for speed - database queries run in parallel
     */
    private async fetchFreshResults(query: string): Promise<SearchResult> {
        const result: SearchResult = {
            teams: [],
            players: [],
            leagues: [],
            matches: { live: [], upcoming: [], finished: [] },
            fromCache: false,
        };

        try {
            // Search in parallel for speed
            const [teams, players, leagues, dbMatches] = await Promise.all([
                this.searchTeams(query),
                this.searchPlayers(query),
                this.searchLeagues(query),
                this.searchMatchesInDb(query),
            ]);

            result.teams = teams;
            result.players = players;
            result.leagues = leagues;

            // Add matches from DB search
            if (dbMatches.length > 0) {
                result.matches.finished = dbMatches.slice(0, 10);
            }

            // If we found teams, get their matches (but don't block)
            if (teams.length > 0) {
                const teamId = teams[0].id;
                if (teamId) {
                    try {
                        const teamMatches = await this.getTeamMatches(teamId);
                        result.matches.live = teamMatches.live;
                        result.matches.upcoming = teamMatches.upcoming;
                        // Merge finished matches (avoid duplicates)
                        const existingIds = new Set(result.matches.finished.map((m: any) => m.fixture?.id));
                        for (const match of teamMatches.finished) {
                            if (!existingIds.has(match.fixture?.id)) {
                                result.matches.finished.push(match);
                            }
                        }
                        result.matches.finished = result.matches.finished.slice(0, 10);
                    } catch (error) {
                        // Team matches failed - continue with what we have
                    }
                }
            }

        } catch (error) {
            logger.error('Error fetching fresh search results:', error);
        }

        return result;
    }

    /**
     * Search teams in database and API
     */
    private async searchTeams(query: string): Promise<any[]> {
        try {
            // Search in database first
            const dbTeams = await prisma.cachedTeam.findMany({
                where: {
                    OR: [
                        { name: { contains: query, mode: 'insensitive' } },
                        { code: { contains: query, mode: 'insensitive' } },
                    ],
                },
                take: 10,
            });

            if (dbTeams.length > 0) {
                return dbTeams.map((t: any) => ({
                    id: t.teamId,
                    name: t.name,
                    logo: t.logo,
                    country: t.country,
                    type: 'team',
                }));
            }

            // Fetch from API only if no results in DB
            try {
                const apiTeams = await footballService.searchTeams(query);
                
                // Cache teams in background
                for (const team of apiTeams) {
                    this.cacheTeam(team).catch(() => {});
                }

                return apiTeams.slice(0, 10).map((t: any) => ({
                    id: t.team?.id || t.id,
                    name: t.team?.name || t.name,
                    logo: t.team?.logo || t.logo,
                    country: t.team?.country || t.country,
                    type: 'team',
                }));
            } catch (apiError) {
                logger.warn('API team search failed, returning empty');
                return [];
            }
        } catch (error) {
            logger.error('Error searching teams:', error);
            return [];
        }
    }

    /**
     * Search players in database only (API requires team/league ID on Free Plan)
     * Players are cached when users view player profiles
     */
    private async searchPlayers(query: string): Promise<any[]> {
        try {
            // Search in database only - API Free Plan doesn't support player search without team/league
            const dbPlayers = await prisma.cachedPlayer.findMany({
                where: {
                    OR: [
                        { name: { contains: query, mode: 'insensitive' } },
                        { firstname: { contains: query, mode: 'insensitive' } },
                        { lastname: { contains: query, mode: 'insensitive' } },
                    ],
                },
                take: 10,
            });

            return dbPlayers.map((p: any) => ({
                id: p.playerId,
                name: p.name,
                photo: p.photo,
                team: p.teamName,
                nationality: p.nationality,
                position: p.position,
                type: 'player',
            }));
        } catch (error) {
            logger.error('Error searching players:', error);
            return [];
        }
    }

    /**
     * Search leagues in database
     */
    private async searchLeagues(query: string): Promise<any[]> {
        try {
            const dbLeagues = await prisma.cachedLeague.findMany({
                where: {
                    OR: [
                        { name: { contains: query, mode: 'insensitive' } },
                        { country: { contains: query, mode: 'insensitive' } },
                    ],
                },
                take: 10,
            });

            return dbLeagues.map((l: any) => ({
                id: l.leagueId,
                name: l.name,
                logo: l.logo,
                country: l.country,
                type: 'league',
            }));
        } catch (error) {
            logger.error('Error searching leagues:', error);
            return [];
        }
    }

    /**
     * Search matches in database by team name
     */
    private async searchMatchesInDb(query: string): Promise<any[]> {
        try {
            const matches = await prisma.cachedFixture.findMany({
                where: {
                    OR: [
                        { homeTeamName: { contains: query, mode: 'insensitive' } },
                        { awayTeamName: { contains: query, mode: 'insensitive' } },
                        { leagueName: { contains: query, mode: 'insensitive' } },
                    ],
                },
                orderBy: { matchDate: 'desc' },
                take: 10,
            });

            return matches.map((m: any) => matchCacheService.convertDbMatchToApiFormat(m));
        } catch (error) {
            logger.error('Error searching matches in DB:', error);
            return [];
        }
    }

    /**
     * Get team matches (live, upcoming, finished)
     */
    private async getTeamMatches(teamId: number): Promise<{ live: any[]; upcoming: any[]; finished: any[] }> {
        try {
            // Get finished matches from database first (instant)
            const dbMatches = await prisma.cachedFixture.findMany({
                where: {
                    OR: [
                        { homeTeamId: teamId },
                        { awayTeamId: teamId },
                    ],
                },
                orderBy: { matchDate: 'desc' },
                take: 10,
            });

            const finished = dbMatches
                .filter((m: any) => ['FT', 'AET', 'PEN'].includes(m.status))
                .slice(0, 5)
                .map((m: any) => matchCacheService.convertDbMatchToApiFormat(m));

            // Try to get live and upcoming from API (non-blocking)
            let live: any[] = [];
            let upcoming: any[] = [];

            try {
                const apiMatches = await footballService.getFixtures({ team: teamId, season: 2024 });
                
                for (const match of apiMatches) {
                    const status = match.fixture?.status?.short;
                    if (['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'].includes(status)) {
                        live.push(match);
                    } else if (['NS', 'TBD'].includes(status)) {
                        upcoming.push(match);
                    }
                }

                // Archive finished matches in background
                matchCacheService.archiveFinishedMatches(apiMatches).catch(() => {});
            } catch (error) {
                // API failed - just return what we have from DB
                logger.debug('Could not fetch live/upcoming matches from API');
            }

            return {
                live: live.slice(0, 3),
                upcoming: upcoming.slice(0, 5),
                finished,
            };
        } catch (error) {
            logger.error('Error getting team matches:', error);
            return { live: [], upcoming: [], finished: [] };
        }
    }

    /**
     * Cache search results
     */
    private async cacheSearchResults(query: string, result: SearchResult): Promise<void> {
        try {
            await prisma.cachedSearch.upsert({
                where: { query },
                update: {
                    teams: result.teams,
                    players: result.players,
                    leagues: result.leagues,
                    matches: result.matches,
                    resultCount: result.teams.length + result.players.length + result.leagues.length,
                    searchCount: { increment: 1 },
                    lastSearchedAt: new Date(),
                    updatedAt: new Date(),
                },
                create: {
                    query,
                    teams: result.teams,
                    players: result.players,
                    leagues: result.leagues,
                    matches: result.matches,
                    resultCount: result.teams.length + result.players.length + result.leagues.length,
                    searchCount: 1,
                    lastSearchedAt: new Date(),
                },
            });
        } catch (error) {
            logger.error('Error caching search results:', error);
        }
    }

    /**
     * Increment search count for cached query
     */
    private async incrementSearchCount(query: string): Promise<void> {
        try {
            await prisma.cachedSearch.update({
                where: { query },
                data: {
                    searchCount: { increment: 1 },
                    lastSearchedAt: new Date(),
                },
            });
        } catch (error) {
            // Ignore errors
        }
    }

    /**
     * Track popular searches
     */
    private async trackPopularSearch(query: string): Promise<void> {
        try {
            await prisma.popularSearch.upsert({
                where: { query },
                update: {
                    searchCount: { increment: 1 },
                    lastSearchedAt: new Date(),
                },
                create: {
                    query,
                    searchCount: 1,
                    lastSearchedAt: new Date(),
                },
            });
        } catch (error) {
            // Ignore errors
        }
    }

    /**
     * Refresh search results in background
     */
    private async refreshSearchInBackground(query: string): Promise<void> {
        const result = await this.fetchFreshResults(query);
        await this.cacheSearchResults(query, result);
    }

    /**
     * Get popular searches for suggestions
     */
    async getPopularSearches(limit: number = 10): Promise<string[]> {
        try {
            const popular = await prisma.popularSearch.findMany({
                orderBy: { searchCount: 'desc' },
                take: limit,
                select: { query: true },
            });
            return popular.map((p: any) => p.query);
        } catch (error) {
            logger.error('Error getting popular searches:', error);
            return [];
        }
    }

    /**
     * Cache a team
     */
    private async cacheTeam(team: any): Promise<void> {
        const teamData = team.team || team;
        if (!teamData?.id) return;

        try {
            await prisma.cachedTeam.upsert({
                where: { teamId: teamData.id },
                update: {
                    name: teamData.name,
                    logo: teamData.logo,
                    country: teamData.country,
                    fullData: team,
                    updatedAt: new Date(),
                },
                create: {
                    teamId: teamData.id,
                    name: teamData.name,
                    code: teamData.code,
                    logo: teamData.logo,
                    country: teamData.country,
                    fullData: team,
                },
            });
        } catch (error) {
            // Ignore duplicate errors
        }
    }

    /**
     * Cache a player
     */
    private async cachePlayer(player: any): Promise<void> {
        const playerData = player.player || player;
        if (!playerData?.id) return;

        try {
            await prisma.cachedPlayer.upsert({
                where: { playerId: playerData.id },
                update: {
                    name: playerData.name,
                    photo: playerData.photo,
                    nationality: playerData.nationality,
                    teamName: player.statistics?.[0]?.team?.name,
                    teamId: player.statistics?.[0]?.team?.id,
                    position: player.statistics?.[0]?.games?.position,
                    fullData: player,
                    updatedAt: new Date(),
                },
                create: {
                    playerId: playerData.id,
                    name: playerData.name,
                    firstname: playerData.firstname,
                    lastname: playerData.lastname,
                    photo: playerData.photo,
                    nationality: playerData.nationality,
                    age: playerData.age,
                    teamName: player.statistics?.[0]?.team?.name,
                    teamId: player.statistics?.[0]?.team?.id,
                    teamLogo: player.statistics?.[0]?.team?.logo,
                    position: player.statistics?.[0]?.games?.position,
                    fullData: player,
                },
            });
        } catch (error) {
            // Ignore duplicate errors
        }
    }

    /**
     * Normalize search query
     */
    private normalizeQuery(query: string): string {
        return query.toLowerCase().trim();
    }

    /**
     * Empty result helper
     */
    private emptyResult(): SearchResult {
        return {
            teams: [],
            players: [],
            leagues: [],
            matches: { live: [], upcoming: [], finished: [] },
            fromCache: false,
        };
    }

    /**
     * Get cache statistics
     */
    async getCacheStats(): Promise<{
        totalSearches: number;
        uniqueQueries: number;
        popularSearches: string[];
    }> {
        const [totalSearches, uniqueQueries, popular] = await Promise.all([
            prisma.cachedSearch.aggregate({ _sum: { searchCount: true } }),
            prisma.cachedSearch.count(),
            this.getPopularSearches(5),
        ]);

        return {
            totalSearches: totalSearches._sum.searchCount || 0,
            uniqueQueries,
            popularSearches: popular,
        };
    }
}

export const searchCacheService = new SearchCacheService();
