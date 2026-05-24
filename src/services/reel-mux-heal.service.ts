/**
 * Reel Mux self-heal — recover reels stuck in PROCESSING/FAILED when Mux asset is ready.
 * Used by status polling, startup, and scripts/fix-stuck-reels.ts.
 */

import { Prisma, ReelStatus } from '@prisma/client';
import prisma from '../lib/prisma';
import * as muxService from './mux.service';
import { logger } from '../utils/logger';
import { getUserLanguage, renderPushTemplate } from './push-templates.service';

export const REEL_HEAL_STATUS_SELECT = {
  id: true,
  status: true,
  videoUrl: true,
  processedVideoUrl: true,
  thumbnail: true,
  muxUploadId: true,
  muxAssetId: true,
  muxPlaybackId: true,
  userId: true,
  createdAt: true,
} as const;

export type ReelHealRow = {
  id: string;
  status: ReelStatus;
  videoUrl: string;
  processedVideoUrl: string | null;
  thumbnail: string | null;
  muxUploadId: string | null;
  muxAssetId: string | null;
  muxPlaybackId: string | null;
  userId: string;
  createdAt: Date;
};

export type HealReelResult =
  | { outcome: 'ready'; reel: ReelHealRow }
  | { outcome: 'failed'; reel: ReelHealRow }
  | { outcome: 'unchanged'; reel: ReelHealRow }
  | { outcome: 'skipped'; reason: string };

export interface HealReelOptions {
  dryRun?: boolean;
  /** Send ready/failed notifications (default true for poll/startup heal) */
  notify?: boolean;
  /** Invalidate feed caches after READY (default true) */
  invalidateCaches?: boolean;
}

export interface HealStuckReelsOptions {
  dryRun?: boolean;
  statuses?: ReelStatus[];
  maxAgeDays?: number;
  notify?: boolean;
  invalidateCaches?: boolean;
}

async function invalidateReelFeedCaches(): Promise<void> {
  try {
    const { clearReelsFeedCache } = await import('../routes/reels.routes');
    await clearReelsFeedCache();
  } catch { /* non-critical */ }

  try {
    const { getRedisClient } = await import('../lib/redis');
    const redis = getRedisClient();
    if (redis) {
      let cursor = '0';
      const keysToDelete: string[] = [];
      do {
        const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', 'reels:feed:*', 'COUNT', 100);
        cursor = nextCursor;
        keysToDelete.push(...keys);
      } while (cursor !== '0');
      if (keysToDelete.length > 0) {
        await redis.del(...keysToDelete);
      }
    }
  } catch { /* non-critical */ }
}

async function notifyReelReady(userId: string, reelId: string, playbackId: string): Promise<void> {
  try {
    const { NotificationService } = await import('./notification.service');
    const lang = await getUserLanguage(userId);
    await NotificationService.createNotification({
      userId,
      title: renderPushTemplate('videoReadyTitle', lang),
      message: renderPushTemplate('videoReadyBody', lang),
      type: 'VIDEO_PROCESSED',
      data: { type: 'VIDEO_PROCESSED', reelId, status: 'READY', muxPlaybackId: playbackId },
    });
  } catch (err: any) {
    logger.warn('[ReelHeal] Ready notification failed:', err?.message);
  }
}

async function notifyReelFailed(userId: string, reelId: string): Promise<void> {
  try {
    const { NotificationService } = await import('./notification.service');
    const lang = await getUserLanguage(userId);
    await NotificationService.createNotification({
      userId,
      title: renderPushTemplate('videoFailedTitle', lang),
      message: renderPushTemplate('videoFailedBody', lang),
      type: 'VIDEO_PROCESSED',
      data: { type: 'VIDEO_PROCESSED', reelId, status: 'FAILED' },
    });
  } catch (err: any) {
    logger.warn('[ReelHeal] Failed notification failed:', err?.message);
  }
}

/**
 * Query Mux and update a single reel if the asset is ready or errored.
 */
