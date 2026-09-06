import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/clerk.middleware';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { enqueueNotification } from '../queues/notification.queue';
import { ErrorCode, sendError } from '../constants/errors';

const router = Router();

// نسب الحظ للجوائز
const PRIZES = [
    { coins: 5, probability: 50, color: '#32cd32' },    // 50%
    { coins: 10, probability: 35, color: '#00bfff' },   // 35%
    { coins: 25, probability: 10, color: '#ff6b6b' },   // 10%
    { coins: 50, probability: 4.5, color: '#ffd700' },  // 4.5%
    { coins: 200, probability: 0.5, color: '#ff00ff' }, // 0.5%
];

// دالة لاختيار الجائزة بناءً على النسب
function selectPrize(): { coins: number; index: number } {
    const random = Math.random() * 100;
    let cumulative = 0;
    
    for (let i = 0; i < PRIZES.length; i++) {
        cumulative += PRIZES[i].probability;
        if (random <= cumulative) {
            return { coins: PRIZES[i].coins, index: i };
        }
    }
    
    // Fallback to first prize
    return { coins: PRIZES[0].coins, index: 0 };
}

// التحقق من مرور 24 ساعة
function canSpinToday(lastSpin: Date | null): boolean {
    if (!lastSpin) return true;
    
    const now = new Date();
    const lastSpinDate = new Date(lastSpin);
    const hoursDiff = (now.getTime() - lastSpinDate.getTime()) / (1000 * 60 * 60);
    
    return hoursDiff >= 24;
}

// حساب الوقت المتبقي
function getTimeRemaining(lastSpin: Date): { hours: number; minutes: number; seconds: number } {
    const now = new Date();
    const nextSpin = new Date(lastSpin.getTime() + 24 * 60 * 60 * 1000);
    const diff = nextSpin.getTime() - now.getTime();
    
    if (diff <= 0) {
        return { hours: 0, minutes: 0, seconds: 0 };
    }
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    return { hours, minutes, seconds };
}

/**
 * GET /api/lucky-wheel/status
 * التحقق من حالة عجلة الحظ
 */
router.get('/status', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;
        if (!clerkUserId) {
            sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
            return;
        }

        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true, lastDailySpin: true, coins: true }
        });

        if (!user) {
            sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
            return;
        }

        const canSpin = canSpinToday(user.lastDailySpin);
        const timeRemaining = user.lastDailySpin ? getTimeRemaining(user.lastDailySpin) : null;

        res.json({
            status: 'SUCCESS',
            data: {
                canSpin,
                timeRemaining,
                currentCoins: user.coins,
                prizes: PRIZES.map(p => ({ coins: p.coins, color: p.color })),
                lastSpin: user.lastDailySpin
            }
        });
    } catch (error: any) {
        logger.error('Lucky wheel status error:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
    }
});

/**
 * POST /api/lucky-wheel/spin
 * لف عجلة الحظ
 */
router.post('/spin', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;
        if (!clerkUserId) {
            sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
            return;
        }

        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true, lastDailySpin: true, coins: true }
        });

        if (!user) {
            sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
            return;
        }

        // التحقق من مرور 24 ساعة
        if (!canSpinToday(user.lastDailySpin)) {
            const timeRemaining = getTimeRemaining(user.lastDailySpin!);
            sendError(req, res, ErrorCode.RATE_LIMIT, 'يمكنك لف العجلة مرة واحدة كل 24 ساعة', { code: 'SPIN_COOLDOWN', timeRemaining });
            return;
        }

        // اختيار الجائزة
        const prize = selectPrize();
        const now = new Date();

        // تحديث المستخدم وإضافة السجل
        await prisma.$transaction([
            // تحديث الكوينات وآخر لف
            prisma.user.update({
                where: { id: user.id },
                data: {
                    coins: { increment: prize.coins },
                    lastDailySpin: now
                }
            }),
            // إضافة سجل اللف
            prisma.dailySpinHistory.create({
                data: {
                    userId: user.id,
                    coinsWon: prize.coins,
                    spinDate: now
                }
            }),
            // إضافة معاملة الكوينات
            prisma.coinTransaction.create({
                data: {
                    userId: user.id,
                    amount: prize.coins,
                    type: 'DAILY_LOGIN',
                    description: `عجلة الحظ اليومية - ربحت ${prize.coins} كوين`
                }
            })
        ]);

        // 🎰 Lucky Wheel spin result notification (fire-and-forget)
        enqueueNotification({
            userId: user.id,
            title: prize.coins >= 50 ? '🎉 يا سلام! جائزة كبيرة!' : '🎡 لفيت العجلة!',
            message: `مبروك! ربحت ${prize.coins} تذكرة من عجلة الحظ اليومية 🎁`,
            type: 'LUCKY_WHEEL',
                data: { type: 'LUCKY_WHEEL', coinsWon: prize.coins, prizeIndex: prize.index, screen: '/(tabs)/profile' },
        }).catch(() => {});

        res.json({
            status: 'SUCCESS',
            data: {
                coinsWon: prize.coins,
                prizeIndex: prize.index,
                newBalance: user.coins + prize.coins,
                nextSpinAt: new Date(now.getTime() + 24 * 60 * 60 * 1000)
            },
            message: `🎉 مبروك! ربحت ${prize.coins} كوين`
        });
    } catch (error: any) {
        logger.error('Lucky wheel spin error:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
    }
});


