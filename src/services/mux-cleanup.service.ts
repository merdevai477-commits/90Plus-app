/**
 * Mux asset cleanup — frees slots on the free-tier 10-asset cap.
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
 * Delete Mux assets that are safe to remove so new direct uploads can be created.
 * Returns the number of assets deleted from Mux.
 */
export async function freeMuxAssetSlots(need = 1): Promise<number> {
  if (need < 1) return 0;

  const now = Date.now();

  const [muxAssets, dbReels, allReelIds] = await Promise.all([
    listMuxAssets(100),
    prisma.reel.findMany({
      where: { muxAssetId: { not: null } },
      select: { id: true, muxAssetId: true, status: true, createdAt: true },
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
  for (const reel of dbReels) {
    if (!reel.muxAssetId) continue;
    if (reel.status === 'READY') {
      protectedIds.add(reel.muxAssetId);
      continue;
    }
    if (reel.status === 'PROCESSING') {
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

  let deleted = 0;
  const seen = new Set<string>();
  for (const asset of ordered) {
    if (deleted >= need) break;
    if (seen.has(asset.id)) continue;
    seen.add(asset.id);

    await deleteAsset(asset.id);
    deleted++;

    await prisma.reel.updateMany({
      where: { muxAssetId: asset.id },
      data: { muxAssetId: null, muxPlaybackId: null },
    }).catch((err) => {
      logger.warn('[MuxCleanup] Failed to clear reel muxAssetId after delete:', err?.message);
    });
  }

  if (deleted > 0) {
    logger.info(`[MuxCleanup] Freed ${deleted} Mux asset slot(s)`, {
      muxAssetsBefore: muxAssets.length,
      protected: protectedIds.size,
      orphans: orphanReelIds.size,
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
