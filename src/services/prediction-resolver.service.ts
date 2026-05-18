/**
 * Prediction Resolver Service
 * نظام تحديث نتائج التوقعات
 * 
 * This service is responsible for:
 * 1. Resolving predictions after matches end
 * 2. Awarding coins for correct predictions
 * 3. Sending push notifications to users
 */

import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { NotificationService } from './notification.service';
import { awardXp } from './xp.service';

const CORRECT_PREDICTION_REWARD = 10; // coins for correct prediction
const CORRECT_PREDICTION_XP_ACTION = 'PREDICTION_WINNER'; // XP action key (10 XP per correct prediction)

export class PredictionResolverService {

    /**
     * Resolve all predictions for a finished match
     * Called when match status changes to FT, AET, or PEN
     */
    static async resolveMatchPredictions(
        apiMatchId: number,
        homeScore: number,
        awayScore: number
    ): Promise<void> {
        try {
            logger.info(`🎯 Resolving predictions for match ${apiMatchId} (${homeScore}-${awayScore})`);

            // Determine the actual result
            let actualResult: 'home' | 'draw' | 'away';
            if (homeScore > awayScore) {
                actualResult = 'home';
            } else if (homeScore < awayScore) {
                actualResult = 'away';
            } else {
                actualResult = 'draw';
            }

            // Get all unresolved predictions for this match
            const predictions = await (prisma as any).prediction.findMany({
                where: {
                    apiMatchId,
                    isCorrect: null, // Not yet resolved
                },
            });

            if (predictions.length === 0) {
                logger.debug(`📭 No predictions to resolve for match ${apiMatchId}`);
                return;
            }

            logger.info(`📊 Resolving ${predictions.length} predictions for match ${apiMatchId}`);

            // Process each prediction
            for (const prediction of predictions) {
                const isCorrect = prediction.predictionType === actualResult;

                // Update prediction with result
                await (prisma as any).prediction.update({
                    where: { id: prediction.id },
                    data: {
                        isCorrect,
                        coinsWon: isCorrect ? CORRECT_PREDICTION_REWARD : 0,
                        resolvedAt: new Date(),
                    },
                });

                // Award coins for correct prediction
                if (isCorrect) {
                    await prisma.$transaction([
                        prisma.user.update({
                            where: { id: prediction.userId },
                            data: { coins: { increment: CORRECT_PREDICTION_REWARD } },
                        }),
                        prisma.coinTransaction.create({
                            data: {
                                userId: prediction.userId,
                                amount: CORRECT_PREDICTION_REWARD,
                                type: 'PREDICTION' as any,
                                description: `مكافأة توقع صحيح - مباراة ${apiMatchId}`,
                            },
                        }),
                    ]);

                    // ✅ Award XP for correct prediction (daily cap 5 to prevent farming)
                    try {
                        await awardXp({
                            userId: prediction.userId,
                            action: CORRECT_PREDICTION_XP_ACTION,
                            dailyCap: 5,
                            timezone: 'UTC',
                        });
                    } catch (xpErr: any) {
                        logger.warn(`⚠️ XP award failed for user ${prediction.userId} (non-fatal):`, xpErr?.message);
                    }

                    logger.info(`💰 Awarded ${CORRECT_PREDICTION_REWARD} coins + XP to user ${prediction.userId} for correct prediction`);
                    
                    // ✅ Send push notification for correct prediction
                    try {
                        const matchInfo = `${prediction.homeTeam || 'Home'} ${homeScore}-${awayScore} ${prediction.awayTeam || 'Away'}`;
                        await NotificationService.sendPredictionResultNotification(
                            prediction.userId,
                            true, // isCorrect
                            matchInfo,
                            CORRECT_PREDICTION_REWARD
                        );
                        logger.debug(`📱 Sent correct prediction notification to user ${prediction.userId}`);
                    } catch (notifError) {
                        logger.warn(`⚠️ Failed to send notification to user ${prediction.userId}:`, notifError);
                        // Continue even if notification fails
                    }
                } else {
                    // ✅ Send push notification for incorrect prediction
                    try {
                        const matchInfo = `${prediction.homeTeam || 'Home'} ${homeScore}-${awayScore} ${prediction.awayTeam || 'Away'}`;
                        await NotificationService.sendPredictionResultNotification(
                            prediction.userId,
                            false, // isCorrect
                            matchInfo,
                            0
                        );
                        logger.debug(`📱 Sent incorrect prediction notification to user ${prediction.userId}`);
                    } catch (notifError) {
                        logger.warn(`⚠️ Failed to send notification to user ${prediction.userId}:`, notifError);
                        // Continue even if notification fails
                    }
                }
            }

            const correctCount = predictions.filter((p: any) => p.predictionType === actualResult).length;
            logger.info(`✅ Resolved ${predictions.length} predictions: ${correctCount} correct, ${predictions.length - correctCount} incorrect`);

        } catch (error) {
            logger.error(`❌ Error resolving predictions for match ${apiMatchId}:`, error);
        }
    }

    /**
     * Get prediction statistics for a match
     */
    static async getMatchPredictionStats(apiMatchId: number) {
        const stats = await (prisma as any).prediction.groupBy({
            by: ['predictionType'],
            where: { apiMatchId },
            _count: true,
        });

        const result = {
            total: 0,
            home: 0,
            draw: 0,
            away: 0,
        };

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
