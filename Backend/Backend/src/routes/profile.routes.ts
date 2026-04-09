import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/clerk.middleware';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { ProfileController } from '../controllers/profile.controller';
import { moderateBio } from '../middleware/content-moderation.middleware';

const router = Router();

/**
 * GET /api/profile/me
 * Get current user profile
 */
router.get('/me', requireAuth, ProfileController.getMyProfile);

/**
 * PATCH /api/profile/me
 * Update current user profile
 */
router.patch('/me', requireAuth, moderateBio, ProfileController.updateMyProfile);

// Constants - Strict Cooldown Rules
const AVATAR_CHANGE_COOLDOWN_DAYS = 7;   // صورة البروفايل: مرة كل 7 أيام (Requirement 10)
const COVER_CHANGE_COOLDOWN_DAYS = 15;   // صورة الغلاف: مرة كل 15 يوم
const USERNAME_CHANGE_COOLDOWN_DAYS = 15; // اليوزر نيم: مرة كل 15 يوم
const REEL_UPLOAD_COOLDOWN_DAYS = 3;      // الريلز: مرة كل 3 أيام

/**
 * PUT /api/profile/avatar
 * Update profile avatar (7 days cooldown)
 * Requirements: 10.1, 10.2, 10.3, 10.4
 */
router.put('/avatar', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;
        if (!clerkUserId) {
            res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
            return;
        }

        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true, lastAvatarChange: true }
        });

        if (!user) {
            res.status(404).json({ status: 'ERROR', message: 'User not found' });
            return;
        }

        // Check 7 days cooldown (Requirement 10.2)
        if (user.lastAvatarChange) {
            const daysSinceLastChange = Math.floor(
                (Date.now() - new Date(user.lastAvatarChange).getTime()) / (1000 * 60 * 60 * 24)
            );
            if (daysSinceLastChange < AVATAR_CHANGE_COOLDOWN_DAYS) {
                const daysRemaining = AVATAR_CHANGE_COOLDOWN_DAYS - daysSinceLastChange;
                
                // Create notification on rejection (Requirement 10.4)
                await prisma.notification.create({
                    data: {
                        userId: user.id,
                        type: 'GENERAL',
                        title: 'تغيير صورة البروفايل',
                        message: `لا يمكنك تغيير صورة البروفايل الآن. يرجى الانتظار ${daysRemaining} يوم.`,
                        data: { 
                            type: 'AVATAR_COOLDOWN',
                            daysRemaining,
                            cooldownDays: AVATAR_CHANGE_COOLDOWN_DAYS
                        }
                    }
                });
                
                // Return remaining days on rejection (Requirement 10.3)
                res.status(429).json({
                    status: 'ERROR',
                    code: 'COOLDOWN_ACTIVE',
                    message: `يمكنك تغيير صورة البروفايل بعد ${daysRemaining} يوم`,
                    daysRemaining
                });
                return;
            }
        }

        const { avatarUrl, storagePath } = req.body;

        if (!avatarUrl) {
            res.status(400).json({ status: 'ERROR', message: 'Avatar URL is required' });
            return;
        }

        // Record the change timestamp (Requirement 10.1)
        await prisma.user.update({
            where: { id: user.id },
            data: {
                avatar: avatarUrl,
                avatarStoragePath: storagePath,
                lastAvatarChange: new Date()
            }
        });

        res.json({
            status: 'SUCCESS',
            message: 'تم تحديث صورة البروفايل بنجاح'
        });
    } catch (error: any) {
        logger.error('Update avatar error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
});

/**
 * PUT /api/profile/cover
 * Update cover image (15 days cooldown)
 * Requirements: 11.1, 11.2, 11.3, 11.4
 */
router.put('/cover', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;
        if (!clerkUserId) {
            res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
            return;
        }

        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true, lastCoverChange: true }
        });

        if (!user) {
            res.status(404).json({ status: 'ERROR', message: 'User not found' });
            return;
        }

        // Check 15 days cooldown (Requirement 11.2)
        if (user.lastCoverChange) {
            const daysSinceLastChange = Math.floor(
                (Date.now() - new Date(user.lastCoverChange).getTime()) / (1000 * 60 * 60 * 24)
            );
            if (daysSinceLastChange < COVER_CHANGE_COOLDOWN_DAYS) {
                const daysRemaining = COVER_CHANGE_COOLDOWN_DAYS - daysSinceLastChange;
                
                // Create notification on rejection (Requirement 11.4)
                await prisma.notification.create({
                    data: {
                        userId: user.id,
                        type: 'GENERAL',
                        title: 'تغيير صورة الغلاف',
                        message: `لا يمكنك تغيير صورة الغلاف الآن. يرجى الانتظار ${daysRemaining} يوم.`,
                        data: { 
                            type: 'COVER_COOLDOWN',
                            daysRemaining,
                            cooldownDays: COVER_CHANGE_COOLDOWN_DAYS
                        }
                    }
                });
                
                // Return remaining days on rejection (Requirement 11.3)
                res.status(429).json({
                    status: 'ERROR',
                    code: 'COOLDOWN_ACTIVE',
                    message: `يمكنك تغيير صورة الغلاف بعد ${daysRemaining} يوم`,
                    daysRemaining
                });
                return;
            }
        }

        const { coverUrl, storagePath } = req.body;

        if (!coverUrl) {
            res.status(400).json({ status: 'ERROR', message: 'Cover URL is required' });
            return;
        }

        // Record the change timestamp (Requirement 11.1)
        await prisma.user.update({
            where: { id: user.id },
            data: {
                coverImage: coverUrl,
                coverStoragePath: storagePath,
                lastCoverChange: new Date()
            }
        });

        res.json({
            status: 'SUCCESS',
            message: 'تم تحديث صورة الغلاف بنجاح'
        });
    } catch (error: any) {
        logger.error('Update cover error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
});

