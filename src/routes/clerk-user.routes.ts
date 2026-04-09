import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/clerk.middleware';
import { ClerkUserService } from '../services/clerk-user.service';
import { ProfileCompletionService } from '../services/profile-completion.service';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { WebSocketService } from '../services/websocket.service';
import { userSyncLimiter } from '../middleware/rateLimit.middleware';
import { clearResponseCache, responseCacheMiddleware } from '../middleware/responseCache.middleware';
import { enqueueSocialNotification } from '../queues/notification.queue';
import { getOrSetWithLock } from '../lib/cache-mutex';

const router = Router();

// Helper function to ensure string from params (handles string | string[])
function ensureString(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0] || '';
  return param || '';
}

// Simple in-memory cache for user profiles (5 minutes TTL - increased for better performance)
const userCache = new Map<string, { data: any; timestamp: number }>();
const USER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Helper to invalidate user cache
export const invalidateUserCache = (clerkUserId: string) => {
    userCache.delete(clerkUserId);
    // Also clear response cache for endpoints that are cached by auth userId
    // (req.path is used in cache key, so patterns must match path-only)
    clearResponseCache('/me').catch(() => {});
    clearResponseCache('/stats').catch(() => {});
};

/**
 * GET /api/clerk/me
 * Get current user profile (protected) - WITH CACHING
 * Uses userSyncLimiter for more lenient rate limiting
 */
router.get(
  '/me',
  requireAuth,
  userSyncLimiter,
  responseCacheMiddleware({ ttl: 60 * 1000 }),
  async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;

        if (!clerkUserId) {
            logger.warn('[/clerk/me] ⚠️ No clerkUserId in request');
            res.status(401).json({
                status: 'ERROR',
                message: 'Unauthorized',
                code: 'E002',
            });
            return;
        }

        logger.info(`[/clerk/me] 🔄 Fetching user data for: ${clerkUserId}`);

        // Check cache first
        const cached = userCache.get(clerkUserId);
        if (cached && Date.now() - cached.timestamp < USER_CACHE_TTL) {
            logger.info(`[/clerk/me] ⚡ Returning cached data for: ${clerkUserId}`);
            res.json({ status: 'SUCCESS', data: { user: cached.data } });
            return;
        }

        logger.info(`[/clerk/me] 📡 Cache miss, fetching from database for: ${clerkUserId}`);

        // Find or create user in our database with better error handling and retry logic
        let user;
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
            try {
                user = await ClerkUserService.findOrCreateUser(clerkUserId);
                if (user) break; // Success, exit retry loop
                
                // If user is null but no error thrown, retry
                retryCount++;
                if (retryCount < maxRetries) {
                    logger.warn(`[/clerk/me] ⚠️ User creation returned null, retrying (${retryCount}/${maxRetries})...`);
                    await new Promise(resolve => setTimeout(resolve, 500 * retryCount)); // Exponential backoff
                }
            } catch (dbError: any) {
                retryCount++;
                logger.error(`[/clerk/me] ❌ Database error for ${clerkUserId} (attempt ${retryCount}/${maxRetries}):`, {
                    error: dbError.message,
                    code: dbError.code,
                    stack: dbError.stack?.split('\n').slice(0, 3).join('\n'), // First 3 lines of stack
                });
                
                // If last retry, return error
                if (retryCount >= maxRetries) {
                    res.status(500).json({
                        status: 'ERROR',
                        message: 'Database error while loading user. Please try again.',
                        code: 'E009',
                        details: process.env.NODE_ENV === 'development' ? dbError.message : undefined,
                    });
                    return;
                }
                
                // Wait before retry with exponential backoff
                await new Promise(resolve => setTimeout(resolve, 500 * retryCount));
            }
        }

        if (!user) {
            logger.error(`[/clerk/me] ❌ Failed to find or create user after ${maxRetries} attempts: ${clerkUserId}`);
            res.status(500).json({
                status: 'ERROR',
                message: 'Failed to load user profile. Please try logging out and back in.',
                code: 'E009',
            });
            return;
        }

        logger.info(`[/clerk/me] ✅ User data loaded: ${user.username} (${user.id})`);

        const userData = {
            id: user.id,
            clerkUserId: user.clerkUserId,
            email: user.email,
            username: user.username,
            displayName: user.displayName,
            avatar: user.avatar,
            coverImage: user.coverImage,
            bio: user.bio,
            coins: user.coins,
            level: user.level,
            xp: user.xp,
            isVerified: user.isVerified,
            isDeveloper: user.isDeveloper,
            favoriteTeam: user.favoriteTeam,
            position: user.position,
            countryFlag: user.countryFlag,
            country: user.country,
            age: user.age,
            height: user.height,
            weight: user.weight,
            preferredFoot: user.preferredFoot,
            clubLogo: user.clubLogo,
            brandLogo: user.brandLogo,
            socialLinks: (user as any).socialLinks || [],
            consecutiveLoginDays: (user as any).consecutiveLoginDays || 0,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        };

        // Save to cache
        userCache.set(clerkUserId, { data: userData, timestamp: Date.now() });

        logger.info(`[/clerk/me] ✅ Returning user data for: ${user.username}`);
        res.json({ status: 'SUCCESS', data: { user: userData } });
    } catch (error: any) {
        logger.error('[/clerk/me] ❌ Unexpected error:', error);
        res.status(500).json({
            status: 'ERROR',
            message: 'Internal server error',
            code: 'E010',
        });
    }
});

