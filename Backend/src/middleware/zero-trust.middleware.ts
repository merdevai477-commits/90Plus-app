/**
 * 🔒 ZERO TRUST ARCHITECTURE ENFORCEMENT
 * No implicit trust - verify everything, trust nothing
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import prisma from '../lib/prisma';

/**
 * Ownership verification middleware
 * Ensures user can only access their own resources
 */
export function verifyOwnership(resourceType: 'reel' | 'comment' | 'user' | 'prediction') {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const clerkUserId = req.auth?.userId;
      if (!clerkUserId) {
        res.status(401).json({
          status: 'ERROR',
          message: 'Unauthorized - No user context',
        });
        return;
      }

      // Get user from database
      const user = await prisma.user.findUnique({
        where: { clerkUserId },
        select: { id: true },
      });

      if (!user) {
        res.status(401).json({
          status: 'ERROR',
          message: 'Unauthorized - User not found',
        });
        return;
      }

      // Extract resource ID from params
      const resourceId = req.params.id || req.params.reelId || req.params.commentId || req.params.userId;

      if (!resourceId) {
        res.status(400).json({
          status: 'ERROR',
          message: 'Bad Request - Resource ID required',
        });
        return;
      }

      // Verify ownership based on resource type
      let resource: any = null;

      switch (resourceType) {
        case 'reel':
          resource = await prisma.reel.findUnique({
            where: { id: resourceId },
            select: { userId: true },
          });
          break;

        case 'comment':
          resource = await prisma.comment.findUnique({
            where: { id: resourceId },
            select: { userId: true },
          });
          break;

        case 'user':
          // For user resources, check if accessing own profile
          if (resourceId !== user.id) {
            res.status(403).json({
              status: 'ERROR',
              message: 'Forbidden - Cannot access other user resources',
            });
            return;
          }
          next();
          return;

        case 'prediction':
          resource = await prisma.prediction.findUnique({
            where: { id: resourceId },
            select: { userId: true },
          });
          break;

        default:
          res.status(500).json({
            status: 'ERROR',
            message: 'Internal error - Invalid resource type',
          });
          return;
      }

      if (!resource) {
        res.status(404).json({
          status: 'ERROR',
          message: 'Resource not found',
        });
        return;
      }

      if (resource.userId !== user.id) {
        logger.warn('Ownership verification failed', {
          userId: user.id,
          resourceType,
          resourceId,
          ownerId: resource.userId,
          ip: req.ip,
          path: req.path,
        });

        res.status(403).json({
          status: 'ERROR',
          message: 'Forbidden - You do not own this resource',
        });
        return;
      }

      // Attach user ID to request for downstream use
      req.userId = user.id;
      next();
    } catch (error: any) {
      logger.error('Ownership verification error:', error);
      res.status(500).json({
        status: 'ERROR',
        message: 'Internal server error',
      });
    }
  };
}

/**
 * Strict content-type validation
 * Rejects requests with unexpected content types
 */
export function validateContentType(allowedTypes: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentType = req.headers['content-type'];

    if (!contentType) {
      res.status(400).json({
        status: 'ERROR',
        message: 'Bad Request - Content-Type header required',
      });
      return;
    }

    const isAllowed = allowedTypes.some(type => contentType.includes(type));

    if (!isAllowed) {
      logger.warn('Invalid content-type', {
        contentType,
        allowed: allowedTypes,
        path: req.path,
        ip: req.ip,
      });

      res.status(415).json({
        status: 'ERROR',
        message: `Unsupported Media Type - Expected: ${allowedTypes.join(', ')}`,
      });
      return;
    }

    next();
  };
}

/**
 * Reject unknown fields (whitelist only)
 * Prevents prototype pollution and injection attacks
 */
export function rejectUnknownFields(allowedFields: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const bodyKeys = Object.keys(req.body || {});
    const unknownFields = bodyKeys.filter(key => !allowedFields.includes(key));

    if (unknownFields.length > 0) {
      logger.warn('Unknown fields detected', {
        unknownFields,
        path: req.path,
        ip: req.ip,
      });

      res.status(400).json({
        status: 'ERROR',
        message: 'Bad Request - Unknown fields not allowed',
        unknownFields,
      });
      return;
    }

    next();
  };
}

/**
 * Prevent prototype pollution
 * Blocks __proto__, constructor, prototype in keys
 */
export function preventPrototypePollution(req: Request, res: Response, next: NextFunction): void {
  const dangerousKeys = ['__proto__', 'constructor', 'prototype'];

  const checkObject = (obj: any, path: string = 'body'): string | null => {
    if (typeof obj !== 'object' || obj === null) return null;

    for (const key of Object.keys(obj)) {
      if (dangerousKeys.includes(key)) {
        return `${path}.${key}`;
      }

      if (typeof obj[key] === 'object') {
        const result = checkObject(obj[key], `${path}.${key}`);
        if (result) return result;
      }
    }

    return null;
  };

  const dangerousPath = checkObject(req.body);

  if (dangerousPath) {
    logger.error('Prototype pollution attempt detected', {
      path: req.path,
      dangerousPath,
      ip: req.ip,
      body: JSON.stringify(req.body),
    });

    res.status(400).json({
      status: 'ERROR',
      message: 'Bad Request - Dangerous keys detected',
    });
    return;
  }

  next();
}

/**
 * Rate limiting per user (in addition to IP-based)
 * Prevents abuse even with rotating IPs
 */
export function userRateLimit(maxRequests: number, windowMs: number) {
  const userRequests = new Map<string, { count: number; resetAt: number }>();

  // Cleanup old entries every minute
  setInterval(() => {
    const now = Date.now();
    for (const [userId, data] of userRequests.entries()) {
      if (now > data.resetAt) {
        userRequests.delete(userId);
      }
    }
  }, 60000);

  return (req: Request, res: Response, next: NextFunction): void => {
    const userId = req.auth?.userId;

    if (!userId) {
      // No user context, skip user-based rate limiting
      next();
      return;
    }

    const now = Date.now();
    const userData = userRequests.get(userId);

    if (!userData || now > userData.resetAt) {
      // New window
      userRequests.set(userId, {
        count: 1,
        resetAt: now + windowMs,
      });
      next();
      return;
    }

    if (userData.count >= maxRequests) {
      const retryAfter = Math.ceil((userData.resetAt - now) / 1000);

      logger.warn('User rate limit exceeded', {
        userId,
        path: req.path,
        count: userData.count,
        maxRequests,
      });

      res.status(429).json({
        status: 'ERROR',
        message: 'Too many requests - Please try again later',
        retryAfter,
      });
      return;
    }

    userData.count++;
    next();
  };
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}
