import { Request, Response } from 'express';
import { r2MediaStorage } from '../services/r2-media-storage.service';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { ErrorCode, sendError } from '../constants/errors';

export class ProfileController {
  static async getMyProfile(req: Request, res: Response): Promise<void> {
    try {
      const clerkUserId = req.auth?.userId;

      if (!clerkUserId) {
        sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
        return;
      }

      const user = await prisma.user.findUnique({
        where: { clerkUserId },
        select: {
          id: true,
          email: true,
          username: true,
          displayName: true,
          avatar: true,
          bio: true,
          coins: true,
          level: true,
          xp: true,
          isVerified: true,
          isDeveloper: true,
          favoriteTeam: true,
          settings: true,
          createdAt: true,
          lastUsernameChange: true,
          position: true,
          countryFlag: true,
          age: true,
          height: true,
          weight: true,
          preferredFoot: true,
          clubLogo: true,
          brandLogo: true,
          coverImage: true,
          socialLinks: true,
          consecutiveLoginDays: true,
          _count: {
            select: {
              followers: true,
              following: true,
              reels: true,
            },
          },
        },
      });

      if (!user) {
        sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
        return;
      }

      res.json({
        status: 'SUCCESS',
        data: {
          ...user,
          followersCount: user._count.followers,
          followingCount: user._count.following,
          videosCount: user._count.reels,
        },
      });
    } catch (error) {
      logger.error('Get profile error:', error);
      sendError(req, res, ErrorCode.INTERNAL, 'Failed to get profile');
    }
  }

  static async updateMyProfile(req: Request, res: Response): Promise<void> {
    try {
      const clerkUserId = req.auth?.userId;

      if (!clerkUserId) {
        sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
        return;
      }

      const { displayName, bio, favoriteTeam, socials, location } = req.body;

      // Input validation
      if (displayName !== undefined && (typeof displayName !== 'string' || displayName.length > 50)) {
        sendError(req, res, ErrorCode.VALIDATION, 'Display name must be 50 characters or less');
        return;
      }
      if (bio !== undefined && (typeof bio !== 'string' || bio.length > 500)) {
        sendError(req, res, ErrorCode.VALIDATION, 'Bio must be 500 characters or less');
        return;
      }
      if (favoriteTeam !== undefined && (typeof favoriteTeam !== 'string' || favoriteTeam.length > 100)) {
        sendError(req, res, ErrorCode.VALIDATION, 'Favorite team must be 100 characters or less');
        return;
      }

      const currentUser = await prisma.user.findUnique({
        where: { clerkUserId },
        select: { settings: true },
      });

      const currentSettings = (currentUser?.settings as Record<string, any>) || {};

      const updatedUser = await prisma.user.update({
        where: { clerkUserId },
        data: {
          displayName,
          bio,
          favoriteTeam,
          settings: {
            ...currentSettings,
            socials,
            location,
          },
        },
        select: {
          id: true,
          username: true,
          displayName: true,
          bio: true,
          favoriteTeam: true,
          settings: true,
        },
      });

      res.json({
        status: 'SUCCESS',
        data: updatedUser,
        message: 'Profile updated successfully',
      });
    } catch (error) {
      logger.error('Update profile error:', error);
      sendError(req, res, ErrorCode.INTERNAL, 'Failed to update profile');
    }
  }

  static async uploadAvatar(req: Request, res: Response): Promise<void> {
    try {
      const clerkUserId = req.auth?.userId;

      if (!clerkUserId) {
        sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
        return;
      }

      if (!req.file) {
        sendError(req, res, ErrorCode.FILE_UPLOAD, 'No file uploaded');
        return;
      }

      const user = await prisma.user.findUnique({
        where: { clerkUserId },
        select: { id: true, avatarStoragePath: true },
      });

      if (!user) {
        sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
        return;
      }

      if (user.avatarStoragePath) {
        await r2MediaStorage.deleteObject(user.avatarStoragePath);
      }

      const result = await r2MediaStorage.uploadPublic(
        'avatars',
        user.id,
        req.file.buffer,
        `${user.id}/${Date.now()}.${req.file.mimetype.split('/')[1]}`,
        req.file.mimetype
      );

      if (!result.success || !result.url || !result.key) {
        sendError(req, res, ErrorCode.EXTERNAL_SERVICE, result.error || 'Upload failed');
        return;
      }

      await prisma.user.update({
        where: { clerkUserId },
        data: {
          avatar: result.url,
          avatarStoragePath: result.key,
        },
      });

      res.json({
        status: 'SUCCESS',
        data: { avatarUrl: result.url },
        message: 'Avatar uploaded successfully',
      });
    } catch (error) {
      logger.error('Upload avatar error:', error);
      sendError(req, res, ErrorCode.INTERNAL, 'Failed to upload avatar');
    }
  }

