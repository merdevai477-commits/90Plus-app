/**
 * Mux reel orphan reconciliation — repair missing muxUploadId / muxAssetId links
 * via passthrough metadata, webhooks, and scheduled scans.
 */

import prisma from '../lib/prisma';
import * as muxService from './mux.service';
import {
  healReelFromMux,
  REEL_HEAL_STATUS_SELECT,
  type ReelHealRow,
} from './reel-mux-heal.service';
import { logger } from '../utils/logger';

/** How far back the scheduled job scans PROCESSING reels with null muxUploadId. */
export const MUX_RECONCILE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export type MuxObservabilityEvent =
  | 'REEL_MUX_REPAIRED'
  | 'REEL_MUX_RECONCILED'
  | 'REEL_MUX_ORPHAN_FOUND'
  | 'REEL_MUX_REPAIR_FAILED';

const REEL_SELECT = {
  id: true,
  userId: true,
  thumbnail: true,
  muxUploadId: true,
  muxAssetId: true,
  status: true,
  isDeleted: true,
} as const;

export type ReelMuxLinkRow = {
  id: string;
  userId: string;
  thumbnail: string | null;
  muxUploadId: string | null;
  muxAssetId: string | null;
  status: string;
};

export interface MuxPassthroughPayload {
  userId: string;
  reelId: string;
}

export interface MuxPassthroughMatch {
  muxUploadId?: string;
  muxAssetId?: string;
  passthrough?: string;
}

export interface AttachMuxIdentifiersResult {
  attached: boolean;
  reel: ReelMuxLinkRow | null;
  reason?: string;
}

export interface MuxReconcileSummary {
  scanned: number;
  indexed: number;
  identifiersAttached: number;
  healedReady: number;
  orphansUnmatched: number;
  repairFailed: number;
}

export function logMuxReconcile(
  event: MuxObservabilityEvent,
  payload: Record<string, unknown>,
): void {
  logger.info(event, { event, ...payload });
}

/** Parse Mux passthrough JSON `{ userId, reelId }`. */
export function parseMuxPassthrough(
  passthrough?: string | null,
): MuxPassthroughPayload | null {
  if (!passthrough) return null;
  try {
    const data = JSON.parse(passthrough) as { userId?: string; reelId?: string };
    if (typeof data.userId !== 'string' || typeof data.reelId !== 'string') {
      return null;
    }
    if (!data.userId || !data.reelId) return null;
    return { userId: data.userId, reelId: data.reelId };
  } catch {
    return null;
  }
}

/** Extract passthrough from Mux webhook event payloads. */
export function passthroughFromMuxEvent(data: Record<string, unknown> | undefined): string | null {
  if (!data) return null;
  if (typeof data.passthrough === 'string' && data.passthrough) {
    return data.passthrough;
  }
  const settings = data.new_asset_settings as { passthrough?: string } | undefined;
  if (typeof settings?.passthrough === 'string' && settings.passthrough) {
    return settings.passthrough;
  }
  return null;
}

async function reelConflictsWithMuxIds(
  reelId: string,
  muxUploadId?: string,
  muxAssetId?: string,
): Promise<string | null> {
  if (muxUploadId) {
    const other = await prisma.reel.findFirst({
      where: { muxUploadId, id: { not: reelId }, isDeleted: false },
      select: { id: true },
    });
    if (other) return `muxUploadId already linked to reel ${other.id}`;
  }
  if (muxAssetId) {
    const other = await prisma.reel.findFirst({
      where: { muxAssetId, id: { not: reelId }, isDeleted: false },
      select: { id: true },
    });
    if (other) return `muxAssetId already linked to reel ${other.id}`;
  }
  return null;
}

/**
 * Idempotently attach muxUploadId / muxAssetId when the reel row is missing them.
 * Never overwrites an existing, different identifier.
 */
