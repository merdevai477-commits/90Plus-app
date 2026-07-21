import Bull, { Queue } from 'bull';
import { bullCreateClient } from '../lib/bull-redis';
import { logger } from '../utils/logger';
import { NotificationService } from '../services/notification.service';
import PushNotificationService from '../services/push-notification.service';
import prisma from '../lib/prisma';
import { isAllowedByPreference } from '../services/notify.service';

export type NotificationJob =
  | {
      kind: 'SOCIAL';
      payload: {
        type: string;
        userId: string;
        actorId: string;
        title: string;
        message: string;
        data?: any;
        idempotencyKey?: string;
      };
    }
  | {
      kind: 'GENERIC';
      payload: {
        type: string;
        userId: string;
        title: string;
        message: string;
        data?: any;
        idempotencyKey?: string;
      };
    }
  | {
      kind: 'RE_ENGAGEMENT';
      payload: Record<string, never>; // empty — cron triggers the job itself
    };

let queue: Queue<NotificationJob> | null = null;

export function getNotificationQueue(): Queue<NotificationJob> | null {
  if (queue) return queue;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    logger.warn('⚠️ REDIS_URL not set - notification queue disabled (will run in-process)');
    return null;
  }

  queue = new Bull<NotificationJob>('notifications', {
    createClient: bullCreateClient(redisUrl),
  });

  const notifConcurrency = Math.max(
    1,
    Math.min(50, parseInt(process.env.NOTIFICATION_QUEUE_CONCURRENCY || '20', 10) || 20),
  );

  queue.process(notifConcurrency, async (job) => {
    const { kind } = job.data;

    if (kind === 'SOCIAL') {
      const { payload } = job.data;
      // Enforce per-category preferences for legacy callers that bypass
      // the unified notifyUser helper (follow / like / comment / reply / etc).
      const allowed = await isAllowedByPreference(payload.userId, payload.type);
      if (!allowed) {
        logger.debug('[NotifQueue] social suppressed by preference', {
          userId: payload.userId, type: payload.type,
        });
        return;
      }
      const notification = await NotificationService.createSocialNotification({
        userId: payload.userId,
        actorId: payload.actorId,
        title: payload.title,
        message: payload.message,
        type: payload.type,
        data: {
          type: payload.type,
          ...payload.data,
        },
        skipPush: Boolean(payload.data?.__skipPush),
        idempotencyKey: payload.idempotencyKey,
        requirePushSuccess: true,
      });
      if (!notification) {
        throw new Error(`social notification delivery failed for ${payload.type}`);
      }
      return;
    }

    if (kind === 'GENERIC') {
      const { payload } = job.data;
      const allowed = await isAllowedByPreference(payload.userId, payload.type);
      if (!allowed) {
        logger.debug('[NotifQueue] generic suppressed by preference', {
          userId: payload.userId, type: payload.type,
        });
        return;
      }
      const notification = await NotificationService.createNotification({
        userId: payload.userId,
        title: payload.title,
        message: payload.message,
        type: payload.type,
        data: {
          type: payload.type,
          ...payload.data,
        },
        skipPush: Boolean(payload.data?.__skipPush),
        idempotencyKey: payload.idempotencyKey,
        requirePushSuccess: true,
      });
      if (!notification) {
        throw new Error(`generic notification delivery failed for ${payload.type}`);
      }
      return;
    }

    if (kind === 'RE_ENGAGEMENT') {
      await runReEngagementJob();
      return;
    }
  });

  queue.on('error', (err) => {
    logger.warn('Notification queue error:', err);
  });

  queue.on('failed', (job, err) => {
    logger.error('[NotifQueue] job failed', {
      id: job?.id,
      kind: job?.data?.kind,
      err: err?.message,
    });
    const data = job?.data;
    if (!data) return;
    setImmediate(async () => {
      try {
        if (data.kind === 'GENERIC') {
          const { payload } = data;
          const allowed = await isAllowedByPreference(payload.userId, payload.type);
          if (!allowed) return;
          await NotificationService.createNotification({
            userId: payload.userId,
            title: payload.title,
            message: payload.message,
            type: payload.type,
            data: { type: payload.type, ...payload.data },
            skipPush: Boolean(payload.data?.__skipPush),
            idempotencyKey: payload.idempotencyKey,
            requirePushSuccess: true,
          });
        } else if (data.kind === 'SOCIAL') {
          const { payload } = data;
          const allowed = await isAllowedByPreference(payload.userId, payload.type);
          if (!allowed) return;
          await NotificationService.createSocialNotification({
            userId: payload.userId,
            actorId: payload.actorId,
            title: payload.title,
            message: payload.message,
            type: payload.type,
            data: { type: payload.type, ...payload.data },
            skipPush: Boolean(payload.data?.__skipPush),
            idempotencyKey: payload.idempotencyKey,
            requirePushSuccess: true,
          });
        }
      } catch (fallbackErr) {
        logger.error('[NotifQueue] sync fallback after failure failed:', fallbackErr);
      }
    });
  });

  // ─── Re-engagement cron: every 12 hours ──────────────────────────────────
  // Fires once immediately on startup, then repeats every 12 hours.
  // Uses Bull's built-in repeatable jobs — safe across restarts.
  queue.add(
    { kind: 'RE_ENGAGEMENT', payload: {} } as NotificationJob,
    {
      repeat: { cron: '0 */12 * * *' }, // every 12 hours at minute 0
      jobId: 're_engagement_cron',       // stable ID prevents duplicate registrations
      removeOnComplete: true,
      removeOnFail: 100,
    }
  ).catch((err) => logger.warn('Failed to register re-engagement cron:', err));

  return queue;
}

