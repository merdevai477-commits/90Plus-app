/**
 * R2 Orphan Cleanup Service  (Fix 2)
 *
 * Before every R2 upload we create an R2OrphanTracker record.
 * After the DB save succeeds we mark it resolved.
 * A daily cron (03:00 Cairo = 01:00 UTC) deletes all unresolved records older than 1 hour.
 */

import prisma from '../lib/prisma';
import { r2MediaStorage, R2MediaBucket } from './r2-media-storage.service';
import { logger } from '../utils/logger';
import { NotificationService } from './notification.service';
import { renderPushTemplate, getUserLanguage } from './push-templates.service';

// Lazy import to avoid circular dependency
async function getMuxDeleteAsset(): Promise<(assetId: string) => Promise<void>> {
  const mux = await import('./mux.service');
  return mux.deleteAsset;
}

// ─── Pre-upload: register orphan ─────────────────────────────────────────────

export async function registerOrphan(
  storagePath: string,
  bucket: R2MediaBucket,
  fileSizeBytes: number,
): Promise<void> {
  try {
    await prisma.r2OrphanTracker.upsert({
      where: { storagePath },
      create: { storagePath, bucket, fileSizeBytes, resolved: false },
      update: { resolved: false, resolvedAt: null, uploadedAt: new Date() },
    });
  } catch (err) {
    // Non-fatal — upload proceeds even if tracking fails
    logger.warn('[R2Cleanup] registerOrphan failed (non-fatal):', err);
  }
}

// ─── Post-upload: mark resolved ───────────────────────────────────────────────

export async function resolveOrphan(storagePath: string): Promise<void> {
  try {
    await prisma.r2OrphanTracker.update({
      where: { storagePath },
      data: { resolved: true, resolvedAt: new Date() },
    });
  } catch (err) {
    // Non-fatal — file is in R2 and DB record exists; cron will eventually clean up
    logger.warn('[R2Cleanup] resolveOrphan failed (non-fatal):', err);
  }
}

// ─── Cron job: clean up stale orphans ────────────────────────────────────────

export async function runOrphanCleanup(): Promise<void> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  logger.info('[R2Cleanup] Starting orphan cleanup...');

  let orphans: Awaited<ReturnType<typeof prisma.r2OrphanTracker.findMany>>;

  try {
    orphans = await prisma.r2OrphanTracker.findMany({
      where: { resolved: false, uploadedAt: { lt: oneHourAgo } },
    });
  } catch (err) {
    logger.error('[R2Cleanup] Failed to query orphan tracker (aborting cleanup):', err);
    return;
  }

  if (orphans.length === 0) {
    logger.info('[R2Cleanup] No orphan files found.');
    return;
  }

  logger.info(`[R2Cleanup] Found ${orphans.length} orphan file(s) to delete`);

  let deleted = 0;
  let failed = 0;

  for (const orphan of orphans) {
    try {
      const ok = await r2MediaStorage.deleteObject(orphan.storagePath);
      if (ok) {
        try {
          await prisma.r2OrphanTracker.delete({ where: { id: orphan.id } });
        } catch (dbErr) {
          logger.warn(`[R2Cleanup] R2 deleted but DB record removal failed for ${orphan.storagePath}:`, dbErr);
        }
        deleted++;
      } else {
        failed++;
        logger.warn(`[R2Cleanup] Could not delete orphan from R2: ${orphan.storagePath}`);
      }
    } catch (err) {
      failed++;
      logger.error(`[R2Cleanup] Error processing orphan ${orphan.storagePath}:`, err);
    }
  }

  logger.info(`[R2Cleanup] Cleanup done. Deleted: ${deleted}, Failed: ${failed}`);
}

// ─── Stuck reel cleanup (Fix 2) ───────────────────────────────────────────────

/**
 * Find reels stuck in PROCESSING for more than 2 hours.
 * These are zombie reels where Mux never fired a webhook (upload failed silently).
 * Mark them FAILED, notify the user, and delete the Mux asset if one exists.
 *
 * Call this from the same cron that runs runOrphanCleanup().
 */
export async function runStuckReelCleanup(): Promise<void> {
  const staleAfterMs = 45 * 60 * 1000;
  const staleBefore = new Date(Date.now() - staleAfterMs);

  logger.info('[R2Cleanup] Checking for stuck PROCESSING reels...');

  let stuckReels: Array<{
    id: string;
    userId: string;
    muxAssetId: string | null;
    muxUploadId: string | null;
    thumbnailStoragePath: string | null;
    fileSizeBytes: bigint;
  }>;

  try {
    stuckReels = await prisma.reel.findMany({
      where: {
        status: 'PROCESSING',
        createdAt: { lt: staleBefore },
      },
      select: {
        id: true,
        userId: true,
        muxAssetId: true,
        muxUploadId: true,
        thumbnailStoragePath: true,
        fileSizeBytes: true,
      },
    });
  } catch (err) {
    logger.error('[R2Cleanup] Failed to query stuck reels:', err);
    return;
  }

  if (stuckReels.length === 0) {
    logger.info('[R2Cleanup] No stuck reels found.');
    return;
  }

  logger.warn(`[R2Cleanup] Found ${stuckReels.length} stuck reel(s) — marking FAILED`);

  const deleteAsset = await getMuxDeleteAsset();

  for (const reel of stuckReels) {
    try {
      // Mark as FAILED in DB
      await prisma.reel.update({
        where: { id: reel.id },
        data: { status: 'FAILED' },
      });

      // Release upload lock so the user can retry without waiting 25 minutes
      await prisma.user
        .update({
          where: { id: reel.userId },
          data: { reelUploadLockedUntil: null },
        })
        .catch((err: any) =>
          logger.warn(`[R2Cleanup] Failed to clear upload lock for user ${reel.userId}:`, err?.message),
        );

      // Delete Mux asset if it was created
      if (reel.muxAssetId) {
        await deleteAsset(reel.muxAssetId).catch((err: any) =>
          logger.warn(`[R2Cleanup] Mux asset delete failed for reel ${reel.id}:`, err?.message),
        );
      }

      // Delete orphaned thumbnail from R2
      if (reel.thumbnailStoragePath) {
        await r2MediaStorage.deleteObject(reel.thumbnailStoragePath).catch((err: any) =>
          logger.warn(`[R2Cleanup] Thumbnail R2 delete failed for reel ${reel.id}:`, err?.message),
        );
      }

      // Decrement storage quota for the stuck reel's file size
      const fileSizeBytes = Number(reel.fileSizeBytes);
      if (fileSizeBytes > 0) {
        await prisma.user.update({
          where: { id: reel.userId },
          data: { storageUsedBytes: { decrement: fileSizeBytes } },
        }).catch((err: any) =>
          logger.warn(`[R2Cleanup] Quota decrement failed for user ${reel.userId}:`, err?.message),
        );
      }

      // Notify user
      const lang = await getUserLanguage(reel.userId);
      await NotificationService.createNotification({
        userId: reel.userId,
        title: renderPushTemplate('videoFailedTitle', lang),
        message: renderPushTemplate('videoFailedBody', lang),
        type: 'VIDEO_PROCESSED',
        data: { type: 'VIDEO_PROCESSED', reelId: reel.id, status: 'FAILED' },
      }).catch((err: any) =>
        logger.warn(`[R2Cleanup] Notification failed for reel ${reel.id}:`, err?.message),
      );

      logger.info(`[R2Cleanup] Stuck reel ${reel.id} marked FAILED and cleaned up`);
    } catch (err) {
      logger.error(`[R2Cleanup] Error processing stuck reel ${reel.id}:`, err);
    }
  }
}