/**
 * PUT /api/clerk/profile
 * Update user profile (protected)
 */
router.put('/profile', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;

        if (!clerkUserId) {
            res.status(401).json({
                status: 'ERROR',
                message: 'Unauthorized',
            });
            return;
        }

        const { username, displayName, bio, favoriteTeam } = req.body;

        // Validate username if provided
        if (username) {
            const usernameRegex = /^[a-z0-9_]+$/;
            if (!usernameRegex.test(username)) {
                res.status(400).json({
                    status: 'ERROR',
                    message: 'Username must contain only lowercase letters, numbers, and underscore',
                });
                return;
            }

            // Check if username is taken
            const existingUser = await ClerkUserService.getUserByClerkId(clerkUserId);
            if (existingUser && existingUser.username !== username) {
                // Check 15-day restriction for username changes
                if (existingUser.lastUsernameChange) {
                    const daysSinceLastChange = Math.floor(
                        (Date.now() - existingUser.lastUsernameChange.getTime()) / (1000 * 60 * 60 * 24)
                    );
                    
                    if (daysSinceLastChange < 15) {
                        const daysRemaining = 15 - daysSinceLastChange;
                        res.status(400).json({
                            status: 'ERROR',
                            message: `يمكنك تغيير اسم المستخدم بعد ${daysRemaining} يوم`,
                            code: 'USERNAME_CHANGE_RESTRICTED',
                            data: {
                                daysRemaining,
                                nextAllowedChange: new Date(existingUser.lastUsernameChange.getTime() + (15 * 24 * 60 * 60 * 1000))
                            }
                        });
                        return;
                    }
                }

                const userWithUsername = await prisma.user.findUnique({
                    where: { username },
                });
                if (userWithUsername) {
                    res.status(400).json({
                        status: 'ERROR',
                        message: 'Username already taken',
                    });
                    return;
                }
            }
        }

        // Update user
        const user = await ClerkUserService.updateUser(clerkUserId, {
            username,
            displayName,
            bio,
            favoriteTeam,
        });

        // Invalidate cache so /me returns fresh data
        invalidateUserCache(clerkUserId);
        
        // ✅ CRITICAL: Recalculate profile completion after profile update
        try {
          await ProfileCompletionService.getCompletionStatus(clerkUserId);
          logger.info('✅ Profile completion recalculated after profile update');
        } catch (err) {
          logger.error('Failed to recalculate profile completion:', err);
        }

        res.json({
            status: 'SUCCESS',
            message: 'Profile updated successfully',
            data: { user },
        });
    } catch (error: any) {
        logger.error('Update profile error:', error);
        res.status(500).json({
            status: 'ERROR',
            message: error.message || 'Internal server error',
        });
    }
});

/**
 * POST /api/clerk/preferences
 * Save user onboarding preferences (protected)
 */
router.post('/preferences', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;

        if (!clerkUserId) {
            res.status(401).json({
                status: 'ERROR',
                message: 'Unauthorized',
            });
            return;
        }

        const { favoriteTeam, favoriteBrand, country, favoriteLeagues, clubLogo, brandLogo, countryFlag } = req.body;

        // Update user preferences
        const user = await prisma.user.update({
            where: { clerkUserId },
            data: {
                favoriteTeam,
                favoriteBrand,
                country,
                favoriteLeagues: favoriteLeagues || [],
                // Save logos for profile card
                clubLogo: clubLogo || undefined,
                brandLogo: brandLogo || undefined,
                countryFlag: countryFlag || undefined,
            },
        });

        // Invalidate cache
        invalidateUserCache(clerkUserId);
        
        // ✅ CRITICAL: Recalculate profile completion after preferences update
        try {
          await ProfileCompletionService.getCompletionStatus(clerkUserId);
          logger.info('✅ Profile completion recalculated after preferences update');
        } catch (err) {
          logger.error('Failed to recalculate profile completion:', err);
        }

        logger.info('✅ User preferences saved:', clerkUserId);

        res.json({
            status: 'SUCCESS',
            message: 'Preferences saved successfully',
            data: { user },
        });
    } catch (error: any) {
        logger.error('Save preferences error:', error);
        res.status(500).json({
            status: 'ERROR',
            message: error.message || 'Internal server error',
        });
    }
});

