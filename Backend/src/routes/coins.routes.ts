/**
 * Coins Routes
 * نظام الكوينات الموحد - API Endpoints
 */

import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { requireAuth } from '../middleware/clerk.middleware';
import { logger } from '../utils/logger';

const router = Router();

const INITIAL_COINS = 50;
const MAX_TRANSACTION_AMOUNT = 1000;
const MAX_BALANCE = 99999;

/**
 * GET /api/coins/balance
 */
router.get('/balance', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;

        if (!clerkUserId) {
            res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
            return;
        }

        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true, coins: true }
        });

        if (!user) {
            res.status(404).json({ status: 'ERROR', message: 'User not found' });
            return;
        }

        res.json({
            status: 'SUCCESS',
            data: { coins: user.coins, userId: user.id }
        });
    } catch (error: any) {
        logger.error('Get coins balance error:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
});

/**
 * POST /api/coins/add
 */
router.post('/add', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;
        const { amount, description, type } = req.body;

        if (!clerkUserId) {
            res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
            return;
        }

        if (!amount || amount <= 0) {
            res.status(400).json({ status: 'ERROR', message: 'Invalid amount' });
            return;
        }

        if (amount > MAX_TRANSACTION_AMOUNT) {
            res.status(400).json({ status: 'ERROR', message: 'Amount exceeds maximum allowed (1000)' });
            return;
        }

        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true, coins: true }
        });

        if (!user) {
            res.status(404).json({ status: 'ERROR', message: 'User not found' });
            return;
        }

        if (user.coins + amount > MAX_BALANCE) {
            res.status(400).json({
                status: 'ERROR',
                message: 'Adding this amount would exceed maximum balance (99999)',
                current: user.coins,
                maxBalance: MAX_BALANCE
            });
            return;
        }

        const validTypes = ['QUIZ_REWARD', 'DAILY_LOGIN', 'ACHIEVEMENT', 'SPEND', 'ADMIN_GRANT', 'REEL_REWARD', 'PREDICTION'];
        const transactionType = (type && validTypes.includes(type)) ? type : 'QUIZ_REWARD';

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
            data: { coins: updatedUser.coins, added: amount }
        });
    } catch (error: any) {
        logger.error('Add coins error:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
});

/**
 * POST /api/coins/subtract
 */
router.post('/subtract', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;
        const { amount, description, type } = req.body;

        if (!clerkUserId) {
            res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
            return;
        }

        if (!amount || amount <= 0) {
            res.status(400).json({ status: 'ERROR', message: 'Invalid amount' });
            return;
        }

        if (amount > MAX_TRANSACTION_AMOUNT) {
            res.status(400).json({ status: 'ERROR', message: 'Amount exceeds maximum allowed (1000)' });
            return;
        }

        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true, coins: true }
        });

        if (!user) {
            res.status(404).json({ status: 'ERROR', message: 'User not found' });
            return;
        }

        if (user.coins < amount) {
            res.status(400).json({
                status: 'ERROR',
                message: 'Insufficient coins',
                current: user.coins,
                required: amount
            });
            return;
        }

        const validTypes = ['QUIZ_REWARD', 'DAILY_LOGIN', 'ACHIEVEMENT', 'SPEND', 'ADMIN_GRANT', 'REEL_REWARD', 'PREDICTION'];
        const transactionType = (type && validTypes.includes(type)) ? type : 'SPEND';

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
            data: { coins: updatedUser.coins, subtracted: amount }
        });
    } catch (error: any) {
        logger.error('Subtract coins error:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
});

export default router;