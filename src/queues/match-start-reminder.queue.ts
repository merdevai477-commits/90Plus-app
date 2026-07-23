/**
 * Match Start Reminder Queue
 *
 * Schedules:
 * 1) Pre-match reminder 30 minutes before kickoff
 * 2) Kickoff push at match start
 *
 * Each subscription schedules delayed Bull jobs with stable IDs so
 * re-subscribing overwrites the old schedule and unsubscribing removes them.
 *
 * Status-based kickoff from the live ingestor remains a fallback; `notifiedStart`
 * prevents duplicate kickoff pushes if both paths fire.
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

const PRE_MATCH_REMINDER_MS = 30 * 60 * 1000;

let queue: Queue<MatchStartReminderJob> | null = null;

/**
 * Deterministic job id so re-subscribing the same user for the same fixture
 * replaces the previous schedule (Bull treats the jobId as unique).
 */
export function matchStartJobId(userId: string, fixtureId: number): string {
    return `match-start:${userId}:${fixtureId}`;
}

export function matchSoonJobId(userId: string, fixtureId: number): string {
    return `match-soon:${userId}:${fixtureId}`;
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
        const { userId, fixtureId, homeTeam, awayTeam, matchDate } = job.data;
        const isSoonReminder = String(job.id || '').startsWith('match-soon:');

        try {
            const [subscription, user] = await Promise.all([
                prisma.favoriteMatch.findUnique({
                    where: { userId_apiMatchId: { userId, apiMatchId: fixtureId } },
                    select: {
                        notifiedStart: true,
                        matchDate: true,
                        homeTeamLogo: true,
                        awayTeamLogo: true,
                        leagueName: true,
                        lastStatus: true,
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
            if (!user?.pushNotificationsConsent) {
                logger.debug(`[match-start] no consent for ${userId}`);
                return;
            }

            const tokens = await getUserPushTokens(userId);
            if (tokens.length === 0) {
                logger.debug(`[match-start] no push tokens for ${userId}`);
                return;
            }

            const extras = {
                homeTeamLogo: subscription.homeTeamLogo || '',
                awayTeamLogo: subscription.awayTeamLogo || '',
                leagueName: subscription.leagueName || '',
                matchDate: subscription.matchDate,
            };

            if (isSoonReminder) {
                const kickoffMs = new Date(matchDate).getTime();
                const remainingMs = kickoffMs - Date.now();
                // Skip if kickoff already passed or match already live/finished.
                if (
                    remainingMs <= 0 ||
                    subscription.notifiedStart ||
                    ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'FT', 'AET', 'PEN'].includes(
                        String(subscription.lastStatus || ''),
                    )
                ) {
                    logger.debug(`[match-soon] skip stale reminder for ${userId}/${fixtureId}`);
                    return;
                }

                const recent = await prisma.notification.findMany({
                    where: {
                        userId,
                        createdAt: { gte: new Date(Date.now() - 2 * 60 * 60 * 1000) },
                    },
                    select: { data: true },
                    take: 40,
                    orderBy: { createdAt: 'desc' },
                });
                const alreadyForFixture = recent.some((row) => {
                    const data = (row.data || {}) as Record<string, unknown>;
                    return (
                        data.type === 'MATCH_SOON' &&
                        String(data.fixtureId || data.matchId || '') === String(fixtureId)
                    );
                });
                if (alreadyForFixture) {
                    logger.debug(`[match-soon] already sent for ${userId}/${fixtureId}`);
                    return;
                }

                const minutes = Math.max(1, Math.round(remainingMs / 60000));
                await NotificationService.createMatchSoonNotification(
                    userId,
                    null,
                    homeTeam,
                    awayTeam,
                    fixtureId,
                    minutes,
                    extras,
                );
                logger.info(
                    `[match-soon] ✅ notified ${userId} for fixture ${fixtureId} (~${minutes}m, ${tokens.length} device(s))`,
                );
                return;
            }

            if (subscription.notifiedStart) {
                logger.debug(`[match-start] already notified for ${userId}/${fixtureId}`);
                return;
            }

            await NotificationService.createMatchStartNotification(
                userId,
                null,
                homeTeam,
                awayTeam,
                fixtureId,
                extras,
            );

            await prisma.favoriteMatch.update({
                where: { userId_apiMatchId: { userId, apiMatchId: fixtureId } },
                data: { notifiedStart: true },
            });

            logger.info(`[match-start] ✅ notified ${userId} for fixture ${fixtureId} (${tokens.length} device(s))`);
        } catch (err: any) {
            logger.error(`[match-start] job failed for ${userId}/${fixtureId}:`, err?.message);
            throw err;
        }
    });

    queue.on('error', (err) => {
        logger.warn('match-start queue error:', err);
    });

    return queue;
}

async function upsertDelayedJob(
    q: Queue<MatchStartReminderJob>,
    jobId: string,
    data: MatchStartReminderJob,
    delay: number,
): Promise<void> {
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
}

/**
 * Schedule kickoff push + 30-minute pre-match reminder.
 * Past times are skipped — live status ingest remains the kickoff fallback.
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

    const kickoffDelay = kickoffMs - Date.now();
    if (kickoffDelay > 0) {
        const jobId = matchStartJobId(data.userId, data.fixtureId);
        await upsertDelayedJob(q, jobId, data, kickoffDelay);
        logger.info(
            `[match-start] scheduled ${jobId} in ${Math.round(kickoffDelay / 1000)}s (kickoff ${data.matchDate})`,
        );
    } else {
        logger.debug(
            `[match-start] kickoff already passed for ${data.userId}/${data.fixtureId} — skip kickoff schedule`,
        );
    }

    const soonDelay = kickoffMs - PRE_MATCH_REMINDER_MS - Date.now();
    if (soonDelay > 0) {
        const soonId = matchSoonJobId(data.userId, data.fixtureId);
        await upsertDelayedJob(q, soonId, data, soonDelay);
        logger.info(
            `[match-soon] scheduled ${soonId} in ${Math.round(soonDelay / 1000)}s (T-30m for ${data.matchDate})`,
        );
    } else if (kickoffDelay > 0) {
        // Inside the final 30 minutes — send soon reminder ASAP once.
        const soonId = matchSoonJobId(data.userId, data.fixtureId);
        await upsertDelayedJob(q, soonId, data, 1_000);
        logger.info(
            `[match-soon] scheduled ${soonId} immediately (already inside T-30m window)`,
        );
    }
}

/**
 * Cancel scheduled kickoff + soon reminders (unsubscribe path).
 */
export async function cancelMatchStartReminder(userId: string, fixtureId: number): Promise<void> {
    const q = getMatchStartReminderQueue();
    if (!q) return;
    for (const jobId of [matchStartJobId(userId, fixtureId), matchSoonJobId(userId, fixtureId)]) {
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
}
