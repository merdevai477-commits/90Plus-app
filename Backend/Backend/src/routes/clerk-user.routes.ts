import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/clerk.middleware';
import { ClerkUserService } from '../services/clerk-user.service';
import { ProfileCompletionService } from '../services/profile-completion.service';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { userSyncLimiter } from '../middleware/rateLimit.middleware';
import { getProfileCache, setProfileCache, invalidateProfileCache } from '../services/profile-cache.service';

const router = Router();

function ensureString(param: string | string[] | undefined): string {
    if (Array.isArray(param)) return param[0] || '';
    return param || '';
}

export const invalidateUserCache = (clerkUserId: string) => {
    invalidateProfileCache(clerkUserId).catch(() => {});
};

const recalculateProfileCompletion = async (clerkUserId: string) => {
    try {
        await ProfileCompletionService.getCompletionStatus(clerkUserId);
    } catch (err) {
        logger.error('Failed to recalculate profile completion:', err);
    }
};

/**
 * GET /api/clerk/me
 */
router.get('/me', requireAuth, userSyncLimiter, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;

        if (!clerkUserId) {
            res.status(401).json({ status: 'ERROR', message: 'Unauthorized', code: 'E002' });
            return;
        }

        const cached = await getProfileCache<any>(clerkUserId);
        if (cached) {
            res.json({ status: 'SUCCESS', data: { user: cached } });
            return;
        }

        let user;
        let retryCount = 0;
        const maxRetries = 3;

        while (retryCount < maxRetries) {
            try {
                user = await ClerkUserService.findOrCreateUser(clerkUserId);
                if (user) break;
                retryCount++;
                if (retryCount < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 500 * retryCount));
                }
            } catch (dbError: any) {
                retryCount++;
                logger.error(`[/clerk/me] DB error (attempt ${retryCount}/${maxRetries}):`, {
                    error: dbError.message,
                    code: dbError.code,
                });
                if (retryCount >= maxRetries) {
                    res.status(500).json({
                        status: 'ERROR',
                        message: 'Database error while loading user. Please try again.',
                        code: 'E009',
                        details: process.env.NODE_ENV === 'development' ? dbError.message : undefined,
                    });
                    return;
                }
                await new Promise(resolve => setTimeout(resolve, 500 * retryCount));
            }
        }

        if (!user) {
            res.status(500).json({
                status: 'ERROR',
                message: 'Failed to load user profile. Please try logging out and back in.',
                code: 'E009',
            });
            return;
        }

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

        await setProfileCache(clerkUserId, userData);
        res.json({ status: 'SUCCESS', data: { user: userData } });
    } catch (error: any) {
        logger.error('[/clerk/me] Unexpected error:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error', code: 'E010' });
    }
});

/**
 * PUT /api/clerk/profile
 */
router.put('/profile', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;
        if (!clerkUserId) {
            res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
            return;
        }

        const { username, displayName, bio, favoriteTeam } = req.body;

        if (username) {
            const usernameRegex = /^[a-z0-9_]+$/;
            if (!usernameRegex.test(username)) {
                res.status(400).json({
                    status: 'ERROR',
                    message: 'Username must contain only lowercase letters, numbers, and underscore',
                });
                return;
            }

            const existingUser = await ClerkUserService.getUserByClerkId(clerkUserId);
            if (existingUser && existingUser.username !== username) {
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

                const userWithUsername = await prisma.user.findUnique({ where: { username } });
                if (userWithUsername) {
                    res.status(400).json({ status: 'ERROR', message: 'Username already taken' });
                    return;
                }
            }
        }

        const user = await ClerkUserService.updateUser(clerkUserId, { username, displayName, bio, favoriteTeam });
        invalidateUserCache(clerkUserId);
        await recalculateProfileCompletion(clerkUserId);

        res.json({ status: 'SUCCESS', message: 'Profile updated successfully', data: { user } });
    } catch (error: any) {
        logger.error('Update profile error:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
});

/**
 * POST /api/clerk/preferences
 */