/**
 * PUT /api/clerk/card-profile
 * Update FIFA card profile fields (protected)
 */
router.put('/card-profile', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;

        if (!clerkUserId) {
            res.status(401).json({
                status: 'ERROR',
                message: 'Unauthorized',
            });
            return;
        }

        const { position, countryFlag, age, height, weight, preferredFoot, clubLogo, brandLogo, favoriteTeam, country } = req.body;

        // Validate fields
        const validPositions = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST', 'CF'];
        if (position && !validPositions.includes(position)) {
            res.status(400).json({
                status: 'ERROR',
                message: 'Invalid position',
            });
            return;
        }

        const validFeet = ['R', 'L', 'B'];
        if (preferredFoot && !validFeet.includes(preferredFoot)) {
            res.status(400).json({
                status: 'ERROR',
                message: 'Invalid preferred foot (R, L, or B)',
            });
            return;
        }

        // Update user card profile
        const user = await prisma.user.update({
            where: { clerkUserId },
            data: {
                position: position || undefined,
                countryFlag: countryFlag || undefined,
                country: country || undefined, // ✅ NEW
                age: age ? parseInt(age) : undefined,
                height: height ? parseInt(height) : undefined,
                weight: weight ? parseInt(weight) : undefined,
                preferredFoot: preferredFoot || undefined,
                clubLogo: clubLogo || undefined,
                brandLogo: brandLogo || undefined,
                favoriteTeam: favoriteTeam || undefined,
            },
            select: {
                position: true,
                countryFlag: true,
                country: true, // ✅ NEW
                age: true,
                height: true,
                weight: true,
                preferredFoot: true,
                clubLogo: true,
                brandLogo: true,
                favoriteTeam: true,
            },
        });

        // ✅ Invalidate Backend Cache to force refresh on next request
        invalidateUserCache(clerkUserId);
        
        // ✅ CRITICAL: Invalidate profile completion cache to force recalculation
        try {
          await ProfileCompletionService.getCompletionStatus(clerkUserId);
          logger.info('✅ Profile completion recalculated after card profile update');
        } catch (err) {
          logger.error('Failed to recalculate profile completion:', err);
        }

        res.json({
            status: 'SUCCESS',
            message: 'Card profile updated successfully',
            data: { cardProfile: user },
        });
    } catch (error: any) {
        logger.error('Update card profile error:', error);
        res.status(500).json({
            status: 'ERROR',
            message: error.message || 'Internal server error',
        });
    }
});

/**
 * POST /api/clerk/sync
 * Sync user data from Clerk (protected)
 */
router.post('/sync', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;

        if (!clerkUserId) {
            res.status(401).json({
                status: 'ERROR',
                message: 'Unauthorized',
            });
            return;
        }

        const user = await ClerkUserService.syncUserFromClerk(clerkUserId);

        res.json({
            status: 'SUCCESS',
            message: 'User synced successfully',
            data: { user },
        });
    } catch (error: any) {
        logger.error('Sync user error:', error);
        res.status(500).json({
            status: 'ERROR',
            message: error.message || 'Internal server error',
        });
    }
});

// Search cache (2 minutes TTL)
const SEARCH_CACHE_TTL_BACKEND = 2 * 60 * 1000;

/**
 * GET /api/clerk/search
 * Search users by username or displayName (protected) - WITH CACHING
 */
