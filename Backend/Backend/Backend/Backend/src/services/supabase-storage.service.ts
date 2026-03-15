import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

interface UploadResult {
  success: boolean;
  url?: string;
  path?: string;
  error?: string;
}

class SupabaseStorageService {
  private client: SupabaseClient | null = null;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      this.client = createClient(supabaseUrl, supabaseKey);
      logger.info('✅ Supabase Storage initialized');
    } else {
      logger.warn('⚠️ Supabase credentials not found. Storage features will be disabled.');
    }
  }

  /**
   * رفع ملف إلى Supabase Storage
   */
  async uploadFile(
    bucket: string,
    fileBuffer: Buffer,
    filePath: string,
    contentType: string
  ): Promise<UploadResult> {
    if (!this.client) {
      return { success: false, error: 'Supabase not configured' };
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
