/**
 * Resolves group predictions when matches finish and awards global XP.
 */

import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { awardXp } from './xp.service';

function actualWinner(homeScore: number, awayScore: number): 'home' | 'draw' | 'away' {
  if (homeScore > awayScore) return 'home';
  if (homeScore < awayScore) return 'away';
  return 'draw';
}

export class GroupPredictionResolverService {
  static async resolveMatchPredictions(
    apiMatchId: number,
    homeScore: number,
    awayScore: number,
  ): Promise<void> {
    const predictions = await prisma.groupPrediction.findMany({
      where: { apiMatchId, isCorrect: null },
    });

    if (predictions.length === 0) return;

    const winner = actualWinner(homeScore, awayScore);
    logger.info(`[GroupPred] Resolving ${predictions.length} group predictions for match ${apiMatchId}`);

    for (const pred of predictions) {
      let isCorrect = false;
      let xpAction: 'GROUP_PREDICTION_EXACT' | 'GROUP_PREDICTION_WINNER' | null = null;

      if (pred.mode === 'EXACT') {
        isCorrect =
          pred.predictedHomeScore === homeScore && pred.predictedAwayScore === awayScore;
        if (isCorrect) xpAction = 'GROUP_PREDICTION_EXACT';
      } else {
        isCorrect = pred.predictedWinner === winner;
        if (isCorrect) xpAction = 'GROUP_PREDICTION_WINNER';
      }

      const settled = await prisma.groupPrediction.updateMany({
        where: { id: pred.id, isCorrect: null },
        data: {
          isCorrect,
          settledAt: new Date(),
          xpAwarded: 0,
        },
      });

      if (settled.count === 0) continue;

      if (!isCorrect || !xpAction) continue;

      try {
        const xpResult = await awardXp({
          userId: pred.userId,
          action: xpAction,
          timezone: 'UTC',
          idempotencyKey: `groupPred:${pred.id}`,
          metadata: {
            groupId: pred.groupId,
            roundId: pred.roundId,
            apiMatchId,
            homeScore,
            awayScore,
          },
        });

        if (xpResult.awarded > 0) {
          await prisma.$transaction([
            prisma.groupPrediction.update({
              where: { id: pred.id },
              data: { xpAwarded: xpResult.awarded },
            }),
            prisma.groupMember.updateMany({
              where: { groupId: pred.groupId, userId: pred.userId, leftAt: null },
              data: { groupXpTotal: { increment: xpResult.awarded } },
            }),
          ]);
        }
      } catch (err: any) {
        logger.warn(`[GroupPred] XP award failed for ${pred.id}:`, err?.message);
      }
    }
  }
}