router.post('/preferences', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;
        if (!clerkUserId) {
            res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
            return;
        }

        const { favoriteTeam, favoriteBrand, country, favoriteLeagues, clubLogo, brandLogo, countryFlag } = req.body;

        const user = await prisma.user.update({
            where: { clerkUserId },
            data: {
                favoriteTeam,
                favoriteBrand,
                country,
                favoriteLeagues: favoriteLeagues || [],
                clubLogo: clubLogo || undefined,
                brandLogo: brandLogo || undefined,
                countryFlag: countryFlag || undefined,
            },
        });

        invalidateUserCache(clerkUserId);
        await recalculateProfileCompletion(clerkUserId);

        res.json({ status: 'SUCCESS', message: 'Preferences saved successfully', data: { user } });
    } catch (error: any) {
        logger.error('Save preferences error:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
});

/**
 * PUT /api/clerk/card-profile
 */
router.put('/card-profile', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;
        if (!clerkUserId) {
            res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
            return;
        }

        const { position, countryFlag, age, height, weight, preferredFoot, clubLogo, brandLogo, favoriteTeam, country } = req.body;

        const validPositions = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST', 'CF'];
        if (position && !validPositions.includes(position)) {
            res.status(400).json({ status: 'ERROR', message: 'Invalid position' });
            return;
        }

        const validFeet = ['R', 'L', 'B'];
        if (preferredFoot && !validFeet.includes(preferredFoot)) {
            res.status(400).json({ status: 'ERROR', message: 'Invalid preferred foot (R, L, or B)' });
            return;
        }

        const user = await prisma.user.update({
            where: { clerkUserId },
            data: {
                position: position || undefined,
                countryFlag: countryFlag || undefined,
                country: country || undefined,
                age: age ? parseInt(age) : undefined,
                height: height ? parseInt(height) : undefined,
                weight: weight ? parseInt(weight) : undefined,
                preferredFoot: preferredFoot || undefined,
                clubLogo: clubLogo || undefined,
                brandLogo: brandLogo || undefined,
                favoriteTeam: favoriteTeam || undefined,
            },
            select: {
                position: true, countryFlag: true, country: true,
                age: true, height: true, weight: true,
                preferredFoot: true, clubLogo: true, brandLogo: true, favoriteTeam: true,
            },
        });

        invalidateUserCache(clerkUserId);
        await recalculateProfileCompletion(clerkUserId);

        res.json({ status: 'SUCCESS', message: 'Card profile updated successfully', data: { cardProfile: user } });
    } catch (error: any) {
        logger.error('Update card profile error:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
});
/**
 * POST /api/clerk/sync
 */
router.post('/sync', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;
        if (!clerkUserId) {
            res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
            return;
        }
        const user = await ClerkUserService.syncUserFromClerk(clerkUserId);
        res.json({ status: 'SUCCESS', message: 'User synced successfully', data: { user } });
    } catch (error: any) {
        logger.error('Sync user error:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
});

/**
 * GET /api/clerk/search
 * ✅ Fixed: Using SearchCacheHelper with namespace tracking
 */
router.get('/search', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const { q, limit = '10' } = req.query;
        const searchQuery = (q as string || '').trim().toLowerCase();
        const searchLimit = Math.min(parseInt(limit as string) || 10, 20);

        if (!searchQuery || searchQuery.length < 1) {
            res.json({ status: 'SUCCESS', data: { users: [] } });
            return;
        }

        // Use SearchCacheHelper for efficient caching
        const { SearchCacheHelper } = await import('../services/cache-helpers.service');
        const cached = await SearchCacheHelper.get<any>(searchQuery, searchLimit);
        if (cached) {
            res.json(cached);
            return;
        }

        const users = await prisma.user.findMany({
            where: {
                OR: [
                    { username: { contains: searchQuery, mode: 'insensitive' } },
                    { displayName: { contains: searchQuery, mode: 'insensitive' } },
                ],
            },
            select: {
                id: true, username: true, displayName: true,
                avatar: true, bio: true, isVerified: true,
                isDeveloper: true, level: true, favoriteTeam: true,
            },
            take: searchLimit * 2,
        });

        const searchQueryLower = searchQuery.toLowerCase();
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
            .sort((a: any, b: any) => b._relevanceScore - a._relevanceScore)
            .slice(0, searchLimit)
            .map(({ _relevanceScore, ...user }: any) => user);

        const responseData = { status: 'SUCCESS', data: { users: rankedUsers } };
        
        // Cache with SearchCacheHelper (includes namespace tracking)
        await SearchCacheHelper.set(searchQuery, responseData, searchLimit);
        
        res.json(responseData);
    } catch (error: any) {
        logger.error('Search users error:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
});