export async function attachMuxIdentifiersIfMissing(
  reelId: string,
  params: {
    muxUploadId?: string;
    muxAssetId?: string;
    expectedUserId?: string;
    source?: string;
  },
): Promise<AttachMuxIdentifiersResult> {
  const { muxUploadId, muxAssetId, expectedUserId, source = 'unknown' } = params;

  const reel = await prisma.reel.findUnique({
    where: { id: reelId },
    select: REEL_SELECT,
  });

  if (!reel || reel.isDeleted) {
    return { attached: false, reel: null, reason: 'reel_not_found' };
  }

  if (expectedUserId && reel.userId !== expectedUserId) {
    logMuxReconcile('REEL_MUX_REPAIR_FAILED', {
      reelId,
      userId: reel.userId,
      expectedUserId,
      muxUploadId: muxUploadId ?? null,
      muxAssetId: muxAssetId ?? null,
      reason: 'user_mismatch',
      source,
    });
    return { attached: false, reel, reason: 'user_mismatch' };
  }

  if (muxUploadId && reel.muxUploadId && reel.muxUploadId !== muxUploadId) {
    logMuxReconcile('REEL_MUX_REPAIR_FAILED', {
      reelId,
      userId: reel.userId,
      muxUploadId,
      existingMuxUploadId: reel.muxUploadId,
      muxAssetId: muxAssetId ?? reel.muxAssetId,
      reason: 'muxUploadId_conflict',
      source,
    });
    return { attached: false, reel, reason: 'muxUploadId_conflict' };
  }

  if (muxAssetId && reel.muxAssetId && reel.muxAssetId !== muxAssetId) {
    logMuxReconcile('REEL_MUX_REPAIR_FAILED', {
      reelId,
      userId: reel.userId,
      muxUploadId: muxUploadId ?? reel.muxUploadId,
      muxAssetId,
      existingMuxAssetId: reel.muxAssetId,
      reason: 'muxAssetId_conflict',
      source,
    });
    return { attached: false, reel, reason: 'muxAssetId_conflict' };
  }

  const conflict = await reelConflictsWithMuxIds(reelId, muxUploadId, muxAssetId);
  if (conflict) {
    logMuxReconcile('REEL_MUX_REPAIR_FAILED', {
      reelId,
      userId: reel.userId,
      muxUploadId: muxUploadId ?? null,
      muxAssetId: muxAssetId ?? null,
      reason: conflict,
      source,
    });
    return { attached: false, reel, reason: conflict };
  }

  const data: { muxUploadId?: string; muxAssetId?: string } = {};
  if (muxUploadId && !reel.muxUploadId) data.muxUploadId = muxUploadId;
  if (muxAssetId && !reel.muxAssetId) data.muxAssetId = muxAssetId;

  if (Object.keys(data).length === 0) {
    return { attached: false, reel, reason: 'already_linked' };
  }

  const updated = await prisma.reel.update({
    where: { id: reelId },
    data,
    select: REEL_SELECT,
  });

  logMuxReconcile('REEL_MUX_REPAIRED', {
    reelId: updated.id,
    userId: updated.userId,
    muxUploadId: updated.muxUploadId,
    muxAssetId: updated.muxAssetId,
    source,
  });

  return { attached: true, reel: updated };
}

/**
 * Resolve a reel for a Mux webhook or heal path:
 * 1) muxUploadId  2) muxAssetId  3) passthrough.reelId + attach missing ids
 */
export async function resolveReelForMuxEvent(params: {
  uploadId?: string | null;
  assetId?: string | null;
  passthrough?: string | null;
  source?: string;
}): Promise<ReelMuxLinkRow | null> {
  const { uploadId, assetId, passthrough, source = 'mux_event' } = params;

  if (uploadId) {
    const byUpload = await prisma.reel.findFirst({
      where: { muxUploadId: uploadId, isDeleted: false },
      select: REEL_SELECT,
    });
    if (byUpload) return byUpload;
  }

  if (assetId) {
    const byAsset = await prisma.reel.findFirst({
      where: { muxAssetId: assetId, isDeleted: false },
      select: REEL_SELECT,
    });
    if (byAsset) return byAsset;
  }

  const parsed = parseMuxPassthrough(passthrough);
  if (!parsed) {
    if (uploadId || assetId) {
      logMuxReconcile('REEL_MUX_ORPHAN_FOUND', {
        reelId: null,
        userId: null,
        muxUploadId: uploadId ?? null,
        muxAssetId: assetId ?? null,
        reason: 'missing_passthrough',
        source,
      });
    }
    return null;
  }

  const reel = await prisma.reel.findFirst({
    where: { id: parsed.reelId, isDeleted: false },
    select: REEL_SELECT,
  });

  if (!reel) {
    logMuxReconcile('REEL_MUX_ORPHAN_FOUND', {
      reelId: parsed.reelId,
      userId: parsed.userId,
      muxUploadId: uploadId ?? null,
      muxAssetId: assetId ?? null,
      reason: 'reel_row_missing',
      source,
    });
    return null;
  }

  const attach = await attachMuxIdentifiersIfMissing(reel.id, {
    muxUploadId: uploadId ?? undefined,
    muxAssetId: assetId ?? undefined,
    expectedUserId: parsed.userId,
    source,
  });

  if (!attach.reel) return null;
  if (attach.reason === 'user_mismatch') return null;

  return attach.reel;
}

