import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logger } from '../utils/logger';

interface UploadResult {
  success: boolean;
  url?: string;
  path?: string;
  error?: string;
}

class R2StorageService {
  private client: S3Client | null = null;
  private bucket: string = '';
  private publicUrl: string = '';

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    this.bucket = process.env.R2_BUCKET_NAME || '90plus-storage';
    this.publicUrl = process.env.R2_PUBLIC_URL || '';

    if (accountId && accessKeyId && secretAccessKey) {
      this.client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
      logger.info('✅ Cloudflare R2 Storage initialized');
    } else {
      logger.warn('⚠️ R2 credentials not found. Storage features will be disabled.');
    }
  }

  /**
   * رفع ملف إلى R2 Storage
   */
  async uploadFile(
    folder: string,
    fileBuffer: Buffer,
    filePath: string,
    contentType: string
  ): Promise<UploadResult> {
    if (!this.client) {
      return { success: false, error: 'R2 not configured' };
    }

    try {
      const fullPath = `${folder}/${filePath}`;
      
      logger.info(`📤 Uploading to R2: ${fullPath}`);

      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: fullPath,
          Body: fileBuffer,
          ContentType: contentType,
        })
      );

      const url = this.getPublicUrl(folder, filePath);
      
      if (!url) {
        logger.warn(`⚠️ R2 Upload succeeded but no public URL (R2_PUBLIC_URL not configured): ${fullPath}`);
      } else {
        logger.info(`✅ R2 Upload success: ${url}`);
      }

      return {
        success: true,
        url: url || undefined,
        path: fullPath,
      };
    } catch (error: any) {
      logger.error('R2 upload error:', error);
      return { success: false, error: error.message };
    }
  }


  /**
   * حذف ملف من R2 Storage
   */
  async deleteFile(folder: string, filePath: string): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      // Handle both full path and relative path
      const fullPath = filePath.includes('/') ? filePath : `${folder}/${filePath}`;

      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: fullPath,
        })
      );

      return true;
    } catch (error) {
      logger.error('R2 delete error:', error);
      return false;
    }
  }

  /**
   * الحصول على رابط مؤقت للملف (للملفات الخاصة)
   */
  async getSignedUrl(folder: string, filePath: string, expiresIn: number = 3600): Promise<string | null> {
    if (!this.client) {
      return null;
    }

    try {
      const fullPath = filePath.includes('/') ? filePath : `${folder}/${filePath}`;

      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: fullPath,
      });

      const signedUrl = await getSignedUrl(this.client, command, { expiresIn });
      return signedUrl;
    } catch (error) {
      logger.error('R2 signed URL error:', error);
      return null;
    }
  }

  /**
   * التحقق من وجود ملف
   */
  async fileExists(folder: string, filePath: string): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      const fullPath = filePath.includes('/') ? filePath : `${folder}/${filePath}`;

      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: fullPath,
        })
      );

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * الحصول على الرابط العام للملف
   */
  getPublicUrl(folder: string, filePath: string): string | null {
    if (!this.publicUrl) {
      return null;
    }

    // Always construct full path with folder
    const fullPath = `${folder}/${filePath}`;
    return `${this.publicUrl}/${fullPath}`;
  }
}

// Export with same name for easy migration
export const r2Storage = new R2StorageService();

// Also export as supabaseStorage for backward compatibility
export const supabaseStorage = r2Storage;