/**
 * GET /api/clerk/user/:username
 */
router.get('/user/:username', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const username = ensureString(req.params.username);
        const currentClerkUserId = req.auth?.userId;

        if (!username) {
            res.status(400).json({ status: 'ERROR', message: 'Username is required', code: 'E001' });
            return;
        }

        const user = await prisma.user.findUnique({
            where: { username },
            select: {
                id: true, username: true, displayName: true, avatar: true,
                bio: true, isVerified: true, isDeveloper: true, level: true,
                favoriteTeam: true, createdAt: true, position: true,
                countryFlag: true, country: true, age: true, height: true,
                weight: true, preferredFoot: true, clubLogo: true,
                brandLogo: true, socialLinks: true,
                _count: { select: { followers: true, following: true, reels: true } },
            },
        });

        if (!user) {
            res.status(404).json({ status: 'ERROR', message: 'User not found', code: 'E004' });
            return;
        }

        let isFollowing = false;
        let isFollowingMe = false;

        if (currentClerkUserId) {
            const currentUser = await prisma.user.findUnique({
                where: { clerkUserId: currentClerkUserId },
                select: { id: true },
            });
            if (currentUser) {
                const [follow, followBack] = await Promise.all([
                    prisma.follow.findUnique({
                        where: { followerId_followingId: { followerId: currentUser.id, followingId: user.id } },
                    }),
                    prisma.follow.findUnique({
                        where: { followerId_followingId: { followerId: user.id, followingId: currentUser.id } },
                    }),
                ]);
                isFollowing = !!follow;
                isFollowingMe = !!followBack;
            }
        }

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
        logger.error('[/clerk/user/:username] Error:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error', code: 'E010' });
    }
});

/**
 * GET /api/clerk/user/:username/reels
 * ✅ Fixed: مش بيقبل clerkId كـ username
 */
router.get('/user/:username/reels', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const username = ensureString(req.params.username);
        const { limit = '20', offset = '0' } = req.query;

        if (!username) {
            res.status(400).json({ status: 'ERROR', message: 'Username is required' });
            return;
        }

        const user = await prisma.user.findUnique({
            where: { username },
            select: { id: true },
        });

        if (!user) {
            res.status(404).json({ status: 'ERROR', message: 'User not found' });
            return;
        }

        const reels = await prisma.reel.findMany({
            where: { userId: user.id, isDeleted: false },
            select: {
                id: true, videoUrl: true, thumbnail: true,
                caption: true, views: true, createdAt: true,
                _count: { select: { likes: true, comments: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: parseInt(limit as string),
            skip: parseInt(offset as string),
        });

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

        res.json({ status: 'SUCCESS', data: { reels: formattedReels } });
    } catch (error: any) {
        logger.error('Get user reels error:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
});

/**
 * POST /api/clerk/follow/:username
 * ✅ Race condition safe using FollowService
 */
router.post('/follow/:username', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const username = ensureString(req.params.username);
        const clerkUserId = req.auth?.userId;

        if (!clerkUserId) {
            res.status(401).json({ status: 'ERROR', message: 'Unauthorized', code: 'E002' });
            return;
        }

        // Get both users
        const [currentUser, targetUser] = await Promise.all([
            prisma.user.findUnique({
                where: { clerkUserId },
                select: { id: true, username: true, displayName: true, avatar: true },
            }),
            prisma.user.findUnique({
                where: { username },
                select: { id: true, username: true, displayName: true, avatar: true },
            }),
        ]);

        if (!currentUser) {
            res.status(404).json({ status: 'ERROR', message: 'User not found', code: 'E004' });
            return;
        }
        if (!targetUser) {
            res.status(404).json({ status: 'ERROR', message: 'Target user not found', code: 'E004' });
            return;
        }

        // Use FollowService for race-condition-safe follow
        const { FollowService } = await import('../services/follow.service');
        const result = await FollowService.followUser(currentUser, targetUser);

        // Return appropriate response based on action
        if (result.action === 'already_following') {
            res.status(200).json({
                status: 'SUCCESS',
                message: 'Already following this user',
                data: {
                    action: 'already_following',
                    isFollowing: true,
                    followersCount: result.followersCount,
                    followingCount: result.followingCount,
                },
            });
        } else {
            res.status(200).json({
                status: 'SUCCESS',
                message: 'Followed successfully',
                data: {
                    action: 'followed',
                    isFollowing: true,
                    followersCount: result.followersCount,
                    followingCount: result.followingCount,
                },
            });
        }
    } catch (error: any) {
        if (error.message === 'CANNOT_FOLLOW_SELF') {
            res.status(400).json({ status: 'ERROR', message: 'Cannot follow yourself', code: 'E001' });
            return;
        }
        logger.error('Follow error:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error', code: 'E010' });
    }
});

