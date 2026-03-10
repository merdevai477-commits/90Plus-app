/**
 * Prediction Watcher Service
 * نظام مراقبة التوقعات وتحديثها تلقائياً
 * 
 * This service watches ALL matches that have predictions (not just favorites)
 * and resolves them when matches end.
 */

import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { footballService } from './football.service';
import { PredictionResolverService } from './prediction-resolver.service';

export class PredictionWatcherService {
    private static isRunning = false;
    private static intervalId: NodeJS.Timeout | null = null;

    /**
     * Start the prediction watcher (runs every 5 minutes)
     */
    static start() {
        if (this.intervalId) {
            logger.info('⚠️ Prediction watcher already running');
            return;
        }

        logger.info('🎯 Starting prediction watcher service...');

        // Run immediately on start
        this.checkPredictions();

        // Then run every 5 minutes
        this.intervalId = setInterval(() => {
            this.checkPredictions();
        }, 5 * 60 * 1000); // 5 minutes

        logger.info('✅ Prediction watcher started (checking every 5 minutes)');
    }

    /**
     * Stop the prediction watcher
     */
    static stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            logger.info('✅ Prediction watcher stopped');
        }
    }

    /**
     * Check all unresolved predictions and resolve finished matches
     */
    static async checkPredictions() {
        if (this.isRunning) {
            logger.debug('⏳ Prediction check already in progress, skipping...');
            return;
        }

        this.isRunning = true;
        logger.info('🔍 Checking unresolved predictions...');

        try {
            // Get all unique match IDs that have unresolved predictions
            const unresolvedPredictions = await (prisma as any).prediction.findMany({
                where: {
                    isCorrect: null, // Not yet resolved
                },
                select: {
                    apiMatchId: true,
                },
                distinct: ['apiMatchId'],
            });

            if (unresolvedPredictions.length === 0) {
                logger.debug('📭 No unresolved predictions to check');
                this.isRunning = false;
                return;
            }

            const matchIds = unresolvedPredictions.map((p: any) => p.apiMatchId);
            logger.info(`📊 Checking ${matchIds.length} matches with unresolved predictions...`);

            // Check each match
            for (const matchId of matchIds) {
                try {
                    await this.checkAndResolveMatch(matchId);
                } catch (error) {
                    logger.error(`Error checking match ${matchId}:`, error);
                }
            }

            logger.info('✅ Prediction check completed');
        } catch (error) {
            logger.error('❌ Prediction watcher error:', error);
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Check a single match and resolve predictions if finished
     */
    private static async checkAndResolveMatch(matchId: number) {
        try {
            // Fetch match data from API-Football
            const data = await footballService.fetchFromApi<any[]>('/fixtures', { id: matchId });

            if (!data || data.length === 0) {
                logger.warn(`⚠️ No data found for match ${matchId}`);
                return;
            }

            const match = data[0];
            const status = match.fixture.status.short;
            const homeScore = match.goals.home;
            const awayScore = match.goals.away;

            // Check if match is finished (FT, AET, PEN)
            if (['FT', 'AET', 'PEN'].includes(status)) {
                logger.info(`🏁 Match ${matchId} is finished (${homeScore}-${awayScore}), resolving predictions...`);
                
                // Resolve all predictions for this match
                await PredictionResolverService.resolveMatchPredictions(matchId, homeScore, awayScore);
            } else {
                logger.debug(`⏳ Match ${matchId} status: ${status} - not finished yet`);
            }
        } catch (error) {
            logger.error(`Error fetching match ${matchId}:`, error);
        }
    }

    /**
     * Manually resolve predictions for a specific match
     * Can be called from admin panel or API
     */
    static async manualResolve(matchId: number): Promise<{ success: boolean; message: string }> {
        try {
            const data = await footballService.fetchFromApi<any[]>('/fixtures', { id: matchId });

            if (!data || data.length === 0) {
                return { success: false, message: 'Match not found' };
            }

            const match = data[0];
            const status = match.fixture.status.short;
            const homeScore = match.goals.home;
            const awayScore = match.goals.away;

            if (!['FT', 'AET', 'PEN'].includes(status)) {
                return { success: false, message: `Match not finished yet (status: ${status})` };
            }

            await PredictionResolverService.resolveMatchPredictions(matchId, homeScore, awayScore);
            
            return { success: true, message: `Resolved predictions for match ${matchId} (${homeScore}-${awayScore})` };
        } catch (error: any) {
            return { success: false, message: error.message || 'Unknown error' };
        }
    }
}

export default PredictionWatcherService;
