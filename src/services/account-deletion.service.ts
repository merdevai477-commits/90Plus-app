import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { clerkClient } from '@clerk/express';
import Bull, { Queue } from 'bull';
import Redis from 'ioredis';
import { r2MediaStorage } from './r2-media-storage.service';

// ─── Account cleanup queue (Fix 8) ───────────────────────────────────────────

interface AccountCleanupJobData {
  userId: string;
  storagePaths: string[];
}

function createBullRedis(redisUrl: string): Redis {
  return new Redis(redisUrl, {
    enableReadyCheck: false,
    maxRetriesPerRequest: null,
  });
}

let accountCleanupQueue: Queue<AccountCleanupJobData> | null = null;

function getAccountCleanupQueue(): Queue<AccountCleanupJobData> | null {
  if (accountCleanupQueue) return accountCleanupQueue;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;

  accountCleanupQueue = new Bull<AccountCleanupJobData>('account-cleanup', {
    createClient: (type) => createBullRedis(redisUrl),
    defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 5_000 } },
  });

  accountCleanupQueue.process(async (job) => {
    const { userId, storagePaths } = job.data;
    logger.info(`[AccountCleanup] Deleting ${storagePaths.length} R2 files for user ${userId}`);

    const BATCH = 10;
    let deleted = 0;
    for (let i = 0; i < storagePaths.length; i += BATCH) {
      const batch = storagePaths.slice(i, i + BATCH);
      await Promise.all(
        batch.map(async (p) => {
          const ok = await r2MediaStorage.deleteObject(p);
          if (ok) deleted++;
          else logger.warn(`[AccountCleanup] Failed to delete: ${p}`);
        }),
      );
    }
    logger.info(`[AccountCleanup] Deleted ${deleted}/${storagePaths.length} files for user ${userId}`);
  });

  accountCleanupQueue.on('failed', (job, err) => {
    logger.error(`[AccountCleanup] Job ${job.id} failed:`, err.message);
  });

  return accountCleanupQueue;
}

async function enqueueAccountCleanup(userId: string, storagePaths: string[]): Promise<void> {
  const queue = getAccountCleanupQueue();
  if (!queue) {
    // Inline fallback — delete in batches of 10
    logger.warn('[AccountCleanup] Queue unavailable, deleting inline in batches');
    const BATCH = 10;
    for (let i = 0; i < storagePaths.length; i += BATCH) {
      const batch = storagePaths.slice(i, i + BATCH);
      await Promise.all(
        batch.map((p) => r2MediaStorage.deleteObject(p).catch(() => undefined)),
      );
    }
    return;
  }
  await queue.add({ userId, storagePaths });
}