/**
 * DELETE /api/clerk/follow/:username
 * ✅ Race condition safe using FollowService
 */
router.delete('/follow/:username', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const username = ensureString(req.params.username);
        const clerkUserId = req.auth?.userId;

        if (!clerkUserId) {
            res.status(401).json({ status: 'ERROR', message: 'Unauthorized', code: 'E002' });
            return;
        }

        // Get both users
        const [currentUser, targetUser] = await Promise.all([
            prisma.user.findUnique({
                where: { clerkUserId },
                select: { id: true, username: true, displayName: true, avatar: true },
            }),
            prisma.user.findUnique({
                where: { username },
                select: { id: true, username: true, displayName: true, avatar: true },
            }),
        ]);

        if (!currentUser) {
            res.status(404).json({ status: 'ERROR', message: 'User not found', code: 'E004' });
            return;
        }
        if (!targetUser) {
            res.status(404).json({ status: 'ERROR', message: 'Target user not found', code: 'E004' });
            return;
        }

        // Use FollowService for race-condition-safe unfollow
        const { FollowService } = await import('../services/follow.service');
        const result = await FollowService.unfollowUser(currentUser, targetUser);

        // Return appropriate response based on action
        if (result.action === 'not_following') {
            res.status(200).json({
                status: 'SUCCESS',
                message: 'Not following this user',
                data: {
                    action: 'not_following',
                    isFollowing: false,
                    followersCount: result.followersCount,
                    followingCount: result.followingCount,
                },
            });
        } else {
            res.status(200).json({
                status: 'SUCCESS',
                message: 'Unfollowed successfully',
                data: {
                    action: 'unfollowed',
                    isFollowing: false,
                    followersCount: result.followersCount,
                    followingCount: result.followingCount,
                },
            });
        }
    } catch (error: any) {
        logger.error('Unfollow error:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error', code: 'E010' });
    }
});

/**
 * GET /api/clerk/stats
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
            select: { _count: { select: { followers: true, following: true, reels: true } } },
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
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
});

/**
 * GET /api/clerk/followers/:userId
 * ✅ Optimized: No N+1 queries, single query with Prisma include
 */
