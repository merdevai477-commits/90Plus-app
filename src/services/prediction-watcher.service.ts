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
import { getMaxMatchesPerTick } from './prediction-settle-push-policy';
import { isSchemaOk } from './schema-guard.service';
import { loadAuthoritativeSettlementFixture } from './prediction-settlement-snapshot';
import { VOID_STATUSES } from './prediction-void.service';
import { runSettleWatchdog } from './settle-metrics.service';

const FINAL_STATUSES = new Set(['FT', 'AET', 'PEN']);

const isScore = (v: unknown): v is number =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0;

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

            for (const matchId of matchIds) {
                try {
                    await this.checkAndResolveMatch(matchId);
                } catch (error) {
                    logger.error(`Error checking match ${matchId}:`, error);
                }
            }

            await runSettleWatchdog().catch((err) =>
                logger.warn('[predictionWatcher] settle watchdog failed:', err?.message),
            );

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

            const settle = await PredictionResolverService.resolveMatchPredictions(matchId, {
                source: 'manual',
                prefetched: { snapshot, fetchedAt },
            });

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

}

export default PredictionWatcherService;
