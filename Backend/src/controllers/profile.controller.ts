import { Request, Response } from 'express';
import { supabaseStorage } from '../services/r2-storage.service';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';

export class ProfileController {
  /**
   * GET /api/profile/me - جلب بيانات البروفايل الحالي
   */
  static async getMyProfile(req: Request, res: Response): Promise<void> {
    try {
      const clerkUserId = req.auth?.userId;

      if (!clerkUserId) {
        res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
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
          // FIFA Card Profile Fields
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
        res.status(404).json({ status: 'ERROR', message: 'User not found' });
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
      res.status(500).json({ status: 'ERROR', message: 'Failed to get profile' });
    }
  }

  /**
   * PATCH /api/profile/me - تحديث البروفايل
   */
  static async updateMyProfile(req: Request, res: Response): Promise<void> {
    try {
      const clerkUserId = req.auth?.userId;

      if (!clerkUserId) {
        res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
        return;
      }

      const { displayName, bio, favoriteTeam, socials, location } = req.body;

      // Get current user settings
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
      res.status(500).json({ status: 'ERROR', message: 'Failed to update profile' });
    }
  }

  /**
   * POST /api/profile/me/avatar - رفع صورة البروفايل
   */
  static async uploadAvatar(req: Request, res: Response): Promise<void> {
    try {
      const clerkUserId = req.auth?.userId;

      if (!clerkUserId) {
        res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
        return;
      }

      if (!req.file) {
        res.status(400).json({ status: 'ERROR', message: 'No file uploaded' });
        return;
      }

      // Get user to find old avatar path
      const user = await prisma.user.findUnique({
        where: { clerkUserId },
        select: { id: true, avatarStoragePath: true },
      });

      if (!user) {
        res.status(404).json({ status: 'ERROR', message: 'User not found' });
        return;
      }

      // Delete old avatar if exists
      if (user.avatarStoragePath) {
        await supabaseStorage.deleteFile('avatars', user.avatarStoragePath);
      }

      // Upload new avatar
      const result = await supabaseStorage.uploadFile(
        'avatars',
        req.file.buffer,
        `${user.id}/${Date.now()}.${req.file.mimetype.split('/')[1]}`,
        req.file.mimetype
      );

      if (!result.success) {
        res.status(500).json({ status: 'ERROR', message: result.error });
        return;
      }

      // Update user with new avatar URL
      await prisma.user.update({
        where: { clerkUserId },
        data: {
          avatar: result.url,
          avatarStoragePath: result.path,
        },
      });

      res.json({
        status: 'SUCCESS',
        data: { avatarUrl: result.url },
        message: 'Avatar uploaded successfully',
      });
    } catch (error) {
      logger.error('Upload avatar error:', error);
      res.status(500).json({ status: 'ERROR', message: 'Failed to upload avatar' });
    }
  }

  /**
   * POST /api/profile/me/cover - رفع صورة الغلاف
   */
  static async uploadCover(req: Request, res: Response): Promise<void> {
    try {
      const clerkUserId = req.auth?.userId;

      if (!clerkUserId) {
        res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
        return;
      }

      if (!req.file) {
        res.status(400).json({ status: 'ERROR', message: 'No file uploaded' });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { clerkUserId },
        select: { id: true, settings: true },
      });

      if (!user) {
        res.status(404).json({ status: 'ERROR', message: 'User not found' });
        return;
      }

      const currentSettings = (user.settings as Record<string, any>) || {};

      // Delete old cover if exists
      if (currentSettings.coverStoragePath) {
        await supabaseStorage.deleteFile('covers', currentSettings.coverStoragePath);
      }

      // Upload new cover
      const result = await supabaseStorage.uploadFile(
        'covers',
        req.file.buffer,
        `${user.id}/${Date.now()}.${req.file.mimetype.split('/')[1]}`,
        req.file.mimetype
      );

      if (!result.success) {
        res.status(500).json({ status: 'ERROR', message: result.error });
        return;
      }

      // Update user settings with cover URL
      await prisma.user.update({
        where: { clerkUserId },
        data: {
          settings: {
            ...currentSettings,
            coverUrl: result.url,
            coverStoragePath: result.path,
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
      res.status(500).json({ status: 'ERROR', message: 'Failed to upload cover' });
    }
  }

  /**
   * PATCH /api/profile/me/stats - تحديث إحصائيات اللاعب
   */
  static async updateStats(req: Request, res: Response): Promise<void> {
    try {
      const clerkUserId = req.auth?.userId;

      if (!clerkUserId) {
        res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
        return;
      }

      const { age, height, weight, foot, position, country } = req.body;

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
      res.status(500).json({ status: 'ERROR', message: 'Failed to update stats' });
    }
  }

  /**
   * GET /api/profile/:username - عرض بروفايل مستخدم آخر
   */
  static async getProfileByUsername(req: Request, res: Response): Promise<void> {
    try {
      const { username } = req.params;
      const clerkUserId = req.auth?.userId;

      const user = await prisma.user.findUnique({
        where: { username },
        select: {
          id: true,
          username: true,
          displayName: true,
          avatar: true,
          bio: true,
          level: true,
          isVerified: true,
          isDeveloper: true,
          favoriteTeam: true,
          settings: true,
          createdAt: true,
          // FIFA Card Profile Fields
          position: true,
          countryFlag: true,
          age: true,
          height: true,
          weight: true,
          preferredFoot: true,
          clubLogo: true,
          brandLogo: true,
          coverImage: true,
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
        res.status(404).json({ status: 'ERROR', message: 'User not found' });
        return;
      }

      // Check if current user follows this user
      let isFollowing = false;
      if (clerkUserId) {
        const currentUser = await prisma.user.findUnique({
          where: { clerkUserId },
          select: { id: true },
        });

        if (currentUser) {
          const follow = await prisma.follow.findUnique({
            where: {
              followerId_followingId: {
                followerId: currentUser.id,
                followingId: user.id,
              },
            },
          });
          isFollowing = !!follow;
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
        },
      });
    } catch (error) {
      logger.error('Get profile by username error:', error);
      res.status(500).json({ status: 'ERROR', message: 'Failed to get profile' });
    }
  }
}
