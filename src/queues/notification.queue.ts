import Bull, { Queue } from 'bull';
import { bullCreateClient } from '../lib/bull-redis';
import { logger } from '../utils/logger';
import { NotificationService } from '../services/notification.service';
import PushNotificationService from '../services/push-notification.service';
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
      // Retired Bull cron; re-engagement now runs in re-engagement-notifier.service.
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

  removeLegacyReEngagementCron(queue);

  return queue;
}

/** The old 00:00/12:00 UTC Bull repeat lives in Redis until explicitly removed. */
function removeLegacyReEngagementCron(q: Queue<NotificationJob>): void {
  q.getRepeatableJobs()
    .then((jobs) =>
      Promise.all(
        jobs
          .filter((j) => j.id === 're_engagement_cron')
          .map((j) => q.removeRepeatableByKey(j.key)),
      ),
    )
    .then((removed) => {
      if (removed.length) logger.info(`[NotifQueue] removed ${removed.length} legacy re-engagement repeat job(s)`);
    })
    .catch((err) => logger.warn('[NotifQueue] legacy re-engagement cleanup failed:', err));
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
