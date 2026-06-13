/**
 * Mux asset cleanup — frees slots on the free-tier 10-asset cap.
 */
import prisma from '../lib/prisma';
import { deleteAsset, listMuxAssets, type MuxAssetSummary } from './mux.service';
import { logger } from '../utils/logger';

function isTestProbeAsset(asset: MuxAssetSummary): boolean {
  const pt = asset.passthrough ?? '';
  return pt.includes('test-script') || pt.includes('connectivity-check') || pt.includes('"probe"');
}

/**
 * Delete Mux assets that are safe to remove so new direct uploads can be created.
 * Returns the number of assets deleted from Mux.
 */
export async function freeMuxAssetSlots(need = 1): Promise<number> {
  if (need < 1) return 0;

  const [muxAssets, dbReels] = await Promise.all([
    listMuxAssets(100),
    prisma.reel.findMany({
      where: { muxAssetId: { not: null } },
      select: { id: true, muxAssetId: true, status: true },
    }),
  ]);

  const protectedIds = new Set<string>();
  for (const reel of dbReels) {
    if (!reel.muxAssetId) continue;
    // Keep assets tied to live or in-flight reels.
    if (reel.status === 'READY' || reel.status === 'PROCESSING') {
      protectedIds.add(reel.muxAssetId);
    }
  }

  const deletable = muxAssets.filter((a) => !protectedIds.has(a.id));
  const ordered = [
    ...deletable.filter(isTestProbeAsset),
    ...deletable
      .filter((a) => !isTestProbeAsset(a))
      .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0)),
  ];

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
    logger.info(`[MuxCleanup] Freed ${deleted} Mux asset slot(s)`);
  } else {
    logger.warn('[MuxCleanup] No deletable Mux assets found (all protected or list empty)');
  }

  return deleted;
}
