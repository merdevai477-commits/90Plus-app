import { Request, Response } from 'express';
import { supabaseStorage } from '../services/supabase-storage.service';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';

export class ProfileController {
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

  static async updateMyProfile(req: Request, res: Response): Promise<void> {
    try {
      const clerkUserId = req.auth?.userId;

      if (!clerkUserId) {
        res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
        return;
      }

      const { displayName, bio, favoriteTeam, socials, location } = req.body;

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

      const user = await prisma.user.findUnique({
        where: { clerkUserId },
        select: { id: true, avatarStoragePath: true },
      });

      if (!user) {
        res.status(404).json({ status: 'ERROR', message: 'User not found' });
        return;
      }

      if (user.avatarStoragePath) {
        await supabaseStorage.deleteFile('avatars', user.avatarStoragePath);
      }

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

      if (currentSettings.coverStoragePath) {
        await supabaseStorage.deleteFile('covers', currentSettings.coverStoragePath);
      }

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
      // ✅ Fix 1: cast username to string
      const username = req.params.username as string;
      const clerkUserId = req.auth?.userId;

      // ✅ Fix 2: use include instead of select to get _count
      const user = await prisma.user.findUnique({
        where: { username },
        include: {
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

      // ✅ استبعاد الحقول الحساسة قبل الإرسال
      const { email, clerkUserId: _, avatarStoragePath, ...publicData } = user as any;

      res.json({
        status: 'SUCCESS',
        data: {
          ...publicData,
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