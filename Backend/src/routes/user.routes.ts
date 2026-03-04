import { Router, Request, Response } from 'express';
import { UserController } from '../controllers/user.controller';
import { requireAuth } from '../middleware/clerk.middleware';
import { strictLimiter } from '../middleware/rateLimit.middleware';
import { accountDeletionRateLimiter } from '../middleware/auth-rate-limit.middleware';
import { validate } from '../middleware/validation.middleware';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';

const router = Router();

// Helper function to ensure param is string
const ensureString = (param: string | string[] | undefined): string => {
    if (Array.isArray(param)) return param[0];
    return param || '';
};

// Settings Routes (Protected)
router.get('/settings', requireAuth, UserController.getSettings);
router.patch('/settings', requireAuth, UserController.updateSettings);

// Account Routes (Protected + Rate Limited)
router.delete('/me', requireAuth, accountDeletionRateLimiter, UserController.deleteAccount);

/**
 * POST /api/users/block/:userId
 * Block a user (protected)
 * Note: Requires running prisma migrate after adding Block model
 */
router.post('/block/:userId', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const { userId } = req.params;
        const targetUserId = ensureString(userId);
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

        // Can't block yourself
        if (currentUser.id === targetUserId) {
            res.status(400).json({ status: 'ERROR', message: 'Cannot block yourself' });
            return;
        }

        // Check if target user exists
        const targetUser = await prisma.user.findUnique({
            where: { id: targetUserId },
            select: { id: true },
        });

        if (!targetUser) {
            res.status(404).json({ status: 'ERROR', message: 'Target user not found' });
            return;
        }

        // Use raw query for block (until migration is run)
        try {
            await prisma.$executeRaw`
                INSERT INTO blocks (id, "blockerId", "blockedId", "createdAt")
                VALUES (gen_random_uuid(), ${currentUser.id}, ${targetUserId}, NOW())
                ON CONFLICT ("blockerId", "blockedId") DO NOTHING
            `;
        } catch (dbError: any) {
            // If table doesn't exist yet, return a friendly message
            if (dbError.code === '42P01') {
                res.status(503).json({ 
                    status: 'ERROR', 
                    message: 'Block feature not available yet. Please run database migration.' 
                });
                return;
            }
            throw dbError;
        }

        // Remove any follow relationships
        await prisma.follow.deleteMany({
            where: {
                OR: [
                    { followerId: currentUser.id, followingId: targetUserId },
                    { followerId: targetUserId, followingId: currentUser.id },
                ],
            },
        });

        logger.info(`User ${currentUser.id} blocked user ${targetUserId}`);

        res.json({
            status: 'SUCCESS',
            message: 'User blocked successfully',
        });
    } catch (error: any) {
        logger.error('Block user error:', error);
        res.status(500).json({
            status: 'ERROR',
            message: error.message || 'Internal server error',
        });
    }
});

/**
 * DELETE /api/users/block/:userId
 * Unblock a user (protected)
 */
router.delete('/block/:userId', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const { userId } = req.params;
        const targetUserId = ensureString(userId);
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

        // Use raw query for unblock (until migration is run)
        try {
            await prisma.$executeRaw`
                DELETE FROM blocks 
                WHERE "blockerId" = ${currentUser.id} AND "blockedId" = ${targetUserId}
            `;
        } catch (dbError: any) {
            if (dbError.code === '42P01') {
                res.status(503).json({ 
                    status: 'ERROR', 
                    message: 'Block feature not available yet. Please run database migration.' 
                });
                return;
            }
            throw dbError;
        }

        res.json({
            status: 'SUCCESS',
            message: 'User unblocked successfully',
        });
    } catch (error: any) {
        logger.error('Unblock user error:', error);
        res.status(500).json({
            status: 'ERROR',
            message: error.message || 'Internal server error',
        });
    }
});

/**
 * GET /api/users/blocked
 * Get list of blocked users (protected)
 */
