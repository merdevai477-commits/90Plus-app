/**
 * Mux asset cleanup — frees slots on the free-tier 10-asset cap.
 *
 * Stale, failed, and already-deleted reels go first. When every slot is a
 * live READY reel, the oldest ones are retired so a new upload can be created.
 */
import prisma from '../lib/prisma';
import { deleteAsset, listMuxAssets, type MuxAssetSummary } from './mux.service';
import { logger } from '../utils/logger';

/** In-flight uploads older than this are safe to drop from Mux. */
const STALE_PROCESSING_MS = 45 * 60 * 1000;

function isTestProbeAsset(asset: MuxAssetSummary): boolean {
  const pt = asset.passthrough ?? '';
  return pt.includes('test-script') || pt.includes('connectivity-check') || pt.includes('"probe"');
}

function parsePassthroughReelId(passthrough?: string): string | null {
  if (!passthrough) return null;
  try {
    const data = JSON.parse(passthrough) as { reelId?: string };
    return typeof data.reelId === 'string' ? data.reelId : null;
  } catch {
    return null;
  }
}

function deletionPriority(asset: MuxAssetSummary, orphanReelIds: Set<string>): number {
  if (isTestProbeAsset(asset)) return 0;
  const reelId = parsePassthroughReelId(asset.passthrough);
  if (reelId && orphanReelIds.has(reelId)) return 1;
  if (!reelId && asset.passthrough) return 2;
  return 3;
}

/**
 * Delete Mux assets so new direct uploads can be created.
 * Returns the number of assets deleted from Mux.
 */
export async function freeMuxAssetSlots(need = 1): Promise<number> {
  if (need < 1) return 0;

  const now = Date.now();

  const [muxAssets, dbReels, allReelIds] = await Promise.all([
    listMuxAssets(100),
    prisma.reel.findMany({
      where: { muxAssetId: { not: null } },
      select: { id: true, muxAssetId: true, status: true, createdAt: true, isDeleted: true },
    }),
    prisma.reel.findMany({ select: { id: true, status: true } }),
  ]);

  const reelStatusById = new Map(allReelIds.map((r) => [r.id, r.status]));
  const orphanReelIds = new Set<string>();
  for (const asset of muxAssets) {
    const reelId = parsePassthroughReelId(asset.passthrough);
    if (!reelId) continue;
    const status = reelStatusById.get(reelId);
    if (!status || status === 'FAILED') {
      orphanReelIds.add(reelId);
    }
  }

  const protectedIds = new Set<string>();
  const liveReadyAt = new Map<string, number>();
  for (const reel of dbReels) {
    if (!reel.muxAssetId) continue;
    if (reel.status === 'READY' && !reel.isDeleted) {
      protectedIds.add(reel.muxAssetId);
      const created = reel.createdAt.getTime();
      const prev = liveReadyAt.get(reel.muxAssetId);
      if (prev == null || created < prev) liveReadyAt.set(reel.muxAssetId, created);
      continue;
    }
    if (reel.status === 'PROCESSING' && !reel.isDeleted) {
      const ageMs = now - reel.createdAt.getTime();
      if (ageMs < STALE_PROCESSING_MS) {
        protectedIds.add(reel.muxAssetId);
      }
    }
  }

  const deletable = muxAssets.filter((a) => !protectedIds.has(a.id));
  const ordered = [...deletable].sort((a, b) => {
    const pa = deletionPriority(a, orphanReelIds);
    const pb = deletionPriority(b, orphanReelIds);
    if (pa !== pb) return pa - pb;
    return (a.createdAt ?? 0) - (b.createdAt ?? 0);
  });

  const retireLiveIds = new Set<string>();
  if (ordered.length < need) {
    const oldestLive = muxAssets
      .filter((a) => liveReadyAt.has(a.id))
      .sort((a, b) => (liveReadyAt.get(a.id) ?? 0) - (liveReadyAt.get(b.id) ?? 0));
    for (const asset of oldestLive) {
      if (ordered.length >= need) break;
      ordered.push(asset);
      retireLiveIds.add(asset.id);
    }
  }

  let deleted = 0;
  let retiredLive = 0;
  const seen = new Set<string>();
  for (const asset of ordered) {
    if (deleted >= need) break;
    if (seen.has(asset.id)) continue;
    seen.add(asset.id);

    const removed = await deleteAsset(asset.id);
    if (!removed) continue;
    deleted++;

    const retireLive = retireLiveIds.has(asset.id);
    if (retireLive) retiredLive++;

    await prisma.reel.updateMany({
      where: { muxAssetId: asset.id },
      data: retireLive
        ? {
            muxAssetId: null,
            muxPlaybackId: null,
            videoUrl: '',
            isDeleted: true,
            deletedAt: new Date(),
          }
        : { muxAssetId: null, muxPlaybackId: null },
    }).catch((err) => {
      logger.warn('[MuxCleanup] Failed to clear reel muxAssetId after delete:', err?.message);
    });
  }

  if (deleted > 0) {
    logger.info(`[MuxCleanup] Freed ${deleted} Mux asset slot(s)`, {
      muxAssetsBefore: muxAssets.length,
      protected: protectedIds.size,
      orphans: orphanReelIds.size,
      retiredLive,
    });
  } else {
    logger.warn('[MuxCleanup] No deletable Mux assets found', {
      muxAssets: muxAssets.length,
      protected: protectedIds.size,
      need,
    });
  }

  return deleted;
}

/** Proactive headroom when approaching the free-tier cap (call on startup / cron). */
export async function ensureMuxUploadHeadroom(minFreeSlots = 2): Promise<number> {
  const assets = await listMuxAssets(100);
  const used = assets.length;
  if (used < 10 - minFreeSlots) return 0;
  const need = Math.max(1, used - (10 - minFreeSlots));
  return freeMuxAssetSlots(need);
}