router.get('/search', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const { q, limit = '10', offset = '0' } = req.query;
        const rawQuery = (q as string || '');
        const sanitized = rawQuery
            .trim()
            .toLowerCase()
            .replace(/[%_\\]/g, '\\$&')
            .replace(/'/g, "''");

        const searchLimit = Math.min(parseInt(limit as string) || 10, 20);
        const searchOffset = Math.max(parseInt(offset as string) || 0, 0);

        if (!sanitized || sanitized.length < 2) {
            res.status(400).json({ status: 'ERROR', error: 'Search query too short' });
            return;
        }

        const cacheKey = `search:${sanitized}:${searchLimit}:${searchOffset}`;
        const responseData = await getOrSetWithLock(cacheKey, async () => {
            // Search by username and displayName (case-insensitive)
            const users = await prisma.user.findMany({
                where: {
                    OR: [
                        { username: { contains: sanitized, mode: 'insensitive' } },
                        { displayName: { contains: sanitized, mode: 'insensitive' } },
                    ],
                },
                select: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatar: true,
                    bio: true,
                    isVerified: true,
                    isDeveloper: true,
                    level: true,
                    favoriteTeam: true,
                },
                take: searchLimit * 2,
                skip: searchOffset,
            });

            const searchQueryLower = sanitized.toLowerCase();
            const rankedUsers = users
                .map((user: any) => {
                    const usernameLower = (user.username || '').toLowerCase();
                    const displayNameLower = (user.displayName || '').toLowerCase();

                    let score = 0;

                    if (usernameLower === searchQueryLower) score += 1000;
                    else if (usernameLower.startsWith(searchQueryLower)) score += 500;
                    else if (usernameLower.includes(searchQueryLower)) score += 200;

                    if (displayNameLower === searchQueryLower) score += 800;
                    else if (displayNameLower.startsWith(searchQueryLower)) score += 400;
                    else if (displayNameLower.includes(searchQueryLower)) score += 150;

                    if (user.isVerified) score += 100;
                    score += user.level || 0;

                    return { ...user, _relevanceScore: score };
                })
                .sort((a: any, b: any) => {
                    if (b._relevanceScore !== a._relevanceScore) return b._relevanceScore - a._relevanceScore;
                    if (b.isVerified !== a.isVerified) return b.isVerified ? 1 : -1;
                    return (b.level || 0) - (a.level || 0);
                })
                .slice(0, searchLimit)
                .map(({ _relevanceScore, ...user }: any) => user);

            return {
                status: 'SUCCESS',
                data: { users: rankedUsers },
            };
        }, SEARCH_CACHE_TTL_BACKEND);

        res.json(responseData);
    } catch (error: any) {
        logger.error('Search users error:', error);
        res.status(500).json({
            status: 'ERROR',
            message: error.message || 'Internal server error',
        });
    }
});

/**
 * GET /api/clerk/user/:username
 * Get public profile by username (protected)
 */
router.get('/user/:username', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const username = ensureString(req.params.username);
        const currentClerkUserId = req.auth?.userId;

        logger.info(`[/clerk/user/:username] 🔍 Fetching profile for: ${username}`);

        if (!username) {
            logger.warn('[/clerk/user/:username] ⚠️ No username provided');
            res.status(400).json({
                status: 'ERROR',
                message: 'Username is required',
                code: 'E001',
            });
            return;
        }

        const user = await prisma.user.findUnique({
            where: { username },
            select: {
                id: true,
                username: true,
                displayName: true,
                avatar: true,
                bio: true,
                isVerified: true,
                isDeveloper: true,
                level: true,
                favoriteTeam: true,
                createdAt: true,
                position: true,
                countryFlag: true,
                country: true,
                age: true,
                height: true,
                weight: true,
                preferredFoot: true,
                clubLogo: true,
                brandLogo: true,
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
            logger.warn(`[/clerk/user/:username] ⚠️ User not found: ${username}`);
            res.status(404).json({
                status: 'ERROR',
                message: 'User not found',
                code: 'E004',
            });
            return;
        }

        logger.info(`[/clerk/user/:username] ✅ User found: ${user.username} (${user.id})`);

        // Check if current user is following this user AND if this user is following current user
        let isFollowing = false;
        let isFollowingMe = false;
        if (currentClerkUserId) {
            const currentUser = await prisma.user.findUnique({
                where: { clerkUserId: currentClerkUserId },
                select: { id: true },
            });
            if (currentUser) {
                // Check if I'm following them
                const follow = await prisma.follow.findUnique({
                    where: {
                        followerId_followingId: {
                            followerId: currentUser.id,
                            followingId: user.id,
                        },
                    },
                });
                isFollowing = !!follow;
                
                // Check if they're following me (for "Follow Back" button)
                const followBack = await prisma.follow.findUnique({
                    where: {
                        followerId_followingId: {
                            followerId: user.id,
                            followingId: currentUser.id,
                        },
                    },
                });
                isFollowingMe = !!followBack;
            }
        }

        logger.info(`[/clerk/user/:username] ✅ Returning profile data for: ${username}`);
        res.json({
            status: 'SUCCESS',
            data: {
                user: {
                    ...user,
                    socialLinks: (user.socialLinks as any) || [],
                    country: user.country || null,
                    followersCount: user._count.followers,
                    followingCount: user._count.following,
                    reelsCount: user._count.reels,
                    isFollowing,
                    isFollowingMe,
                },
            },
        });
    } catch (error: any) {
        logger.error('[/clerk/user/:username] ❌ Error:', error);
        res.status(500).json({
            status: 'ERROR',
            message: 'Internal server error',
            code: 'E010',
        });
    }
});

/**
 * POST /api/clerk/follow/:username
 * Follow a user (protected)
 */
