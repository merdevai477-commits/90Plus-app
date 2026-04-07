/**
 * Storage Service - Cloudflare R2
 * Previously Supabase, now fully migrated to R2
 * Kept as supabase-storage.service.ts for backward compatibility with existing imports
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { logger } from '../utils/logger';

interface UploadResult {
  success: boolean;
  url?: string;
  path?: string;
  error?: string;
}

const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || '90plus-storage';
const BASE_URL = (process.env.CDN_URL || process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');

const CACHE_HEADERS: Record<string, string> = {
  avatars:    'public, max-age=31536000, immutable',
  covers:     'public, max-age=31536000, immutable',
  thumbnails: 'public, max-age=31536000, immutable',
  reels:      'public, max-age=86400',
  videos:     'public, max-age=86400',
};

const r2Client = R2_ENDPOINT ? new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  forcePathStyle: false,
}) : null;

if (r2Client) {
  logger.info('✅ R2 Storage initialized');
} else {
  logger.warn('⚠️ R2 storage not configured. Check R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY');
}

class StorageService {
  async uploadFile(
    bucket: string,
    fileBuffer: Buffer,
    filePath: string,
    contentType: string
  ): Promise<UploadResult> {
    if (!r2Client) {
      return { success: false, error: 'R2 storage not configured' };
    }

    try {
      const key = `${bucket}/${filePath}`;
      const cacheControl = CACHE_HEADERS[bucket] || 'public, max-age=3600';

      await r2Client.send(new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
        CacheControl: cacheControl,
        Metadata: {
          'uploaded-at': new Date().toISOString(),
          'content-size': fileBuffer.length.toString(),
        },
      }));

      const url = `${BASE_URL}/${key}`;
      const sizeMB = (fileBuffer.length / 1024 / 1024).toFixed(2);
      logger.info(`[R2] ✅ Uploaded ${key} (${sizeMB}MB)`);

      return { success: true, url, path: key };
    } catch (error: any) {
      logger.error(`[R2] ❌ Upload failed for ${bucket}/${filePath}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  async deleteFile(bucket: string, filePath: string): Promise<boolean> {
    if (!r2Client || !filePath) return false;

    try {
      // Support full key (reels/userId/file.mp4) or relative path
      const key = filePath.startsWith(`${bucket}/`) ? filePath : `${bucket}/${filePath}`;

      await r2Client.send(new DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
      }));
      logger.info(`[R2] 🗑️ Deleted: ${key}`);
      return true;
    } catch (error: any) {
      logger.error(`[R2] ❌ Delete failed for ${bucket}/${filePath}:`, error.message);
      return false;
    }
  }

  getUrl(key: string): string {
    return `${BASE_URL}/${key}`;
  }
}

export const supabaseStorage = new StorageService();
