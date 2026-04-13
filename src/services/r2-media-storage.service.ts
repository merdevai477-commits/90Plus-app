/**
 * R2 Media Storage Service
 *
 * Fixes applied:
 *  Fix 2  – Orphan tracking (registerOrphan / resolveOrphan wrappers)
 *  Fix 3  – Signed URLs for reels/videos (1-hour expiry, Redis cache 50 min)
 *           Redis failure → graceful fallback to fresh signed URL (no crash)
 *  Fix 10 – Cache-Control headers on uploads
 */

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logger } from '../utils/logger';
import { registerOrphan, resolveOrphan } from './r2-cleanup.service';
import { redisCacheService } from './redis-cache.service';

export type R2MediaBucket = 'avatars' | 'covers' | 'reels' | 'thumbnails' | 'videos';

export interface R2UploadResult {
  success: boolean;
  url?: string;
  key?: string;
  error?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function getPublicBaseUrl(): string {
  return (
    process.env.R2_MEDIA_PUBLIC_URL ||
    process.env.R2_PUBLIC_URL ||
    ''
  ).replace(/\/$/, '');
}

function buildObjectKey(bucket: R2MediaBucket, userId: string, fileName: string): string {
  const safeName = fileName.replace(/[^\w.-]+/g, '_').slice(0, 120);
  return `${bucket}/${userId}/${Date.now()}_${safeName}`;
}

/** Cache-Control header per bucket type (Fix 10) */
function cacheControlFor(bucket: R2MediaBucket): string {
  if (bucket === 'reels' || bucket === 'videos') {
    return 'private, max-age=3600';
  }
  return 'public, max-age=31536000, immutable';
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class R2MediaStorageService {
  private client: S3Client;
  private bucketName: string;
  private publicBaseUrl: string;

  constructor() {
    const endpoint = requiredEnv('R2_ENDPOINT');
    const accessKeyId = requiredEnv('R2_ACCESS_KEY_ID');
    const secretAccessKey = requiredEnv('R2_SECRET_ACCESS_KEY');

    this.bucketName =
      process.env.R2_MEDIA_BUCKET_NAME ||
      process.env.R2_BUCKET_NAME ||
      requiredEnv('R2_BUCKET_NAME');

    this.publicBaseUrl = getPublicBaseUrl();

    this.client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  // ── Upload (public) ─────────────────────────────────────────────────────────

  async uploadPublic(
    bucket: R2MediaBucket,
    userId: string,
    fileBuffer: Buffer,
    originalName: string,
    contentType: string,
  ): Promise<R2UploadResult> {
    if (!this.publicBaseUrl) {
      return {
        success: false,
        error: 'R2 public URL not configured (set R2_MEDIA_PUBLIC_URL or R2_PUBLIC_URL)',
      };
    }

    const key = buildObjectKey(bucket, userId, originalName);

    // Fix 2: register orphan BEFORE upload attempt
    await registerOrphan(key, bucket, fileBuffer.length);

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: fileBuffer,
          ContentType: contentType,
          CacheControl: cacheControlFor(bucket), // Fix 10
        }),
      );

      // Fix 2: mark resolved after successful upload
      await resolveOrphan(key);

      return { success: true, key, url: `${this.publicBaseUrl}/${key}` };
    } catch (error: any) {
      logger.error('[R2] uploadPublic error:', error);
      return { success: false, error: error?.message || 'R2 upload failed' };
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  async deleteObject(key: string): Promise<boolean> {
    if (!key) return true;
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucketName, Key: key }),
      );
      return true;
    } catch (error) {
      logger.error('[R2] deleteObject error:', error);
      return false;
    }
  }

  // ── Signed URL (Fix 3) ──────────────────────────────────────────────────────

  /**
   * Generate a signed URL for a private object (reels / videos).
   * Cached in Redis for 50 minutes.
   * If Redis is down → generates a fresh URL without caching (no crash).
   * If AWS SDK throws → propagates the error to the caller.
   */
  async generateSignedUrl(
    storagePath: string,
    expiresInSeconds = 3600,
  ): Promise<string> {
    const cacheKey = `r2:signed:${storagePath}`;

    // Try Redis cache — swallow errors gracefully
    try {
      const cached = await redisCacheService.get<string>(cacheKey);
      if (cached) return cached;
    } catch (redisErr) {
      logger.warn('[R2] Redis cache read failed for signed URL (will generate fresh):', redisErr);
    }

    // Generate fresh signed URL — let AWS SDK errors propagate
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: storagePath,
    });
    const url = await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });

    // Cache for 50 minutes — swallow errors gracefully
    try {
      await redisCacheService.set(cacheKey, url, 50 * 60 * 1000);
    } catch (redisErr) {
      logger.warn('[R2] Redis cache write failed for signed URL (non-fatal):', redisErr);
    }

    return url;
  }

  /**
   * Bulk-sign multiple storage paths.
   * Each path is signed independently; one failure doesn't block others.
   */
  async generateSignedUrls(
    paths: string[],
    expiresInSeconds = 3600,
  ): Promise<Record<string, string>> {
    const results: Record<string, string> = {};
    await Promise.allSettled(
      paths.map(async (p) => {
        try {
          results[p] = await this.generateSignedUrl(p, expiresInSeconds);
        } catch (err) {
          logger.error(`[R2] generateSignedUrl failed for path ${p}:`, err);
          // Leave results[p] undefined — caller handles missing keys
        }
      }),
    );
    return results;
  }
}

export const r2MediaStorage = new R2MediaStorageService();
