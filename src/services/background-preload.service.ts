/**
 * Background Preload Service
 * 
 * ✅ OPTIMIZATION 4: Preloads frequently accessed team data in the background
 * to reduce API response times and improve user experience.
 * 
 * This service runs periodically to:
 * 1. Preload teams from upcoming matches
 * 2. Preload teams from user favorite matches
 * 3. Preload popular teams (most searched/viewed)
 */

import { logger } from '../utils/logger';
import { footballDataCacheService } from './football-data-cache.service';
import { footballService } from './football.service';
import prisma from '../lib/prisma';

class BackgroundPreloadService {
    private isRunning = false;
    private intervalId: NodeJS.Timeout | null = null;
    private readonly PRELOAD_INTERVAL = 30 * 60 * 1000; // Run every 30 minutes
    private readonly MAX_TEAMS_PER_BATCH = 20; // Preload up to 20 teams at a time
    private disabledUntilMs = 0;
    private lastQuotaLogAtMs = 0;

    private isFreePlan(): boolean {
        return process.env.FOOTBALL_API_PLAN === 'free' || !process.env.FOOTBALL_API_PLAN;
    }

    private isQuotaError(error: any): boolean {
        const msg = String(error?.message || error || '').toLowerCase();
        return msg.includes('reached the request limit') || msg.includes('request limit for the day');
    }

    /**
     * Start background preloading service
     */
    start(): void {
        if (this.isFreePlan()) {
            logger.warn('[BackgroundPreload] ⚠️ Service DISABLED - Free Plan detected (API-Football daily limit)');
            logger.info('[BackgroundPreload] 💡 Set FOOTBALL_API_PLAN=pro to enable background preloading');
            return;
        }

        if (this.isRunning) {
            logger.warn('[BackgroundPreload] Service already running');
            return;
        }

        this.isRunning = true;
        logger.info('[BackgroundPreload] ✅ Service started');

        // Run immediately on start
        this.preloadTeams().catch(err => {
            logger.error('[BackgroundPreload] Initial preload failed:', err);
        });

        // Then run periodically
        this.intervalId = setInterval(() => {
            this.preloadTeams().catch(err => {
                logger.error('[BackgroundPreload] Periodic preload failed:', err);
            });
        }, this.PRELOAD_INTERVAL);
    }

    /**
     * Stop background preloading service
     */
    stop(): void {
        if (!this.isRunning) return;

        this.isRunning = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        logger.info('[BackgroundPreload] ⏹️ Service stopped');
    }

