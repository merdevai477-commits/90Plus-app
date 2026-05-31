import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/clerk.middleware';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { followCountsFromPrisma } from '../utils/follow-count.utils';
import { ProfileController } from '../controllers/profile.controller';
import { moderateBio } from '../middleware/content-moderation.middleware';
import { responseCacheMiddleware } from '../middleware/responseCache.middleware';
import { writeLimiter, strictLimiter } from '../middleware/rateLimit.middleware';
import { ErrorCode, sendError } from '../constants/errors';

const router = Router();

/**
 * GET /api/profile/me
 * Get current user profile (cached per-user, 2min TTL)
 */
router.get('/me', requireAuth, responseCacheMiddleware({ ttl: 2 * 60 * 1000 }), ProfileController.getMyProfile);

/**
 * PATCH /api/profile/me
 * Update current user profile
 */
router.patch('/me', requireAuth, writeLimiter, moderateBio, ProfileController.updateMyProfile);

// Constants - Strict Cooldown Rules
const AVATAR_CHANGE_COOLDOWN_DAYS = 7;   // Avatar: once every 7 days (Requirement 10)
const COVER_CHANGE_COOLDOWN_DAYS = 15;   // Cover image: once every 15 days
const USERNAME_CHANGE_COOLDOWN_DAYS = 15; // Username: once every 15 days
const REEL_UPLOAD_COOLDOWN_DAYS = 3;

/**
 * PUT /api/profile/avatar
 * Update profile avatar (7 days cooldown)
 * Requirements: 10.1, 10.2, 10.3, 10.4
 */
router.put('/avatar', requireAuth, writeLimiter, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;
        if (!clerkUserId) {
            sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
            return;
        }

        const { avatarUrl, storagePath } = req.body;

        if (!avatarUrl) {
            sendError(req, res, ErrorCode.VALIDATION, 'Avatar URL is required');
            return;
        }

        // Use transaction to prevent race condition on cooldown check
        const result = await prisma.$transaction(async (tx) => {
            const user = await tx.user.findUnique({
                where: { clerkUserId },
                select: { id: true, lastAvatarChange: true }
            });

            if (!user) {
                return { error: 'NOT_FOUND' } as const;
            }

            // Check 7 days cooldown (Requirement 10.2)
            if (user.lastAvatarChange) {
                const daysSinceLastChange = Math.floor(
                    (Date.now() - new Date(user.lastAvatarChange).getTime()) / (1000 * 60 * 60 * 24)
                );
                if (daysSinceLastChange < AVATAR_CHANGE_COOLDOWN_DAYS) {
                    const daysRemaining = AVATAR_CHANGE_COOLDOWN_DAYS - daysSinceLastChange;
                    return { error: 'COOLDOWN', daysRemaining, userId: user.id } as const;
                }
            }

            // Record the change timestamp (Requirement 10.1)
            await tx.user.update({
                where: { id: user.id },
                data: {
                    avatar: avatarUrl,
                    avatarStoragePath: storagePath,
                    lastAvatarChange: new Date()
                }
            });

            return { error: null } as const;
        });

        if (result.error === 'NOT_FOUND') {
            sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
            return;
        }

        if (result.error === 'COOLDOWN') {
            sendError(
                req,
                res,
                ErrorCode.RATE_LIMIT,
                `You can change your profile picture in ${result.daysRemaining} day(s)`,
                {
                    code: 'COOLDOWN_ACTIVE',
                    daysRemaining: result.daysRemaining,
                },
            );
            return;
        }

        res.json({
            data: { updated: true },
            message: 'Profile picture updated successfully'
        });
    } catch (error: any) {
        logger.error('Update avatar error:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Failed to update avatar');
    }
});

/**
 * PUT /api/profile/cover
 * Update cover image (15 days cooldown)
 * Requirements: 11.1, 11.2, 11.3, 11.4
 */
