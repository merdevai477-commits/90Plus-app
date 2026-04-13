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
