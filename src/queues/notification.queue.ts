import Bull, { Queue } from 'bull';
import { logger } from '../utils/logger';
import { NotificationService } from '../services/notification.service';

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
      };
    };

let queue: Queue<NotificationJob> | null = null;

function getQueue(): Queue<NotificationJob> | null {
  if (queue) return queue;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    logger.warn('⚠️ REDIS_URL not set - notification queue disabled (will run in-process)');
    return null;
  }

  queue = new Bull<NotificationJob>('notifications', {
    redis: redisUrl,
  });

  queue.process(async (job) => {
    const { kind } = job.data;
    if (kind === 'SOCIAL') {
      const { payload } = job.data;
      await NotificationService.createSocialNotification({
        userId: payload.userId,
        actorId: payload.actorId,
        title: payload.title,
        message: payload.message,
        type: payload.type,
        data: payload.data,
      });
      return;
    }
    if (kind === 'GENERIC') {
      const { payload } = job.data;
      await NotificationService.createNotification({
        userId: payload.userId,
        title: payload.title,
        message: payload.message,
        type: payload.type,
        data: payload.data,
      });
      return;
    }
  });

  queue.on('error', (err) => {
    logger.warn('Notification queue error:', err);
  });

  return queue;
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
}): Promise<void> {
  const q = getQueue();
  if (!q) {
    setImmediate(() => {
      NotificationService.createSocialNotification(params).catch((err) => {
        logger.warn('In-process notification failed:', err);
      });
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
}): Promise<void> {
  const q = getQueue();
  if (!q) {
    setImmediate(() => {
      NotificationService.createNotification(params).catch((err) => {
        logger.warn('In-process notification failed:', err);
      });
    });
    return;
  }

  await q.add(
    {
      kind: 'GENERIC',
      payload: params,
    },
    { attempts: 3, backoff: 2000, removeOnComplete: true, removeOnFail: 1000 }
  );
}