router.put('/cover', requireAuth, writeLimiter, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;
        if (!clerkUserId) {
            sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
            return;
        }

        const { coverUrl, storagePath } = req.body;

        if (!coverUrl) {
            sendError(req, res, ErrorCode.VALIDATION, 'Cover URL is required');
            return;
        }

        // Use transaction to prevent race condition on cooldown check
        const result = await prisma.$transaction(async (tx) => {
            const user = await tx.user.findUnique({
                where: { clerkUserId },
                select: { id: true, lastCoverChange: true }
            });

            if (!user) {
                return { error: 'NOT_FOUND' } as const;
            }

            // Check 15 days cooldown (Requirement 11.2)
            if (user.lastCoverChange) {
                const daysSinceLastChange = Math.floor(
                    (Date.now() - new Date(user.lastCoverChange).getTime()) / (1000 * 60 * 60 * 24)
                );
                if (daysSinceLastChange < COVER_CHANGE_COOLDOWN_DAYS) {
                    const daysRemaining = COVER_CHANGE_COOLDOWN_DAYS - daysSinceLastChange;
                    return { error: 'COOLDOWN', daysRemaining, userId: user.id } as const;
                }
            }

            // Record the change timestamp (Requirement 11.1)
            await tx.user.update({
                where: { id: user.id },
                data: {
                    coverImage: coverUrl,
                    coverStoragePath: storagePath,
                    lastCoverChange: new Date()
                }
            });

            return { error: null } as const;
        });

        if (result.error === 'NOT_FOUND') {
            sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
            return;
        }

        if (result.error === 'COOLDOWN') {
            sendError(
                req,
                res,
                ErrorCode.RATE_LIMIT,
                `You can change your cover image in ${result.daysRemaining} day(s)`,
                {
                    code: 'COOLDOWN_ACTIVE',
                    daysRemaining: result.daysRemaining,
                },
            );
            return;
        }

        res.json({
            data: { updated: true },
            message: 'Cover image updated successfully'
        });
    } catch (error: any) {
        logger.error('Update cover error:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Failed to update cover');
    }
});

/**
 * PUT /api/profile/username
 * Update username (15 days cooldown)
 * Requirements: 12.1, 12.2
 */
router.put('/username', requireAuth, strictLimiter, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;
        if (!clerkUserId) {
            sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
            return;
        }

        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true, username: true, lastUsernameChange: true }
        });

        if (!user) {
            sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
            return;
        }

        // Check 15 days cooldown (Requirement 12.2)
        if (user.lastUsernameChange) {
            const daysSinceLastChange = Math.floor(
                (Date.now() - new Date(user.lastUsernameChange).getTime()) / (1000 * 60 * 60 * 24)
            );
            if (daysSinceLastChange < USERNAME_CHANGE_COOLDOWN_DAYS) {
                const daysRemaining = USERNAME_CHANGE_COOLDOWN_DAYS - daysSinceLastChange;

                // Create notification on rejection
                await prisma.notification.create({
                    data: {
                        userId: user.id,
                        type: 'GENERAL',
                        title: 'Username change',
                        message: `You cannot change your username right now. Please wait ${daysRemaining} more day(s).`,
                        data: {
                            type: 'USERNAME_COOLDOWN',
                            daysRemaining,
                            cooldownDays: USERNAME_CHANGE_COOLDOWN_DAYS
                        }
                    }
                });

                // Return remaining days on rejection (Requirement 12.2)
                sendError(
                    req,
                    res,
                    ErrorCode.RATE_LIMIT,
                    `You can change your username in ${daysRemaining} day(s)`,
                    {
                        code: 'COOLDOWN_ACTIVE',
                        daysRemaining,
                    },
                );
                return;
            }
        }

        const { username } = req.body;

        if (!username) {
            sendError(req, res, ErrorCode.VALIDATION, 'Username is required');
            return;
        }

        // Validate username format
        const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
        if (!usernameRegex.test(username)) {
            sendError(
                req,
                res,
                ErrorCode.VALIDATION,
                'Username must be 3-20 characters and contain only letters, numbers, and underscores',
            );
            return;
        }

        // Check if username is already taken
        const existingUser = await prisma.user.findUnique({
            where: { username },
            select: { id: true }
        });

        if (existingUser && existingUser.id !== user.id) {
            sendError(req, res, ErrorCode.CONFLICT, 'Username is already taken');
            return;
        }

        // Record the change timestamp with exact date and time (Requirement 12.1)
        await prisma.user.update({
            where: { id: user.id },
            data: {
                username,
                lastUsernameChange: new Date()
            }
        });

        res.json({
            data: { username },
            message: 'Username updated successfully'
        });
    } catch (error: any) {
        logger.error('Update username error:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Failed to update username');
    }
});

