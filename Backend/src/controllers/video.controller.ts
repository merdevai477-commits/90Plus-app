import { Request, Response } from 'express';
import { supabaseStorage } from '../services/r2-storage.service';
import prisma from '../lib/prisma';
import { validateFileSize, validateMimeType } from '../middleware/file-validation.middleware';
import { logger } from '../utils/logger';

// Constants for rate limiting
const REEL_UPLOAD_COOLDOWN_DAYS = 3;
// Requirements 13.5, 13.6: Allow up to 2 deletions, block the third
export const MAX_REEL_DELETES = 2;

/**
 * Check if a user can delete a video based on their delete count
 * Requirements 13.5, 13.6
 * @param deleteCount - Current number of deletions by the user
 * @returns Object with canDelete flag and remaining deletes
 */
export function checkDeleteLimit(deleteCount: number): { 
  canDelete: boolean; 
  remainingDeletes: number;
  deletesUsed: number;
  maxDeletes: number;
} {
  const canDelete = deleteCount < MAX_REEL_DELETES;
  const remainingDeletes = Math.max(0, MAX_REEL_DELETES - deleteCount);
  
  return {
    canDelete,
    remainingDeletes,
    deletesUsed: deleteCount,
    maxDeletes: MAX_REEL_DELETES
  };
}

/**
 * Calculate if upload cooldown should be reset after deletion
 * Requirement 13.4: Deleting a video resets the upload cooldown
 * @param wasDeleted - Whether a video was successfully deleted
 * @returns Whether the upload cooldown should be reset
 */
export function shouldResetUploadCooldown(wasDeleted: boolean): boolean {
  return wasDeleted;
}

export class VideoController {
  /**
   * GET /api/videos - جلب فيديوهات المستخدم الحالي
   */
  static async getMyVideos(req: Request, res: Response): Promise<void> {
    try {
      const clerkUserId = req.auth?.userId;

      if (!clerkUserId) {
        res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { clerkUserId },
        select: { id: true },
      });

      if (!user) {
        res.status(404).json({ status: 'ERROR', message: 'User not found' });
        return;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;

      const [videos, total] = await Promise.all([
        prisma.reel.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          include: {
            _count: {
              select: {
                likes: true,
                comments: true,
              },
            },
          },
        }),
        prisma.reel.count({ where: { userId: user.id } }),
      ]);

