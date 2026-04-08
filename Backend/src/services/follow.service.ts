/**
 * Follow Service
 * 
 * Handles follow/unfollow operations with race condition protection
 * Uses Prisma transactions and upsert for atomic operations
 */

import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { NotificationService } from './notification.service';
import { WebSocketService } from './websocket.service';

export interface FollowResult {
  action: 'followed' | 'already_following' | 'unfollowed' | 'not_following';
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
}

export interface UserIdentifier {
  id: string;
  username: string;
  displayName?: string | null;
  avatar?: string | null;
}

export class FollowService {
  /**
   * Toggle follow status (follow if not following, unfollow if following)
   * Race condition safe using Prisma transaction
   */
  static async toggleFollow(
    currentUser: UserIdentifier,
    targetUser: UserIdentifier
  ): Promise<FollowResult> {
    try {
      // Validate: Cannot follow yourself
      if (currentUser.id === targetUser.id) {
        throw new Error('CANNOT_FOLLOW_SELF');
      }

      // Use transaction to ensure atomicity
      const result = await prisma.$transaction(async (tx) => {
        // Check current follow status
        const existingFollow = await tx.follow.findUnique({
          where: {
            followerId_followingId: {
              followerId: currentUser.id,
              followingId: targetUser.id,
            },
          },
        });

        let action: 'followed' | 'unfollowed';
        let isFollowing: boolean;

        if (existingFollow) {
          // Already following → Unfollow
          await tx.follow.delete({
            where: {
              followerId_followingId: {
                followerId: currentUser.id,
                followingId: targetUser.id,
              },
            },
          });
          action = 'unfollowed';
          isFollowing = false;

          logger.info('User unfollowed', {
            followerId: currentUser.id,
            followingId: targetUser.id,
          });
        } else {
          // Not following → Follow
          await tx.follow.create({
            data: {
              followerId: currentUser.id,
              followingId: targetUser.id,
            },
          });
          action = 'followed';
          isFollowing = true;

          logger.info('User followed', {
            followerId: currentUser.id,
            followingId: targetUser.id,
          });
        }

        // Get updated counts
        const counts = await tx.user.findUnique({
          where: { id: targetUser.id },
          select: {
            _count: {
              select: {
                followers: true,
                following: true,
              },
            },
          },
        });

        return {
          action,
          isFollowing,
          followersCount: counts?._count.followers || 0,
          followingCount: counts?._count.following || 0,
        };
      });

      // Send notifications and WebSocket updates (outside transaction)
      if (result.action === 'followed') {
        // Send notification
        await NotificationService.createSocialNotification({
          userId: targetUser.id,
          actorId: currentUser.id,
          title: 'متابع جديد',
          message: `${currentUser.displayName || currentUser.username} بدأ متابعتك`,
          type: 'FOLLOW',
          data: { followerId: currentUser.id },
        }).catch((err) => {
          logger.error('Failed to create follow notification:', err);
        });

        // Send WebSocket event
        WebSocketService.sendFollowUpdate(targetUser.id, {
          followerId: currentUser.id,
          followingId: targetUser.id,
          followerUsername: currentUser.username,
          action: 'follow',
        });
      } else {
        // Send unfollow WebSocket event
        WebSocketService.sendFollowUpdate(targetUser.id, {
          followerId: currentUser.id,
          followingId: targetUser.id,
          followerUsername: currentUser.username,
          action: 'unfollow',
        });
      }

      return result;
    } catch (error: any) {
      logger.error('Toggle follow error:', error);
      throw error;
    }
  }