router.get('/followers/:userId', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = ensureString(req.params.userId);
        const clerkUserId = req.auth?.userId;
        const limit = Math.min(parseInt(ensureString(req.query.limit as any)) || 50, 100);
        const offset = parseInt(ensureString(req.query.offset as any)) || 0;

        if (!userId) {
            res.status(400).json({ status: 'ERROR', message: 'User ID is required', code: 'E001' });
            return;
        }

        // Check cache first
        const { FollowersCacheHelper } = await import('../services/cache-helpers.service');
        const cacheKey = `${userId}:${offset}`;
        
        if (clerkUserId) {
            const currentUser = await prisma.user.findUnique({
                where: { clerkUserId },
                select: { id: true },
            });
            
            if (currentUser) {
                const cached = await FollowersCacheHelper.get<any>(cacheKey);
                if (cached) {
                    // Recalculate isFollowing for current user
                    const followersWithStatus = await Promise.all(
                        cached.followers.map(async (follower: any) => {
                            const isFollowing = await prisma.follow.findUnique({
                                where: {
                                    followerId_followingId: {
                                        followerId: currentUser.id,
                                        followingId: follower.id,
                                    },
                                },
                            });
                            return { ...follower, isFollowedByMe: !!isFollowing };
                        })
                    );
                    
                    res.json({
                        status: 'SUCCESS',
                        data: { ...cached, followers: followersWithStatus },
                    });
                    return;
                }
            }
        }

        // Get current user ID for follow status check
        const currentUser = clerkUserId ? await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true },
        }) : null;

        // Single optimized query with all data
        const [followers, total] = await Promise.all([
            prisma.follow.findMany({
                where: { followingId: userId },
                select: {
                    createdAt: true,
                    follower: {
                        select: {
                            id: true,
                            username: true,
                            displayName: true,
                            avatar: true,
                            isVerified: true,
                            isDeveloper: true,
                            level: true,
                            position: true,
                            countryFlag: true,
                            clubLogo: true,
                            // Nested query to check if current user follows this follower
                            followers: currentUser ? {
                                where: { followerId: currentUser.id },
                                select: { id: true },
                                take: 1,
                            } : false,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: offset,
            }),
            prisma.follow.count({ where: { followingId: userId } }),
        ]);

        // Format response
        const formattedFollowers = followers.map((f: any) => ({
            id: f.follower.id,
            username: f.follower.username,
            displayName: f.follower.displayName,
            avatar: f.follower.avatar,
            isVerified: f.follower.isVerified,
            isDeveloper: f.follower.isDeveloper,
            level: f.follower.level,
            position: f.follower.position,
            countryFlag: f.follower.countryFlag,
            clubLogo: f.follower.clubLogo,
            isFollowedByMe: Array.isArray(f.follower.followers) && f.follower.followers.length > 0,
            followedAt: f.createdAt,
        }));

        const responseData = {
            followers: formattedFollowers,
            total,
            hasMore: offset + limit < total,
            limit,
            offset,
        };

        // Cache the response
        await FollowersCacheHelper.set(cacheKey, responseData, offset);

        res.json({
            status: 'SUCCESS',
            data: responseData,
        });
    } catch (error: any) {
        logger.error('Get followers error:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error', code: 'E010' });
    }
});

/**
 * GET /api/clerk/following/:userId
 * ✅ Optimized: No N+1 queries, single query with Prisma include
 */