router.post('/follow/:username', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const username = ensureString(req.params.username);
        const clerkUserId = req.auth?.userId;

        if (!clerkUserId) {
            res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
            return;
        }

        // Get current user
        const currentUser = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true, username: true, displayName: true, avatar: true },
        });

        if (!currentUser) {
            res.status(404).json({ status: 'ERROR', message: 'User not found' });
            return;
        }

        // Get target user
        const targetUser = await prisma.user.findUnique({
            where: { username },
            select: { id: true, username: true },
        });

        if (!targetUser) {
            res.status(404).json({ status: 'ERROR', message: 'Target user not found' });
            return;
        }

        // Can't follow yourself
        if (currentUser.id === targetUser.id) {
            res.status(400).json({ status: 'ERROR', message: 'Cannot follow yourself' });
            return;
        }

        await prisma.$transaction(async (tx) => {
            // Following limit guard
            const followingCount = await tx.follow.count({
                where: { followerId: currentUser.id },
            });
            if (followingCount >= 5000) {
                const err: any = new Error('FOLLOWING_LIMIT_REACHED');
                err.statusCode = 400;
                throw err;
            }

            // Check if already following
            const existingFollow = await tx.follow.findUnique({
                where: {
                    followerId_followingId: {
                        followerId: currentUser.id,
                        followingId: targetUser.id,
                    },
                },
            });

            if (existingFollow) {
                const err: any = new Error('ALREADY_FOLLOWING');
                err.statusCode = 400;
                throw err;
            }

            await tx.follow.create({
                data: {
                    followerId: currentUser.id,
                    followingId: targetUser.id,
                },
            });
        });

        // Create notification asynchronously (off request path)
        await enqueueSocialNotification({
            userId: targetUser.id,
            actorId: currentUser.id,
            title: 'متابع جديد',
            message: `${currentUser.displayName || currentUser.username} بدأ متابعتك`,
            type: 'FOLLOW',
            data: { followerId: currentUser.id },
        });

        // Send WebSocket follow event (Requirements: 21.4)
        WebSocketService.sendFollowUpdate(targetUser.id, {
            followerId: currentUser.id,
            followingId: targetUser.id,
            followerUsername: currentUser.username,
            action: 'follow',
        });

        // Get updated counts
        const counts = await prisma.user.findUnique({
            where: { id: targetUser.id },
            select: {
                _count: {
                    select: { followers: true, following: true },
                },
            },
        });

        res.json({
            status: 'SUCCESS',
            message: 'Followed successfully',
            data: {
                followersCount: counts?._count.followers || 0,
                followingCount: counts?._count.following || 0,
            },
        });
    } catch (error: any) {
        logger.error('Follow error:', error);
        if (error?.message === 'FOLLOWING_LIMIT_REACHED') {
            res.status(400).json({ status: 'ERROR', message: 'FOLLOWING_LIMIT_REACHED' });
            return;
        }
        if (error?.message === 'ALREADY_FOLLOWING') {
            res.status(400).json({ status: 'ERROR', message: 'Already following this user' });
            return;
        }
        res.status(500).json({ status: 'ERROR', message: error.message || 'Internal server error' });
    }
});

/**
 * DELETE /api/clerk/follow/:username
 * Unfollow a user (protected)
 */
router.delete('/follow/:username', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const username = ensureString(req.params.username);
        const clerkUserId = req.auth?.userId;

        if (!clerkUserId) {
            res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
            return;
        }

        // Get current user
        const currentUser = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true },
        });

        if (!currentUser) {
            res.status(404).json({ status: 'ERROR', message: 'User not found' });
            return;
        }

        // Get target user
        const targetUser = await prisma.user.findUnique({
            where: { username },
            select: { id: true },
        });

        if (!targetUser) {
            res.status(404).json({ status: 'ERROR', message: 'Target user not found' });
            return;
        }

        // Get current user's username for WebSocket event
        const currentUserWithUsername = await prisma.user.findUnique({
            where: { id: currentUser.id },
            select: { username: true },
        });

        // Delete follow relationship
        await prisma.follow.deleteMany({
            where: {
                followerId: currentUser.id,
                followingId: targetUser.id,
            },
        });

        // Send WebSocket unfollow event (Requirements: 21.4)
        WebSocketService.sendFollowUpdate(targetUser.id, {
            followerId: currentUser.id,
            followingId: targetUser.id,
            followerUsername: currentUserWithUsername?.username || '',
            action: 'unfollow',
        });

        // Get updated counts
        const counts = await prisma.user.findUnique({
            where: { id: targetUser.id },
            select: {
                _count: {
                    select: { followers: true, following: true },
                },
            },
        });

        res.json({
            status: 'SUCCESS',
            message: 'Unfollowed successfully',
            data: {
                followersCount: counts?._count.followers || 0,
                followingCount: counts?._count.following || 0,
            },
        });
    } catch (error: any) {
        logger.error('Unfollow error:', error);
        res.status(500).json({
            status: 'ERROR',
            message: error.message || 'Internal server error',
        });
    }
});

/**
 * GET /api/clerk/user/:username/reels
 * Get user's reels/videos by username (protected)
 */