router.get('/blocked', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
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

        // Get blocked users using raw query
        try {
            const blockedUsers = await prisma.$queryRaw<any[]>`
                SELECT 
                    u.id,
                    u.username,
                    u."fullName",
                    u."avatarUrl",
                    b."createdAt" as "blockedAt"
                FROM blocks b
                JOIN users u ON b."blockedId" = u.id
                WHERE b."blockerId" = ${currentUser.id}
                ORDER BY b."createdAt" DESC
            `;

            res.json({
                status: 'SUCCESS',
                data: blockedUsers,
            });
        } catch (dbError: any) {
            if (dbError.code === '42P01') {
                res.status(503).json({ 
                    status: 'ERROR', 
                    message: 'Block feature not available yet. Please run database migration.',
                    data: []
                });
                return;
            }
            throw dbError;
        }
    } catch (error: any) {
        logger.error('Get blocked users error:', error);
        res.status(500).json({
            status: 'ERROR',
            message: error.message || 'Internal server error',
        });
    }
});

/**
 * GET /api/users/block/:userId/status
 * Check if a user is blocked (protected)
 */
router.get('/block/:userId/status', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const { userId } = req.params;
        const targetUserId = ensureString(userId);
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

        // Check if user is blocked using raw query
        try {
            const result = await prisma.$queryRaw<any[]>`
                SELECT COUNT(*) as count
                FROM blocks
                WHERE "blockerId" = ${currentUser.id} AND "blockedId" = ${targetUserId}
            `;

            const isBlocked = result[0]?.count > 0;

            res.json({
                status: 'SUCCESS',
                isBlocked,
            });
        } catch (dbError: any) {
            if (dbError.code === '42P01') {
                res.json({ 
                    status: 'SUCCESS',
                    isBlocked: false
                });
                return;
            }
            throw dbError;
        }
    } catch (error: any) {
        logger.error('Check block status error:', error);
        res.status(500).json({
            status: 'ERROR',
            message: error.message || 'Internal server error',
        });
    }
});

/**
 * POST /api/users/report/:userId
 * Report a user (protected)
 * ✅ DRAGON FIX: Input validation added
 */
router.post('/report/:userId', requireAuth, validate({
    params: {
        userId: { type: 'string', required: true, min: 1, max: 100 },
    },
    body: {
        reason: { 
            type: 'string', 
            required: true, 
            enum: ['spam', 'harassment', 'inappropriate', 'fake', 'other'] 
        },
        additionalInfo: { type: 'string', required: false, max: 1000 },
    }
}), async (req: Request, res: Response): Promise<void> => {
    try {
        const { userId } = req.params;
        const targetUserId = ensureString(userId);
        const { reason, additionalInfo } = req.body;
        const clerkUserId = req.auth?.userId;

        if (!clerkUserId) {
            res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
            return;
        }

        if (!reason) {
            res.status(400).json({ status: 'ERROR', message: 'Reason is required' });
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

        // Can't report yourself
        if (currentUser.id === targetUserId) {
            res.status(400).json({ status: 'ERROR', message: 'Cannot report yourself' });
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

        // Map reason to ReportType enum
        const reasonToType: Record<string, string> = {
            'spam': 'SPAM',
            'harassment': 'HARASSMENT',
            'inappropriate': 'INAPPROPRIATE',
            'fake': 'FAKE_INFO',
            'other': 'OTHER',
        };

        const reportType = reasonToType[reason] || 'OTHER';

        // Create report
        const report = await prisma.report.create({
            data: {
                reporterId: currentUser.id,
                reportedUserId: targetUserId,
                type: reportType as any,
                reason: additionalInfo || reason,
                status: 'PENDING',
            },
        });

        logger.info(`User ${currentUser.id} reported user ${targetUserId} for: ${reason}`);

        // Send notification to admin (Apple Guideline 1.2 requirement)
        try {
            const { AdminNotificationService } = await import('../services/admin-notification.service');
            await AdminNotificationService.notifyUserReport({
                reportId: report.id,
                reporterUsername: currentUser.id,
                reportedUsername: targetUser.username,
                reportType: reportType,
                reason: additionalInfo || reason,
            });
        } catch (notifError) {
            // Don't fail the request if notification fails
            logger.error('Failed to send admin notification:', notifError);
        }

        res.json({
            status: 'SUCCESS',
            message: 'Report submitted successfully',
        });
    } catch (error: any) {
        logger.error('Report user error:', error);
        res.status(500).json({
            status: 'ERROR',
            message: error.message || 'Internal server error',
        });
    }
});

export default router;

