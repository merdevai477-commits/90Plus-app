/**
 * Data Anonymization Service
 * 
 * Handles GDPR-compliant data anonymization for account deletion
 * Instead of deleting all records, we anonymize personal data
 * while keeping statistical data for analytics
 * 
 * @author Kiro AI Assistant
 * @date 2026-03-30
 */

import { getPrisma } from '../lib/prisma-lazy';
import { logger } from '../utils/logger';
import crypto from 'crypto';

const prisma = getPrisma();

// ============================================================================
// HELPER: Generate Anonymous ID
// ============================================================================

function generateAnonymousId(): string {
  return `anon_${crypto.randomBytes(16).toString('hex')}`;
}

// ============================================================================
// Anonymize User Data
// ============================================================================

export async function anonymizeUserData(userId: string): Promise<void> {
  try {
    logger.info(`[Anonymization] Starting anonymization for user ${userId}`);

    const anonymousId = generateAnonymousId();
    const anonymousEmail = `${anonymousId}@deleted.90plus.app`;
    const anonymousUsername = `deleted_${anonymousId.substring(0, 12)}`;

    // Step 1: Anonymize user profile
    await prisma.user.update({
      where: { id: userId },
      data: {
        email: anonymousEmail,
        username: anonymousUsername,
        displayName: '[Deleted User]',
        bio: null,
        avatar: null,
        coverImage: null,
        age: null,
        country: null,
        
        // Mark as deleted
        isDeleted: true,
        deletedAt: new Date(),
        
        // Clear sensitive data
        clerkUserId: null,
        
        // Clear consent
        analyticsConsent: false,
        pushNotificationsConsent: false,
        emailCommunicationsConsent: false,
        dataSharingConsent: false,
      },
    });

    logger.info(`[Anonymization] User profile anonymized`);

    // Step 2: Anonymize reels (keep for statistics, remove personal data)
    await prisma.reel.updateMany({
      where: { userId },
      data: {
        caption: '[Content removed by user]',
        // Keep video for moderation/legal purposes but mark as deleted
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    logger.info(`[Anonymization] Reels anonymized`);

    // Step 3: Anonymize comments
    await prisma.comment.updateMany({
      where: { userId },
      data: {
        content: '[Comment removed by user]',
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    logger.info(`[Anonymization] Comments anonymized`);

    // Step 4: Delete personal messages (if any)
    // await prisma.message.deleteMany({ where: { userId } });

    // Step 5: Delete notifications
    await prisma.notification.deleteMany({
      where: { userId },
    });

    logger.info(`[Anonymization] Notifications deleted`);

    // Step 6: Keep predictions/quiz attempts for statistics (already anonymized)
    // No action needed - these don't contain personal data

    // Step 7: Keep coin transactions for audit (already anonymized)
    // No action needed

    // Step 8: Delete follows
    await prisma.follow.deleteMany({
      where: {
        OR: [
          { followerId: userId },
          { followingId: userId },
        ],
      },
    });

    logger.info(`[Anonymization] Follows deleted`);

    // Step 9: Delete likes (keep count for statistics)
    await prisma.like.deleteMany({
      where: { userId },
    });

    logger.info(`[Anonymization] Likes deleted`);

    // Step 10: Delete reports
    await prisma.report.deleteMany({
      where: {
        OR: [
          { reporterId: userId },
          { reportedUserId: userId },
        ],
      },
    });

    logger.info(`[Anonymization] Reports deleted`);

    // Step 11: Delete strikes
    await prisma.strike.deleteMany({
      where: { userId },
    });

    logger.info(`[Anonymization] Strikes deleted`);

    // Step 12: Delete sessions/tokens
    await prisma.session.deleteMany({
      where: { userId },
    });

    await prisma.refreshToken.deleteMany({
      where: { userId },
    });

    logger.info(`[Anonymization] Sessions/tokens deleted`);

    // Step 13: Keep GDPR audit logs for legal compliance (7 years)
    // No action needed - required by law

    // Step 14: Keep consent logs for legal compliance
    // No action needed - required by law

    logger.info(`[Anonymization] Anonymization completed for user ${userId}`);

  } catch (error) {
    logger.error(`[Anonymization] Failed to anonymize user ${userId}:`, error);
    throw error;
  }
}

// ============================================================================
// Process Scheduled Deletions
// ============================================================================

export async function processScheduledDeletions(): Promise<void> {
  try {
    logger.info('[Anonymization] Checking for scheduled deletions...');

    // Find all scheduled deletions that are due
    const dueDeletions = await prisma.accountDeletionRequest.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledAt: {
          lte: new Date(),
        },
      },
    });

    logger.info(`[Anonymization] Found ${dueDeletions.length} due deletions`);

    for (const deletion of dueDeletions) {
      try {
        // Anonymize user data
        await anonymizeUserData(deletion.userId);

        // Update deletion request
        await prisma.accountDeletionRequest.update({
          where: { id: deletion.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
          },
        });

        logger.info(`[Anonymization] Completed deletion for user ${deletion.userId}`);

        // Send confirmation email
        // TODO: Implement email service

      } catch (error) {
        logger.error(`[Anonymization] Failed to process deletion ${deletion.id}:`, error);
      }
    }

    logger.info('[Anonymization] Scheduled deletions processing completed');

  } catch (error) {
    logger.error('[Anonymization] Failed to process scheduled deletions:', error);
  }
}

// ============================================================================
// Cleanup Old Export Files
// ============================================================================

export async function cleanupOldExports(): Promise<void> {
  try {
    logger.info('[Anonymization] Cleaning up old export files...');

    // Find expired exports
    const expiredExports = await prisma.dataExportRequest.findMany({
      where: {
        status: 'COMPLETED',
        expiresAt: {
          lte: new Date(),
        },
      },
    });

    logger.info(`[Anonymization] Found ${expiredExports.length} expired exports`);

    for (const exportRequest of expiredExports) {
      try {
        // Delete file from Cloudflare R2
        if (exportRequest.fileUrl) {
          const { deleteFile } = await import('./r2-storage.service');
          const fileName = exportRequest.fileUrl.split('/').pop();
          if (fileName) {
            await deleteFile(`exports/${fileName}`);
          }
        }

        // Update request
        await prisma.dataExportRequest.update({
          where: { id: exportRequest.id },
          data: {
            fileUrl: null,
            status: 'FAILED',
            failedReason: 'Export expired',
          },
        });

        logger.info(`[Anonymization] Cleaned up export ${exportRequest.id}`);

      } catch (error) {
        logger.error(`[Anonymization] Failed to cleanup export ${exportRequest.id}:`, error);
      }
    }

    logger.info('[Anonymization] Export cleanup completed');

  } catch (error) {
    logger.error('[Anonymization] Failed to cleanup exports:', error);
  }
}

// ============================================================================
// Cron Job Setup
// ============================================================================

/**
 * Run GDPR deletion + export cleanup once.
 * Prefer scheduling via node-cron in main.ts — do not wrap this in setInterval
 * that gets re-registered every hour (timer leak).
 */
export async function runGdprMaintenanceJobs(): Promise<void> {
  await processScheduledDeletions();
  await cleanupOldExports();
}

/**
 * @deprecated Prefer runGdprMaintenanceJobs from a single node-cron.
 * Kept idempotent so accidental re-entry cannot multiply intervals.
 */
let gdprInterval: NodeJS.Timeout | null = null;
export function setupGDPRCronJobs(): void {
  if (gdprInterval) return;
  gdprInterval = setInterval(() => {
    void runGdprMaintenanceJobs().catch((err) =>
      logger.error('[Anonymization] GDPR interval job failed:', err),
    );
  }, 60 * 60 * 1000);
  logger.info('[Anonymization] GDPR cron jobs setup complete (idempotent interval)');
}
