/**
 * Mux Webhook Route
 *
 * POST /api/webhooks/mux
 *
 * CRITICAL: This route must be registered BEFORE express.json() middleware
 * so we receive the raw body for signature verification.
 *
 * Handles:
 *  - video.asset.ready   → mark reel READY, set videoUrl + muxPlaybackId
 *  - video.asset.errored → mark reel FAILED, notify user
 */

import { Router, Request, Response } from 'express';
import * as muxService from '../services/mux.service';
import { NotificationService } from '../services/notification.service';
import { enqueueNotification } from '../queues/notification.queue';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';


const router = Router();

/**
 * POST /api/webhooks/mux
 *
 * Raw body is captured by the express.raw() middleware applied in main.ts
 * specifically for this route — before express.json() runs.
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const signature = req.headers['mux-signature'] as string;
  const rawBody: Buffer = req.body;

  logger.info(`[MuxWebhook] Received POST — signature present: ${!!signature}, body size: ${rawBody?.length ?? 0}`);

  // ── Signature verification ────────────────────────────────────────────────
  const secret = process.env.MUX_WEBHOOK_SECRET;

  if (!secret) {
    // No secret configured — log warning but process event (dev/staging fallback)
    logger.warn('[MuxWebhook] MUX_WEBHOOK_SECRET not set — skipping verification (INSECURE)');
  } else if (!signature) {
    logger.warn('[MuxWebhook] Missing mux-signature header — rejecting');
    res.status(401).json({ error: 'Missing signature' });
    return;
  } else {
    try {
      muxService.verifyWebhook(rawBody, signature);
      logger.info('[MuxWebhook] Signature verified ✅');
    } catch (err: any) {
      logger.error('[MuxWebhook] Signature verification failed:', err.message);
      logger.error('[MuxWebhook] Secret length:', secret.length, '| Signature:', signature?.substring(0, 30));
      res.status(401).json({ error: 'Invalid webhook signature' });
      return;
    }
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let event: any;
  try {
    const bodyStr = typeof rawBody === 'string' ? rawBody : rawBody?.toString('utf8');
    event = JSON.parse(bodyStr);
  } catch (parseErr: any) {
    logger.error('[MuxWebhook] Failed to parse body:', parseErr.message);
    res.status(400).json({ error: 'Invalid JSON body' });
    return;
  }

  const eventType: string = event.type;
  logger.info(`[MuxWebhook] Processing event: ${eventType}`);

  try {
    switch (eventType) {
      case 'video.asset.ready':
        await handleAssetReady(event);
        break;

      case 'video.asset.errored':
        await handleAssetErrored(event);
        break;

      case 'video.upload.asset_created':
        logger.info(`[MuxWebhook] Upload ${event.data?.id} linked to asset ${event.data?.asset_id}`);
        break;

      default:
        logger.debug(`[MuxWebhook] Unhandled event type: ${eventType}`);
    }

    res.status(200).json({ received: true });
  } catch (err: any) {
    logger.error(`[MuxWebhook] Error handling ${eventType}:`, err);
    res.status(200).json({ received: true, error: 'Processing error' });
  }
});

// ─── Handlers ─────────────────────────────────────────────────────────────────

async function handleAssetReady(event: any): Promise<void> {
  const assetId: string = event.data?.id;
  const uploadId: string | undefined = event.data?.upload_id;
  const playbackIds: Array<{ id: string; policy: string }> = event.data?.playback_ids ?? [];

  if (!assetId) {
    logger.warn('[MuxWebhook] video.asset.ready missing asset id');
    return;
  }

  // Find the reel — prefer upload_id lookup, fall back to asset_id
  const reel = await prisma.reel.findFirst({
    where: uploadId
      ? { muxUploadId: uploadId }
      : { muxAssetId: assetId },
    select: { id: true, userId: true, thumbnail: true },
  });

  if (!reel) {
    logger.warn(`[MuxWebhook] No reel found for uploadId=${uploadId} assetId=${assetId}`);
    return;
  }

  const publicPlayback = playbackIds.find((p) => p.policy === 'public') ?? playbackIds[0];
  if (!publicPlayback) {
    logger.warn(`[MuxWebhook] No public playback ID for asset ${assetId}`);
    return;
  }

  const playbackId = publicPlayback.id;
  const videoUrl = muxService.getPlaybackUrl(playbackId);

  // Use Mux auto-thumbnail only if no custom thumbnail was uploaded
  const thumbnailUrl = reel.thumbnail || muxService.getThumbnailUrl(playbackId);

  await prisma.reel.update({
    where: { id: reel.id },
    data: {
      muxAssetId: assetId,
      muxPlaybackId: playbackId,
      videoUrl,
      thumbnail: thumbnailUrl,
      status: 'READY',
    },
  });

  // Invalidate feed cache so the new READY reel appears immediately
  try {
    const { getRedisClient } = await import('../lib/redis');
    const redis = getRedisClient();
    if (redis) {
      // Use SCAN instead of KEYS to avoid blocking Redis in production
      let cursor = '0';
      const keysToDelete: string[] = [];
      do {
        const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', 'reels:feed:*', 'COUNT', 100);
        cursor = nextCursor;
        keysToDelete.push(...keys);
      } while (cursor !== '0');
      
      if (keysToDelete.length > 0) {
        await redis.del(...keysToDelete);
        logger.info(`[MuxWebhook] Invalidated ${keysToDelete.length} feed cache keys for reel ${reel.id}`);
      }
    }
  } catch (cacheErr: any) {
    logger.warn('[MuxWebhook] Feed cache invalidation failed (non-critical):', cacheErr?.message);
  }

  // Also clear the in-process feed cache used by /api/reels/feed so the new
  // READY reel becomes visible immediately (otherwise cached pages hide it
  // for up to 3 minutes).
  try {
    const { clearReelsFeedCache } = await import('./reels.routes');
    await clearReelsFeedCache();
    logger.info(`[MuxWebhook] Cleared feed cache for reel ${reel.id}`);
  } catch (cacheErr: any) {
    logger.warn('[MuxWebhook] In-process feed cache clear failed (non-critical):', cacheErr?.message);
  }

  // Feature 5: Delete the raw video from R2 now that Mux has processed it
  const reelWithRaw = await prisma.reel.findUnique({
    where: { id: reel.id },
    select: { videoStoragePath: true },
  });
  if (reelWithRaw?.videoStoragePath) {
    const { r2MediaStorage } = await import('../services/r2-media-storage.service');
    const pathToDelete = reelWithRaw.videoStoragePath;
    // ✅ Only null out videoStoragePath after the R2 delete actually
    // succeeds, otherwise we lose the reference and the orphan-cleanup
    // sweeper has nothing to retry against.
    r2MediaStorage
      .deleteObject(pathToDelete)
      .then(async (ok) => {
        if (ok) {
          await prisma.reel
            .update({ where: { id: reel.id }, data: { videoStoragePath: null } })
            .catch((e: any) => logger.warn(`[MuxWebhook] Failed to null videoStoragePath for ${reel.id}:`, e?.message));
        } else {
          logger.warn(`[MuxWebhook] R2 delete returned false for ${pathToDelete} — leaving videoStoragePath set for retry`);
        }
      })
      .catch((err: any) =>
        logger.warn(`[MuxWebhook] Raw video R2 delete failed for reel ${reel.id} — keeping videoStoragePath for retry:`, err?.message),
      );
  }

  logger.info(`[MuxWebhook] Reel ${reel.id} is READY — playbackId: ${playbackId}`);

  // 1. Notify the uploader that their video is ready
  await NotificationService.createNotification({
    userId: reel.userId,
    title: '✅ فيديوهك جاهز!',
    message: 'تم معالجة فيديوهك بنجاح وهو متاح الآن للمشاهدة',
    type: 'VIDEO_PROCESSED',
    data: { type: 'VIDEO_PROCESSED', reelId: reel.id, status: 'READY', muxPlaybackId: playbackId },
  });

  // 2. 📢 Notify followers that someone they follow posted a new video (fire-and-forget)
  setImmediate(async () => {
    try {
      // Get uploader info for the notification message
      const uploader = await prisma.user.findUnique({
        where: { id: reel.userId },
        select: { username: true, displayName: true },
      });

      if (!uploader) return;

      const uploaderName = uploader.displayName || uploader.username || 'شخص';

      // Fetch up to 500 followers (limit to avoid overwhelming the queue)
      const followers = await prisma.follow.findMany({
        where: { followingId: reel.userId },
        select: { followerId: true },
        take: 500,
      });

      if (followers.length === 0) return;

      logger.info(`[MuxWebhook] Notifying ${followers.length} followers of user ${reel.userId} about new video`);

      // Batch enqueue in groups of 50 to avoid Redis overload
      const BATCH_SIZE = 50;
      for (let i = 0; i < followers.length; i += BATCH_SIZE) {
        const batch = followers.slice(i, i + BATCH_SIZE);
        await Promise.allSettled(
          batch.map(f =>
            enqueueNotification({
              userId: f.followerId,
              title: '🎬 فيديو جديد!',
              message: `${uploaderName} نشر فيديو جديد — شوفه دلوقتي!`,
              type: 'FOLLOW_ACTIVITY',
              data: { type: 'FOLLOW_ACTIVITY', reelId: reel.id, uploaderUsername: uploader.username, screen: '/(tabs)/reels' },
            })
          )
        );
      }
    } catch (err: any) {
      logger.warn('[MuxWebhook] Failed to notify followers about new video (non-critical):', err?.message);
    }
  });
}


async function handleAssetErrored(event: any): Promise<void> {
  const assetId: string | undefined = event.data?.id;
  const uploadId: string | undefined = event.data?.upload_id;
  const errors = event.data?.errors;

  // Guard: if neither uploadId nor assetId is available, we can't identify the reel
  if (!uploadId && !assetId) {
    logger.error('[MuxWebhook] handleAssetErrored called without uploadId or assetId — cannot identify reel');
    return;
  }

  const reel = await prisma.reel.findFirst({
    where: uploadId
      ? { muxUploadId: uploadId }
      : { muxAssetId: assetId },
    select: { id: true, userId: true },
  });

  if (!reel) {
    logger.warn(`[MuxWebhook] No reel found for errored asset uploadId=${uploadId} assetId=${assetId}`);
    return;
  }

  await prisma.reel.update({
    where: { id: reel.id },
    data: { status: 'FAILED' },
  });

  logger.error(`[MuxWebhook] Reel ${reel.id} FAILED — errors:`, errors);

  await NotificationService.createNotification({
    userId: reel.userId,
    title: '❌ فشل رفع الفيديو',
    message: 'حدث خطأ أثناء معالجة فيديوهك. حاول تاني من البروفايل.',
    type: 'VIDEO_PROCESSED',
    data: { type: 'VIDEO_PROCESSED', reelId: reel.id, status: 'FAILED' },
  });
}

export default router;