export class AccountDeletionService {
  /**
   * Initiate account deletion (soft delete + schedule permanent deletion)
   */
  static async initiateAccountDeletion(
    userId: string,
    clerkUserId: string
  ): Promise<void> {
    try {
      // Calculate scheduled deletion date (30 days from now)
      const scheduledDeletionAt = new Date();
      scheduledDeletionAt.setDate(scheduledDeletionAt.getDate() + 30);

      // Soft delete user
      await prisma.user.update({
        where: { id: userId },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          scheduledDeletionAt,
        },
      });

      // Delete Clerk user immediately
      try {
        await this.deleteClerkUser(clerkUserId);
      } catch (clerkError) {
        logger.error('Error deleting Clerk user:', clerkError);
        // Continue even if Clerk deletion fails
      }

      logger.info(`Account deletion initiated for user ${userId}`);
    } catch (error) {
      logger.error('Error initiating account deletion:', error);
      throw new Error('Failed to initiate account deletion');
    }
  }

  /**
   * Permanently delete user data (called by cron job after 30 days)
   */
  static async permanentlyDeleteAccount(userId: string): Promise<void> {
    try {
      // Delete all user data in order (respecting foreign key constraints)
      await this.deleteUserData(userId);

      // Finally, delete the user record
      await prisma.user.delete({
        where: { id: userId },
      });

      logger.info(`User ${userId} permanently deleted`);
    } catch (error) {
      logger.error('Error permanently deleting account:', error);
      throw new Error('Failed to permanently delete account');
    }
  }

  /**
   * Cancel account deletion (if user logs in within grace period)
   */
  static async cancelAccountDeletion(userId: string): Promise<void> {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          isDeleted: false,
          deletedAt: null,
          scheduledDeletionAt: null,
        },
      });

      logger.info(`Account deletion cancelled for user ${userId}`);
    } catch (error) {
      logger.error('Error cancelling account deletion:', error);
      throw new Error('Failed to cancel account deletion');
    }
  }

  /**
   * Delete all user data (cascade delete) + enqueue R2 cleanup (Fix 8)
   */
  static async deleteUserData(userId: string): Promise<void> {
    try {
      // Collect all R2 storage paths before deleting DB records
      const [reels, userRecord] = await Promise.all([
        prisma.reel.findMany({
          where: { userId },
          select: { id: true, videoStoragePath: true, processedVideoKey: true, thumbnailStoragePath: true },
        }),
        prisma.user.findUnique({
          where: { id: userId },
          select: { avatarStoragePath: true, coverStoragePath: true },
        }),
      ]);

      const storagePaths: string[] = [];
      for (const reel of reels) {
        if (reel.videoStoragePath) storagePaths.push(reel.videoStoragePath);
        if (reel.processedVideoKey) storagePaths.push(reel.processedVideoKey);
        if (reel.thumbnailStoragePath) storagePaths.push(reel.thumbnailStoragePath);
      }
      if (userRecord?.avatarStoragePath) storagePaths.push(userRecord.avatarStoragePath);
      if (userRecord?.coverStoragePath) storagePaths.push(userRecord.coverStoragePath);

      // Delete in order to respect foreign key constraints
      for (const reel of reels) {
        await prisma.like.deleteMany({ where: { reelId: reel.id } });
        await prisma.comment.deleteMany({ where: { reelId: reel.id } });
        await prisma.reelView.deleteMany({ where: { reelId: reel.id } });
        await prisma.savedReel.deleteMany({ where: { reelId: reel.id } });
        await prisma.reelShare.deleteMany({ where: { reelId: reel.id } });
        await prisma.reelHashtag.deleteMany({ where: { reelId: reel.id } });
        await prisma.reelMention.deleteMany({ where: { reelId: reel.id } });
      }

      await prisma.reel.deleteMany({ where: { userId } });
      await prisma.comment.deleteMany({ where: { userId } });
      await prisma.like.deleteMany({ where: { userId } });
      await prisma.commentLike.deleteMany({ where: { userId } });
      await prisma.prediction.deleteMany({ where: { userId } });
      await prisma.quizAttempt.deleteMany({ where: { userId } });
      await prisma.userQuizAnswer.deleteMany({ where: { userId } });
      await prisma.userQuizState.delete({ where: { userId } }).catch(() => {});
      await prisma.notification.deleteMany({ where: { userId } });
      await prisma.follow.deleteMany({ where: { OR: [{ followerId: userId }, { followingId: userId }] } });
      await prisma.block.deleteMany({ where: { OR: [{ blockerId: userId }, { blockedId: userId }] } });
      await prisma.report.deleteMany({ where: { OR: [{ reporterId: userId }, { reportedUserId: userId }] } });
      await prisma.strike.deleteMany({ where: { userId } });
      await prisma.coinTransaction.deleteMany({ where: { userId } });
      await prisma.userAchievement.deleteMany({ where: { userId } });
      await prisma.favoriteMatch.deleteMany({ where: { userId } });
      await prisma.dailySpinHistory.deleteMany({ where: { userId } });
      await prisma.savedReel.deleteMany({ where: { userId } });
      await prisma.reelShare.deleteMany({ where: { userId } });
      await prisma.reelView.deleteMany({ where: { userId } });
      await prisma.session.deleteMany({ where: { userId } });
      await prisma.refreshToken.deleteMany({ where: { userId } });
      await prisma.termsAcceptance.deleteMany({ where: { userId } });

      // Enqueue R2 cleanup after DB records are gone (Fix 8)
      if (storagePaths.length > 0) {
        await enqueueAccountCleanup(userId, storagePaths);
        logger.info(`[AccountDeletion] Enqueued R2 cleanup for ${storagePaths.length} files`);
      }

      logger.info(`All data deleted for user ${userId}`);
    } catch (error) {
      logger.error('Error deleting user data:', error);
      throw error;
    }
  }

  /**
   * Delete Clerk user
   */
  static async deleteClerkUser(clerkUserId: string): Promise<void> {
    try {
      await clerkClient.users.deleteUser(clerkUserId);
      logger.info(`Clerk user ${clerkUserId} deleted`);
    } catch (error) {
      logger.error('Error deleting Clerk user:', error);
      throw error;
    }
  }

  /**
   * Get users scheduled for permanent deletion
   */
  static async getUsersScheduledForDeletion(): Promise<any[]> {
    try {
      const now = new Date();
      
      const users = await prisma.user.findMany({
        where: {
          isDeleted: true,
          scheduledDeletionAt: {
            lte: now,
          },
        },
        select: {
          id: true,
          email: true,
          username: true,
          scheduledDeletionAt: true,
        },
      });

      return users;
    } catch (error) {
      logger.error('Error fetching users scheduled for deletion:', error);
      return [];
    }
  }
}
