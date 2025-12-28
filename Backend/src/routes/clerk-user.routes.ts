import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/clerk.middleware';
import { ClerkUserService } from '../services/clerk-user.service';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { WebSocketService } from '../services/websocket.service';
import { userSyncLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

// Simple in-memory cache for user profiles (5 minutes TTL - increased for better performance)
const userCache = new Map<string, { data: any; timestamp: number }>();
const USER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Helper to invalidate user cache
export const invalidateUserCache = (clerkUserId: string) => {
    userCache.delete(clerkUserId);
};

/**
 * GET /api/clerk/me
 * Get current user profile (protected) - WITH CACHING
 * Uses userSyncLimiter for more lenient rate limiting
 */
router.get('/me', requireAuth, userSyncLimiter, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;

        if (!clerkUserId) {
            res.status(401).json({
                status: 'ERROR',
                message: 'Unauthorized',
            });
            return;
        }

        // Check cache first
        const cached = userCache.get(clerkUserId);
        if (cached && Date.now() - cached.timestamp < USER_CACHE_TTL) {
            res.json({ status: 'SUCCESS', data: { user: cached.data } });
            return;
        }

        // Find or create user in our database
        const user = await ClerkUserService.findOrCreateUser(clerkUserId);

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
            age: user.age,
            height: user.height,
            weight: user.weight,
            preferredFoot: user.preferredFoot,
            clubLogo: user.clubLogo,
            brandLogo: user.brandLogo,
            socialLinks: (user as any).socialLinks || [],
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        };

        // Save to cache
        userCache.set(clerkUserId, { data: userData, timestamp: Date.now() });

        res.json({ status: 'SUCCESS', data: { user: userData } });
    } catch (error: any) {
        logger.error('Get user error:', error);
        res.status(500).json({
            status: 'ERROR',
            message: error.message || 'Internal server error',
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

        const { position, countryFlag, age, height, weight, preferredFoot, clubLogo, brandLogo, favoriteTeam } = req.body;

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
                age: true,
                height: true,
                weight: true,
                preferredFoot: true,
                clubLogo: true,
                brandLogo: true,
                favoriteTeam: true,
            },
        });

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
const searchCacheBackend = new Map<string, { data: any; timestamp: number }>();
const SEARCH_CACHE_TTL_BACKEND = 2 * 60 * 1000;

/**
 * GET /api/clerk/search
 * Search users by username or displayName (protected) - WITH CACHING
 */
router.get('/search', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const { q, limit = '10' } = req.query;
        const searchQuery = (q as string || '').trim().toLowerCase();
        const searchLimit = Math.min(parseInt(limit as string) || 10, 20);

        if (!searchQuery || searchQuery.length < 1) {
            res.json({
                status: 'SUCCESS',
                data: { users: [] },
            });
            return;
        }

        // Check cache first
        const cacheKey = `search_${searchQuery}_${searchLimit}`;
        const cached = searchCacheBackend.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < SEARCH_CACHE_TTL_BACKEND) {
            res.json(cached.data);
            return;
        }

        // Search by username only (case-insensitive)
        const users = await prisma.user.findMany({
            where: {
                username: { contains: searchQuery, mode: 'insensitive' },
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
            take: searchLimit,
            orderBy: [
                { isVerified: 'desc' },
                { level: 'desc' },
            ],
        });

        const responseData = {
            status: 'SUCCESS',
            data: { users },
        };

        // Save to cache
        searchCacheBackend.set(cacheKey, { data: responseData, timestamp: Date.now() });

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
        const { username } = req.params;
        const currentClerkUserId = req.auth?.userId;

        if (!username) {
            res.status(400).json({
                status: 'ERROR',
                message: 'Username is required',
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
                // FIFA Card fields
                position: true,
                countryFlag: true,
                age: true,
                height: true,
                weight: true,
                preferredFoot: true,
                clubLogo: true,
                brandLogo: true,
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
            res.status(404).json({
                status: 'ERROR',
                message: 'User not found',
            });
            return;
        }

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

        res.json({
            status: 'SUCCESS',
            data: {
                user: {
                    ...user,
                    followersCount: user._count.followers,
                    followingCount: user._count.following,
                    reelsCount: user._count.reels,
                    isFollowing,
                    isFollowingMe,
                },
            },
        });
    } catch (error: any) {
        logger.error('Get user profile error:', error);
        res.status(500).json({
            status: 'ERROR',
            message: error.message || 'Internal server error',
        });
    }
});