      res.json({
        status: 'SUCCESS',
        data: {
          videos: videos.map((v) => ({
            id: v.id,
            videoUrl: v.videoUrl,
            thumbnail: v.thumbnail,
            caption: v.caption,
            views: v.views,
            likes: v._count.likes,
            comments: v._count.comments,
            createdAt: v.createdAt,
          })),
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error) {
      logger.error('Get videos error:', error);
      res.status(500).json({ status: 'ERROR', message: 'Failed to get videos' });
    }
  }

  /**
   * GET /api/videos/user/:username - جلب فيديوهات مستخدم معين
   */
  static async getVideosByUsername(req: Request, res: Response): Promise<void> {
    try {
      const { username } = req.params;

      const user = await prisma.user.findUnique({
        where: { username },
        select: { id: true },
      });

      if (!user) {
        res.status(404).json({ status: 'ERROR', message: 'User not found' });
        return;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;

      const [videos, total] = await Promise.all([
        prisma.reel.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          include: {
            _count: {
              select: {
                likes: true,
                comments: true,
              },
            },
          },
        }),
        prisma.reel.count({ where: { userId: user.id } }),
      ]);

      res.json({
        status: 'SUCCESS',
        data: {
          videos: videos.map((v) => ({
            id: v.id,
            videoUrl: v.videoUrl,
            thumbnail: v.thumbnail,
            caption: v.caption,
            views: v.views,
            likes: v._count.likes,
            comments: v._count.comments,
            createdAt: v.createdAt,
          })),
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error) {
      logger.error('Get videos by username error:', error);
      res.status(500).json({ status: 'ERROR', message: 'Failed to get videos' });
    }
  }

  /**
   * POST /api/videos - رفع فيديو جديد
   * Requirements: 13.1, 13.2, 13.3 - 3-day cooldown enforcement
   */
  static async uploadVideo(req: Request, res: Response): Promise<void> {
    try {
      const clerkUserId = req.auth?.userId;

      if (!clerkUserId) {
        res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { clerkUserId },
        select: { id: true, lastReelUpload: true },
      });

      if (!user) {
        res.status(404).json({ status: 'ERROR', message: 'User not found' });
        return;
      }

      // Check 3-day cooldown (Requirement 13.2)
      if (user.lastReelUpload) {
        const msSinceLastUpload = Date.now() - new Date(user.lastReelUpload).getTime();
        const cooldownMs = REEL_UPLOAD_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
        
        if (msSinceLastUpload < cooldownMs) {
          const remainingMs = cooldownMs - msSinceLastUpload;
          const hoursRemaining = Math.ceil(remainingMs / (60 * 60 * 1000));
          const daysRemaining = Math.floor(hoursRemaining / 24);
          const hoursInDay = hoursRemaining % 24;
          
          // Return remaining hours on rejection (Requirement 13.3)
          res.status(429).json({
            status: 'ERROR',
            code: 'UPLOAD_COOLDOWN_ACTIVE',
            message: `يمكنك رفع فيديو جديد بعد ${hoursRemaining} ساعة`,
            hoursRemaining,
            daysRemaining,
            hoursInDay,
          });
          return;
        }
      }

      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const videoFile = files?.['video']?.[0];
      const thumbnailFile = files?.['thumbnail']?.[0];

      if (!videoFile) {
        res.status(400).json({ status: 'ERROR', message: 'No video file uploaded' });
        return;
      }

      // Validate file size (50MB hard limit)
      const sizeValidation = validateFileSize(videoFile.buffer);
      if (!sizeValidation.valid) {
        res.status(413).json({
          status: 'ERROR',
          code: sizeValidation.errorCode,
          message: sizeValidation.error,
        });
        return;
      }

      // Validate MIME type using magic bytes
      const mimeValidation = validateMimeType(videoFile.buffer, videoFile.mimetype);
      if (!mimeValidation.valid) {
        res.status(415).json({
          status: 'ERROR',
          code: mimeValidation.errorCode,
          message: mimeValidation.error,
        });
        return;
      }

      const { caption } = req.body;
      const timestamp = Date.now();

      // Upload video to Supabase
      const videoResult = await supabaseStorage.uploadFile(
        'videos',
        videoFile.buffer,
        `${user.id}/${timestamp}.${videoFile.mimetype.split('/')[1]}`,
        videoFile.mimetype
      );

      if (!videoResult.success) {
        res.status(500).json({ status: 'ERROR', message: videoResult.error });
        return;
      }

      // Upload thumbnail if provided
      let thumbnailUrl = null;
      let thumbnailPath = null;

      if (thumbnailFile) {
        const thumbResult = await supabaseStorage.uploadFile(
          'thumbnails',
          thumbnailFile.buffer,
          `${user.id}/${timestamp}_thumb.${thumbnailFile.mimetype.split('/')[1]}`,
          thumbnailFile.mimetype
        );

        if (thumbResult.success) {
          thumbnailUrl = thumbResult.url;
          thumbnailPath = thumbResult.path;
        }
      }

      // Create reel in database
      const reel = await prisma.reel.create({
        data: {
          userId: user.id,
          videoUrl: videoResult.url!,
          videoStoragePath: videoResult.path,
          thumbnail: thumbnailUrl,
          thumbnailStoragePath: thumbnailPath,
          caption,
        },
      });

      // Award coins for uploading and record upload timestamp (Requirement 13.1)
      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: { 
            coins: { increment: 5 },
            lastReelUpload: new Date(),
          },
        }),
        prisma.coinTransaction.create({
          data: {
            userId: user.id,
            amount: 5,
            type: 'REEL_REWARD',
            description: 'Uploaded a new reel',
          },
        }),
      ]);

