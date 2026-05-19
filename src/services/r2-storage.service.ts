/**
 * Cloudflare R2 Storage Service
 * 
 * Handles file uploads to Cloudflare R2 for GDPR data exports
 * 
 * @author Kiro AI Assistant
 * @date 2026-03-30
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logger } from '../utils/logger';

// Cloudflare R2 is S3-compatible
const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT, // https://<account-id>.r2.cloudflarestorage.com
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME || '90plus-exports';
const PUBLIC_URL = process.env.R2_PUBLIC_URL || ''; // https://exports.90plus.app

function requirePublicUrl(): string {
  if (!PUBLIC_URL) {
    throw new Error(
      'R2_PUBLIC_URL is not configured — refusing to return relative URLs that will not open',
    );
  }
  return PUBLIC_URL;
}

// ============================================================================
// Upload Data Export File
// ============================================================================

export async function uploadDataExport(
  requestId: string,
  data: string
): Promise<{ url: string; size: number }> {
  try {
    const fileName = `exports/${requestId}.json`;
    const buffer = Buffer.from(data, 'utf8');
    const size = buffer.length;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileName,
      Body: buffer,
      ContentType: 'application/json',
      ContentDisposition: `attachment; filename="90plus-data-export-${requestId}.json"`,
      // Set expiration via lifecycle rules in R2 dashboard (7 days)
    });

    await r2Client.send(command);

    // Generate public URL — fail loudly if R2_PUBLIC_URL is missing
    const url = `${requirePublicUrl()}/${fileName}`;

    logger.info(`[R2] Data export uploaded: ${fileName} (${size} bytes)`);

    return { url, size };
  } catch (error) {
    logger.error('[R2] Upload error:', error);
    throw error;
  }
}

// ============================================================================
// Generate Signed URL (for private access)
// ============================================================================

export async function generateSignedUrl(
  fileName: string,
  expiresIn: number = 3600 // 1 hour
): Promise<string> {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileName,
    });

    const url = await getSignedUrl(r2Client, command, { expiresIn });

    logger.info(`[R2] Signed URL generated: ${fileName}`);

    return url;
  } catch (error) {
    logger.error('[R2] Generate signed URL error:', error);
    throw error;
  }
}

// ============================================================================
// Delete File
// ============================================================================

export async function deleteFile(fileName: string): Promise<void> {
  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileName,
    });

    await r2Client.send(command);

    logger.info(`[R2] File deleted: ${fileName}`);
  } catch (error) {
    logger.error('[R2] Delete error:', error);
    throw error;
  }
}

// ============================================================================
// Upload File (Generic)
// ============================================================================

export async function uploadFile(
  fileName: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileName,
      Body: buffer,
      ContentType: contentType,
    });

    await r2Client.send(command);

    const url = `${requirePublicUrl()}/${fileName}`;

    logger.info(`[R2] File uploaded: ${fileName}`);

    return url;
  } catch (error) {
    logger.error('[R2] Upload file error:', error);
    throw error;
  }
}
