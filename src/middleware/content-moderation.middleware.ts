/**
 * Content Moderation Middleware
 * Automatically moderates user-generated content
 */

import { Request, Response, NextFunction } from 'express';
import { TextModerationService } from '../services/text-moderation.service';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';

/**
 * Middleware: Moderate comment content
 */
export const moderateComment = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { content } = req.body;
        const userId = req.auth?.userId;

        if (!content || !userId) {
            next();
            return;
        }

        // Moderate text
        const moderation = TextModerationService.moderateText(content, 'comment');

        if (!moderation.isClean) {
            // Log moderation action
            await logModerationAction({
                userId,
                contentType: 'comment',
                action: 'BLOCKED',
                reason: moderation.reason || 'Inappropriate content',
                detectedWords: moderation.detectedWords || [],
                severity: moderation.severity,
            });

            // Block the comment
            res.status(400).json({
                status: 'ERROR',
                message: 'تم رفض التعليق بسبب محتوى غير لائق',
                code: 'CONTENT_MODERATION_FAILED',
                details: {
                    reason: moderation.reason,
                    severity: moderation.severity,
                },
            });
            return;
        }

        // Check for spam
        const isSpam = TextModerationService.detectSpam(content);
        if (isSpam) {
            await logModerationAction({
                userId,
                contentType: 'comment',
                action: 'BLOCKED',
                reason: 'Spam detected',
                detectedWords: ['spam'],
                severity: 'medium',
            });

            res.status(429).json({
                status: 'ERROR',
                message: 'تم رفض التعليق بسبب اكتشاف spam',
                code: 'SPAM_DETECTED',
            });
            return;
        }

        next();
    } catch (error: any) {
        logger.error('[CONTENT_MODERATION] Error:', error);
        // Don't block the request on moderation errors
        next();
    }
};

/**
 * Middleware: Moderate reel caption
 */
export const moderateReelCaption = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { caption } = req.body;
        const userId = req.auth?.userId;

        if (!caption || !userId) {
            next();
            return;
        }

        // Moderate text
        const moderation = TextModerationService.moderateText(caption, 'caption');

        if (!moderation.isClean) {
            await logModerationAction({
                userId,
                contentType: 'reel',
                action: 'BLOCKED',
                reason: moderation.reason || 'Inappropriate content',
                detectedWords: moderation.detectedWords || [],
                severity: moderation.severity,
            });

            res.status(400).json({
                status: 'ERROR',
                message: 'تم رفض الفيديو بسبب محتوى غير لائق في الوصف',
                code: 'CONTENT_MODERATION_FAILED',
                details: {
                    reason: moderation.reason,
                    severity: moderation.severity,
                },
            });
            return;
        }

        next();
    } catch (error: any) {
        logger.error('[CONTENT_MODERATION] Error:', error);
        next();
    }
};

/**
 * Middleware: Moderate bio
 */
export const moderateBio = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { bio } = req.body;
        const userId = req.auth?.userId;

        if (!bio || !userId) {
            next();
            return;
        }

        // Moderate text
        const moderation = TextModerationService.moderateText(bio, 'bio');

        if (!moderation.isClean) {
            await logModerationAction({
                userId,
                contentType: 'bio',
                action: 'BLOCKED',
                reason: moderation.reason || 'Inappropriate content',
                detectedWords: moderation.detectedWords || [],
                severity: moderation.severity,
            });

            res.status(400).json({
                status: 'ERROR',
                message: 'تم رفض النبذة بسبب محتوى غير لائق',
                code: 'CONTENT_MODERATION_FAILED',
                details: {
                    reason: moderation.reason,
                    severity: moderation.severity,
                },
            });
            return;
        }

        next();
    } catch (error: any) {
        logger.error('[CONTENT_MODERATION] Error:', error);
        next();
    }
};

/**
 * Middleware: Validate username
 */
export const validateUsernameMiddleware = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { username } = req.body;
        const userId = req.auth?.userId;

        if (!username || !userId) {
            next();
            return;
        }

        // Validate username
        const validation = TextModerationService.validateUsername(username);

        if (!validation.isClean) {
            await logModerationAction({
                userId,
                contentType: 'username',
                action: 'BLOCKED',
                reason: validation.reason || 'Invalid username',
                detectedWords: validation.detectedWords || [],
                severity: validation.severity,
            });

            res.status(400).json({
                status: 'ERROR',
                message: validation.reason || 'اسم المستخدم غير صالح',
                code: 'USERNAME_VALIDATION_FAILED',
            });
            return;
        }

        next();
    } catch (error: any) {
        logger.error('[CONTENT_MODERATION] Error:', error);
        next();
    }
};

/**
 * Helper: Log moderation action to database
 */
async function logModerationAction(data: {
    userId: string;
    contentType: string;
    contentId?: string;
    action: string;
    reason: string;
    detectedWords: string[];
    severity: string;
}) {
    try {
        // Get user's database ID
        const user = await prisma.user.findUnique({
            where: { clerkUserId: data.userId },
            select: { id: true },
        });

        if (!user) {
            logger.warn('[CONTENT_MODERATION] User not found:', data.userId);
            return;
        }

        // Create moderation log
        await prisma.moderationLog.create({
            data: {
                userId: user.id,
                contentType: data.contentType,
                contentId: data.contentId,
                action: data.action as any,
                reason: data.reason,
                detectedWords: data.detectedWords,
                severity: data.severity,
                isAutomatic: true,
            },
        });

        logger.info('[CONTENT_MODERATION] Action logged:', {
            userId: user.id,
            contentType: data.contentType,
            action: data.action,
            severity: data.severity,
        });
    } catch (error) {
        logger.error('[CONTENT_MODERATION] Failed to log action:', error);
    }
}

/**
 * Rate limiting for content creation (anti-spam)
 */
const contentCreationLimits = new Map<string, { count: number; resetAt: number }>();

export const rateLimitContentCreation = (maxRequests: number = 10, windowMs: number = 60000) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = req.auth?.userId;

            if (!userId) {
                next();
                return;
            }

            const now = Date.now();
            const userLimit = contentCreationLimits.get(userId);

            if (!userLimit || now > userLimit.resetAt) {
                // Reset limit
                contentCreationLimits.set(userId, {
                    count: 1,
                    resetAt: now + windowMs,
                });
                next();
                return;
            }

            if (userLimit.count >= maxRequests) {
                res.status(429).json({
                    status: 'ERROR',
                    message: 'تم تجاوز الحد الأقصى للطلبات. يرجى المحاولة لاحقاً',
                    code: 'RATE_LIMIT_EXCEEDED',
                    retryAfter: Math.ceil((userLimit.resetAt - now) / 1000),
                });
                return;
            }

            // Increment count
            userLimit.count++;
            contentCreationLimits.set(userId, userLimit);

            next();
        } catch (error: any) {
            logger.error('[RATE_LIMIT] Error:', error);
            next();
        }
    };
};
