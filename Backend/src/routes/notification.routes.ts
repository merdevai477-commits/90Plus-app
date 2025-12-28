import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/clerk.middleware';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { WebSocketService } from '../services/websocket.service';

const router = Router();

/**
 * GET /api/notifications
 * Get user notifications
 */
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;
        if (!clerkUserId) {
            res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
            return;
        }

        const { limit = '20', offset = '0' } = req.query;

        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true }
        });

        if (!user) {
            res.status(404).json({ status: 'ERROR', message: 'User not found' });
            return;
        }

        const notifications = await prisma.notification.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: 'desc' },
            take: parseInt(limit as string),
            skip: parseInt(offset as string),
            select: {
                id: true,
                type: true,
                title: true,
                message: true,
                isRead: true,
                data: true,
                createdAt: true,
            }
        });

        res.json({
            status: 'SUCCESS',
            data: { notifications }
        });
    } catch (error: any) {
        logger.error('Get notifications error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
});

/**
 * GET /api/notifications/unread-count
 * Get unread notification count
 */
router.get('/unread-count', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;
        if (!clerkUserId) {
            res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
            return;
        }

        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true }
        });

        if (!user) {
            res.status(404).json({ status: 'ERROR', message: 'User not found' });
            return;
        }

        const count = await prisma.notification.count({
            where: { userId: user.id, isRead: false }
        });

        res.json({
            status: 'SUCCESS',
            data: { count }
        });
    } catch (error: any) {
        logger.error('Get unread count error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
});

/**
 * PUT /api/notifications/:id/read
 * Mark notification as read
 */
router.put('/:id/read', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;
        const { id } = req.params;

        if (!clerkUserId) {
            res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
            return;
        }

        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true }
        });

        if (!user) {
            res.status(404).json({ status: 'ERROR', message: 'User not found' });
            return;
        }

        await prisma.notification.updateMany({
            where: { id, userId: user.id },
            data: { isRead: true }
        });

        res.json({ status: 'SUCCESS', message: 'تم قراءة الإشعار' });
    } catch (error: any) {
        logger.error('Mark as read error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
});

/**
 * PUT /api/notifications/read-all
 * Mark all notifications as read
 */
router.put('/read-all', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;
        if (!clerkUserId) {
            res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
            return;
        }

        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true }
        });

        if (!user) {
            res.status(404).json({ status: 'ERROR', message: 'User not found' });
            return;
        }

        await prisma.notification.updateMany({
            where: { userId: user.id, isRead: false },
            data: { isRead: true }
        });

        res.json({ status: 'SUCCESS', message: 'تم قراءة جميع الإشعارات' });
    } catch (error: any) {
        logger.error('Mark all as read error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
});

/**
 * DELETE /api/notifications/clear-all
 * Delete all notifications for user
 */
router.delete('/clear-all', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;
        if (!clerkUserId) {
            res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
            return;
        }

        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true }
        });

        if (!user) {
            res.status(404).json({ status: 'ERROR', message: 'User not found' });
            return;
        }

        await prisma.notification.deleteMany({
            where: { userId: user.id }
        });

        res.json({ status: 'SUCCESS', message: 'تم مسح جميع الإشعارات' });
    } catch (error: any) {
        logger.error('Clear all notifications error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
});

export default router;
