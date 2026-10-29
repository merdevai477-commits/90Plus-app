/**
 * Prediction Resolver Service
 *
 * Settles King predictions when a match reaches FT / AET / PEN.
 * All paths must go through resolveMatchPredictions → settle lock →
 * authoritative fixture re-read → resolveSettlementInput gate.
 */

import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { NotificationService } from './notification.service';
import { awardXp, levelFromXp, XP_VALUES } from './xp.service';
import { clearResponseCache } from '../middleware/responseCache.middleware';
import { acquireSettleLock } from './prediction-settle-lock';
import {
  isExactPredictionCorrect,
  isWinnerPredictionCorrect,
  resolveSettlementInput,
  type SettlementOk,
} from './prediction-settlement-gate';
import { loadAuthoritativeSettlementFixture } from './prediction-settlement-snapshot';
import { isSchemaOk } from './schema-guard.service';
import { decideResultPush, isStaleKickoff } from './prediction-settle-push-policy';

const CORRECT_PREDICTION_REWARD = 10;

export type SettleOutcome =
  | 'SETTLE_COMPLETE'
  | 'SETTLE_SKIPPED_SCHEMA'
  | 'SETTLE_SKIPPED_LOCKED'
  | 'SETTLE_SKIPPED_NO_LOCK'
  | 'SETTLE_SKIPPED_NO_FIXTURE'
  | 'SETTLE_GATE_REJECTED'
  | 'SETTLE_ERROR';

export type SettleResult = {
  outcome: SettleOutcome;
  /** Rows transitioned from pending to settled by this call. */
  settled: number;
  /** True when every settled row had a stale kickoff (no live pushes went out). */
  staleOnly: boolean;
};

export type SettleSource =
  | 'prediction-watcher'
  | 'live-fixture-sync'
  | 'match-event-delivery'
  | 'manual'
  | 'admin'
  | 'unknown';

type ScoredPrediction = {
  id: string;
  userId: string;
  predictionType: string;
  predictedHomeScore: number | null;
  predictedAwayScore: number | null;
  homeTeam: string | null;
  awayTeam: string | null;
  homeTeamLogo: string | null;
  awayTeamLogo: string | null;
  leagueName: string | null;
  matchDate: Date | null;
};

function hasScoreline(prediction: ScoredPrediction): boolean {
  return prediction.predictedHomeScore != null && prediction.predictedAwayScore != null;
}

function isPredictionCorrect(prediction: ScoredPrediction, settled: SettlementOk): boolean {
  if (hasScoreline(prediction)) {
    return isExactPredictionCorrect(
      prediction.predictedHomeScore!,
      prediction.predictedAwayScore!,
      settled.exactHomeScore,
      settled.exactAwayScore,
    );
  }
  return isWinnerPredictionCorrect(prediction.predictionType, settled.winner, settled.status);
}

function predictionXpAction(prediction: ScoredPrediction): 'PREDICTION_EXACT' | 'PREDICTION_WINNER' {
  return hasScoreline(prediction) ? 'PREDICTION_EXACT' : 'PREDICTION_WINNER';
}

