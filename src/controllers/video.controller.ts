import { Request, Response } from 'express';
import { r2MediaStorage } from '../services/r2-media-storage.service';
import prisma from '../lib/prisma';
import { validateFileSize, validateMimeType } from '../middleware/file-validation.middleware';
import { logger } from '../utils/logger';
import { ErrorCode, sendError } from '../constants/errors';

// Constants for rate limiting
const REEL_UPLOAD_COOLDOWN_DAYS = 1; // Reduced from 3 days to 1 day
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
   * GET /api/videos — fetch the current user's videos
   */
  static async getMyVideos(req: Request, res: Response): Promise<void> {
    try {
      const clerkUserId = req.auth?.userId;

      if (!clerkUserId) {
        sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
        return;
      }

      const user = await prisma.user.findUnique({
        where: { clerkUserId },
        select: { id: true },
      });

      if (!user) {
        sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
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
      sendError(req, res, ErrorCode.INTERNAL, 'Failed to get videos');
    }
  }

  /**
   * GET /api/videos/user/:username — fetch a specific user's videos
   */
  static async getVideosByUsername(req: Request, res: Response): Promise<void> {
    try {
      const username = Array.isArray(req.params.username) ? req.params.username[0] : req.params.username;

      const user = await prisma.user.findUnique({
        where: { username },
        select: { id: true },
      });

      if (!user) {
        sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
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
      sendError(req, res, ErrorCode.INTERNAL, 'Failed to get videos');
    }
  }

  /**
   * POST /api/videos — upload a new video
   * Requirements: 13.1, 13.2, 13.3 - 3-day cooldown enforcement
   */
  static async uploadVideo(req: Request, res: Response): Promise<void> {
    try {
      const clerkUserId = req.auth?.userId;

      if (!clerkUserId) {
        sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
        return;
      }

      const user = await prisma.user.findUnique({
        where: { clerkUserId },
        select: { id: true, lastReelUpload: true },
      });

      if (!user) {
        sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
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

          // E006 — frontend localizes via the error code; the message
          // here is a safe English fallback only.
          sendError(
            req, res, ErrorCode.RATE_LIMIT,
            `You can upload a new reel in ${hoursRemaining} hour(s).`,
            {
              code: 'UPLOAD_COOLDOWN_ACTIVE',
              hoursRemaining,
              daysRemaining,
              hoursInDay,
            },
          );
          return;
        }
      }

      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const videoFile = files?.['video']?.[0];
      const thumbnailFile = files?.['thumbnail']?.[0];

      if (!videoFile) {
        sendError(req, res, ErrorCode.FILE_UPLOAD, 'No video file uploaded');
        return;
      }

      // Validate file size (50MB hard limit)
      const sizeValidation = validateFileSize(videoFile.buffer);
      if (!sizeValidation.valid) {
        sendError(
          req, res, ErrorCode.FILE_UPLOAD,
          sizeValidation.error || 'Video file too large.',
          { code: sizeValidation.errorCode },
          413,
        );
        return;
      }

      // Validate MIME type using magic bytes
      const mimeValidation = validateMimeType(videoFile.buffer, videoFile.mimetype);
      if (!mimeValidation.valid) {
        sendError(
          req, res, ErrorCode.FILE_UPLOAD,
          mimeValidation.error || 'Unsupported video type.',
          { code: mimeValidation.errorCode },
          415,
        );
        return;
      }

      const { caption } = req.body;
      const timestamp = Date.now();

      // Upload video to R2
      const videoResult = await r2MediaStorage.uploadPublic(
        'videos',
        user.id,
        videoFile.buffer,
        `${user.id}/${timestamp}.${videoFile.mimetype.split('/')[1]}`,
        videoFile.mimetype
      );

      if (!videoResult.success || !videoResult.url || !videoResult.key) {
        sendError(req, res, ErrorCode.EXTERNAL_SERVICE, videoResult.error || 'Failed to upload video');
        return;
      }

      // Upload thumbnail if provided
      let thumbnailUrl = null;
      let thumbnailPath = null;

      if (thumbnailFile) {
        const thumbResult = await r2MediaStorage.uploadPublic(
          'thumbnails',
          user.id,
          thumbnailFile.buffer,
          `${user.id}/${timestamp}_thumb.${thumbnailFile.mimetype.split('/')[1]}`,
          thumbnailFile.mimetype
        );

        if (thumbResult.success && thumbResult.url && thumbResult.key) {
          thumbnailUrl = thumbResult.url;
          thumbnailPath = thumbResult.key;
        }
      }

      // Create reel in database
      const reel = await prisma.reel.create({
        data: {
          userId: user.id,
          videoUrl: videoResult.url!,
          videoStoragePath: videoResult.key,
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
      sendError(req, res, ErrorCode.INTERNAL, 'Failed to upload video');
    }
  }

  /**
   * DELETE /api/videos/:id — delete a video
   * Maximum 2 deletions per user (Requirements 13.5, 13.6).
   * Deleting a video resets the upload cooldown (Requirement 13.4).
   */
  static async deleteVideo(req: Request, res: Response): Promise<void> {
    
    try {
      const clerkUserId = req.auth?.userId;
      // Ensure id is a string (handle array case)
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

      if (!clerkUserId) {
        sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
        return;
      }

      const user = await prisma.user.findUnique({
        where: { clerkUserId },
        select: { id: true, reelDeleteCount: true },
      });

      if (!user) {
        sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
        return;
      }

      // Check if user has reached delete limit (Requirement 13.6)
      if (user.reelDeleteCount >= MAX_REEL_DELETES) {
        sendError(
          req, res, ErrorCode.RATE_LIMIT,
          `You have reached the maximum number of reel deletions (${MAX_REEL_DELETES}).`,
          {
            code: 'MAX_DELETES_REACHED',
            deletesUsed: user.reelDeleteCount,
            maxDeletes: MAX_REEL_DELETES,
          },
        );
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
        sendError(req, res, ErrorCode.NOT_FOUND, 'Video not found');
        return;
      }

      if (reel.userId !== user.id) {
        sendError(req, res, ErrorCode.AUTHORIZATION, 'Not authorized to delete this video');
        return;
      }

      // Delete files from storage
      let videoDeleted = false;
      let thumbnailDeleted = false;
      
      if (reel.videoStoragePath) {
        logger.info(`Attempting to delete video: ${reel.videoStoragePath}`);
        
        // The path stored in DB might be:
        // 1. Full path: "reels/user123/file.mp4" (from upload.routes.ts)
        // 2. Full path: "videos/user123/file.mp4" (from video.controller.ts)
        // 3. Relative path: "user123/file.mp4"
        
        // Try deleting with 'reels' folder first (current standard)
        videoDeleted = await r2MediaStorage.deleteObject(reel.videoStoragePath);
        
        if (!videoDeleted) {
          logger.warn(`Failed to delete video file: ${reel.videoStoragePath}`);
        } else {
          logger.info(`Successfully deleted video file: ${reel.videoStoragePath}`);
        }
      }
      
      if (reel.thumbnailStoragePath) {
        logger.info(`Attempting to delete thumbnail: ${reel.thumbnailStoragePath}`);
        thumbnailDeleted = await r2MediaStorage.deleteObject(reel.thumbnailStoragePath);
        if (!thumbnailDeleted) {
          logger.warn(`Failed to delete thumbnail file: ${reel.thumbnailStoragePath}`);
        } else {
          logger.info(`Successfully deleted thumbnail file: ${reel.thumbnailStoragePath}`);
        }
      }
      
      // Log deletion results
      logger.info(`Video deletion: ${videoDeleted ? 'success' : 'failed'}, Thumbnail deletion: ${thumbnailDeleted ? 'success' : 'failed'}`);

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
      sendError(req, res, ErrorCode.INTERNAL, 'Failed to delete video');
    }
  }

  /**
   * POST /api/videos/:id/view — record a view
   */
  static async recordView(req: Request, res: Response): Promise<void> {
    try {
      // Ensure id is a string (handle array case)
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

      await prisma.reel.update({
        where: { id },
        data: { views: { increment: 1 } },
      });

      res.json({ status: 'SUCCESS' });
    } catch (error) {
      logger.error('Record view error:', error);
      sendError(req, res, ErrorCode.INTERNAL, 'Failed to record view');
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
        sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
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
        sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
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
      sendError(req, res, ErrorCode.INTERNAL, 'Failed to get delete status');
    }
  }
}