router.get('/user/:username/reels', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const username = ensureString(req.params.username);
        const { limit = '20', offset = '0' } = req.query;

        logger.info(`[GET /user/:username/reels] 🔍 Request for username: ${username}, limit: ${limit}, offset: ${offset}`);

        if (!username) {
            logger.warn('[GET /user/:username/reels] ⚠️ No username provided');
            res.status(400).json({
                status: 'ERROR',
                message: 'Username is required',
            });
            return;
        }

        // Find user by username
        const user = await prisma.user.findUnique({
            where: { username },
            select: { id: true },
        });

        if (!user) {
            res.status(404).json({
                status: 'ERROR',
                message: 'User not found',
            });
            return;
        }

        // Get user's reels
        const reels = await prisma.reel.findMany({
            where: { userId: user.id },
            select: {
                id: true,
                videoUrl: true,
                thumbnail: true,
                caption: true,
                views: true,
                createdAt: true,
                _count: {
                    select: {
                        likes: true,
                        comments: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            take: parseInt(limit as string),
            skip: parseInt(offset as string),
        });

        // Format response
        const formattedReels = reels.map((reel: any) => ({
            id: reel.id,
            uri: reel.videoUrl,
            thumbnail: reel.thumbnail,
            caption: reel.caption,
            views: reel.views.toString(),
            likes: reel._count.likes,
            comments: reel._count.comments,
            createdAt: reel.createdAt,
        }));

        res.json({
            status: 'SUCCESS',
            data: { reels: formattedReels },
        });
    } catch (error: any) {
        logger.error('Get user reels error:', error);
        res.status(500).json({
            status: 'ERROR',
            message: error.message || 'Internal server error',
        });
    }
});

/**
 * GET /api/clerk/stats
 * Get current user's follow stats (protected)
 */
router.get('/stats', requireAuth, responseCacheMiddleware({ ttl: 60 * 1000 }), async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;

        if (!clerkUserId) {
            res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
            return;
        }

        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: {
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
                followersCount: user._count.followers,
                followingCount: user._count.following,
                reelsCount: user._count.reels,
            },
        });
    } catch (error: any) {
        logger.error('Get stats error:', error);
        res.status(500).json({
            status: 'ERROR',
            message: error.message || 'Internal server error',
        });
    }
});

/**
 * GET /api/clerk/followers/:userId
 * Get followers list for a user (protected)
 */
router.get('/followers/:userId', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = ensureString(req.params.userId);
        const clerkUserId = req.auth?.userId;

        if (!userId) {
            res.status(400).json({ status: 'ERROR', message: 'User ID is required' });
            return;
        }

        // Get current user to check follow status
        const currentUser = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true },
        });

        // Get followers with their details
        const followers = await prisma.follow.findMany({
            where: { followingId: userId },
            select: {
                follower: {
                    select: {
                        id: true,
                        username: true,
                        displayName: true,
                        avatar: true,
                        isVerified: true,
                        isDeveloper: true,
                        position: true,
                        countryFlag: true,
                        clubLogo: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });

        // Check if current user is following each follower
        const followerIds = followers.map((f: any) => f.follower.id);
        const myFollows = currentUser ? await prisma.follow.findMany({
            where: {
                followerId: currentUser.id,
                followingId: { in: followerIds },
            },
            select: { followingId: true },
        }) : [];
        const myFollowingSet = new Set(myFollows.map((f: any) => f.followingId));

        const formattedFollowers = followers.map((f: any) => ({
            id: f.follower.id,
            username: f.follower.username,
            displayName: f.follower.displayName,
            avatar: f.follower.avatar,
            isVerified: f.follower.isVerified,
            isDeveloper: f.follower.isDeveloper,
            position: f.follower.position,
            countryFlag: f.follower.countryFlag,
            clubLogo: f.follower.clubLogo,
            isFollowing: myFollowingSet.has(f.follower.id),
        }));

        res.json({
            status: 'SUCCESS',
            data: { followers: formattedFollowers },
        });
    } catch (error: any) {
        logger.error('Get followers error:', error);
        res.status(500).json({
            status: 'ERROR',
            message: error.message || 'Internal server error',
        });
    }
});

/**
 * GET /api/clerk/following/:userId
 * Get following list for a user (protected)
 */
