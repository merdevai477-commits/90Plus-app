/**
 * 🔒 ZERO TRUST: Comprehensive Ownership Verification
 * Prevents IDOR (Insecure Direct Object Reference) attacks
 * Every resource modification must verify ownership
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import prisma from '../lib/prisma';

// Helper function to ensure param is string
const ensureString = (param: string | string[] | undefined): string => {
  if (Array.isArray(param)) return param[0];
  return param || '';
};

/**
 * Get user ID from authenticated request
 */
async function getUserId(req: Request): Promise<string | null> {
  const clerkUserId = req.auth?.userId;
  if (!clerkUserId) return null;

  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    select: { id: true },
  });

  return user?.id || null;
}

/**
 * Verify ownership of a reel
 */
export async function verifyReelOwnership(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
      return;
    }

    const reelId = ensureString(req.params.id || req.params.reelId);
    if (!reelId) {
      res.status(400).json({ status: 'ERROR', message: 'Reel ID required' });
      return;
    }

    const reel = await prisma.reel.findUnique({
      where: { id: reelId },
      select: { userId: true },
    });

    if (!reel) {
      res.status(404).json({ status: 'ERROR', message: 'Reel not found' });
      return;
    }

    if (reel.userId !== userId) {
      logger.warn('Reel ownership verification failed', {
        userId,
        reelId,
        ownerId: reel.userId,
        ip: req.ip,
        path: req.path,
      });

      res.status(403).json({ status: 'ERROR', message: 'Forbidden - You do not own this reel' });
      return;
    }

    req.userId = userId;
    next();
  } catch (error: any) {
    logger.error('Reel ownership verification error:', error);
    res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
  }
}

/**
 * Verify ownership of a comment
 */
export async function verifyCommentOwnership(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
      return;
    }

    const commentId = ensureString(req.params.commentId || req.params.id);
    if (!commentId) {
      res.status(400).json({ status: 'ERROR', message: 'Comment ID required' });
      return;
    }

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { userId: true },
    });

    if (!comment) {
      res.status(404).json({ status: 'ERROR', message: 'Comment not found' });
      return;
    }

    if (comment.userId !== userId) {
      logger.warn('Comment ownership verification failed', {
        userId,
        commentId,
        ownerId: comment.userId,
        ip: req.ip,
        path: req.path,
      });

      res.status(403).json({ status: 'ERROR', message: 'Forbidden - You do not own this comment' });
      return;
    }

    req.userId = userId;
    next();
  } catch (error: any) {
    logger.error('Comment ownership verification error:', error);
    res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
  }
}

/**
 * Verify ownership of a video
 */
export async function verifyVideoOwnership(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
      return;
    }

    const videoId = ensureString(req.params.id || req.params.videoId);
    if (!videoId) {
      res.status(400).json({ status: 'ERROR', message: 'Video ID required' });
      return;
    }

    const video = await prisma.reel.findUnique({
      where: { id: videoId },
      select: { userId: true },
    });

    if (!video) {
      res.status(404).json({ status: 'ERROR', message: 'Video not found' });
      return;
    }

    if (video.userId !== userId) {
      logger.warn('Video ownership verification failed', {
        userId,
        videoId,
        ownerId: video.userId,
        ip: req.ip,
        path: req.path,
      });

      res.status(403).json({ status: 'ERROR', message: 'Forbidden - You do not own this video' });
      return;
    }

    req.userId = userId;
    next();
  } catch (error: any) {
    logger.error('Video ownership verification error:', error);
    res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
  }
}

/**
 * Verify ownership of a notification
 */
export async function verifyNotificationOwnership(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
      return;
    }

    const notificationId = ensureString(req.params.id || req.params.notificationId);
    if (!notificationId) {
      res.status(400).json({ status: 'ERROR', message: 'Notification ID required' });
      return;
    }

    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
      select: { userId: true },
    });

    if (!notification) {
      res.status(404).json({ status: 'ERROR', message: 'Notification not found' });
      return;
    }

    if (notification.userId !== userId) {
      logger.warn('Notification ownership verification failed', {
        userId,
        notificationId,
        ownerId: notification.userId,
        ip: req.ip,
        path: req.path,
      });

      res.status(403).json({ status: 'ERROR', message: 'Forbidden - You do not own this notification' });
      return;
    }

    req.userId = userId;
    next();
  } catch (error: any) {
    logger.error('Notification ownership verification error:', error);
    res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
  }
}

/**
 * Verify ownership of a prediction
 */
export async function verifyPredictionOwnership(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
      return;
    }

    const predictionId = ensureString(req.params.id || req.params.predictionId);
    if (!predictionId) {
      res.status(400).json({ status: 'ERROR', message: 'Prediction ID required' });
      return;
    }

    const prediction = await prisma.prediction.findUnique({
      where: { id: predictionId },
      select: { userId: true },
    });

    if (!prediction) {
      res.status(404).json({ status: 'ERROR', message: 'Prediction not found' });
      return;
    }

    if (prediction.userId !== userId) {
      logger.warn('Prediction ownership verification failed', {
        userId,
        predictionId,
        ownerId: prediction.userId,
        ip: req.ip,
        path: req.path,
      });

      res.status(403).json({ status: 'ERROR', message: 'Forbidden - You do not own this prediction' });
      return;
    }

    req.userId = userId;
    next();
  } catch (error: any) {
    logger.error('Prediction ownership verification error:', error);
    res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
  }
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}
