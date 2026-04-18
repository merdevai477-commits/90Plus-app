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
import { enqueueNotification } from '../queues/notification.queue';


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

            const oldTop10 = await this.getTop10UserIds();
            let resolvedAny = false;

            // Check each match
            for (const matchId of matchIds) {
                try {
                    const resolved = await this.checkAndResolveMatch(matchId);
                    if (resolved) resolvedAny = true;
                } catch (error) {
                    logger.error(`Error checking match ${matchId}:`, error);
                }
            }

            // If predictions were resolved, check leaderboard changes
            if (resolvedAny) {
                const newTop10 = await this.getTop10UserIds();
                const newIds = newTop10.filter((id) => !oldTop10.includes(id));
                
                for (const userId of newIds) {
                    logger.info(`🏆 User ${userId} entered Top 10 Leaderboard! Sending notification...`);
                    await enqueueNotification({
                        userId,
                        type: 'LEADERBOARD_TOP10',
                        title: '🏆 بطل التوقعات!',
                        message: 'تهانينا! لقد دخلت قائمة أفضل 10 متوقعين 🔥',
                        data: { type: 'LEADERBOARD_TOP10', screen: '/(tabs)/rank' }
                    }).catch(() => {});
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
     * Returns true if predictions were resolved
     */
    private static async checkAndResolveMatch(matchId: number): Promise<boolean> {
        try {
            // Fetch match data from API-Football
            const data = await footballService.fetchFromApi<any[]>('/fixtures', { id: matchId });

            if (!data || data.length === 0) {
                logger.warn(`⚠️ No data found for match ${matchId}`);
                return false;
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
                return true;
            } else {
                logger.debug(`⏳ Match ${matchId} status: ${status} - not finished yet`);
            }
        } catch (error) {
            logger.error(`Error fetching match ${matchId}:`, error);
        }
        return false;
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

            const oldTop10 = await this.getTop10UserIds();
            await PredictionResolverService.resolveMatchPredictions(matchId, homeScore, awayScore);
            const newTop10 = await this.getTop10UserIds();

            const newIds = newTop10.filter((id) => !oldTop10.includes(id));
            for (const userId of newIds) {
                await enqueueNotification({
                    userId,
                    type: 'LEADERBOARD_TOP10',
                    title: '🏆 بطل التوقعات!',
                    message: 'تهانينا! لقد دخلت قائمة أفضل 10 متوقعين 🔥',
                    data: { type: 'LEADERBOARD_TOP10', screen: '/(tabs)/rank' }
                }).catch(() => {});
            }
            
            return { success: true, message: `Resolved predictions for match ${matchId} (${homeScore}-${awayScore})` };
        } catch (error: any) {
            return { success: false, message: error.message || 'Unknown error' };
        }
    }

    /**
     * Get IDs of current Top 10 predictors in leaderboard
     */
    private static async getTop10UserIds(): Promise<string[]> {
        try {
            const countsByUserAndState = await (prisma as any).prediction.groupBy({
                by: ['userId', 'isCorrect'],
                _count: true,
            });

            const statsByUser: Record<string, { correct: number; incorrect: number }> = {};

            for (const row of countsByUserAndState) {
                const userId: string = row.userId;
                if (!statsByUser[userId]) statsByUser[userId] = { correct: 0, incorrect: 0 };
                const c = row._count as number;
                if (row.isCorrect === true) statsByUser[userId].correct += c;
                else if (row.isCorrect === false) statsByUser[userId].incorrect += c;
            }

            const candidates = Object.entries(statsByUser)
                .map(([userId, s]) => {
                    const resolved = s.correct + s.incorrect;
                    const accuracy = resolved > 0 ? Math.round((s.correct / resolved) * 100) : 0;
                    return { userId, stats: { correct: s.correct, accuracy, resolved } };
                })
                .filter((x) => x.stats.resolved > 0)
                .sort((a, b) => {
                    if (b.stats.accuracy !== a.stats.accuracy) return b.stats.accuracy - a.stats.accuracy;
                    return b.stats.correct - a.stats.correct;
                })
                .slice(0, 10);

            return candidates.map(c => c.userId);
        } catch (err) {
            logger.warn('Error fetching Top 10 user IDs for leaderboard check:', err);
            return [];
        }
    }
}

export default PredictionWatcherService;
