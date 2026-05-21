/**
 * Coins Routes
 * نظام الكوينات الموحد - API Endpoints
 */

import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { requireAuth } from '../middleware/clerk.middleware';
import { logger } from '../utils/logger';
import { ErrorCode, sendError } from '../constants/errors';

const router = Router();

const INITIAL_COINS = 50;

/**
 * GET /api/coins/balance
 * Get current user's coin balance
 */
router.get('/balance', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;

        if (!clerkUserId) {
            sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
            return;
        }

        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true, coins: true }
        });

        if (!user) {
            // Create user if doesn't exist
            const newUser = await prisma.user.create({
                data: {
                    clerkUserId,
                    email: `temp_${clerkUserId}@temp.com`, // Will be updated by Clerk webhook
                    username: `user_${clerkUserId.slice(-8)}`,
                    coins: INITIAL_COINS,
                    level: 1,
                },
                select: { id: true, coins: true }
            });

            res.json({
                status: 'SUCCESS',
                data: {
                    coins: newUser.coins,
                    userId: newUser.id
                }
            });
            return;
        }

        res.json({
            status: 'SUCCESS',
            data: {
                coins: user.coins,
                userId: user.id
            }
        });
    } catch (error: any) {
        logger.error('Get coins balance error:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
    }
});

/**
 * POST /api/coins/add
 * Add coins to user's balance
 */
router.post('/add', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;
        const { amount, description, type } = req.body;

        if (!clerkUserId) {
            sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
            return;
        }

        if (!amount || amount <= 0) {
            sendError(req, res, ErrorCode.VALIDATION, 'Invalid amount');
            return;
        }

        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true, coins: true }
        });

        if (!user) {
            sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
            return;
        }

        // Validate and set transaction type
        const validTypes = ['QUIZ_REWARD', 'DAILY_LOGIN', 'ACHIEVEMENT', 'SPEND', 'ADMIN_GRANT', 'REEL_REWARD', 'PREDICTION'];
        const transactionType = (type && validTypes.includes(type)) ? type : 'QUIZ_REWARD';

        // Update coins in transaction
        const [updatedUser] = await prisma.$transaction([
            prisma.user.update({
                where: { id: user.id },
                data: { coins: { increment: amount } },
                select: { coins: true }
            }),
            prisma.coinTransaction.create({
                data: {
                    userId: user.id,
                    amount,
                    type: transactionType as any,
                    description: description || `Added ${amount} coins`
                }
            })
        ]);

        res.json({
            status: 'SUCCESS',
            data: {
                coins: updatedUser.coins,
                added: amount
            }
        });
    } catch (error: any) {
        logger.error('Add coins error:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
    }
});

/**
 * POST /api/coins/subtract
 * Subtract coins from user's balance
 */
router.post('/subtract', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;
        const { amount, description, type } = req.body;

        if (!clerkUserId) {
            sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
            return;
        }

        if (!amount || amount <= 0) {
            sendError(req, res, ErrorCode.VALIDATION, 'Invalid amount');
            return;
        }

        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true, coins: true }
        });

        if (!user) {
            sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
            return;
        }

        // Check if user has enough coins
        if (user.coins < amount) {
            sendError(req, res, ErrorCode.VALIDATION, 'Insufficient coins', { current: user.coins, required: amount });
            return;
        }

        // Validate and set transaction type
        const validTypes = ['QUIZ_REWARD', 'DAILY_LOGIN', 'ACHIEVEMENT', 'SPEND', 'ADMIN_GRANT', 'REEL_REWARD', 'PREDICTION'];
        const transactionType = (type && validTypes.includes(type)) ? type : 'SPEND';

        // Update coins in transaction
        const [updatedUser] = await prisma.$transaction([
            prisma.user.update({
                where: { id: user.id },
                data: { coins: { decrement: amount } },
                select: { coins: true }
            }),
            prisma.coinTransaction.create({
                data: {
                    userId: user.id,
                    amount: -amount,
                    type: transactionType as any,
                    description: description || `Subtracted ${amount} coins`
                }
            })
        ]);

        res.json({
            status: 'SUCCESS',
            data: {
                coins: updatedUser.coins,
                subtracted: amount
            }
        });
    } catch (error: any) {
        logger.error('Subtract coins error:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
    }
});

/**
 * POST /api/coins/sync
 * Sync coins from backend to frontend (for manual sync)
 */
router.post('/sync', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;

        if (!clerkUserId) {
            sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
            return;
        }

        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true, coins: true }
        });

        if (!user) {
            sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
            return;
        }

        res.json({
            status: 'SUCCESS',
            data: {
                coins: user.coins,
                userId: user.id
            }
        });
    } catch (error: any) {
        logger.error('Sync coins error:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
    }
});

export default router;

