/**
 * Cloudflare R2 Media Storage Service
 * Handles avatars, covers, reels, and thumbnails
 * 
 * CDN Strategy:
 * - Images (avatars, covers, thumbnails): Cache-Control: public, max-age=31536000 (1 year)
 *   → Immutable files (new upload = new filename), safe to cache forever
 * - Videos (reels): Cache-Control: public, max-age=86400 (1 day)
 *   → Large files, cache at Cloudflare edge for fast delivery worldwide
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { logger } from '../utils/logger';

interface UploadResult {
  success: boolean;
  url?: string;
  path?: string;
  error?: string;
}

// Validate R2 config at startup
const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
const BUCKET_NAME = process.env.R2_BUCKET_NAME || '90plus-storage';
// CDN_URL takes priority over R2_PUBLIC_URL for Cloudflare CDN delivery
const BASE_URL = (process.env.CDN_URL || process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');

if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  logger.warn('⚠️ R2 storage not fully configured. Check R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY');
} else {
  logger.info('✅ R2 Media Storage initialized');
}

const r2Client = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
  // Force path-style for R2 compatibility
  forcePathStyle: false,
});

// Cache-Control headers per media type
const CACHE_HEADERS: Record<string, string> = {
  avatars:    'public, max-age=31536000, immutable', // 1 year - immutable (new file = new name)
  covers:     'public, max-age=31536000, immutable', // 1 year
  thumbnails: 'public, max-age=31536000, immutable', // 1 year
  reels:      'public, max-age=86400',               // 1 day - videos are large, cache at edge
  videos:     'public, max-age=86400',               // 1 day
};

class R2MediaStorageService {
  private isConfigured(): boolean {
    return !!(R2_ENDPOINT && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY);
  }

  /**
   * Upload a file to R2
   * @param folder - bucket folder: 'avatars' | 'covers' | 'reels' | 'thumbnails'
   * @param fileBuffer - file content
   * @param fileName - filename only (no folder prefix) e.g. "userId/timestamp_file.jpg"
   * @param contentType - MIME type
   */
  async uploadFile(
    folder: string,
    fileBuffer: Buffer,
    fileName: string,
    contentType: string
  ): Promise<UploadResult> {
    if (!this.isConfigured()) {
      return { success: false, error: 'R2 storage not configured' };
    }

    try {
      // Build the full R2 key: folder/fileName
      const key = `${folder}/${fileName}`;
      const cacheControl = CACHE_HEADERS[folder] || 'public, max-age=3600';

      await r2Client.send(new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
        CacheControl: cacheControl,
        // Metadata for debugging
        Metadata: {
          'uploaded-at': new Date().toISOString(),
          'content-size': fileBuffer.length.toString(),
        },
      }));

      const url = `${BASE_URL}/${key}`;
      const sizeMB = (fileBuffer.length / 1024 / 1024).toFixed(2);
      logger.info(`[R2] ✅ Uploaded ${folder}/${fileName} (${sizeMB}MB) → ${url}`);

      return { success: true, url, path: key };
    } catch (error: any) {
      logger.error(`[R2] ❌ Upload failed for ${folder}/${fileName}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete a file from R2 by its full key (e.g. "avatars/userId/timestamp_file.jpg")
   */
  async deleteFile(key: string): Promise<boolean> {
    if (!this.isConfigured() || !key) return false;

    try {
      await r2Client.send(new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      }));
      logger.info(`[R2] 🗑️ Deleted: ${key}`);
      return true;
    } catch (error: any) {
      logger.error(`[R2] ❌ Delete failed for ${key}:`, error.message);
      return false;
    }
  }

  /**
   * Build a CDN URL from a stored key
   * Useful when you have the path and need the full URL
   */
  getUrl(key: string): string {
    return `${BASE_URL}/${key}`;
  }
}

export const r2MediaStorage = new R2MediaStorageService();