router.get('/following/:userId', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = ensureString(req.params.userId);
        const clerkUserId = req.auth?.userId;
        const limit = Math.min(parseInt(ensureString(req.query.limit as any)) || 50, 100);
        const offset = parseInt(ensureString(req.query.offset as any)) || 0;

        if (!userId) {
            res.status(400).json({ status: 'ERROR', message: 'User ID is required', code: 'E001' });
            return;
        }

        // Check cache first
        const { FollowingCacheHelper } = await import('../services/cache-helpers.service');
        const cacheKey = `${userId}:${offset}`;
        
        if (clerkUserId) {
            const currentUser = await prisma.user.findUnique({
                where: { clerkUserId },
                select: { id: true },
            });
            
            if (currentUser) {
                const cached = await FollowingCacheHelper.get<any>(cacheKey);
                if (cached) {
                    // Recalculate isFollowing for current user
                    const followingWithStatus = await Promise.all(
                        cached.following.map(async (user: any) => {
                            const isFollowing = await prisma.follow.findUnique({
                                where: {
                                    followerId_followingId: {
                                        followerId: currentUser.id,
                                        followingId: user.id,
                                    },
                                },
                            });
                            return { ...user, isFollowedByMe: !!isFollowing };
                        })
                    );
                    
                    res.json({
                        status: 'SUCCESS',
                        data: { ...cached, following: followingWithStatus },
                    });
                    return;
                }
            }
        }

        // Get current user ID for follow status check
        const currentUser = clerkUserId ? await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true },
        }) : null;

        // Single optimized query with all data
        const [following, total] = await Promise.all([
            prisma.follow.findMany({
                where: { followerId: userId },
                select: {
                    createdAt: true,
                    following: {
                        select: {
                            id: true,
                            username: true,
                            displayName: true,
                            avatar: true,
                            isVerified: true,
                            isDeveloper: true,
                            level: true,
                            position: true,
                            countryFlag: true,
                            clubLogo: true,
                            // Nested query to check if current user follows this user
                            followers: currentUser ? {
                                where: { followerId: currentUser.id },
                                select: { id: true },
                                take: 1,
                            } : false,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: offset,
            }),
            prisma.follow.count({ where: { followerId: userId } }),
        ]);

        // Format response
        const formattedFollowing = following.map((f: any) => ({
            id: f.following.id,
            username: f.following.username,
            displayName: f.following.displayName,
            avatar: f.following.avatar,
            isVerified: f.following.isVerified,
            isDeveloper: f.following.isDeveloper,
            level: f.following.level,
            position: f.following.position,
            countryFlag: f.following.countryFlag,
            clubLogo: f.following.clubLogo,
            isFollowedByMe: Array.isArray(f.following.followers) && f.following.followers.length > 0,
            followedAt: f.createdAt,
        }));

        const responseData = {
            following: formattedFollowing,
            total,
            hasMore: offset + limit < total,
            limit,
            offset,
        };

        // Cache the response
        await FollowingCacheHelper.set(cacheKey, responseData, offset);

        res.json({
            status: 'SUCCESS',
            data: responseData,
        });
    } catch (error: any) {
        logger.error('Get following error:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error', code: 'E010' });
    }
});

/**
 * POST /api/clerk/follow/id/:userId
 * ✅ Race condition safe using FollowService
 */
router.post('/follow/id/:userId', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const targetUserId = ensureString(req.params.userId);
        const clerkUserId = req.auth?.userId;

        if (!clerkUserId) {
            res.status(401).json({ status: 'ERROR', message: 'Unauthorized', code: 'E002' });
            return;
        }

        // Get both users
        const [currentUser, targetUser] = await Promise.all([
            prisma.user.findUnique({
                where: { clerkUserId },
                select: { id: true, username: true, displayName: true, avatar: true },
            }),
            prisma.user.findUnique({
                where: { id: targetUserId },
                select: { id: true, username: true, displayName: true, avatar: true },
            }),
        ]);

        if (!currentUser) {
            res.status(404).json({ status: 'ERROR', message: 'User not found', code: 'E004' });
            return;
        }
        if (!targetUser) {
            res.status(404).json({ status: 'ERROR', message: 'Target user not found', code: 'E004' });
            return;
        }

        // Use FollowService for race-condition-safe follow
        const { FollowService } = await import('../services/follow.service');
        const result = await FollowService.followUser(currentUser, targetUser);

        res.status(200).json({
            status: 'SUCCESS',
            message: result.action === 'followed' ? 'Followed successfully' : 'Already following this user',
            data: {
                action: result.action,
                isFollowing: true,
                followersCount: result.followersCount,
                followingCount: result.followingCount,
            },
        });
    } catch (error: any) {
        if (error.message === 'CANNOT_FOLLOW_SELF') {
            res.status(400).json({ status: 'ERROR', message: 'Cannot follow yourself', code: 'E001' });
            return;
        }
        logger.error('Follow by ID error:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error', code: 'E010' });
    }
});

/**
 * DELETE /api/clerk/follow/id/:userId
 * ✅ Race condition safe using FollowService
 */