router.get('/following/:userId', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = ensureString(req.params.userId);
        const clerkUserId = req.auth?.userId;

        if (!userId) {
            res.status(400).json({ status: 'ERROR', message: 'User ID is required' });
            return;
        }

        // Get current user to check follow status
        const currentUser = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true },
        });

        // Get following with their details
        const following = await prisma.follow.findMany({
            where: { followerId: userId },
            select: {
                following: {
                    select: {
                        id: true,
                        username: true,
                        displayName: true,
                        avatar: true,
                        isVerified: true,
                        isDeveloper: true,
                        position: true,
                        countryFlag: true,
                        clubLogo: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });

        // Check if current user is following each user
        const followingIds = following.map((f: any) => f.following.id);
        const myFollows = currentUser ? await prisma.follow.findMany({
            where: {
                followerId: currentUser.id,
                followingId: { in: followingIds },
            },
            select: { followingId: true },
        }) : [];
        const myFollowingSet = new Set(myFollows.map((f: any) => f.followingId));

        const formattedFollowing = following.map((f: any) => ({
            id: f.following.id,
            username: f.following.username,
            displayName: f.following.displayName,
            avatar: f.following.avatar,
            isVerified: f.following.isVerified,
            isDeveloper: f.following.isDeveloper,
            position: f.following.position,
            countryFlag: f.following.countryFlag,
            clubLogo: f.following.clubLogo,
            isFollowing: myFollowingSet.has(f.following.id),
        }));

        res.json({
            status: 'SUCCESS',
            data: { following: formattedFollowing },
        });
    } catch (error: any) {
        logger.error('Get following error:', error);
        res.status(500).json({
            status: 'ERROR',
            message: error.message || 'Internal server error',
        });
    }
});

/**
 * POST /api/clerk/follow/id/:userId
 * Follow a user by ID (protected)
 */
router.post('/follow/id/:userId', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const targetUserId = ensureString(req.params.userId);
        const clerkUserId = req.auth?.userId;

        if (!clerkUserId) {
            res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
            return;
        }

        // Get current user
        const currentUser = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true, username: true, displayName: true, avatar: true },
        });

        if (!currentUser) {
            res.status(404).json({ status: 'ERROR', message: 'User not found' });
            return;
        }

        // Can't follow yourself
        if (currentUser.id === targetUserId) {
            res.status(400).json({ status: 'ERROR', message: 'Cannot follow yourself' });
            return;
        }

        // Check if target user exists
        const targetUser = await prisma.user.findUnique({
            where: { id: targetUserId },
            select: { id: true, username: true },
        });

        if (!targetUser) {
            res.status(404).json({ status: 'ERROR', message: 'Target user not found' });
            return;
        }

        await prisma.$transaction(async (tx) => {
            const followingCount = await tx.follow.count({
                where: { followerId: currentUser.id },
            });
            if (followingCount >= 5000) {
                const err: any = new Error('FOLLOWING_LIMIT_REACHED');
                err.statusCode = 400;
                throw err;
            }

            const existingFollow = await tx.follow.findUnique({
                where: {
                    followerId_followingId: {
                        followerId: currentUser.id,
                        followingId: targetUserId,
                    },
                },
            });

            if (existingFollow) {
                const err: any = new Error('ALREADY_FOLLOWING');
                err.statusCode = 400;
                throw err;
            }

            await tx.follow.create({
                data: {
                    followerId: currentUser.id,
                    followingId: targetUserId,
                },
            });
        });

        await enqueueSocialNotification({
            userId: targetUserId,
            actorId: currentUser.id,
            title: 'متابع جديد',
            message: `${currentUser.displayName || currentUser.username} بدأ متابعتك`,
            type: 'FOLLOW',
            data: { followerId: currentUser.id },
        });

        res.json({
            status: 'SUCCESS',
            message: 'Followed successfully',
        });
    } catch (error: any) {
        logger.error('Follow by ID error:', error);
        if (error?.message === 'FOLLOWING_LIMIT_REACHED') {
            res.status(400).json({ status: 'ERROR', message: 'FOLLOWING_LIMIT_REACHED' });
            return;
        }
        if (error?.message === 'ALREADY_FOLLOWING') {
            res.status(400).json({ status: 'ERROR', message: 'Already following this user' });
            return;
        }
        res.status(500).json({ status: 'ERROR', message: error.message || 'Internal server error' });
    }
});

/**
 * DELETE /api/clerk/follow/id/:userId
 * Unfollow a user by ID (protected)
 */
router.delete('/follow/id/:userId', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const targetUserId = ensureString(req.params.userId);
        const clerkUserId = req.auth?.userId;

        if (!clerkUserId) {
            res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
            return;
        }

        // Get current user
        const currentUser = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true },
        });

        if (!currentUser) {
            res.status(404).json({ status: 'ERROR', message: 'User not found' });
            return;
        }

        // Delete follow relationship
        await prisma.follow.deleteMany({
            where: {
                followerId: currentUser.id,
                followingId: targetUserId,
            },
        });

        res.json({
            status: 'SUCCESS',
            message: 'Unfollowed successfully',
        });
    } catch (error: any) {
        logger.error('Unfollow by ID error:', error);
        res.status(500).json({
            status: 'ERROR',
            message: error.message || 'Internal server error',
        });
    }
});

/**
 * PUT /api/clerk/social-links
 * Update user's social media links (protected)
 */
