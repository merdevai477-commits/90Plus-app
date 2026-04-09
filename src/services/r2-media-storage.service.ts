import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { logger } from '../utils/logger';

export type R2MediaBucket = 'avatars' | 'covers' | 'reels' | 'thumbnails' | 'videos';

export interface R2UploadResult {
  success: boolean;
  url?: string;
  key?: string;
  error?: string;
}

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
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

export class R2MediaStorageService {
  private client: S3Client;
  private bucketName: string;
  private publicBaseUrl: string;

  constructor() {
    const endpoint = requiredEnv('R2_ENDPOINT');
    const accessKeyId = requiredEnv('R2_ACCESS_KEY_ID');
    const secretAccessKey = requiredEnv('R2_SECRET_ACCESS_KEY');

    this.bucketName = process.env.R2_MEDIA_BUCKET_NAME || process.env.R2_BUCKET_NAME || requiredEnv('R2_BUCKET_NAME');
    this.publicBaseUrl = getPublicBaseUrl();

    this.client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  async uploadPublic(
    bucket: R2MediaBucket,
    userId: string,
    fileBuffer: Buffer,
    originalName: string,
    contentType: string
  ): Promise<R2UploadResult> {
    try {
      if (!this.publicBaseUrl) {
        return { success: false, error: 'R2 public URL is not configured (R2_MEDIA_PUBLIC_URL or R2_PUBLIC_URL)' };
      }

      const key = buildObjectKey(bucket, userId, originalName);

      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: fileBuffer,
          ContentType: contentType,
        })
      );

      return { success: true, key, url: `${this.publicBaseUrl}/${key}` };
    } catch (error: any) {
      logger.error('[R2] uploadPublic error:', error);
      return { success: false, error: error?.message || 'R2 upload failed' };
    }
  }

  async deleteObject(key: string): Promise<boolean> {
    try {
      if (!key) return true;

      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        })
      );

      return true;
    } catch (error) {
      logger.error('[R2] deleteObject error:', error);
      return false;
    }
  }
}

export const r2MediaStorage = new R2MediaStorageService();