      res.status(201).json({
        status: 'SUCCESS',
        data: {
          id: reel.id,
          videoUrl: reel.videoUrl,
          thumbnail: reel.thumbnail,
          caption: reel.caption,
          createdAt: reel.createdAt,
        },
        message: 'Video uploaded successfully! +5 coins',
      });
    } catch (error) {
      logger.error('Upload video error:', error);
      res.status(500).json({ status: 'ERROR', message: 'Failed to upload video' });
    }
  }

  /**
   * DELETE /api/videos/:id - حذف فيديو
   * حد أقصى 2 مرات مسح للفيديو (Requirements 13.5, 13.6)
   * يتم إعادة تعيين cooldown الرفع عند الحذف (Requirement 13.4)
   */
  static async deleteVideo(req: Request, res: Response): Promise<void> {
    
    try {
      const clerkUserId = req.auth?.userId;
      const { id } = req.params;

      if (!clerkUserId) {
        res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { clerkUserId },
        select: { id: true, reelDeleteCount: true },
      });

      if (!user) {
        res.status(404).json({ status: 'ERROR', message: 'User not found' });
        return;
      }

      // Check if user has reached delete limit (Requirement 13.6)
      if (user.reelDeleteCount >= MAX_REEL_DELETES) {
        res.status(429).json({
          status: 'ERROR',
          message: 'لقد وصلت للحد الأقصى من مسح الفيديوهات (2 مرات)',
          code: 'MAX_DELETES_REACHED',
          deletesUsed: user.reelDeleteCount,
          maxDeletes: MAX_REEL_DELETES
        });
        return;
      }

      // Find the reel and verify ownership
      const reel = await prisma.reel.findUnique({
        where: { id },
        select: {
          userId: true,
          videoStoragePath: true,
          thumbnailStoragePath: true,
        },
      });

      if (!reel) {
        res.status(404).json({ status: 'ERROR', message: 'Video not found' });
        return;
      }

      if (reel.userId !== user.id) {
        res.status(403).json({ status: 'ERROR', message: 'Not authorized to delete this video' });
        return;
      }

      // Delete files from storage
      if (reel.videoStoragePath) {
        await supabaseStorage.deleteFile('videos', reel.videoStoragePath);
      }
      if (reel.thumbnailStoragePath) {
        await supabaseStorage.deleteFile('thumbnails', reel.thumbnailStoragePath);
      }

      // Delete from database, increment delete count, and reset upload cooldown (Requirement 13.4)
      await prisma.$transaction([
        prisma.reel.delete({ where: { id } }),
        prisma.user.update({
          where: { id: user.id },
          data: { 
            reelDeleteCount: { increment: 1 },
            lastReelUpload: null  // Reset upload cooldown (Requirement 13.4)
          }
        })
      ]);

      const remainingDeletes = MAX_REEL_DELETES - (user.reelDeleteCount + 1);

      res.json({
        status: 'SUCCESS',
        message: 'Video deleted successfully',
        data: {
          deletesUsed: user.reelDeleteCount + 1,
          remainingDeletes,
          maxDeletes: MAX_REEL_DELETES,
          uploadCooldownReset: true  // Indicate that upload is now available
        }
      });
    } catch (error) {
      logger.error('Delete video error:', error);
      res.status(500).json({ status: 'ERROR', message: 'Failed to delete video' });
    }
  }

  /**
   * POST /api/videos/:id/view - تسجيل مشاهدة
   */
  static async recordView(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      await prisma.reel.update({
        where: { id },
        data: { views: { increment: 1 } },
      });

      res.json({ status: 'SUCCESS' });
    } catch (error) {
      logger.error('Record view error:', error);
      res.status(500).json({ status: 'ERROR', message: 'Failed to record view' });
    }
  }

  /**
   * GET /api/videos/delete-status - Get current delete limit status
   * Returns remaining deletes and upload cooldown status
   * Requirements: 13.4, 13.5, 13.6, 13.7
   */
  static async getDeleteStatus(req: Request, res: Response): Promise<void> {
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
          reelDeleteCount: true,
          lastReelUpload: true
        },
      });

      if (!user) {
        res.status(404).json({ status: 'ERROR', message: 'User not found' });
        return;
      }

      const deleteStatus = checkDeleteLimit(user.reelDeleteCount);
      
      // Calculate upload cooldown status
      let uploadCooldownActive = false;
      let uploadHoursRemaining = 0;
      
      if (user.lastReelUpload) {
        const msSinceLastUpload = Date.now() - new Date(user.lastReelUpload).getTime();
        const cooldownMs = REEL_UPLOAD_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
        
        if (msSinceLastUpload < cooldownMs) {
          uploadCooldownActive = true;
          const remainingMs = cooldownMs - msSinceLastUpload;
          uploadHoursRemaining = Math.ceil(remainingMs / (60 * 60 * 1000));
        }
      }

      res.json({
        status: 'SUCCESS',
        data: {
          ...deleteStatus,
          uploadCooldownActive,
          uploadHoursRemaining,
          canUpload: !uploadCooldownActive
        }
      });
    } catch (error) {
      logger.error('Get delete status error:', error);
      res.status(500).json({ status: 'ERROR', message: 'Failed to get delete status' });
    }
  }
}
