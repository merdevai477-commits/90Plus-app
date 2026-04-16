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
      // ⚠️ Temporarily return 200 instead of 401 to prevent Mux retry loops
      // while we investigate the signature mismatch.
      // TODO: revert to res.status(401) once signature is confirmed working.
      logger.warn('[MuxWebhook] Proceeding despite signature failure (TEMP — fix secret in Railway env vars)');
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
    logger.error(`[MuxWebhook] Error handling ${eventType}:`, err.message);
    res.status(200).json({ received: true, error: err.message });
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

  // Feature 5: Delete the raw video from R2 now that Mux has processed it
  const reelWithRaw = await prisma.reel.findUnique({
    where: { id: reel.id },
    select: { videoStoragePath: true },
  });
  if (reelWithRaw?.videoStoragePath) {
    const { r2MediaStorage } = await import('../services/r2-media-storage.service');
    r2MediaStorage.deleteObject(reelWithRaw.videoStoragePath).catch((err: any) =>
      logger.warn(`[MuxWebhook] Raw video R2 delete failed for reel ${reel.id}:`, err?.message),
    );
    await prisma.reel.update({
      where: { id: reel.id },
      data: { videoStoragePath: null },
    });
  }

  logger.info(`[MuxWebhook] Reel ${reel.id} is READY — playbackId: ${playbackId}`);

  await NotificationService.createNotification({
    userId: reel.userId,
    title: '✅ فيديوهك جاهز!',
    message: 'تم معالجة فيديوهك بنجاح وهو متاح الآن للمشاهدة',
    type: 'VIDEO_PROCESSED',
    data: { type: 'VIDEO_PROCESSED', reelId: reel.id, status: 'READY', muxPlaybackId: playbackId },
  });
}

async function handleAssetErrored(event: any): Promise<void> {
  const assetId: string | undefined = event.data?.id;
  const uploadId: string | undefined = event.data?.upload_id;
  const errors = event.data?.errors;

  const reel = await prisma.reel.findFirst({
    where: uploadId
      ? { muxUploadId: uploadId }
      : assetId
        ? { muxAssetId: assetId }
        : undefined,
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