    /**
     * Main preload function - identifies teams to preload and fetches them
     */
    private async preloadTeams(): Promise<void> {
        if (!this.isRunning) return;

        try {
            // If we've hit API quota recently, back off to avoid log spam / wasted work
            if (Date.now() < this.disabledUntilMs) {
                return;
            }

            logger.debug('[BackgroundPreload] 🔄 Starting team preload cycle...');

            // Get teams to preload from multiple sources
            const teamIdsToPreload = await this.getTeamsToPreload();

            if (teamIdsToPreload.length === 0) {
                logger.debug('[BackgroundPreload] No teams to preload');
                return;
            }

            logger.debug(`[BackgroundPreload] Preloading ${teamIdsToPreload.length} teams...`);

            // Batch preload teams (use batch API for efficiency)
            const batches: number[][] = [];
            for (let i = 0; i < teamIdsToPreload.length; i += this.MAX_TEAMS_PER_BATCH) {
                batches.push(teamIdsToPreload.slice(i, i + this.MAX_TEAMS_PER_BATCH));
            }

            // Process batches sequentially to avoid overwhelming the API
            for (const batch of batches) {
                try {
                    await footballDataCacheService.getTeams(batch);
                    logger.debug(`[BackgroundPreload] ✅ Preloaded batch of ${batch.length} teams`);
                    
                    // Small delay between batches to respect rate limits
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (error) {
                    // If quota is exhausted, disable for a while (don't spam logs)
                    if (this.isQuotaError(error)) {
                        const now = Date.now();
                        this.disabledUntilMs = now + 6 * 60 * 60 * 1000; // 6 hours backoff
                        if (now - this.lastQuotaLogAtMs > 5 * 60 * 1000) {
                            this.lastQuotaLogAtMs = now;
                            logger.warn('[BackgroundPreload] ⚠️ API-Football quota exhausted. Disabling team preload temporarily.');
                        }
                        return;
                    }

                    logger.error(`[BackgroundPreload] Failed to preload batch:`, error);
                }
            }

            logger.info(`[BackgroundPreload] ✅ Completed preloading ${teamIdsToPreload.length} teams`);
        } catch (error) {
            if (this.isQuotaError(error)) {
                const now = Date.now();
                this.disabledUntilMs = now + 6 * 60 * 60 * 1000; // 6 hours backoff
                if (now - this.lastQuotaLogAtMs > 5 * 60 * 1000) {
                    this.lastQuotaLogAtMs = now;
                    logger.warn('[BackgroundPreload] ⚠️ API-Football quota exhausted. Disabling team preload temporarily.');
                }
                return;
            }
            logger.error('[BackgroundPreload] Preload cycle failed:', error);
        }
    }

    /**
     * Identify teams that should be preloaded
     * Priority:
     * 1. Teams from upcoming matches (next 24 hours)
     * 2. Teams from user favorite matches
     * 3. Teams from recent popular matches
     */
    private async getTeamsToPreload(): Promise<number[]> {
        const teamIds = new Set<number>();

        try {
            // 1. Get teams from upcoming matches (next 24 hours)
            // ✅ FIX: Fetch each day separately using 'date' parameter to avoid API errors
            const today = new Date();
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const todayStr = today.toISOString().split('T')[0];
            const tomorrowStr = tomorrow.toISOString().split('T')[0];

            try {
                // Fetch today's matches
                const todayMatches = await footballService.getFixtures({
                    date: todayStr,
                });

                // Fetch tomorrow's matches
                const tomorrowMatches = await footballService.getFixtures({
                    date: tomorrowStr,
                });

                const allMatches = [...todayMatches, ...tomorrowMatches];

                for (const match of allMatches.slice(0, 50)) { // Limit to 50 matches
                    if (match.teams?.home?.id) teamIds.add(match.teams.home.id);
                    if (match.teams?.away?.id) teamIds.add(match.teams.away.id);
                }
            } catch (error) {
                if (this.isQuotaError(error)) {
                    throw error;
                }
                logger.warn('[BackgroundPreload] Failed to fetch upcoming matches:', error);
            }

            // 2. Get teams from user favorite matches
            try {
                const favoriteMatches = await prisma.favoriteMatch.findMany({
                    where: {
                        matchDate: {
                            gte: new Date(),
                            lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Next 7 days
                        },
                    },
                    take: 100,
                });

                // Extract team IDs from favorite matches (we need to fetch match details)
                // For now, we'll skip this as it requires additional API calls
                // In a future optimization, we could store team IDs in FavoriteMatch
            } catch (error) {
                logger.warn('[BackgroundPreload] Failed to fetch favorite matches:', error);
            }

            // 3. Get teams from recent popular matches (from database)
            try {
                const recentMatches = await prisma.cachedFixture.findMany({
                    where: {
                        matchDate: {
                            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
                        },
                    },
                    orderBy: { matchDate: 'desc' },
                    take: 50,
                });

                for (const match of recentMatches) {
                    if (match.homeTeamId) teamIds.add(match.homeTeamId);
                    if (match.awayTeamId) teamIds.add(match.awayTeamId);
                }
            } catch (error) {
                logger.warn('[BackgroundPreload] Failed to fetch recent matches:', error);
            }

        } catch (error) {
            logger.error('[BackgroundPreload] Error getting teams to preload:', error);
        }

        return Array.from(teamIds).slice(0, 50); // Limit to 50 teams per cycle
    }

    /**
     * Manually trigger a preload cycle (useful for testing or immediate preload)
     */
    async triggerPreload(): Promise<void> {
        logger.info('[BackgroundPreload] 🔄 Manual preload triggered');
        await this.preloadTeams();
    }
}

// Export singleton instance
export const backgroundPreloadService = new BackgroundPreloadService();