/** Build reelId → latest Mux upload/asset ids from Mux list APIs. */
export function buildMuxPassthroughIndex(
  assets: muxService.MuxAssetSummary[],
  uploads: muxService.MuxUploadSummary[],
): Map<string, MuxPassthroughMatch> {
  const index = new Map<string, MuxPassthroughMatch>();

  const merge = (reelId: string, partial: MuxPassthroughMatch) => {
    const prev = index.get(reelId) ?? {};
    index.set(reelId, {
      muxUploadId: partial.muxUploadId ?? prev.muxUploadId,
      muxAssetId: partial.muxAssetId ?? prev.muxAssetId,
      passthrough: partial.passthrough ?? prev.passthrough,
    });
  };

  for (const upload of uploads) {
    const parsed = parseMuxPassthrough(upload.passthrough);
    if (!parsed) continue;
    merge(parsed.reelId, {
      muxUploadId: upload.id,
      muxAssetId: upload.assetId,
      passthrough: upload.passthrough,
    });
  }

  for (const asset of assets) {
    const parsed = parseMuxPassthrough(asset.passthrough);
    if (!parsed) continue;
    merge(parsed.reelId, {
      muxUploadId: asset.uploadId,
      muxAssetId: asset.id,
      passthrough: asset.passthrough,
    });
  }

  return index;
}

/**
 * Scheduled reconciliation: reconnect PROCESSING reels missing muxUploadId,
 * then run existing heal logic when the Mux asset is already ready.
 */
export async function runMuxReconciliation(): Promise<MuxReconcileSummary> {
  const summary: MuxReconcileSummary = {
    scanned: 0,
    indexed: 0,
    identifiersAttached: 0,
    healedReady: 0,
    orphansUnmatched: 0,
    repairFailed: 0,
  };

  const since = new Date(Date.now() - MUX_RECONCILE_RETENTION_MS);

  const orphanReels = await prisma.reel.findMany({
    where: {
      status: 'PROCESSING',
      muxUploadId: null,
      isDeleted: false,
      createdAt: { gte: since },
    },
    select: REEL_HEAL_STATUS_SELECT,
    orderBy: { createdAt: 'desc' },
  });

  summary.scanned = orphanReels.length;
  if (orphanReels.length === 0) {
    return summary;
  }

  const [assets, uploads] = await Promise.all([
    muxService.listMuxAssets(100),
    muxService.listMuxUploads(100),
  ]);

  const index = buildMuxPassthroughIndex(assets, uploads);
  summary.indexed = index.size;

  for (const reel of orphanReels) {
    const match = index.get(reel.id);
    if (!match?.muxUploadId && !match?.muxAssetId) {
      summary.orphansUnmatched++;
      logMuxReconcile('REEL_MUX_ORPHAN_FOUND', {
        reelId: reel.id,
        userId: reel.userId,
        muxUploadId: null,
        muxAssetId: null,
        reason: 'no_mux_index_match',
        source: 'reconcile_cron',
      });
      continue;
    }

    try {
      const attach = await attachMuxIdentifiersIfMissing(reel.id, {
        muxUploadId: match.muxUploadId,
        muxAssetId: match.muxAssetId,
        expectedUserId: reel.userId,
        source: 'reconcile_cron',
      });

      if (attach.reason === 'user_mismatch' || attach.reason?.includes('conflict')) {
        summary.repairFailed++;
        continue;
      }

      if (attach.attached) {
        summary.identifiersAttached++;
        logMuxReconcile('REEL_MUX_RECONCILED', {
          reelId: reel.id,
          userId: reel.userId,
          muxUploadId: attach.reel?.muxUploadId ?? match.muxUploadId ?? null,
          muxAssetId: attach.reel?.muxAssetId ?? match.muxAssetId ?? null,
          source: 'reconcile_cron',
        });
      }

      const refreshed = await prisma.reel.findUnique({
        where: { id: reel.id },
        select: REEL_HEAL_STATUS_SELECT,
      });

      if (!refreshed) continue;

      const heal = await healReelFromMux(refreshed as ReelHealRow, {
        notify: true,
        invalidateCaches: true,
      });

      if (heal.outcome === 'ready') {
        summary.healedReady++;
      }
    } catch (err: unknown) {
      summary.repairFailed++;
      logMuxReconcile('REEL_MUX_REPAIR_FAILED', {
        reelId: reel.id,
        userId: reel.userId,
        muxUploadId: match.muxUploadId ?? null,
        muxAssetId: match.muxAssetId ?? null,
        reason: err instanceof Error ? err.message : String(err),
        source: 'reconcile_cron',
      });
    }
  }

  logger.info('[MuxReconcile] Batch complete', summary);
  return summary;
}