  static async uploadCover(req: Request, res: Response): Promise<void> {
    try {
      const clerkUserId = req.auth?.userId;

      if (!clerkUserId) {
        sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
        return;
      }

      if (!req.file) {
        sendError(req, res, ErrorCode.FILE_UPLOAD, 'No file uploaded');
        return;
      }

      const user = await prisma.user.findUnique({
        where: { clerkUserId },
        select: { id: true, settings: true },
      });

      if (!user) {
        sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
        return;
      }

      const currentSettings = (user.settings as Record<string, any>) || {};

      if (currentSettings.coverStoragePath) {
        await r2MediaStorage.deleteObject(currentSettings.coverStoragePath);
      }

      const result = await r2MediaStorage.uploadPublic(
        'covers',
        user.id,
        req.file.buffer,
        `${user.id}/${Date.now()}.${req.file.mimetype.split('/')[1]}`,
        req.file.mimetype
      );

      if (!result.success || !result.url || !result.key) {
        sendError(req, res, ErrorCode.EXTERNAL_SERVICE, result.error || 'Upload failed');
        return;
      }

      await prisma.user.update({
        where: { clerkUserId },
        data: {
          settings: {
            ...currentSettings,
            coverUrl: result.url,
            coverStoragePath: result.key,
          },
        },
      });

      res.json({
        status: 'SUCCESS',
        data: { coverUrl: result.url },
        message: 'Cover uploaded successfully',
      });
    } catch (error) {
      logger.error('Upload cover error:', error);
      sendError(req, res, ErrorCode.INTERNAL, 'Failed to upload cover');
    }
  }

  static async updateStats(req: Request, res: Response): Promise<void> {
    try {
      const clerkUserId = req.auth?.userId;

      if (!clerkUserId) {
        sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
        return;
      }

      const { age, height, weight, foot, position, country } = req.body;

      // Input validation
      if (age !== undefined && (typeof age !== 'number' || age < 5 || age > 100)) {
        sendError(req, res, ErrorCode.VALIDATION, 'Age must be between 5 and 100');
        return;
      }
      if (height !== undefined && (typeof height !== 'number' || height < 50 || height > 250)) {
        sendError(req, res, ErrorCode.VALIDATION, 'Height must be between 50 and 250 cm');
        return;
      }
      if (weight !== undefined && (typeof weight !== 'number' || weight < 20 || weight > 200)) {
        sendError(req, res, ErrorCode.VALIDATION, 'Weight must be between 20 and 200 kg');
        return;
      }
      if (foot !== undefined && !['R', 'L', 'B'].includes(foot)) {
        sendError(req, res, ErrorCode.VALIDATION, 'Foot must be R, L, or B');
        return;
      }
      if (position !== undefined && (typeof position !== 'string' || position.length > 30)) {
        sendError(req, res, ErrorCode.VALIDATION, 'Position must be 30 characters or less');
        return;
      }
      if (country !== undefined && (typeof country !== 'string' || country.length > 50)) {
        sendError(req, res, ErrorCode.VALIDATION, 'Country must be 50 characters or less');
        return;
      }

      const user = await prisma.user.findUnique({
        where: { clerkUserId },
        select: { settings: true },
      });

      const currentSettings = (user?.settings as Record<string, any>) || {};

      await prisma.user.update({
        where: { clerkUserId },
        data: {
          settings: {
            ...currentSettings,
            playerStats: { age, height, weight, foot, position, country },
          },
        },
      });

      res.json({
        status: 'SUCCESS',
        data: { age, height, weight, foot, position, country },
        message: 'Stats updated successfully',
      });
    } catch (error) {
      logger.error('Update stats error:', error);
      sendError(req, res, ErrorCode.INTERNAL, 'Failed to update stats');
    }
  }

  /**
   * GET /api/profile/:username — view another user's profile
   */
  static async getProfileByUsername(req: Request, res: Response): Promise<void> {
    try {
      // ✅ Fix 1: cast username to string
      const username = req.params.username as string;
      const clerkUserId = req.auth?.userId;

      // ✅ Fix 2: use select to whitelist only public fields (prevent data leaks)
      const user = await prisma.user.findUnique({
        where: { username },
        select: {
          id: true,
          username: true,
          displayName: true,
          avatar: true,
          bio: true,
          coins: true,
          level: true,
          xp: true,
          isVerified: true,
          isDeveloper: true,
          favoriteTeam: true,
          createdAt: true,
          position: true,
          countryFlag: true,
          age: true,
          height: true,
          weight: true,
          preferredFoot: true,
          clubLogo: true,
          brandLogo: true,
          coverImage: true,
          socialLinks: true,
          consecutiveLoginDays: true,
          profileViews: true,
          _count: {
            select: {
              followers: true,
              following: true,
              reels: true,
            },
          },
        },
      });

      if (!user) {
        sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
        return;
      }

      let isFollowing = false;
      let isFollowingMe = false;
      if (clerkUserId) {
        const currentUser = await prisma.user.findUnique({
          where: { clerkUserId },
          select: { id: true },
        });

        if (currentUser) {
          const [followRecord, reverseFollowRecord] = await Promise.all([
            prisma.follow.findUnique({
              where: {
                followerId_followingId: {
                  followerId: currentUser.id,
                  followingId: user.id,
                },
              },
            }),
            prisma.follow.findUnique({
              where: {
                followerId_followingId: {
                  followerId: user.id,
                  followingId: currentUser.id,
                },
              },
            }),
          ]);
          isFollowing = !!followRecord;
          isFollowingMe = !!reverseFollowRecord;
        }
      }

      res.json({
        status: 'SUCCESS',
        data: {
          ...user,
          followersCount: user._count.followers,
          followingCount: user._count.following,
          videosCount: user._count.reels,
          isFollowing,
          isFollowingMe,
        },
      });
    } catch (error) {
      logger.error('Get profile by username error:', error);
      sendError(req, res, ErrorCode.INTERNAL, 'Failed to get profile');
    }
  }
}