export class PredictionResolverService {
  /**
   * Resolve all unresolved predictions for a finished match.
   * Caller-provided scores are ignored — fixture is re-loaded under the lock.
   */
  static async resolveMatchPredictions(
    apiMatchId: number,
    _homeScoreOrOpts?: number | { source?: SettleSource },
    _awayScore?: number,
    opts?: { source?: SettleSource },
  ): Promise<SettleResult> {
    const source: SettleSource =
      (typeof _homeScoreOrOpts === 'object' && _homeScoreOrOpts?.source) ||
      opts?.source ||
      'unknown';
    const skipped = (outcome: SettleOutcome): SettleResult => ({ outcome, settled: 0, staleOnly: false });

    if (!isSchemaOk()) {
      logger.warn(JSON.stringify({ event: 'SETTLE_SKIPPED_SCHEMA', apiMatchId, source }));
      return skipped('SETTLE_SKIPPED_SCHEMA');
    }

    const lock = await acquireSettleLock(apiMatchId);
    if (!lock.ok) {
      logger.info(
        JSON.stringify({
          event: lock.reason,
          apiMatchId,
          source,
          lockWaitMs: lock.waitMs,
        }),
      );
      return skipped(lock.reason);
    }

    try {
      const snapshot = await loadAuthoritativeSettlementFixture(apiMatchId);
      if (!snapshot) {
        logger.info(
          JSON.stringify({
            event: 'SETTLE_SKIPPED_NO_FIXTURE',
            apiMatchId,
            source,
            lockWaitMs: lock.waitMs,
          }),
        );
        return skipped('SETTLE_SKIPPED_NO_FIXTURE');
      }

      const gated = resolveSettlementInput(snapshot);
      if (!gated.ok) {
        logger.info(
          JSON.stringify({
            event: 'SETTLE_GATE_REJECTED',
            apiMatchId,
            source,
            reason: gated.reason,
            status: snapshot.status,
            homeScore: snapshot.homeScore,
            awayScore: snapshot.awayScore,
            penaltyHome: snapshot.penaltyHome,
            penaltyAway: snapshot.penaltyAway,
            lockWaitMs: lock.waitMs,
          }),
        );
        return skipped('SETTLE_GATE_REJECTED');
      }

      return await this.settleUnlocked(apiMatchId, gated, source, lock.waitMs);
    } catch (error) {
      logger.error(`❌ Error resolving predictions for match ${apiMatchId}:`, error);
      return skipped('SETTLE_ERROR');
    } finally {
      await lock.handle.release();
    }
  }

