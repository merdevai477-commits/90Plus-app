/**
 * Prediction Resolver Service
 * Updates prediction outcomes when matches finish
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
import { clearResponseCache } from '../middleware/responseCache.middleware';

const CORRECT_PREDICTION_REWARD = 10; // coins for correct prediction

/**
 * XP for a settled prediction — ONE of these, never both:
 *
 *   called the result .................. PREDICTION_WINNER  (+2 XP)
 *   called the exact scoreline ......... PREDICTION_EXACT   (+5 XP)
 *
 * An exact score is worth 5 IN TOTAL. The amounts live in xp.service.ts
 * (XP_VALUES) so King of Predictions and its group mode price the same thing
 * the same way.
 *
 * Every prediction row records the scoreline the user picked
 * (predictedHomeScore / predictedAwayScore); this used to award WINNER
 * unconditionally, so calling a 3-1 exactly paid the same as calling "home
 * win" — the exact-score reward existed in the XP table and was never
 * reachable from here.
 */
function predictionXpAction(
    prediction: { predictedHomeScore: number | null; predictedAwayScore: number | null },
    homeScore: number,
    awayScore: number,
): 'PREDICTION_EXACT' | 'PREDICTION_WINNER' {
    const calledExactScore =
        prediction.predictedHomeScore === homeScore && prediction.predictedAwayScore === awayScore;
    return calledExactScore ? 'PREDICTION_EXACT' : 'PREDICTION_WINNER';
}

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
            if (
                homeScore == null ||
                awayScore == null ||
                Number.isNaN(homeScore) ||
                Number.isNaN(awayScore)
            ) {
                logger.warn(`⚠️ Skipping prediction resolve for match ${apiMatchId}: invalid scores`);
                return;
            }

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

                // Only resolve once — parallel watchers may race on the same row
                const resolved = await (prisma as any).prediction.updateMany({
                    where: { id: prediction.id, isCorrect: null },
                    data: {
                        isCorrect,
                        coinsWon: isCorrect ? CORRECT_PREDICTION_REWARD : 0,
                        resolvedAt: new Date(),
                    },
                });

                if (resolved.count === 0) {
                    continue;
                }

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
                                // Server-side audit trail. Not rendered to
                                // users directly; the wallet UI maps the
                                // `type` enum to a localized label instead.
                                description: `Correct prediction reward — match ${apiMatchId}`,
                            },
                        }),
                    ]);

                    // ✅ Award XP for correct prediction (daily cap 5 to prevent farming)
                    // idempotencyKey ties the award to this prediction row so
                    // even if MatchWatcher + PredictionWatcher race on the
                    // same match, awardXp returns the cached result on the
                    // second pass instead of double-crediting.
                    try {
                        await awardXp({
                            userId: prediction.userId,
                            action: predictionXpAction(prediction, homeScore, awayScore),
                            dailyCap: 5,
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
                            CORRECT_PREDICTION_REWARD,
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
                            }
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
                            0,
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
                            }
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

            clearResponseCache('/predictions/stats').catch(() => {});

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