router.put('/social-links', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;
        const { socialLinks } = req.body;

        if (!clerkUserId) {
            res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
            return;
        }

        // Validate social links array
        if (!Array.isArray(socialLinks)) {
            res.status(400).json({ status: 'ERROR', message: 'Social links must be an array' });
            return;
        }

        // Validate max 5 links
        if (socialLinks.length > 5) {
            res.status(400).json({ status: 'ERROR', message: 'Maximum 5 social links allowed' });
            return;
        }

        // Validate and normalize each link
        const validLinks = [];
        const allowedPlatforms = ['instagram', 'twitter', 'facebook', 'youtube', 'tiktok', 'website', 'linkedin', 'snapchat'];
        
        for (const link of socialLinks) {
            if (!link || typeof link !== 'object') {
                continue;
            }

            const platform = link.platform?.toLowerCase();
            const url = link.url?.trim();

            // Skip empty links
            if (!url || url === '') {
                continue;
            }

            // Validate platform
            if (!platform || !allowedPlatforms.includes(platform)) {
                logger.warn(`Invalid platform: ${platform}, defaulting to website`);
                link.platform = 'website';
            } else {
                link.platform = platform;
            }

            // Normalize URL - ensure it starts with http:// or https://
            let normalizedUrl = url;
            if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
                normalizedUrl = `https://${normalizedUrl}`;
            }

            validLinks.push({
                platform: link.platform,
                url: normalizedUrl,
                username: link.username || undefined,
            });
        }

        // Update user's social links
        const user = await prisma.user.update({
            where: { clerkUserId },
            data: { socialLinks: validLinks } as any,
        });

        // Invalidate cache
        invalidateUserCache(clerkUserId);
        
        // ✅ CRITICAL: Recalculate profile completion after social links update
        try {
          await ProfileCompletionService.getCompletionStatus(clerkUserId);
          logger.info('✅ Profile completion recalculated after social links update');
        } catch (err) {
          logger.error('Failed to recalculate profile completion:', err);
        }

        res.json({
            status: 'SUCCESS',
            message: 'Social links updated successfully',
            data: { socialLinks: (user as any).socialLinks || [] },
        });
    } catch (error: any) {
        logger.error('Update social links error:', error);
        res.status(500).json({
            status: 'ERROR',
            message: error.message || 'Internal server error',
        });
    }
});

/**
 * GET /api/clerk/username-change-status
 * Check if user can change username (15-day restriction)
 */
router.get('/username-change-status', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;

        if (!clerkUserId) {
            res.status(401).json({
                status: 'ERROR',
                message: 'Unauthorized',
                code: 'E002',
            });
            return;
        }

        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { lastUsernameChange: true }
        });

        if (!user) {
            res.status(404).json({
                status: 'ERROR',
                message: 'User not found',
                code: 'E004',
            });
            return;
        }

        const now = new Date();
        const lastChange = user.lastUsernameChange;
        
        // If never changed, allow change
        if (!lastChange) {
            res.json({
                status: 'SUCCESS',
                data: {
                    canChange: true,
                    lastChange: null,
                    nextAllowedChange: null
                }
            });
            return;
        }

        // Check if 15 days have passed
        const daysSinceLastChange = Math.floor((now.getTime() - lastChange.getTime()) / (1000 * 60 * 60 * 24));
        const canChange = daysSinceLastChange >= 15;
        
        const nextAllowedChange = new Date(lastChange.getTime() + (15 * 24 * 60 * 60 * 1000));

        res.json({
            status: 'SUCCESS',
            data: {
                canChange,
                lastChange: lastChange.toISOString(),
                nextAllowedChange: nextAllowedChange.toISOString(),
                daysRemaining: canChange ? 0 : 15 - daysSinceLastChange
            }
        });

    } catch (error) {
        logger.error('[/clerk/username-change-status] Error:', error);
        res.status(500).json({
            status: 'ERROR',
            message: 'Internal server error',
            code: 'E010',
        });
    }
});

/**
 * GET /api/clerk/user
 * Get current authenticated user (protected)
 */
router.get('/user', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;
        
        if (!clerkUserId) {
            res.status(401).json({
                status: 'ERROR',
                message: 'Unauthorized'
            });
            return;
        }
        
        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: {
                id: true,
                clerkUserId: true,
                username: true,
                displayName: true,
                email: true,
                avatar: true,
                bio: true,
                isVerified: true,
                isDeveloper: true,
                coins: true,
                level: true,
                xp: true,
                createdAt: true,
            }
        });
        
        if (!user) {
            res.status(404).json({
                status: 'ERROR',
                message: 'User not found'
            });
            return;
        }
        
        res.json({
            status: 'SUCCESS',
            data: { user }
        });
    } catch (error: any) {
        logger.error('Get current user error:', error);
        res.status(500).json({
            status: 'ERROR',
            message: error.message
        });
    }
});

export default router;