  /**
   * Follow a user (idempotent - returns success even if already following)
   * Race condition safe using upsert
   */
  static async followUser(
    currentUser: UserIdentifier,
    targetUser: UserIdentifier
  ): Promise<FollowResult> {
    try {
      // Validate: Cannot follow yourself
      if (currentUser.id === targetUser.id) {
        throw new Error('CANNOT_FOLLOW_SELF');
      }

      // Use transaction for atomicity
      const result = await prisma.$transaction(async (tx) => {
        // Check if already following
        const existingFollow = await tx.follow.findUnique({
          where: {
            followerId_followingId: {
              followerId: currentUser.id,
              followingId: targetUser.id,
            },
          },
        });

        let action: 'followed' | 'already_following';

        if (existingFollow) {
          // Already following
          action = 'already_following';
          logger.debug('User already following', {
            followerId: currentUser.id,
            followingId: targetUser.id,
          });
        } else {
          // Create follow record
          await tx.follow.create({
            data: {
              followerId: currentUser.id,
              followingId: targetUser.id,
            },
          });
          action = 'followed';

          logger.info('User followed', {
            followerId: currentUser.id,
            followingId: targetUser.id,
          });
        }

        // Get updated counts
        const counts = await tx.user.findUnique({
          where: { id: targetUser.id },
          select: {
            _count: {
              select: {
                followers: true,
                following: true,
              },
            },
          },
        });

        return {
          action,
          isFollowing: true,
          followersCount: counts?._count.followers || 0,
          followingCount: counts?._count.following || 0,
        };
      });

      // Send notifications only if newly followed
      if (result.action === 'followed') {
        await NotificationService.createSocialNotification({
          userId: targetUser.id,
          actorId: currentUser.id,
          title: 'متابع جديد',
          message: `${currentUser.displayName || currentUser.username} بدأ متابعتك`,
          type: 'FOLLOW',
          data: { followerId: currentUser.id },
        }).catch((err) => {
          logger.error('Failed to create follow notification:', err);
        });

        WebSocketService.sendFollowUpdate(targetUser.id, {
          followerId: currentUser.id,
          followingId: targetUser.id,
          followerUsername: currentUser.username,
          action: 'follow',
        });
      }

      return result;
    } catch (error: any) {
      // Handle unique constraint violation (race condition fallback)
      if (error.code === 'P2002') {
        logger.warn('Duplicate follow attempt (race condition)', {
          followerId: currentUser.id,
          followingId: targetUser.id,
        });

        // Get counts and return already_following
        const counts = await prisma.user.findUnique({
          where: { id: targetUser.id },
          select: {
            _count: {
              select: {
                followers: true,
                following: true,
              },
            },
          },
        });

        return {
          action: 'already_following',
          isFollowing: true,
          followersCount: counts?._count.followers || 0,
          followingCount: counts?._count.following || 0,
        };
      }

      logger.error('Follow user error:', error);
      throw error;
    }
  }

  /**
   * Unfollow a user (idempotent - returns success even if not following)
   */
  static async unfollowUser(
    currentUser: UserIdentifier,
    targetUser: UserIdentifier
  ): Promise<FollowResult> {
    try {
      // Use transaction for atomicity
      const result = await prisma.$transaction(async (tx) => {
        // Try to delete the follow record
        const deleteResult = await tx.follow.deleteMany({
          where: {
            followerId: currentUser.id,
            followingId: targetUser.id,
          },
        });

        const action: 'unfollowed' | 'not_following' =
          deleteResult.count > 0 ? 'unfollowed' : 'not_following';

        if (action === 'unfollowed') {
          logger.info('User unfollowed', {
            followerId: currentUser.id,
            followingId: targetUser.id,
          });
        } else {
          logger.debug('User was not following', {
            followerId: currentUser.id,
            followingId: targetUser.id,
          });
        }

        // Get updated counts
        const counts = await tx.user.findUnique({
          where: { id: targetUser.id },
          select: {
            _count: {
              select: {
                followers: true,
                following: true,
              },
            },
          },
        });

        return {
          action,
          isFollowing: false,
          followersCount: counts?._count.followers || 0,
          followingCount: counts?._count.following || 0,
        };
      });

      // Send WebSocket update only if actually unfollowed
      if (result.action === 'unfollowed') {
        WebSocketService.sendFollowUpdate(targetUser.id, {
          followerId: currentUser.id,
          followingId: targetUser.id,
          followerUsername: currentUser.username,
          action: 'unfollow',
        });
      }

      return result;
    } catch (error: any) {
      logger.error('Unfollow user error:', error);
      throw error;
    }
  }

  /**
   * Check if user A is following user B
   */
  static async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    try {
      const follow = await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId,
            followingId,
          },
        },
      });

      return !!follow;
    } catch (error: any) {
      logger.error('Check following error:', error);
      return false;
    }
  }

  /**
   * Get follow counts for a user
   */
  static async getFollowCounts(userId: string): Promise<{
    followersCount: number;
    followingCount: number;
  }> {
    try {
      const counts = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          _count: {
            select: {
              followers: true,
              following: true,
            },
          },
        },
      });

      return {
        followersCount: counts?._count.followers || 0,
        followingCount: counts?._count.following || 0,
      };
    } catch (error: any) {
      logger.error('Get follow counts error:', error);
      return {
        followersCount: 0,
        followingCount: 0,
      };
    }
  }
}
