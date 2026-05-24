/**
 * Prediction Watcher Service
 *
 * Watches predictions automatically and resolves them when matches end.
 *
 * This service watches ALL matches that have predictions (not just favorites)
 * and resolves them when matches end.
 */

import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { footballService } from './football.service';
import { PredictionResolverService } from './prediction-resolver.service';
import { notifyUser } from './notify.service';
import { NotificationType } from './notification.service';

/**
 * Stable bucket for idempotency on leaderboard notifications. We use UTC
 * day so a user crossing 4→3 multiple times in the same day still gets only
 * one push for that day. Periodic resets (weekly/monthly) can drift in/out
 * across this boundary but the user will be re-notified next day at worst.
 */
function leaderboardPeriodKey(): string {
    return new Date().toISOString().slice(0, 10);
}


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

            const oldBoard = await this.getTopUserIds(10);
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
                const newBoard = await this.getTopUserIds(10);
                await this.notifyLeaderboardEntries(oldBoard, newBoard);
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

            const oldBoard = await this.getTopUserIds(10);
            await PredictionResolverService.resolveMatchPredictions(matchId, homeScore, awayScore);
            const newBoard = await this.getTopUserIds(10);
            await this.notifyLeaderboardEntries(oldBoard, newBoard);

            return { success: true, message: `Resolved predictions for match ${matchId} (${homeScore}-${awayScore})` };
        } catch (error: any) {
            return { success: false, message: error.message || 'Unknown error' };
        }
    }

    /**
     * Dispatch leaderboard celebration notifications when a user newly enters
     * either the top-3 (elite) or the top-10. Both branches share the same
     * `idempotencyKey` per day to avoid spamming a yo-yoing user.
     *
     * Order matters: a user crossing from rank 5 -> 2 receives BOTH the
     * top-10 push (if they were not in top-10 before) and the top-3 push.
     * Most users will already be top-10 when they crack top-3, so the
     * top-10 branch is a no-op.
     */
    private static async notifyLeaderboardEntries(
        oldBoard: string[],
        newBoard: string[],
    ): Promise<void> {
        const oldTop10 = new Set(oldBoard.slice(0, 10));
        const newTop10 = newBoard.slice(0, 10);
        const oldTop3 = new Set(oldBoard.slice(0, 3));
        const newTop3 = newBoard.slice(0, 3);
        const period = leaderboardPeriodKey();

        const top10New = newTop10.filter((id) => !oldTop10.has(id));
        for (const userId of top10New) {
            logger.info(`🏆 User ${userId} entered Top 10 Leaderboard`);
            await notifyUser({
                userId,
                type: NotificationType.LEADERBOARD_TOP10,
                titleKey: 'leaderboardTop10Title',
                bodyKey: 'leaderboardTop10Body',
                data: { screen: '/(tabs)/rank', rank: newBoard.indexOf(userId) + 1 },
                idempotencyKey: `top10:${userId}:${period}`,
            }).catch((err) => logger.warn('[predictionWatcher] top10 notify failed:', err?.message));
        }

        const top3New = newTop3.filter((id) => !oldTop3.has(id));
        for (const userId of top3New) {
            logger.info(`🥇 User ${userId} entered Top 3 Leaderboard (elite)`);
            await notifyUser({
                userId,
                type: NotificationType.LEADERBOARD_TOP3,
                titleKey: 'leaderboardTop3Title',
                bodyKey: 'leaderboardTop3Body',
                data: { screen: '/(tabs)/rank', rank: newBoard.indexOf(userId) + 1 },
                idempotencyKey: `top3:${userId}:${period}`,
            }).catch((err) => logger.warn('[predictionWatcher] top3 notify failed:', err?.message));
        }
    }

    /**
     * Get IDs of the current top-N predictors, ordered. We fetch with `n`
     * so the same query backs both the top-3 and top-10 branches.
     */
    private static async getTopUserIds(n: number = 10): Promise<string[]> {
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
                .slice(0, Math.max(1, n));

            return candidates.map(c => c.userId);
        } catch (err) {
            logger.warn('Error fetching top user IDs for leaderboard check:', err);
            return [];
        }
    }
}

export default PredictionWatcherService;