// ─── Re-engagement Job Logic ─────────────────────────────────────────────────

const MOTIVATIONAL_MESSAGES = [
  { title: '⚽ الكرة بتنادي عليك!', message: 'رجع التطبيق وشوف أحدث مباريات وتوقعات النهارده 🔥' },
  { title: '🏆 انت مش موجود؟', message: 'في ناس بتتنافس على اللوحة العالية دلوقتي — انت فين؟ 💪' },
  { title: '🎡 عجلتك استناتك!', message: 'متنساش تلف عجلة الحظ اليومية واكسب تذاكر مجانية 🎁' },
  { title: '📊 المباريات ناروا!', message: 'متفوتكش الأخبار والتوقعات — دخل دلوقتي وحط تيبك! ⚡' },
  { title: '🔔 ناس بتتابعك!', message: 'متابعينك مستنيين فيديوهاتك الجديدة — ارجع وشاركهم! 🎬' },
];

async function runReEngagementJob(): Promise<void> {
  try {
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);

    // Find users inactive for 12+ hours who have a push token and consent
    const inactiveUsers = await prisma.user.findMany({
      where: {
        expoPushToken: { not: null },
        pushNotificationsConsent: true,
        isDeleted: false,
        isBanned: false,
        OR: [
          { lastLoginDate: null },
          { lastLoginDate: { lt: twelveHoursAgo } },
        ],
      },
      select: { id: true, expoPushToken: true },
      take: 1000, // safety cap
    });

    if (inactiveUsers.length === 0) {
      logger.info('[ReEngagement] No inactive users to notify');
      return;
    }

    logger.info(`[ReEngagement] Sending motivational push to ${inactiveUsers.length} inactive users`);

    // Pick a random message variant
    const msg = MOTIVATIONAL_MESSAGES[Math.floor(Math.random() * MOTIVATIONAL_MESSAGES.length)];

    // Send in batches to avoid overwhelming Expo API
    const BATCH_SIZE = 100;
    let sent = 0;
    for (let i = 0; i < inactiveUsers.length; i += BATCH_SIZE) {
      const batch = inactiveUsers.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(u =>
          enqueueNotification({
            userId: u.id,
            title: msg.title,
            message: msg.message,
            type: 'RE_ENGAGEMENT',
            data: { type: 'RE_ENGAGEMENT', screen: '/(tabs)/Home' },
          })
        )
      );
      sent += results.filter(r => r.status === 'fulfilled').length;
    }

    logger.info(`[ReEngagement] ✅ Sent ${sent}/${inactiveUsers.length} re-engagement pushes`);
  } catch (err: any) {
    logger.error('[ReEngagement] Job failed:', err?.message);
    throw err; // re-throw so Bull retries
  }
}

/**
 * Enqueue a social notification (off the request path).
 * Falls back to fire-and-forget in-process execution if Redis is unavailable.
 */
export async function enqueueSocialNotification(params: {
  type: string;
  userId: string;
  actorId: string;
  title: string;
  message: string;
  data?: any;
  idempotencyKey?: string;
}): Promise<void> {
  const q = getNotificationQueue();
  if (!q) {
    // In-process fallback: still respect preferences so behaviour is
    // identical whether Redis is available or not.
    setImmediate(async () => {
      try {
        const allowed = await isAllowedByPreference(params.userId, params.type);
        if (!allowed) return;
        await NotificationService.createSocialNotification(params);
      } catch (err) {
        logger.warn('In-process social notification failed:', err);
      }
    });
    return;
  }

  await q.add(
    {
      kind: 'SOCIAL',
      payload: params,
    },
    { attempts: 3, backoff: 2000, removeOnComplete: true, removeOnFail: 1000 }
  );
}

/**
 * Enqueue a generic notification (off the request path).
 * Falls back to fire-and-forget in-process execution if Redis is unavailable.
 */
export async function enqueueNotification(params: {
  type: string;
  userId: string;
  title: string;
  message: string;
  data?: any;
  idempotencyKey?: string;
}): Promise<void> {
  const q = getNotificationQueue();
  if (!q) {
    setImmediate(async () => {
      try {
        const allowed = await isAllowedByPreference(params.userId, params.type);
        if (!allowed) return;
        await NotificationService.createNotification(params);
      } catch (err) {
        logger.warn('In-process generic notification failed:', err);
      }
    });
    return;
  }

  try {
    await q.add(
      {
        kind: 'GENERIC',
        payload: params,
      },
      { attempts: 3, backoff: 2000, removeOnComplete: true, removeOnFail: 1000 }
    );
  } catch (err) {
    logger.warn('enqueueNotification failed — sync fallback:', err);
    const allowed = await isAllowedByPreference(params.userId, params.type);
    if (allowed) {
      await NotificationService.createNotification({
        ...params,
        data: { type: params.type, ...params.data },
        skipPush: Boolean(params.data?.__skipPush),
        idempotencyKey: params.idempotencyKey,
        requirePushSuccess: true,
      });
    }
  }
}
