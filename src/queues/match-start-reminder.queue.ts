/**
 * Match Start Reminder Queue
 *
 * Fires a push notification at the moment a subscribed match kicks off.
 * Each subscription schedules ONE delayed Bull job (jobId = userId:fixtureId)
 * with a stable ID so re-subscribing overwrites the old schedule and
 * unsubscribing removes it cleanly.
 *
 * Status-based kickoff from the live ingestor remains a fallback; `notifiedStart`
 * prevents duplicate pushes if both paths fire.
 */

import Bull, { Queue, Job } from 'bull';
import { bullCreateClient } from '../lib/bull-redis';
import { logger } from '../utils/logger';
import { NotificationService } from '../services/notification.service';
import { getUserPushTokens } from '../services/user-push-devices.service';
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
            // Read the latest subscription + consent at send time. The
            // subscription may have been removed after the job was scheduled,
            // in which case we silently skip.
            const [subscription, user] = await Promise.all([
                prisma.favoriteMatch.findUnique({
                    where: { userId_apiMatchId: { userId, apiMatchId: fixtureId } },
                    select: {
                        notifiedStart: true,
                        matchDate: true,
                        homeTeamLogo: true,
                        awayTeamLogo: true,
                        leagueName: true,
                    },
                }),
                prisma.user.findUnique({
                    where: { id: userId },
                    select: { pushNotificationsConsent: true },
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
            if (!user?.pushNotificationsConsent) {
                logger.debug(`[match-start] no consent for ${userId}`);
                return;
            }

            const tokens = await getUserPushTokens(userId);
            if (tokens.length === 0) {
                logger.debug(`[match-start] no push tokens for ${userId}`);
                return;
            }

            // Pass null so createNotification fans out to every registered device.
            await NotificationService.createMatchStartNotification(
                userId,
                null,
                homeTeam,
                awayTeam,
                fixtureId,
                {
                    homeTeamLogo: subscription.homeTeamLogo || '',
                    awayTeamLogo: subscription.awayTeamLogo || '',
                    leagueName: subscription.leagueName || '',
                    matchDate: subscription.matchDate,
                },
            );

            await prisma.favoriteMatch.update({
                where: { userId_apiMatchId: { userId, apiMatchId: fixtureId } },
                data: { notifiedStart: true },
            });

            logger.info(`[match-start] ✅ notified ${userId} for fixture ${fixtureId} (${tokens.length} device(s))`);
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
 * Schedule a push that fires at kickoff (`matchDate`).
 * Past kickoffs are skipped — status/score ingest remains the fallback.
 */
export async function scheduleMatchStartReminder(
    data: MatchStartReminderJob,
): Promise<void> {
    const q = getMatchStartReminderQueue();
    if (!q) {
        logger.debug(`[match-start] queue unavailable — skip schedule for ${data.userId}/${data.fixtureId}`);
        return;
    }

    const kickoffMs = new Date(data.matchDate).getTime();
    if (!Number.isFinite(kickoffMs)) {
        logger.warn(`[match-start] invalid matchDate for ${data.userId}/${data.fixtureId}`);
        return;
    }

    const delay = kickoffMs - Date.now();
    if (delay <= 0) {
        logger.debug(
            `[match-start] kickoff already passed for ${data.userId}/${data.fixtureId} — skip schedule`,
        );
        return;
    }

    const jobId = matchStartJobId(data.userId, data.fixtureId);
    try {
        const existing = await q.getJob(jobId);
        if (existing) {
            await existing.remove();
        }
    } catch {
        // ignore — add below still works if remove fails
    }

    await q.add(data, {
        jobId,
        delay,
        removeOnComplete: true,
        removeOnFail: 50,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
    });

    logger.info(
        `[match-start] scheduled ${jobId} in ${Math.round(delay / 1000)}s (kickoff ${data.matchDate})`,
    );
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