/**
 * PUT /api/profile/username
 * Update username (15 days cooldown)
 * Requirements: 12.1, 12.2
 */
router.put('/username', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;
        if (!clerkUserId) {
            res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
            return;
        }

        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true, username: true, lastUsernameChange: true }
        });

        if (!user) {
            res.status(404).json({ status: 'ERROR', message: 'User not found' });
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
                        title: 'تغيير اسم المستخدم',
                        message: `لا يمكنك تغيير اسم المستخدم الآن. يرجى الانتظار ${daysRemaining} يوم.`,
                        data: { 
                            type: 'USERNAME_COOLDOWN',
                            daysRemaining,
                            cooldownDays: USERNAME_CHANGE_COOLDOWN_DAYS
                        }
                    }
                });
                
                // Return remaining days on rejection (Requirement 12.2)
                res.status(429).json({
                    status: 'ERROR',
                    code: 'COOLDOWN_ACTIVE',
                    message: `يمكنك تغيير اسم المستخدم بعد ${daysRemaining} يوم`,
                    daysRemaining
                });
                return;
            }
        }

        const { username } = req.body;

        if (!username) {
            res.status(400).json({ status: 'ERROR', message: 'Username is required' });
            return;
        }

        // Validate username format
        const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
        if (!usernameRegex.test(username)) {
            res.status(400).json({ 
                status: 'ERROR', 
                message: 'Username must be 3-20 characters and contain only letters, numbers, and underscores' 
            });
            return;
        }

        // Check if username is already taken
        const existingUser = await prisma.user.findUnique({
            where: { username },
            select: { id: true }
        });

        if (existingUser && existingUser.id !== user.id) {
            res.status(409).json({ status: 'ERROR', message: 'Username is already taken' });
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
            status: 'SUCCESS',
            message: 'تم تحديث اسم المستخدم بنجاح',
            data: { username }
        });
    } catch (error: any) {
        logger.error('Update username error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
});

/**
 * POST /api/profile/:username/view
 * Increment profile view count
 */
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
            res.json({ status: 'SUCCESS', message: 'Self view not counted' });
            return;
        }

        await prisma.user.update({
            where: { username },
            data: { profileViews: { increment: 1 } }
        });

        res.json({ status: 'SUCCESS' });
    } catch (error: any) {
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
});

// Simple in-memory cache for analytics (5 minutes TTL)
const analyticsCache = new Map<string, { data: any; timestamp: number }>();
const ANALYTICS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * GET /api/profile/analytics
 * Get current user's analytics - SUPER OPTIMIZED with caching
 */
router.get('/analytics', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;
        if (!clerkUserId) {
            res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
            return;
        }

        // Check cache first
        const cached = analyticsCache.get(clerkUserId);
        if (cached && Date.now() - cached.timestamp < ANALYTICS_CACHE_TTL) {
            res.json({ status: 'SUCCESS', data: cached.data });
            return;
        }

        // Single optimized query to get all analytics at once
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
                reels: {
                    select: {
                        views: true,
                        _count: {
                            select: {
                                likes: true,
                                comments: true,
                            }
                        }
                    }
                }
            }
        });

        if (!user) {
            res.status(404).json({ status: 'ERROR', message: 'User not found' });
            return;
        }

        // Calculate totals from the single query result
        let totalLikes = 0;
        let totalViews = 0;
        let totalComments = 0;
        
        for (const reel of user.reels) {
            totalViews += reel.views;
            totalLikes += reel._count.likes;
            totalComments += reel._count.comments;
        }

        // Only this needs a separate query (recent followers)
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        
        const recentFollowers = await prisma.follow.count({
            where: {
                followingId: user.id,
                createdAt: { gte: weekAgo }
            }
        });

        const analyticsData = {
            profileViews: user.profileViews,
            followersCount: user._count.followers,
            followingCount: user._count.following,
            reelsCount: user._count.reels,
            totalLikes,
            totalViews,
            totalComments,
            recentFollowers,
            memberSince: user.createdAt,
        };

        // Save to cache
        analyticsCache.set(clerkUserId, { data: analyticsData, timestamp: Date.now() });

        res.json({ status: 'SUCCESS', data: analyticsData });
    } catch (error: any) {
        logger.error('Get analytics error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
});

/**
 * GET /api/profile/cooldowns
 * Get remaining cooldowns for avatar, cover, reel upload, and delete limits
 * Requirements: 13.4, 13.5, 13.6, 13.7
 */
router.get('/cooldowns', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;
        if (!clerkUserId) {
            res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
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
            res.status(404).json({ status: 'ERROR', message: 'User not found' });
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
            status: 'SUCCESS',
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
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
});

/**
 * GET /api/profile/:username
 * Get profile by username
 * MUST be last to avoid matching /analytics, /cooldowns, etc.
 */
router.get('/:username', requireAuth, ProfileController.getProfileByUsername);

export default router;