  private static async settleUnlocked(
    apiMatchId: number,
    settled: SettlementOk,
    source: SettleSource,
    lockWaitMs: number,
  ): Promise<SettleResult> {
    const { homeScore, awayScore, winner, status } = settled;

    logger.info(`🎯 Resolving predictions for match ${apiMatchId} (${homeScore}-${awayScore}, ${status}, winner=${winner})`);

    const predictions = (await (prisma as any).prediction.findMany({
      where: { apiMatchId, isCorrect: null },
    })) as ScoredPrediction[];

    if (predictions.length === 0) {
      logger.debug(`📭 No predictions to resolve for match ${apiMatchId}`);
      return { outcome: 'SETTLE_COMPLETE', settled: 0, staleOnly: false };
    }

    let correctCount = 0;
    let wrongCount = 0;
    let freshSettled = 0;
    let pushSuppressed = 0;
    const settledAt = new Date();

    for (const prediction of predictions) {
      const isCorrect = isPredictionCorrect(prediction, settled);
      const xpAction = predictionXpAction(prediction);
      const points = isCorrect ? XP_VALUES[xpAction] : 0;

      try {
        const applied = await prisma.$transaction(async (tx) => {
          const resolved = await (tx as any).prediction.updateMany({
            where: { id: prediction.id, isCorrect: null },
            data: {
              isCorrect,
              coinsWon: isCorrect ? CORRECT_PREDICTION_REWARD : 0,
              resolvedAt: settledAt,
              settledHomeScore: homeScore,
              settledAwayScore: awayScore,
              settledStatus: status,
              settledWinner: winner,
              settledAt,
            },
          });
          if (resolved.count === 0) return false;

          if (isCorrect) {
            const coinKey = `prediction:${prediction.id}:coins`;
            const alreadyCredited = await (tx as any).coinTransaction.findUnique({
              where: { idempotencyKey: coinKey },
              select: { id: true },
            });
            if (!alreadyCredited) {
              await tx.user.update({
                where: { id: prediction.userId },
                data: { coins: { increment: CORRECT_PREDICTION_REWARD } },
              });
              await (tx as any).coinTransaction.create({
                data: {
                  userId: prediction.userId,
                  amount: CORRECT_PREDICTION_REWARD,
                  type: 'PREDICTION' as any,
                  description: `Correct prediction reward — match ${apiMatchId}`,
                  idempotencyKey: coinKey,
                },
              });
            }

            // XP in the same transaction (idempotent on prediction:{id}).
            const idempotencyKey = `prediction:${prediction.id}`;
            const existingXp = await (tx as any).xpTransaction.findUnique({
              where: {
                userId_idempotencyKey: { userId: prediction.userId, idempotencyKey },
              },
            });
            if (!existingXp) {
              const user = await tx.user.findUniqueOrThrow({
                where: { id: prediction.userId },
                select: { xp: true, level: true },
              });
              const newXp = user.xp + points;
              const newLevel = levelFromXp(newXp);
              await (tx as any).xpTransaction.create({
                data: {
                  userId: prediction.userId,
                  action: xpAction,
                  amount: points,
                  idempotencyKey,
                  metadata: {
                    predictionId: prediction.id,
                    apiMatchId,
                    homeScore,
                    awayScore,
                    status,
                    winner,
                    source,
                  },
                },
              });
              await tx.user.update({
                where: { id: prediction.userId },
                data: { xp: newXp, level: newLevel },
              });
            }
          }

          return true;
        });

        if (!applied) continue;
        if (isCorrect) correctCount += 1;
        else wrongCount += 1;
        if (!isStaleKickoff(prediction.matchDate, settledAt)) freshSettled += 1;

        // Side effects outside the settle transaction (notifications / SSE).
        // awardXp is still called so SSE/level-up pushes fire; idempotency
        // key makes the second write a no-op if the inline XP already landed.
        if (isCorrect) {
          try {
            await awardXp({
              userId: prediction.userId,
              action: xpAction,
              timezone: 'UTC',
              idempotencyKey: `prediction:${prediction.id}`,
              metadata: {
                predictionId: prediction.id,
                apiMatchId,
                homeScore,
                awayScore,
              },
            });
          } catch (xpErr: any) {
            logger.warn(`⚠️ XP award side-effect failed for user ${prediction.userId}:`, xpErr?.message);
          }
        }

        const push = decideResultPush(prediction.matchDate, settledAt);
        if (!push.notify || push.skipPush) pushSuppressed += 1;
        if (!push.notify) continue;

        try {
          const matchInfo = `${prediction.homeTeam || 'Home'} ${homeScore}-${awayScore} ${prediction.awayTeam || 'Away'}`;
          await NotificationService.sendPredictionResultNotification(
            prediction.userId,
            isCorrect,
            matchInfo,
            isCorrect ? points : 0,
            {
              fixtureId: apiMatchId,
              homeTeam: prediction.homeTeam,
              awayTeam: prediction.awayTeam,
              homeTeamLogo: prediction.homeTeamLogo,
              awayTeamLogo: prediction.awayTeamLogo,
              leagueName: prediction.leagueName,
              matchDate: prediction.matchDate,
              homeScore,
              awayScore,
            },
            { skipPush: push.skipPush },
          );
        } catch (notifError) {
          logger.warn(`⚠️ Failed to send notification to user ${prediction.userId}:`, notifError);
        }
      } catch (rowErr: any) {
        logger.error(
          `❌ Settle row failed prediction=${prediction.id} match=${apiMatchId}:`,
          rowErr?.message ?? rowErr,
        );
      }
    }

    logger.info(
      JSON.stringify({
        event: 'SETTLE_COMPLETE',
        apiMatchId,
        status,
        homeScore,
        awayScore,
        winner,
        counts: { correct: correctCount, wrong: wrongCount, total: predictions.length },
        source,
        lockWaitMs,
      }),
    );
    if (pushSuppressed > 0) {
      logger.info(JSON.stringify({ event: 'SETTLE_PUSH_SUPPRESSED', apiMatchId, count: pushSuppressed }));
    }

    clearResponseCache('/predictions/stats').catch(() => {});
    const settledCount = correctCount + wrongCount;
    return {
      outcome: 'SETTLE_COMPLETE',
      settled: settledCount,
      staleOnly: settledCount > 0 && freshSettled === 0,
    };
  }

  static async getMatchPredictionStats(apiMatchId: number) {
    const stats = await (prisma as any).prediction.groupBy({
      by: ['predictionType'],
      where: { apiMatchId },
      _count: true,
    });

    const result = { total: 0, home: 0, draw: 0, away: 0 };

    stats.forEach((stat: any) => {
      result.total += stat._count;
      if (stat.predictionType === 'home') result.home = stat._count;
      if (stat.predictionType === 'draw') result.draw = stat._count;
      if (stat.predictionType === 'away') result.away = stat._count;
    });

    return result;
  }
}

export default PredictionResolverService;
