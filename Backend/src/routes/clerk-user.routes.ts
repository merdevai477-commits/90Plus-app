import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/clerk.middleware';
import { ClerkUserService } from '../services/clerk-user.service';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/clerk/me
 * Get current user profile (protected)
 */
router.get('/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;

        if (!clerkUserId) {
            res.status(401).json({
                status: 'ERROR',
                message: 'Unauthorized',
            });
            return;
        }

        // Find or create user in our database
        const user = await ClerkUserService.findOrCreateUser(clerkUserId);

        res.json({
            status: 'SUCCESS',
            data: {
                user: {
                    id: user.id,
                    clerkUserId: user.clerkUserId,
                    email: user.email,
                    username: user.username,
                    displayName: user.displayName,
                    avatar: user.avatar,
                    bio: user.bio,
                    coins: user.coins,
                    level: user.level,
                    xp: user.xp,
                    isVerified: user.isVerified,
                    isDeveloper: user.isDeveloper,
                    favoriteTeam: user.favoriteTeam,
                    createdAt: user.createdAt,
                    updatedAt: user.updatedAt,
                },
            },
        });
    } catch (error: any) {
        console.error('Get user error:', error);
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

        res.json({
            status: 'SUCCESS',
            message: 'Profile updated successfully',
            data: { user },
        });
    } catch (error: any) {
        console.error('Update profile error:', error);
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
        console.error('Sync user error:', error);
        res.status(500).json({
            status: 'ERROR',
            message: error.message || 'Internal server error',
        });
    }
});

export default router;
