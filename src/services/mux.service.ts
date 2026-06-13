/**
 * Mux Video Service
 *
 * Handles all Mux API interactions:
 *  - Direct upload URL creation
 *  - Asset status polling
 *  - Playback / thumbnail URL construction
 *  - Asset deletion
 *  - Webhook signature verification
 */

import Mux from '@mux/mux-node';
import { logger } from '../utils/logger';

// ─── Client singleton ─────────────────────────────────────────────────────────

function getMuxClient(): Mux {
  const tokenId = process.env.MUX_TOKEN_ID;
  const tokenSecret = process.env.MUX_TOKEN_SECRET;

  if (!tokenId || !tokenSecret) {
    throw new Error('MUX_TOKEN_ID and MUX_TOKEN_SECRET must be set');
  }

  return new Mux({ tokenId, tokenSecret });
}

// Lazy singleton — created on first use so missing env vars don't crash startup
let _mux: Mux | null = null;
function mux(): Mux {
  if (!_mux) _mux = getMuxClient();
  return _mux;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MuxUploadResult {
  uploadId: string;
  uploadUrl: string;
}

export interface MuxAsset {
  id: string;
  status: 'preparing' | 'ready' | 'errored';
  playbackIds?: Array<{ id: string; policy: string }>;
  duration?: number;
}

export type MuxVideoQuality = 'basic' | 'plus';

export interface MuxAssetSummary {
  id: string;
  status: string;
  createdAt?: number;
  passthrough?: string;
  uploadId?: string;
}

export interface MuxUploadSummary {
  id: string;
  status?: string;
  assetId?: string;
  passthrough?: string;
  createdAt?: number;
}

export type MuxErrorCode = 'MUX_ASSET_LIMIT' | 'MUX_UNAVAILABLE';

export class MuxServiceError extends Error {
  readonly code: MuxErrorCode;

  constructor(code: MuxErrorCode, message: string) {
    super(message);
    this.name = 'MuxServiceError';
    this.code = code;
  }
}

function getMuxVideoQuality(): MuxVideoQuality {
  const raw = (process.env.MUX_VIDEO_QUALITY || 'basic').toLowerCase();
  return raw === 'plus' ? 'plus' : 'basic';
}

/** Mux free tier blocks new uploads when 10 assets exist. */
export function isMuxAssetLimitError(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message ?? err ?? '').toLowerCase();
  return (
    msg.includes('10 assets') ||
    msg.includes('exceeding this limit') ||
    msg.includes('asset limit')
  );
}

function toMuxServiceError(err: unknown): MuxServiceError {
  if (err instanceof MuxServiceError) return err;
  const message = String((err as { message?: string })?.message ?? err ?? 'Mux request failed');
  if (isMuxAssetLimitError(err)) {
    return new MuxServiceError('MUX_ASSET_LIMIT', message);
  }
  return new MuxServiceError('MUX_UNAVAILABLE', message);
}

async function createUploadUrlOnce(
  userId: string,
  reelId: string,
): Promise<MuxUploadResult> {
  const upload = await mux().video.uploads.create({
    cors_origin: '*',
    new_asset_settings: {
      playback_policy: ['public'],
      video_quality: getMuxVideoQuality(),
      passthrough: JSON.stringify({ userId, reelId }),
    },
  });

  logger.info(`[Mux] Created upload ${upload.id} for reel ${reelId} (quality=${getMuxVideoQuality()})`);

  return {
    uploadId: upload.id,
    uploadUrl: upload.url,
  };
}

/**
 * List Mux assets (newest first). Used for quota cleanup on the free plan.
 */
export async function listMuxAssets(limit = 100): Promise<MuxAssetSummary[]> {
  const page = await mux().video.assets.list({ limit: Math.min(limit, 100) });
  const rows = ((page as { data?: unknown[] }).data ?? []) as Array<{
    id: string;
    status?: string;
    created_at?: number | string;
    passthrough?: string;
    upload_id?: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    status: row.status ?? 'unknown',
    createdAt: typeof row.created_at === 'number'
      ? row.created_at
      : row.created_at
        ? Math.floor(new Date(row.created_at).getTime() / 1000)
        : undefined,
    passthrough: row.passthrough,
    uploadId: row.upload_id,
  }));
}

/**
 * List recent Mux direct uploads (newest first) for passthrough reconciliation.
 */
