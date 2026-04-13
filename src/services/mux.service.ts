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

// ─── Methods ──────────────────────────────────────────────────────────────────

/**
 * Create a Mux direct upload URL.
 * The caller PUTs the raw video buffer to `uploadUrl`.
 */
export async function createUploadUrl(
  userId: string,
  reelId: string,
): Promise<MuxUploadResult> {
  const upload = await mux().video.uploads.create({
    cors_origin: '*',
    new_asset_settings: {
      playback_policy: ['public'],
      video_quality: 'plus', // Upgraded from 'basic' — better quality for sports content with fast motion
      passthrough: JSON.stringify({ userId, reelId }),
    },
  });

  logger.info(`[Mux] Created upload ${upload.id} for reel ${reelId}`);

  return {
    uploadId: upload.id,
    uploadUrl: upload.url,
  };
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

  // Use the mux instance's webhooks helper (has verifySignature on prototype)
  const client = new Mux({ tokenId: 'placeholder', tokenSecret: 'placeholder', webhookSecret: secret });
  // verifySignature exists at runtime but TypeScript types may lag — use bracket access
  (client.webhooks as any).verifySignature(rawBody, { 'mux-signature': signature }, secret);

  // Parse after verification
  const body = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
  return JSON.parse(body);
}