/**
 * POST /api/profile/:username/view
 * Increment profile view count (deduplicated per viewer per 5 minutes)
 */
// Simple in-memory dedup for profile views (viewer:target → timestamp)
const profileViewDedup = new Map<string, number>();
const PROFILE_VIEW_DEDUP_TTL = 5 * 60 * 1000; // 5 minutes

router.post('/:username/view', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        // Ensure username is a string (handle array case)
        const username = Array.isArray(req.params.username) ? req.params.username[0] : req.params.username;
        const clerkUserId = req.auth?.userId;

        // Don't count self views
        const viewer = await prisma.user.findUnique({
            where: { clerkUserId: clerkUserId! },
            select: { username: true }
        });

        if (viewer?.username === username) {
            res.json({ data: { counted: false }, message: 'Self view not counted' });
            return;
        }

        // Deduplicate: same viewer can only count once per 5 minutes
        const dedupKey = `${clerkUserId}:${username}`;
        const lastView = profileViewDedup.get(dedupKey);
        if (lastView && Date.now() - lastView < PROFILE_VIEW_DEDUP_TTL) {
            res.json({ data: { counted: false }, message: 'View already counted recently' });
            return;
        }
        profileViewDedup.set(dedupKey, Date.now());

        // Evict old entries periodically (keep map bounded)
        if (profileViewDedup.size > 10000) {
            const now = Date.now();
            for (const [key, ts] of profileViewDedup) {
                if (now - ts > PROFILE_VIEW_DEDUP_TTL) profileViewDedup.delete(key);
            }
        }

        await prisma.user.update({
            where: { username },
            data: { profileViews: { increment: 1 } }
        });

        res.json({ data: { counted: true } });
    } catch (error: any) {
        logger.error('Update profile error:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Failed to update profile');
    }
});

// Simple in-memory cache for analytics (5 minutes TTL, max 500 entries)
const analyticsCache = new Map<string, { data: any; timestamp: number }>();
const ANALYTICS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const ANALYTICS_CACHE_MAX_SIZE = 500;

// Evict oldest entries when cache exceeds max size
const evictAnalyticsCacheIfNeeded = () => {
    if (analyticsCache.size >= ANALYTICS_CACHE_MAX_SIZE) {
        // Delete oldest 10% of entries
        const toDelete = Math.ceil(ANALYTICS_CACHE_MAX_SIZE * 0.1);
        const keys = analyticsCache.keys();
        for (let i = 0; i < toDelete; i++) {
            const key = keys.next().value;
            if (key !== undefined) analyticsCache.delete(key);
        }
    }
};

/**
 * GET /api/profile/analytics
 * Get current user's analytics - SUPER OPTIMIZED with caching
 * Uses response cache middleware (per-user, 2min TTL) to prevent 499 timeouts
 */
