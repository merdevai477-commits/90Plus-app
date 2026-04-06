import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { logger } from '../utils/logger';

interface UploadResult {
  success: boolean;
  url?: string;
  path?: string;
  error?: string;
}

// R2 client as fallback when Supabase is not configured
const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || '90plus-storage';
const R2_BASE_URL = (process.env.CDN_URL || process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');

const r2Client = R2_ENDPOINT ? new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  forcePathStyle: false,
}) : null;

class SupabaseStorageService {
  private client: SupabaseClient | null = null;
  private useR2: boolean = false;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      this.client = createClient(supabaseUrl, supabaseKey);
      logger.info('✅ Supabase Storage initialized');
    } else if (R2_ENDPOINT && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY) {
      this.useR2 = true;
      logger.info('ℹ️  Supabase not configured - using R2 for storage');
    } else {
      logger.warn('⚠️ Supabase credentials not found. Storage features will be disabled.');
    }
  }

  /**
   * Upload file - uses R2 if Supabase not configured
   */
  async uploadFile(
    bucket: string,
    fileBuffer: Buffer,
    filePath: string,
    contentType: string
  ): Promise<UploadResult> {
    // Use R2 if Supabase not configured
    if (this.useR2 && r2Client) {
      try {
        const key = `${bucket}/${filePath}`;
        await r2Client.send(new PutObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: key,
          Body: fileBuffer,
          ContentType: contentType,
          CacheControl: 'public, max-age=31536000, immutable',
        }));
        const url = `${R2_BASE_URL}/${key}`;
        logger.info(`[R2] ✅ Uploaded ${key}`);
        return { success: true, url, path: key };
      } catch (error: any) {
        logger.error(`[R2] ❌ Upload failed:`, error.message);
        return { success: false, error: error.message };
      }
    }

    if (!this.client) {
      return { success: false, error: 'Storage not configured' };
    }

    try {
      const { data, error } = await this.client.storage
        .from(bucket)
        .upload(filePath, fileBuffer, {
          contentType,
          upsert: true,
        });

      if (error) {
        logger.error('Supabase upload error:', error);
        return { success: false, error: error.message };
      }

      // Get public URL
      const { data: urlData } = this.client.storage
        .from(bucket)
        .getPublicUrl(data.path);

      return {
        success: true,
        url: urlData.publicUrl,
        path: data.path,
      };
    } catch (error: any) {
      logger.error('Upload error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * حذف ملف من Supabase Storage
   */
  async deleteFile(bucket: string, filePath: string): Promise<boolean> {
    // Use R2 if Supabase not configured
    if (this.useR2 && r2Client) {
      try {
        // Support both (bucket, path) and (fullKey) calling conventions
        const key = filePath.includes('/') && filePath.startsWith(bucket)
          ? filePath
          : `${bucket}/${filePath}`;
        await r2Client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }));
        logger.info(`[R2] 🗑️ Deleted: ${key}`);
        return true;
      } catch (error: any) {
        logger.error(`[R2] ❌ Delete failed:`, error.message);
        return false;
      }
    }

    if (!this.client) {
      return false;
    }

    try {
      const { error } = await this.client.storage
        .from(bucket)
        .remove([filePath]);

      if (error) {
        logger.error('Supabase delete error:', error);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Delete error:', error);
      return false;
    }
  }

  /**
   * الحصول على رابط مؤقت للملف (للملفات الخاصة)
   */
  async getSignedUrl(bucket: string, filePath: string, expiresIn: number = 3600): Promise<string | null> {
    if (!this.client) {
      return null;
    }

    try {
      const { data, error } = await this.client.storage
        .from(bucket)
        .createSignedUrl(filePath, expiresIn);

      if (error) {
        logger.error('Signed URL error:', error);
        return null;
      }

      return data.signedUrl;
    } catch (error) {
      logger.error('Get signed URL error:', error);
      return null;
    }
  }

  /**
   * التحقق من وجود ملف
   */
  async fileExists(bucket: string, filePath: string): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      const { data, error } = await this.client.storage
        .from(bucket)
        .list(filePath.split('/').slice(0, -1).join('/'), {
          search: filePath.split('/').pop(),
        });

      return !error && data && data.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * الحصول على الرابط العام للملف
   */
  getPublicUrl(bucket: string, filePath: string): string | null {
    if (!this.client) {
      return null;
    }

    const { data } = this.client.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return data.publicUrl;
  }
}

export const supabaseStorage = new SupabaseStorageService();
