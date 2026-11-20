import { createReadStream } from 'fs';
import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

export interface ObjectStore {
  put(key: string, filePath: string, contentType: string): Promise<void>;
  head(key: string): Promise<{ contentLength: number } | null>;
  publicUrl(key: string): string | null;
}

export function r2Configured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.R2_ENDPOINT && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && (env.R2_MEDIA_BUCKET_NAME || env.R2_BUCKET_NAME));
}

export function createR2ObjectStore(env: NodeJS.ProcessEnv = process.env): ObjectStore {
  const endpoint = env.R2_ENDPOINT || '';
  const bucket = env.R2_MEDIA_BUCKET_NAME || env.R2_BUCKET_NAME || '';
  const publicBase = (env.R2_MEDIA_PUBLIC_URL || env.R2_PUBLIC_URL || '').replace(/\/$/, '');
  const client = new S3Client({
    region: 'auto',
    endpoint,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID || '',
      secretAccessKey: env.R2_SECRET_ACCESS_KEY || '',
    },
  });

  return {
    async put(key, filePath, contentType) {
      await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: createReadStream(filePath),
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }));
    },
    async head(key) {
      try {
        const result = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        return { contentLength: Number(result.ContentLength || 0) };
      } catch {
        return null;
      }
    },
    publicUrl(key) {
      if (!publicBase) return null;
      return `${publicBase}/${key}`;
    },
  };
}
