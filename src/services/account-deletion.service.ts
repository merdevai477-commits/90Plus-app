import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { clerkClient } from '@clerk/express';

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
   * Delete all user data (cascade delete)
   */
  static async deleteUserData(userId: string): Promise<void> {
    try {
      // Delete in order to respect foreign key constraints
      
      // 1. Delete user's reels and related data
      const reels = await prisma.reel.findMany({
        where: { userId },
        select: { id: true },
      });
      
      for (const reel of reels) {
        // Delete reel-related data
        await prisma.like.deleteMany({ where: { reelId: reel.id } });
        await prisma.comment.deleteMany({ where: { reelId: reel.id } });
        await prisma.reelView.deleteMany({ where: { reelId: reel.id } });
        await prisma.savedReel.deleteMany({ where: { reelId: reel.id } });
        await prisma.reelShare.deleteMany({ where: { reelId: reel.id } });
        await prisma.reelHashtag.deleteMany({ where: { reelId: reel.id } });
        await prisma.reelMention.deleteMany({ where: { reelId: reel.id } });
      }
      
      // Delete reels
      await prisma.reel.deleteMany({ where: { userId } });

      // 2. Delete user's comments
      await prisma.comment.deleteMany({ where: { userId } });

      // 3. Delete user's likes
      await prisma.like.deleteMany({ where: { userId } });
      await prisma.commentLike.deleteMany({ where: { userId } });

      // 4. Delete user's predictions
      await prisma.prediction.deleteMany({ where: { userId } });

      // 5. Delete user's quiz data
      await prisma.quizAttempt.deleteMany({ where: { userId } });
      await prisma.userQuizAnswer.deleteMany({ where: { userId } });
      await prisma.userQuizState.delete({ where: { userId } }).catch(() => {});

      // 6. Delete user's notifications
      await prisma.notification.deleteMany({ where: { userId } });

      // 7. Delete user's follows
      await prisma.follow.deleteMany({
        where: {
          OR: [{ followerId: userId }, { followingId: userId }],
        },
      });

      // 8. Delete user's blocks
      await prisma.block.deleteMany({
        where: {
          OR: [{ blockerId: userId }, { blockedId: userId }],
        },
      });

      // 9. Delete user's reports
      await prisma.report.deleteMany({
        where: {
          OR: [{ reporterId: userId }, { reportedUserId: userId }],
        },
      });

      // 10. Delete user's strikes
      await prisma.strike.deleteMany({ where: { userId } });

      // 11. Delete user's coin transactions
      await prisma.coinTransaction.deleteMany({ where: { userId } });

      // 12. Delete user's achievements
      await prisma.userAchievement.deleteMany({ where: { userId } });

      // 13. Delete user's favorite matches
      await prisma.favoriteMatch.deleteMany({ where: { userId } });

      // 14. Delete user's daily spin history
      await prisma.dailySpinHistory.deleteMany({ where: { userId } });

      // 15. Delete user's saved reels
      await prisma.savedReel.deleteMany({ where: { userId } });

      // 16. Delete user's reel shares
      await prisma.reelShare.deleteMany({ where: { userId } });

      // 17. Delete user's reel views
      await prisma.reelView.deleteMany({ where: { userId } });

      // 18. Delete user's sessions
      await prisma.session.deleteMany({ where: { userId } });

      // 19. Delete user's refresh tokens
      await prisma.refreshToken.deleteMany({ where: { userId } });

      // 20. Delete user's terms acceptances
      await prisma.termsAcceptance.deleteMany({ where: { userId } });

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
