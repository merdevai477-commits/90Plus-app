/**
 * Match Start Reminder Queue
 *
 * Fires a push notification at the moment a subscribed match kicks off.
 * Each subscription schedules ONE delayed Bull job (jobId = userId:fixtureId)
 * with a stable ID so re-subscribing overwrites the old schedule and
 * unsubscribing removes it cleanly.
 */

import Bull, { Queue, Job } from 'bull';
import { bullCreateClient } from '../lib/bull-redis';
import { logger } from '../utils/logger';
import PushNotificationService from '../services/push-notification.service';
import prisma from '../lib/prisma';

export interface MatchStartReminderJob {
    userId: string;
    fixtureId: number;
    homeTeam: string;
    awayTeam: string;
    matchDate: string; // ISO
}

let queue: Queue<MatchStartReminderJob> | null = null;

/**
 * Deterministic job id so re-subscribing the same user for the same fixture
 * replaces the previous schedule (Bull treats the jobId as unique).
 */
export function matchStartJobId(userId: string, fixtureId: number): string {
    return `match-start:${userId}:${fixtureId}`;
}

export function getMatchStartReminderQueue(): Queue<MatchStartReminderJob> | null {
    if (queue) return queue;

    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
        logger.warn('⚠️ REDIS_URL not set — match-start reminder queue disabled');
        return null;
    }

    queue = new Bull<MatchStartReminderJob>('match-start-reminders', {
        createClient: bullCreateClient(redisUrl),
    });

    queue.process(async (job: Job<MatchStartReminderJob>) => {
        const { userId, fixtureId, homeTeam, awayTeam } = job.data;

        try {
            // Read the latest subscription + push token at send time. The
            // subscription may have been removed after the job was scheduled,
            // in which case we silently skip.
            const [subscription, user] = await Promise.all([
                prisma.favoriteMatch.findUnique({
                    where: { userId_apiMatchId: { userId, apiMatchId: fixtureId } },
                    select: { notifiedStart: true, matchDate: true, homeTeamLogo: true, awayTeamLogo: true, leagueName: true },
                }),
                prisma.user.findUnique({
                    where: { id: userId },
                    select: { expoPushToken: true, pushNotificationsConsent: true },
                }),
            ]);

            if (!subscription) {
                logger.debug(`[match-start] subscription removed for ${userId}/${fixtureId} — skipping`);
                return;
            }
            if (subscription.notifiedStart) {
                logger.debug(`[match-start] already notified for ${userId}/${fixtureId}`);
                return;
            }
            if (!user?.expoPushToken || !user.pushNotificationsConsent) {
                logger.debug(`[match-start] no push token/consent for ${userId}`);
                return;
            }

            await PushNotificationService.sendLocalizedNotification({
                pushToken: user.expoPushToken,
                userId,
                titleKey: 'matchStartTitle',
                bodyKey: 'matchStartBody',
                vars: {
                    home: homeTeam,
                    away: awayTeam,
                    minutes: 0,
                },
                data: {
                    type: 'MATCH_START',
                    fixtureId: String(fixtureId),
                    matchId: String(fixtureId),
                    homeTeam,
                    awayTeam,
                    homeTeamLogo: subscription.homeTeamLogo || '',
                    awayTeamLogo: subscription.awayTeamLogo || '',
                    leagueName: subscription.leagueName || '',
                    screen: '/(tabs)/match-details',
                },
                channelId: 'match-updates',
            });

            await prisma.favoriteMatch.update({
                where: { userId_apiMatchId: { userId, apiMatchId: fixtureId } },
                data: { notifiedStart: true },
            });

            logger.info(`[match-start] ✅ notified ${userId} for fixture ${fixtureId}`);
        } catch (err: any) {
            logger.error(`[match-start] job failed for ${userId}/${fixtureId}:`, err?.message);
            throw err; // let Bull retry
        }
    });

    queue.on('error', (err) => {
        logger.warn('match-start queue error:', err);
    });

    return queue;
}

/**
 * Schedule a push reminder that fires when the match kicks off.
 * If the match is already in the past, we skip scheduling (caller should
 * still persist the subscription — the DB is the source of truth for UI).
 */
export async function scheduleMatchStartReminder(
    data: MatchStartReminderJob,
): Promise<void> {
    const q = getMatchStartReminderQueue();
    if (!q) return;

    const delay = new Date(data.matchDate).getTime() - Date.now();
    if (delay <= 0) {
        logger.debug(`[match-start] match already started, skipping schedule for ${data.fixtureId}`);
        return;
    }

    const jobId = matchStartJobId(data.userId, data.fixtureId);

    // Remove any existing job with the same id (re-subscribe case).
    try {
        const existing = await q.getJob(jobId);
        if (existing) await existing.remove();
    } catch (err) {
        logger.debug('[match-start] failed to remove existing job:', err);
    }

    await q.add(data, {
        jobId,
        delay,
        attempts: 3,
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: true,
        removeOnFail: 100,
    });

    logger.info(`[match-start] scheduled reminder for ${data.userId}/${data.fixtureId} in ${Math.round(delay / 1000)}s`);
}

/**
 * Cancel a scheduled reminder (unsubscribe path).
 */
export async function cancelMatchStartReminder(userId: string, fixtureId: number): Promise<void> {
    const q = getMatchStartReminderQueue();
    if (!q) return;
    const jobId = matchStartJobId(userId, fixtureId);
    try {
        const existing = await q.getJob(jobId);
        if (existing) {
            await existing.remove();
            logger.debug(`[match-start] cancelled job ${jobId}`);
        }
    } catch (err) {
        logger.debug('[match-start] cancel failed:', err);
    }
}