/**
 * POST /api/clerk/follow/:username
 * Follow a user (protected)
 */
router.post('/follow/:username', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const { username } = req.params;
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

        // Check if already following
        const existingFollow = await prisma.follow.findUnique({
            where: {
                followerId_followingId: {
                    followerId: currentUser.id,
                    followingId: targetUser.id,
                },
            },
        });

        if (existingFollow) {
            res.status(400).json({ status: 'ERROR', message: 'Already following this user' });
            return;
        }

        // Create follow relationship
        await prisma.follow.create({
            data: {
                followerId: currentUser.id,
                followingId: targetUser.id,
            },
        });

        // Create notification for the followed user
        const notification = await prisma.notification.create({
            data: {
                userId: targetUser.id,
                title: 'متابع جديد',
                message: `${currentUser.displayName || currentUser.username} بدأ متابعتك`,
                type: 'FOLLOW',
                data: {
                    followerId: currentUser.id,
                    followerUsername: currentUser.username,
                    followerAvatar: currentUser.avatar,
                },
            },
        });

        // Send WebSocket notification (Requirements: 21.2)
        WebSocketService.sendNotification(targetUser.id, {
            id: notification.id,
            type: 'FOLLOW',
            title: notification.title,
            message: notification.message,
            data: notification.data as Record<string, any>,
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
        res.status(500).json({
            status: 'ERROR',
            message: error.message || 'Internal server error',
        });
    }
});

/**
 * DELETE /api/clerk/follow/:username
 * Unfollow a user (protected)
 */
router.delete('/follow/:username', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const { username } = req.params;
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
        const { username } = req.params;
        const { limit = '20', offset = '0' } = req.query;

        if (!username) {
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
        const formattedReels = reels.map(reel => ({
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
router.get('/stats', requireAuth, async (req: Request, res: Response): Promise<void> => {
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
        const { userId } = req.params;
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
        const followerIds = followers.map(f => f.follower.id);
        const myFollows = currentUser ? await prisma.follow.findMany({
            where: {
                followerId: currentUser.id,
                followingId: { in: followerIds },
            },
            select: { followingId: true },
        }) : [];
        const myFollowingSet = new Set(myFollows.map(f => f.followingId));

        const formattedFollowers = followers.map(f => ({
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
        const { userId } = req.params;
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
        const followingIds = following.map(f => f.following.id);
        const myFollows = currentUser ? await prisma.follow.findMany({
            where: {
                followerId: currentUser.id,
                followingId: { in: followingIds },
            },
            select: { followingId: true },
        }) : [];
        const myFollowingSet = new Set(myFollows.map(f => f.followingId));

        const formattedFollowing = following.map(f => ({
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
        const { userId: targetUserId } = req.params;
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

        // Check if already following
        const existingFollow = await prisma.follow.findUnique({
            where: {
                followerId_followingId: {
                    followerId: currentUser.id,
                    followingId: targetUserId,
                },
            },
        });

        if (existingFollow) {
            res.status(400).json({ status: 'ERROR', message: 'Already following this user' });
            return;
        }

        // Create follow relationship
        await prisma.follow.create({
            data: {
                followerId: currentUser.id,
                followingId: targetUserId,
            },
        });

        // Create notification
        await prisma.notification.create({
            data: {
                userId: targetUserId,
                title: 'متابع جديد',
                message: `${currentUser.displayName || currentUser.username} بدأ متابعتك`,
                type: 'FOLLOW',
                data: {
                    followerId: currentUser.id,
                    followerUsername: currentUser.username,
                    followerAvatar: currentUser.avatar,
                },
            },
        });

        res.json({
            status: 'SUCCESS',
            message: 'Followed successfully',
        });
    } catch (error: any) {
        logger.error('Follow by ID error:', error);
        res.status(500).json({
            status: 'ERROR',
            message: error.message || 'Internal server error',
        });
    }
});

/**
 * DELETE /api/clerk/follow/id/:userId
 * Unfollow a user by ID (protected)
 */
router.delete('/follow/id/:userId', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const { userId: targetUserId } = req.params;
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

        // Validate social links (max 5)
        if (socialLinks && socialLinks.length > 5) {
            res.status(400).json({ status: 'ERROR', message: 'Maximum 5 social links allowed' });
            return;
        }

        // Update user's social links
        const user = await prisma.user.update({
            where: { clerkUserId },
            data: { socialLinks: socialLinks || [] } as any,
        });

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

export default router;