export async function listMuxUploads(limit = 100): Promise<MuxUploadSummary[]> {
  const page = await mux().video.uploads.list({ limit: Math.min(limit, 100) });
  const rows = ((page as { data?: unknown[] }).data ?? []) as Array<{
    id: string;
    status?: string;
    asset_id?: string;
    created_at?: number | string;
    new_asset_settings?: { passthrough?: string };
  }>;

  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    assetId: row.asset_id,
    passthrough: row.new_asset_settings?.passthrough,
    createdAt: typeof row.created_at === 'number'
      ? row.created_at
      : row.created_at
        ? Math.floor(new Date(row.created_at).getTime() / 1000)
        : undefined,
  }));
}

// ─── Methods ──────────────────────────────────────────────────────────────────

/**
 * Create a Mux direct upload URL.
 * The caller PUTs the raw video buffer to `uploadUrl`.
 * On free-tier asset cap, prunes stale/test assets once and retries.
 */
export async function createUploadUrl(
  userId: string,
  reelId: string,
): Promise<MuxUploadResult> {
  try {
    return await createUploadUrlOnce(userId, reelId);
  } catch (firstErr) {
    if (!isMuxAssetLimitError(firstErr)) {
      throw toMuxServiceError(firstErr);
    }

    logger.warn('[Mux] Asset limit hit — attempting cleanup before retry', {
      reelId,
      userId,
    });

    const { freeMuxAssetSlots } = await import('./mux-cleanup.service');
    const freed = await freeMuxAssetSlots(3);
    if (freed < 1) {
      throw new MuxServiceError(
        'MUX_ASSET_LIMIT',
        'Mux free plan asset limit reached and no stale assets could be removed',
      );
    }

    try {
      return await createUploadUrlOnce(userId, reelId);
    } catch (retryErr) {
      throw toMuxServiceError(retryErr);
    }
  }
}

/**
 * Retrieve a Mux asset by its asset ID.
 */
export async function getAsset(assetId: string): Promise<MuxAsset> {
  const asset = await mux().video.assets.retrieve(assetId);
  return {
    id: asset.id,
    status: asset.status as MuxAsset['status'],
    playbackIds: asset.playback_ids?.map((p) => ({ id: p.id, policy: p.policy })),
    duration: asset.duration ?? undefined,
  };
}

/**
 * Retrieve a Mux direct upload by its upload ID to discover the asset it
 * created. Returns null if the upload has not yet produced an asset (e.g.
 * the PUT is still streaming or Mux is still creating the asset).
 */
export async function getUploadAsset(uploadId: string): Promise<MuxAsset | null> {
  try {
    const upload = await mux().video.uploads.retrieve(uploadId);
    const assetId = (upload as any).asset_id as string | undefined;
    if (!assetId) return null;
    return await getAsset(assetId);
  } catch (err: any) {
    logger.warn(`[Mux] Failed to retrieve upload ${uploadId}: ${err?.message}`);
    return null;
  }
}

/**
 * Construct the HLS playback URL for a given playback ID.
 */
export function getPlaybackUrl(playbackId: string): string {
  return `https://stream.mux.com/${playbackId}.m3u8`;
}

/**
 * Construct the thumbnail URL for a given playback ID.
 * `time` is the timestamp in seconds (default: 1s).
 */
export function getThumbnailUrl(playbackId: string, time = 1): string {
  return `https://image.mux.com/${playbackId}/thumbnail.jpg?time=${time}`;
}

/**
 * Delete a Mux asset by its asset ID.
 * Non-throwing — logs warning on failure.
 */
export async function deleteAsset(assetId: string): Promise<void> {
  try {
    await mux().video.assets.delete(assetId);
    logger.info(`[Mux] Deleted asset ${assetId}`);
  } catch (err: any) {
    logger.warn(`[Mux] Failed to delete asset ${assetId}: ${err?.message}`);
  }
}

/**
 * Verify a Mux webhook signature and return the parsed event.
 * Throws if the signature is invalid.
 *
 * IMPORTANT: rawBody must be the raw Buffer/string — NOT the parsed JSON body.
 * Register the Mux webhook route BEFORE express.json() middleware.
 */
export function verifyWebhook(rawBody: string | Buffer, signature: string): any {
  const secret = process.env.MUX_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('MUX_WEBHOOK_SECRET is not set');
  }

  // Mux SDK requires the exact raw JSON string — express.raw() gives us a Buffer.
  const bodyStr = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');

  const client = new Mux({ tokenId: 'placeholder', tokenSecret: 'placeholder', webhookSecret: secret });
  (client.webhooks as any).verifySignature(bodyStr, { 'mux-signature': signature }, secret);

  return JSON.parse(bodyStr);
}