router.delete('/follow/id/:userId', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const targetUserId = ensureString(req.params.userId);
        const clerkUserId = req.auth?.userId;

        if (!clerkUserId) {
            res.status(401).json({ status: 'ERROR', message: 'Unauthorized', code: 'E002' });
            return;
        }

        // Get both users
        const [currentUser, targetUser] = await Promise.all([
            prisma.user.findUnique({
                where: { clerkUserId },
                select: { id: true, username: true, displayName: true, avatar: true },
            }),
            prisma.user.findUnique({
                where: { id: targetUserId },
                select: { id: true, username: true, displayName: true, avatar: true },
            }),
        ]);

        if (!currentUser) {
            res.status(404).json({ status: 'ERROR', message: 'User not found', code: 'E004' });
            return;
        }
        if (!targetUser) {
            res.status(404).json({ status: 'ERROR', message: 'Target user not found', code: 'E004' });
            return;
        }

        // Use FollowService for race-condition-safe unfollow
        const { FollowService } = await import('../services/follow.service');
        const result = await FollowService.unfollowUser(currentUser, targetUser);

        res.status(200).json({
            status: 'SUCCESS',
            message: result.action === 'unfollowed' ? 'Unfollowed successfully' : 'Not following this user',
            data: {
                action: result.action,
                isFollowing: false,
                followersCount: result.followersCount,
                followingCount: result.followingCount,
            },
        });
    } catch (error: any) {
        logger.error('Unfollow by ID error:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error', code: 'E010' });
    }
});

/**
 * PUT /api/clerk/social-links
 */
router.put('/social-links', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;
        const { socialLinks } = req.body;

        if (!clerkUserId) {
            res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
            return;
        }

        if (!Array.isArray(socialLinks)) {
            res.status(400).json({ status: 'ERROR', message: 'Social links must be an array' });
            return;
        }

        if (socialLinks.length > 5) {
            res.status(400).json({ status: 'ERROR', message: 'Maximum 5 social links allowed' });
            return;
        }

        const allowedPlatforms = ['instagram', 'twitter', 'facebook', 'youtube', 'tiktok', 'website', 'linkedin', 'snapchat'];
        const validLinks = [];

        for (const link of socialLinks) {
            if (!link || typeof link !== 'object') continue;
            const platform = link.platform?.toLowerCase();
            const url = link.url?.trim();
            if (!url || url === '') continue;

            let normalizedUrl = url;
            if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
                normalizedUrl = `https://${normalizedUrl}`;
            }

            validLinks.push({
                platform: platform && allowedPlatforms.includes(platform) ? platform : 'website',
                url: normalizedUrl,
                username: link.username || undefined,
            });
        }

        const user = await prisma.user.update({
            where: { clerkUserId },
            data: { socialLinks: validLinks } as any,
        });

        invalidateUserCache(clerkUserId);
        await recalculateProfileCompletion(clerkUserId);

        res.json({
            status: 'SUCCESS',
            message: 'Social links updated successfully',
            data: { socialLinks: (user as any).socialLinks || [] },
        });
    } catch (error: any) {
        logger.error('Update social links error:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
});

/**
 * GET /api/clerk/username-change-status
 */
router.get('/username-change-status', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;
        if (!clerkUserId) {
            res.status(401).json({ status: 'ERROR', message: 'Unauthorized', code: 'E002' });
            return;
        }

        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { lastUsernameChange: true },
        });

        if (!user) {
            res.status(404).json({ status: 'ERROR', message: 'User not found', code: 'E004' });
            return;
        }

        const lastChange = user.lastUsernameChange;
        if (!lastChange) {
            res.json({ status: 'SUCCESS', data: { canChange: true, lastChange: null, nextAllowedChange: null } });
            return;
        }

        const daysSinceLastChange = Math.floor((Date.now() - lastChange.getTime()) / (1000 * 60 * 60 * 24));
        const canChange = daysSinceLastChange >= 15;
        const nextAllowedChange = new Date(lastChange.getTime() + (15 * 24 * 60 * 60 * 1000));

        res.json({
            status: 'SUCCESS',
            data: {
                canChange,
                lastChange: lastChange.toISOString(),
                nextAllowedChange: nextAllowedChange.toISOString(),
                daysRemaining: canChange ? 0 : 15 - daysSinceLastChange,
            },
        });
    } catch (error) {
        logger.error('[/clerk/username-change-status] Error:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error', code: 'E010' });
    }
});

export default router;