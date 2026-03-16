/**
 * League Cache Service
 * 
 * Caches all available leagues in PostgreSQL and provides search utility.
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { footballService } from './football.service';

const prisma = new PrismaClient();

class LeagueCacheService {
    private leagueCache: any[] | null = null;
    private lastUpdate = 0;
    private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

    /**
     * Get all leagues (from cache, DB, or API)
     */
    async getAllLeagues(): Promise<any[]> {
        const now = Date.now();

        // 1. Memory Cache
        if (this.leagueCache && now - this.lastUpdate < 3600000) { // 1 hour memory TTL
            return this.leagueCache;
        }

        // 2. Database
        const dbLeagues = await (prisma as any).cachedLeague.findMany({
            orderBy: { name: 'asc' }
        });

        if (dbLeagues.length > 50) { // Assume we have at least 50 leagues for it to be "all"
            const leagues = dbLeagues.map((l: any) => l.fullData);
            this.leagueCache = leagues;
            this.lastUpdate = now;
            logger.debug(`📦 Loaded ${leagues.length} leagues from database`);
            return leagues;
        }

        // 3. API
        logger.debug('📡 Fetching all leagues from API...');
        try {
            const apiLeagues = await footballService.getLeagues();
            if (apiLeagues && apiLeagues.length > 0) {
                await this.cacheLeagues(apiLeagues);
                this.leagueCache = apiLeagues;
                this.lastUpdate = now;
                return apiLeagues;
            }
        } catch (error) {
            logger.error('Failed to fetch leagues from API:', error);
        }

        return dbLeagues.map((l: any) => l.fullData);
    }

    /**
     * Cache leagues in database
     */
    private async cacheLeagues(leagues: any[]): Promise<void> {
        logger.debug(`📥 Caching ${leagues.length} leagues to database...`);

        // Use transaction for bulk speed
        const operations = leagues.map(item => {
            const l = item.league || item;
            const country = item.country || {};

            return (prisma as any).cachedLeague.upsert({
                where: { leagueId: l.id },
                update: {
                    name: l.name,
                    country: country.name || 'Unknown',
                    logo: l.logo,
                    type: l.type || 'league',
                    fullData: item,
                    updatedAt: new Date()
                },
                create: {
                    leagueId: l.id,
                    name: l.name,
                    country: country.name || 'Unknown',
                    logo: l.logo,
                    type: l.type || 'league',
                    fullData: item
                }
            });
        });

        // Execute in smaller chunks to avoid overwhelming DB connection pool (P2024 error)
        const chunkSize = 10;
        for (let i = 0; i < operations.length; i += chunkSize) {
            const chunk = operations.slice(i, i + chunkSize);
            await Promise.all(chunk);
            // Optional: small delay between chunks if pool is very small
            // await new Promise(r => setTimeout(r, 10));
        }

        logger.debug('✅ Finished caching leagues');
    }

    /**
     * Unified search across players, teams, and leagues
     * NOTE: Player search from API is disabled (Free Plan limitation)
     * Players are searched from database only
     */
    async unifiedSearch(query: string) {
        if (!query || query.length < 2) return { players: [], teams: [], leagues: [] };

        // Search players from database only (API Free Plan doesn't support player search)
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

        const [teams, apiLeagues] = await Promise.all([
            footballService.searchTeams(query),
            footballService.searchLeagues(query)
        ]);

        // Format results
        return {
            players: dbPlayers.map(p => ({
                id: p.playerId,
                name: p.name,
                photo: p.photo,
                team: p.teamName,
                type: 'player'
            })),
            teams: teams.map(t => ({
                id: t.team.id,
                name: t.team.name,
                logo: t.team.logo,
                country: t.team.country,
                type: 'team'
            })),
            leagues: apiLeagues.map(l => ({
                id: l.league.id,
                name: l.league.name,
                logo: l.league.logo,
                country: l.country.name,
                type: 'league'
            }))
        };
    }
}

export const leagueCacheService = new LeagueCacheService();
