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
import { PredictionResolverService } from './prediction-resolver.service';
import { CompetitionResolverService } from './competition-resolver.service';
import { notifyUser } from './notify.service';
import { NotificationType } from './notification.service';
import { allowLeaderboardPush, getMaxMatchesPerTick } from './prediction-settle-push-policy';
import { isSchemaOk } from './schema-guard.service';
import { loadAuthoritativeSettlementFixture } from './prediction-settlement-snapshot';
import { VOID_STATUSES } from './prediction-void.service';

const FINAL_STATUSES = new Set(['FT', 'AET', 'PEN']);

const isScore = (v: unknown): v is number =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0;

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
        if (!isSchemaOk()) {
            logger.error(JSON.stringify({ event: 'PREDICTION_WATCHER_DISABLED', reason: 'SCHEMA_MISMATCH' }));
            return;
        }

        logger.info('🎯 Starting prediction watcher service...');

        // Run immediately on start
        this.checkPredictions();

        // Then run every 2 minutes
        this.intervalId = setInterval(() => {
            this.checkPredictions();
        }, 2 * 60 * 1000); // 2 minutes

        logger.info('✅ Prediction watcher started (checking every 2 minutes)');
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
     * SIGTERM path (E5): stop scheduling, tell in-flight settles to stop at the
     * next row boundary, and wait up to timeoutMs. Unsettled rows stay pending
     * and the lease is released, so the next instance resumes them.
     */
    static async stopAndDrain(timeoutMs: number): Promise<boolean> {
        this.stop();
        PredictionResolverService.beginShutdown();
        const started = Date.now();
        while (this.isRunning && Date.now() - started < timeoutMs) {
            await new Promise((r) => setTimeout(r, 100));
        }
        const drained = await PredictionResolverService.drain(Math.max(0, timeoutMs - (Date.now() - started)));
        logger.info(
            JSON.stringify({
                event: drained && !this.isRunning ? 'SETTLE_DRAINED' : 'SETTLE_DRAIN_TIMEOUT',
                waitedMs: Date.now() - started,
            }),
        );
        return drained && !this.isRunning;
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
            // Close entry on Predict & Win competitions whose deadline has passed,
            // independently of whether their match has any unresolved predictions.
            await CompetitionResolverService.lockExpiredCompetitions().catch((err) =>
                logger.warn('[predictionWatcher] competition lock failed:', err?.message),
            );

            // Get all unique match IDs that have unresolved predictions.
            const [unresolvedPredictions, unresolvedCompetitions] = await Promise.all([
                (prisma as any).prediction.findMany({
                    where: { isCorrect: null, voidedAt: null },
                    select: { apiMatchId: true },
                    distinct: ['apiMatchId'],
                }),
                prisma.competition
                    .findMany({
                        where: { status: { in: ['PUBLISHED', 'LOCKED'] } },
                        select: { apiMatchId: true },
                        distinct: ['apiMatchId'],
                    })
                    .catch((err: any) => {
                        if (err?.code === 'P2021') return [];
                        throw err;
                    }),
            ]);

            const matchIdSet = new Set<number>([
                ...unresolvedPredictions.map((p: any) => p.apiMatchId),
                ...unresolvedCompetitions.map((p) => p.apiMatchId),
            ]);
            const allMatchIds = Array.from(matchIdSet);
            if (allMatchIds.length === 0) {
                logger.debug('📭 No unresolved predictions to check');
                this.isRunning = false;
                return;
            }
            const matchIds = this.nextTickWindow(allMatchIds);
            logger.info(
                `📊 Checking ${matchIds.length}/${allMatchIds.length} matches with unresolved predictions...`,
            );

            const oldBoard = await this.getTopUserIds(10);
            let resolvedAny = false;
            let freshResolved = false;

            // Check each match
            for (const matchId of matchIds) {
                try {
                    const result = await this.checkAndResolveMatch(matchId);
                    if (result.resolved) resolvedAny = true;
                    if (result.resolved && !result.staleOnly) freshResolved = true;
                } catch (error) {
                    logger.error(`Error checking match ${matchId}:`, error);
                }
            }

            // Leaderboard-entry pushes only for fresh results; a stale backlog settles silently.
            if (resolvedAny && freshResolved && allowLeaderboardPush()) {
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
     * Check a single match and settle it when finished. `resolved` is true only
     * when this call actually settled rows (A11) — a gate reject, a held lock or
     * an already-settled match does not count.
     */
    static async checkAndResolveMatch(
        matchId: number,
    ): Promise<{ resolved: boolean; staleOnly: boolean }> {
        const notResolved = { resolved: false, staleOnly: false };
        try {
            // Same snapshot source + 365 classifier the settler uses (A2).
            const fetchedAt = Date.now();
            const snapshot = await loadAuthoritativeSettlementFixture(matchId);

            if (!snapshot?.status) {
                logger.debug(`Prediction watcher: no fixture data for match ${matchId}`);
                return notResolved;
            }

            const { status, homeScore, awayScore } = snapshot;
            const prefetched = { snapshot, fetchedAt };

            if (FINAL_STATUSES.has(status)) {
                logger.info(`🏁 Match ${matchId} is finished (${homeScore}-${awayScore}), resolving predictions...`);

                const settle = await PredictionResolverService.resolveMatchPredictions(matchId, {
                    source: 'prediction-watcher',
                    prefetched,
                });
                if (isScore(homeScore) && isScore(awayScore)) {
                    await CompetitionResolverService.resolveMatchCompetitions(matchId, homeScore, awayScore, status);
                }
                const resolved = settle.outcome === 'SETTLE_COMPLETE' && settle.settled > 0;
                return { resolved, staleOnly: resolved && settle.staleOnly };
            }

            if (VOID_STATUSES.has(status)) {
                // The settler owns VOID (lease + 48h + flag); the gate rejects and
                // hands the row set to the void path.
                await PredictionResolverService.resolveMatchPredictions(matchId, {
                    source: 'prediction-watcher',
                    prefetched,
                });
            }
            // A postponed/abandoned match will never produce a result, so any
            // Predict & Win competition riding on it is closed out instead of
            // being left open forever.
            await CompetitionResolverService.cancelForAbandonedMatch(matchId, status);
            logger.debug(`⏳ Match ${matchId} status: ${status} - not finished yet`);
        } catch (error) {
            logger.error(`Error fetching match ${matchId}:`, error);
        }
        return notResolved;
    }

    private static tickCursor = 0;

    /**
     * Cap matches per tick and rotate the window so permanently-stuck old
     * matches cannot starve fresh ones.
     */
    static nextTickWindow(matchIds: number[]): number[] {
        const cap = getMaxMatchesPerTick();
        if (matchIds.length <= cap) {
            this.tickCursor = 0;
            return matchIds;
        }
        const start = this.tickCursor % matchIds.length;
        const window: number[] = [];
        for (let i = 0; i < cap; i += 1) window.push(matchIds[(start + i) % matchIds.length]);
        this.tickCursor = (start + cap) % matchIds.length;
        return window;
    }

    /**
     * Manually resolve predictions for a specific match
     * Can be called from admin panel or API
     */
    static async manualResolve(matchId: number): Promise<{ success: boolean; message: string }> {
        try {
            const fetchedAt = Date.now();
            const snapshot = await loadAuthoritativeSettlementFixture(matchId);
            if (!snapshot?.status) {
                return { success: false, message: 'Match not found' };
            }

            const { status, homeScore, awayScore } = snapshot;
            if (!FINAL_STATUSES.has(status)) {
                return { success: false, message: `Match not finished yet (status: ${status})` };
            }

            const oldBoard = await this.getTopUserIds(10);
            const settle = await PredictionResolverService.resolveMatchPredictions(matchId, {
                source: 'manual',
                prefetched: { snapshot, fetchedAt },
            });
            const newBoard = await this.getTopUserIds(10);
            await this.notifyLeaderboardEntries(oldBoard, newBoard);

            if (settle.outcome !== 'SETTLE_COMPLETE') {
                return { success: false, message: `Not settled: ${settle.outcome}` };
            }
            return {
                success: true,
                message: `Resolved ${settle.settled} predictions for match ${matchId} (${homeScore}-${awayScore})`,
            };
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
