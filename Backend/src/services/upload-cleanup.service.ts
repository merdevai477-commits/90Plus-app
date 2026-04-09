/**
 * Upload Cleanup Service
 * Handles R2 orphan cleanup when DB save fails after successful upload
 */

import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';

const R2_ENDPOINT = process.env.R2_ENDPOINT ||
    (process.env.R2_ACCOUNT_ID ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : undefined);
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || '90plus-storage';

const r2Client = R2_ENDPOINT ? new S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    },
    forcePathStyle: false,
}) : null;

/**
 * Delete a file from R2 by its full storage key
 */
export async function deleteFromR2(
    storagePath: string,
    bucket: string = R2_BUCKET_NAME
): Promise<boolean> {
    if (!r2Client || !storagePath) return false;

    try {
        await r2Client.send(new DeleteObjectCommand({
            Bucket: bucket,
            Key: storagePath,
        }));
        logger.info(`[UploadCleanup] ✅ Deleted from R2: ${storagePath}`);
        return true;
    } catch (err: any) {
        logger.error('[UploadCleanup] ❌ R2 delete failed', {
            storagePath,
            bucket,
            error: err.message,
            timestamp: new Date().toISOString(),
        });
        return false;
    }
}

/**
 * Log an orphaned upload to the DB for manual/scheduled cleanup
 */
async function logOrphanedUpload(storagePath: string, bucket: string, error: string): Promise<void> {
    try {
        await (prisma as any).orphanedUpload.create({
            data: { storagePath, bucket, error },
        });
        logger.warn('[UploadCleanup] ⚠️ Orphaned upload logged to DB', { storagePath, bucket });
    } catch (dbErr: any) {
        logger.error('[UploadCleanup] ❌ Failed to log orphan to DB', {
            storagePath,
            bucket,
            dbError: dbErr.message,
        });
    }
}

/**
 * Cleanup after a failed DB save:
 * 1. Try to delete from R2
 * 2. If R2 delete also fails → log to orphaned_uploads table
 */
export async function cleanupFailedUpload(
    storagePath: string,
    bucket: string,
    originalError: string
): Promise<void> {
    logger.warn('[UploadCleanup] Starting cleanup for failed upload', {
        storagePath,
        bucket,
        error: originalError,
        timestamp: new Date().toISOString(),
    });

    const deleted = await deleteFromR2(storagePath, bucket);

    if (!deleted) {
        await logOrphanedUpload(storagePath, bucket, originalError);
    }
}