router.get('/analytics', requireAuth, responseCacheMiddleware({ ttl: 2 * 60 * 1000 }), async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;
        if (!clerkUserId) {
            sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
            return;
        }

        // Check cache first
        const cached = analyticsCache.get(clerkUserId);
        if (cached && Date.now() - cached.timestamp < ANALYTICS_CACHE_TTL) {
            res.json({ data: cached.data });
            return;
        }

        // Optimized: Use parallel queries with aggregation instead of loading all reels
        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: {
                id: true,
                profileViews: true,
                createdAt: true,
                _count: {
                    select: {
                        followers: true,
                        following: true,
                        reels: true,
                    }
                },
            }
        });

        if (!user) {
            sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
            return;
        }

        // Run aggregation queries in parallel for speed
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);

        const [viewsAgg, likesCount, commentsCount, recentFollowers] = await Promise.all([
            // Sum all reel views using aggregate (no row loading)
            prisma.reel.aggregate({
                where: { userId: user.id },
                _sum: { views: true },
            }),
            // Count total likes across all user's reels
            prisma.like.count({
                where: { reel: { userId: user.id } },
            }),
            // Count total comments across all user's reels
            prisma.comment.count({
                where: { reel: { userId: user.id } },
            }),
            // Recent followers (last 7 days)
            prisma.follow.count({
                where: {
                    followingId: user.id,
                    createdAt: { gte: weekAgo }
                }
            }),
        ]);

        const analyticsData = {
            profileViews: user.profileViews,
            ...followCountsFromPrisma(user._count),
            reelsCount: user._count.reels,
            totalLikes: likesCount,
            totalViews: viewsAgg._sum.views || 0,
            totalComments: commentsCount,
            recentFollowers,
            memberSince: user.createdAt,
        };

        // Save to cache (with eviction to prevent unbounded growth)
        evictAnalyticsCacheIfNeeded();
        analyticsCache.set(clerkUserId, { data: analyticsData, timestamp: Date.now() });

        res.json({ data: analyticsData });
    } catch (error: any) {
        logger.error('Get analytics error:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Failed to load analytics');
    }
});

/**
 * GET /api/profile/cooldowns
 * Get remaining cooldowns for avatar, cover, reel upload, and delete limits
 * Requirements: 13.4, 13.5, 13.6, 13.7
 * Uses response cache middleware (per-user, 1min TTL) to prevent 499 timeouts
 */
router.get('/cooldowns', requireAuth, responseCacheMiddleware({ ttl: 60 * 1000 }), async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;
        if (!clerkUserId) {
            sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
            return;
        }

        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: {
                lastAvatarChange: true,
                lastCoverChange: true,
                lastReelUpload: true,
                lastUsernameChange: true,
                reelDeleteCount: true,  // Requirements 13.5, 13.6
            }
        });

        if (!user) {
            sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
            return;
        }

        const calculateRemaining = (lastChange: Date | null, cooldownDays: number) => {
            if (!lastChange) return { canChange: true, daysRemaining: 0, hoursRemaining: 0 };

            const msSinceChange = Date.now() - new Date(lastChange).getTime();
            const cooldownMs = cooldownDays * 24 * 60 * 60 * 1000;

            if (msSinceChange >= cooldownMs) {
                return { canChange: true, daysRemaining: 0, hoursRemaining: 0 };
            }

            const remainingMs = cooldownMs - msSinceChange;
            const daysRemaining = Math.floor(remainingMs / (24 * 60 * 60 * 1000));
            const hoursRemaining = Math.ceil((remainingMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

            return { canChange: false, daysRemaining, hoursRemaining };
        };

        // Requirements 13.5, 13.6: Calculate delete limit status
        const MAX_REEL_DELETES = 2;
        const deletesUsed = user.reelDeleteCount || 0;
        const remainingDeletes = Math.max(0, MAX_REEL_DELETES - deletesUsed);
        const canDelete = deletesUsed < MAX_REEL_DELETES;

        res.json({
            data: {
                avatar: calculateRemaining(user.lastAvatarChange, AVATAR_CHANGE_COOLDOWN_DAYS),
                cover: calculateRemaining(user.lastCoverChange, COVER_CHANGE_COOLDOWN_DAYS),
                reelUpload: calculateRemaining(user.lastReelUpload, REEL_UPLOAD_COOLDOWN_DAYS),
                username: calculateRemaining(user.lastUsernameChange, USERNAME_CHANGE_COOLDOWN_DAYS),
                // Requirements 13.4, 13.5, 13.6, 13.7: Delete limit info
                reelDelete: {
                    canDelete,
                    deletesUsed,
                    remainingDeletes,
                    maxDeletes: MAX_REEL_DELETES,
                }
            }
        });
    } catch (error: any) {
        logger.error('Get cooldowns error:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Failed to load cooldowns');
    }
});

/**
 * GET /api/profile/:username
 * Get profile by username
 * MUST be last to avoid matching /analytics, /cooldowns, etc.
 */
router.get('/:username', requireAuth, ProfileController.getProfileByUsername);

export default router;