/**
 * GET /api/lucky-wheel/history
 * سجل اللفات السابقة
 */
router.get('/history', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;
        if (!clerkUserId) {
            sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
            return;
        }

        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true }
        });

        if (!user) {
            sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
            return;
        }

        const history = await prisma.dailySpinHistory.findMany({
            where: { userId: user.id },
            orderBy: { spinDate: 'desc' },
            take: 30, // آخر 30 لفة
            select: {
                id: true,
                coinsWon: true,
                spinDate: true
            }
        });

        // إحصائيات
        const totalSpins = await prisma.dailySpinHistory.count({
            where: { userId: user.id }
        });

        const totalCoinsWon = await prisma.dailySpinHistory.aggregate({
            where: { userId: user.id },
            _sum: { coinsWon: true }
        });

        res.json({
            status: 'SUCCESS',
            data: {
                history,
                stats: {
                    totalSpins,
                    totalCoinsWon: totalCoinsWon._sum.coinsWon || 0
                }
            }
        });
    } catch (error: any) {
        logger.error('Lucky wheel history error:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
    }
});

/**
 * POST /api/lucky-wheel/send-daily-notification
 * إرسال إشعار يومي لجميع المستخدمين (يُستدعى من cron job)
 */
router.post('/send-daily-notification', async (req: Request, res: Response): Promise<void> => {
    try {
        // التحقق من API key للأمان
        const apiKey = req.headers['x-api-key'];
        if (apiKey !== process.env.CRON_API_KEY) {
            sendError(req, res, ErrorCode.AUTHENTICATION, 'Invalid API key');
            return;
        }

        // جلب جميع المستخدمين الذين يمكنهم اللف
        const users = await prisma.user.findMany({
            where: {
                OR: [
                    { lastDailySpin: null },
                    {
                        lastDailySpin: {
                            lt: new Date(Date.now() - 24 * 60 * 60 * 1000)
                        }
                    }
                ]
            },
            select: { id: true }
        });

        // إنشاء إشعارات لجميع المستخدمين
        const notifications = users.map(user => ({
            userId: user.id,
            title: '🎡 عجلة الحظ جاهزة!',
            message: 'لف عجلة الحظ اليومية واربح كوينات مجانية! 🎁',
            type: 'GENERAL' as const,
            data: { action: 'LUCKY_WHEEL' }
        }));

        // Store in DB in bulk (fast)
        if (notifications.length > 0) {
            await prisma.notification.createMany({ data: notifications });
        }

        // Also send push notifications asynchronously (queue handles token+consent).
        // Run in background (do not block cron response).
        setImmediate(() => {
            for (const n of notifications) {
                enqueueNotification(n).catch(() => {});
            }
        });

        res.json({
            status: 'SUCCESS',
            message: `تم إرسال ${notifications.length} إشعار`,
            count: notifications.length
        });
    } catch (error: any) {
        logger.error('Send daily notification error:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
    }
});

export default router;