export async function healReelFromMux(
  reel: ReelHealRow,
  options: HealReelOptions = {},
): Promise<HealReelResult> {
  const { dryRun = false, notify = true, invalidateCaches = true } = options;

  if (!reel.muxUploadId && !reel.muxAssetId) {
    return { outcome: 'skipped', reason: 'no_mux_ids' };
  }

  if (reel.status === 'READY' && reel.muxPlaybackId) {
    return { outcome: 'unchanged', reel };
  }

  let asset: Awaited<ReturnType<typeof muxService.getAsset>> | null = null;
  try {
    if (reel.muxAssetId) {
      asset = await muxService.getAsset(reel.muxAssetId);
    } else if (reel.muxUploadId) {
      asset = await muxService.getUploadAsset(reel.muxUploadId);
    }
  } catch (err: any) {
    logger.warn(`[ReelHeal] Mux lookup failed for reel ${reel.id}:`, err?.message);
    return { outcome: 'unchanged', reel };
  }

  if (!asset) {
    return { outcome: 'unchanged', reel };
  }

  if (asset.status === 'ready') {
    const publicPlayback = asset.playbackIds?.find((p) => p.policy === 'public') ?? asset.playbackIds?.[0];
    if (!publicPlayback) {
      return { outcome: 'skipped', reason: 'no_playback_id' };
    }

    const playbackId = publicPlayback.id;
    const newVideoUrl = muxService.getPlaybackUrl(playbackId);
    const newThumb = reel.thumbnail || muxService.getThumbnailUrl(playbackId);

    if (dryRun) {
      logger.info(`[ReelHeal] [dry-run] Would heal reel ${reel.id} → READY`, {
        playbackId,
        videoUrl: newVideoUrl,
      });
      return {
        outcome: 'ready',
        reel: {
          ...reel,
          status: 'READY',
          muxAssetId: asset.id,
          muxPlaybackId: playbackId,
          videoUrl: newVideoUrl,
          thumbnail: newThumb,
        },
      };
    }

    // `publishedAt` is stamped at the moment of the READY transition so the
    // feed sorts healed reels by their actual go-live time, not their
    // original `createdAt` (which could be days old for stuck reels).
    const updated = await prisma.reel.update({
      where: { id: reel.id },
      data: {
        muxAssetId: asset.id,
        muxPlaybackId: playbackId,
        videoUrl: newVideoUrl,
        thumbnail: newThumb,
        status: 'READY',
        publishedAt: new Date(),
      },
      select: REEL_HEAL_STATUS_SELECT,
    });

    if (invalidateCaches) {
      await invalidateReelFeedCaches();
    }
    if (notify) {
      await notifyReelReady(updated.userId, updated.id, playbackId);
    }

    logger.info(`[ReelHeal] Healed reel ${reel.id} → READY`);
    return { outcome: 'ready', reel: updated };
  }

  if (asset.status === 'errored') {
    if (reel.status === 'FAILED') {
      return { outcome: 'unchanged', reel };
    }

    if (dryRun) {
      logger.info(`[ReelHeal] [dry-run] Would mark reel ${reel.id} → FAILED`);
      return { outcome: 'failed', reel: { ...reel, status: 'FAILED' } };
    }

    const updated = await prisma.reel.update({
      where: { id: reel.id },
      data: { status: 'FAILED' },
      select: REEL_HEAL_STATUS_SELECT,
    });

    if (notify) {
      await notifyReelFailed(updated.userId, updated.id);
    }

    logger.warn(`[ReelHeal] Reel ${reel.id} marked FAILED (Mux asset errored)`);
    return { outcome: 'failed', reel: updated };
  }

  return { outcome: 'unchanged', reel };
}

export interface HealStuckReelsSummary {
  scanned: number;
  healedReady: number;
  markedFailed: number;
  unchanged: number;
  skipped: number;
  errors: number;
}

/**
 * Batch-heal reels by status and optional max age.
 */
export async function healStuckReels(options: HealStuckReelsOptions = {}): Promise<HealStuckReelsSummary> {
  const {
    dryRun = false,
    statuses = ['PROCESSING', 'FAILED'],
    maxAgeDays,
    notify = !dryRun,
    invalidateCaches = !dryRun,
  } = options;

  const where: Prisma.ReelWhereInput = {
    status: { in: statuses },
    muxUploadId: { not: null },
    isDeleted: false,
    ...(maxAgeDays != null && maxAgeDays > 0
      ? {
          createdAt: {
            gte: new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000),
          },
        }
      : {}),
  };

  const reels = await prisma.reel.findMany({
    where,
    select: REEL_HEAL_STATUS_SELECT,
    orderBy: { createdAt: 'desc' },
  });

  const summary: HealStuckReelsSummary = {
    scanned: reels.length,
    healedReady: 0,
    markedFailed: 0,
    unchanged: 0,
    skipped: 0,
    errors: 0,
  };

  logger.info(
    `[ReelHeal] Scanning ${reels.length} reel(s) statuses=${statuses.join(',')} dryRun=${dryRun} maxAgeDays=${maxAgeDays ?? 'none'}`,
  );

  for (const reel of reels) {
    try {
      const result = await healReelFromMux(reel, { dryRun, notify, invalidateCaches });
      switch (result.outcome) {
        case 'ready':
          summary.healedReady++;
          break;
        case 'failed':
          summary.markedFailed++;
          break;
        case 'unchanged':
          summary.unchanged++;
          break;
        case 'skipped':
          summary.skipped++;
          break;
      }
    } catch (err: any) {
      summary.errors++;
      logger.error(`[ReelHeal] Error healing reel ${reel.id}:`, err?.message);
    }
  }

  logger.info('[ReelHeal] Batch complete:', summary);
  return summary;
}
