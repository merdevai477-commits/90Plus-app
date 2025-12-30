/**
 * Quiz Routes
 * API endpoints للكويزات
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/clerk.middleware';
import { logger } from '../utils/logger';
import prisma from '../lib/prisma';
import {
  getRandomQuestions,
  checkAttemptCooldown,
  submitQuizAttempt,
  getUserQuizStats,
  getUserQuizHistory,
} from '../services/quiz.service';

const router = Router();

// Log router initialization for debugging
logger.info('Quiz routes router initialized');

// ============================================
// STATIC ROUTES (يجب أن تكون قبل Dynamic Routes)
// ============================================

/**
 * GET /api/quiz/health
 * Health check endpoint للتحقق من أن quiz routes تعمل
 */
router.get('/health', (_req: Request, res: Response): void => {
    res.json({
        status: 'SUCCESS',
        message: 'Quiz API is healthy',
        timestamp: new Date().toISOString(),
    });
});

// Quiz categories cache (5 minutes TTL)
const quizCategoriesCache = new Map<string, { data: any; timestamp: number }>();
const QUIZ_CATEGORIES_CACHE_TTL = 5 * 60 * 1000;

/**
 * GET /api/quiz/categories
 * جلب جميع فئات الكويز
 * Requires authentication - guests cannot access quiz
 */
router.get('/categories', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        // Check cache first
        const cacheKey = 'quiz_categories_all';
        const cached = quizCategoriesCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < QUIZ_CATEGORIES_CACHE_TTL) {
            res.json(cached.data);
            return;
        }

        const categories = await prisma.quizCategory.findMany({
            orderBy: {
                createdAt: 'asc',
            },
        });

        const responseData = {
            status: 'SUCCESS',
            data: categories,
        };

        // Save to cache
        quizCategoriesCache.set(cacheKey, { data: responseData, timestamp: Date.now() });

        res.json(responseData);
    } catch (error: any) {
        logger.error('Error getting quiz categories:', error);
        res.status(500).json({
            status: 'ERROR',
            message: error.message || 'Failed to get categories',
        });
    }
});

/**
 * GET /api/quiz/stats
 * جلب إحصائيات المستخدم في الكويزات
 */
router.get(
  '/stats',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const clerkUserId = req.auth?.userId;
      if (!clerkUserId) {
        res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { clerkUserId },
        select: { id: true },
      });

      if (!user) {
        res.status(404).json({ status: 'ERROR', message: 'User not found' });
        return;
      }

      const stats = await getUserQuizStats(user.id);

      res.json({
        status: 'SUCCESS',
        data: stats,
      });
    } catch (error: any) {
      logger.error('Error getting quiz stats:', error);
      res.status(500).json({
        status: 'ERROR',
        message: error.message || 'Failed to get stats',
      });
    }
  }
);

/**
 * GET /api/quiz/history
 * جلب تاريخ محاولات المستخدم
 */
router.get(
  '/history',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const clerkUserId = req.auth?.userId;
      if (!clerkUserId) {
        res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { clerkUserId },
        select: { id: true },
      });

      if (!user) {
        res.status(404).json({ status: 'ERROR', message: 'User not found' });
        return;
      }

      const { limit } = req.query;
      const historyLimit = limit ? parseInt(limit as string, 10) : 20;

      const history = await getUserQuizHistory(user.id, historyLimit);

      res.json({
        status: 'SUCCESS',
        data: history,
      });
    } catch (error: any) {
      logger.error('Error getting quiz history:', error);
      res.status(500).json({
        status: 'ERROR',
        message: error.message || 'Failed to get history',
      });
    }
  }
);

// ============================================
// DYNAMIC ROUTES (يجب أن تكون بعد Static Routes)
// ============================================

/**
 * GET /api/quiz/:categoryId/start
 * بدء كويز جديد - يجلب الأسئلة ويفحص الـ cooldown
 */
router.get(
  '/:categoryId/start',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const clerkUserId = req.auth?.userId;
      if (!clerkUserId) {
        res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
        return;
      }

      const { categoryId } = req.params;
      const { count } = req.query;

      const user = await prisma.user.findUnique({
        where: { clerkUserId },
        select: { id: true },
      });

      if (!user) {
        res.status(404).json({ status: 'ERROR', message: 'User not found' });
        return;
      }

      // Check cooldown
      const cooldown = await checkAttemptCooldown(user.id, categoryId);
      if (!cooldown.canStart) {
        res.status(429).json({
          status: 'ERROR',
          message: 'Quiz cooldown active',
          canRetryAt: cooldown.canRetryAt,
          hoursRemaining: cooldown.hoursRemaining,
        });
        return;
      }

      // Verify category exists
      const category = await prisma.quizCategory.findUnique({
        where: { id: categoryId },
      });

      if (!category) {
        res.status(404).json({
          status: 'ERROR',
          message: 'Category not found',
        });
        return;
      }

      // Get random questions (10 questions per quiz as per requirements)
      const questionCount = count ? parseInt(count as string, 10) : 10;
      const questions = await getRandomQuestions(categoryId, questionCount);

      if (questions.length === 0) {
        res.status(404).json({
          status: 'ERROR',
          message: 'No questions available for this category',
        });
        return;
      }

      res.json({
        status: 'SUCCESS',
        data: {
          category,
          questions,
          count: questions.length,
        },
      });
    } catch (error: any) {
      logger.error('Error starting quiz:', error);
      res.status(500).json({
        status: 'ERROR',
        message: error.message || 'Failed to start quiz',
      });
    }
  }
);

/**
 * POST /api/quiz/:categoryId/submit
 * إرسال إجابات الكويز
 */
router.post(
  '/:categoryId/submit',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const clerkUserId = req.auth?.userId;
      if (!clerkUserId) {
        res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
        return;
      }

      const { categoryId } = req.params;
      const { answers, totalTime } = req.body;

      if (!answers || !Array.isArray(answers) || answers.length === 0) {
        res.status(400).json({
          status: 'ERROR',
          message: 'Answers array is required',
        });
        return;
      }

      if (typeof totalTime !== 'number' || totalTime < 0) {
        res.status(400).json({
          status: 'ERROR',
          message: 'Total time must be a positive number',
        });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { clerkUserId },
        select: { id: true },
      });

      if (!user) {
        res.status(404).json({ status: 'ERROR', message: 'User not found' });
        return;
      }

      const result = await submitQuizAttempt({
        userId: user.id,
        categoryId,
        answers,
        totalTime,
      });

      res.json({
        status: 'SUCCESS',
        data: result,
      });
    } catch (error: any) {
      logger.error('Error submitting quiz:', error);
      res.status(500).json({
        status: 'ERROR',
        message: error.message || 'Failed to submit quiz',
      });
    }
  }
);

/**
 * GET /api/quiz/:categoryId/cooldown
 * فحص حالة الـ cooldown لفئة معينة
 */
router.get(
  '/:categoryId/cooldown',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const clerkUserId = req.auth?.userId;
      if (!clerkUserId) {
        res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
        return;
      }

      const { categoryId } = req.params;

      const user = await prisma.user.findUnique({
        where: { clerkUserId },
        select: { id: true },
      });

      if (!user) {
        res.status(404).json({ status: 'ERROR', message: 'User not found' });
        return;
      }

      const cooldown = await checkAttemptCooldown(user.id, categoryId);

      res.json({
        status: 'SUCCESS',
        data: cooldown,
      });
    } catch (error: any) {
      logger.error('Error checking cooldown:', error);
      res.status(500).json({
        status: 'ERROR',
        message: error.message || 'Failed to check cooldown',
      });
    }
  }
);

export default router;

