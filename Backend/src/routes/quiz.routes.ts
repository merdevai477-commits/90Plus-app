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
import {
  checkAndUnlockCategory,
  isCategoryOpenForUser,
} from '../services/quiz-state.service';
import { getAnswers } from '../data/quiz-answers';

const router = Router();

// Log router initialization for debugging
logger.info('Quiz routes router initialized');
logger.info('Quiz routes endpoints: /health, /categories, /answers, /:categoryId/start, /:categoryId/submit');

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
 * جلب النوع المفتوح فقط للمستخدم (categoryId فقط)
 * الكاتيجوري والأسئلة موجودة في الفرونت إند
 * Requires authentication - guests cannot access quiz
 */
router.get('/categories', requireAuth, async (req: Request, res: Response): Promise<void> => {
    logger.info(`📥 Quiz categories endpoint called - Path: ${req.path}, Method: ${req.method}`);
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

        // فحص وفتح النوع إذا لزم الأمر
        const { shouldUnlock, currentCategoryId, nextUnlockAt } =
            await checkAndUnlockCategory(user.id);

        if (!currentCategoryId) {
            res.json({
                status: 'SUCCESS',
                data: {
                    openCategoryId: null,
                    nextUnlockAt: nextUnlockAt?.toISOString(),
                },
            });
            return;
        }

        // جلب اسم النوع فقط للتحقق
        const category = await prisma.quizCategory.findUnique({
            where: { id: currentCategoryId },
            select: { name: true },
        });

        if (!category) {
            res.status(404).json({
                status: 'ERROR',
                message: 'Category not found',
            });
            return;
        }

        // جلب الأسئلة المستخدمة لتحديد الأسئلة المتاحة
        const usedAnswers = await prisma.userQuizAnswer.findMany({
            where: {
                userId: user.id,
                question: {
                    categoryId: currentCategoryId,
                },
            },
            select: {
                questionId: true,
            },
            distinct: ['questionId'],
        });

        const usedQuestionIds = usedAnswers.map((a) => a.questionId);

        // جلب كل questionIds للفئة
        const allQuestions = await prisma.quizQuestion.findMany({
            where: { categoryId: currentCategoryId },
            select: { id: true },
            orderBy: { createdAt: 'asc' }, // Order from backend
        });

        // استبعاد الأسئلة المستخدمة
        let availableQuestionIds = allQuestions
            .map((q) => q.id)
            .filter((id) => !usedQuestionIds.includes(id));

        // إذا لم يبقَ أسئلة كافية، إعادة استخدام كل الأسئلة
        if (availableQuestionIds.length < 20) {
            availableQuestionIds = allQuestions.map((q) => q.id);
        }

        // اختيار 20 سؤال عشوائي مع الحفاظ على الترتيب من الباك إند
        const shuffled = [...availableQuestionIds].sort(() => Math.random() - 0.5);
        const selectedQuestionIds = shuffled.slice(0, 20);

        const responseData = {
            status: 'SUCCESS',
            data: {
                openCategoryId: currentCategoryId,
                openCategoryName: category.name,
                questionIds: selectedQuestionIds, // الأسئلة المختارة للاختبار اليومي
                nextUnlockAt: nextUnlockAt?.toISOString(),
            },
        };

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
 * POST /api/quiz/answers
 * جلب الإجابات الصحيحة للأسئلة من الملفات المحلية
 * Requires authentication
 */
router.post('/answers', requireAuth, async (req: Request, res: Response): Promise<void> => {
    logger.info(`📥 Quiz answers endpoint called - Path: ${req.path}, Method: ${req.method}`);
    try {
        const clerkUserId = req.auth?.userId;
        if (!clerkUserId) {
            res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
            return;
        }

        const { questionIds, categoryId } = req.body;

        if (!questionIds || !Array.isArray(questionIds) || questionIds.length === 0) {
            res.status(400).json({
                status: 'ERROR',
                message: 'questionIds array is required',
            });
            return;
        }

        if (!categoryId) {
            res.status(400).json({
                status: 'ERROR',
                message: 'categoryId is required',
            });
            return;
        }

        // جلب الإجابات من الملفات المحلية
        let answersMap: Record<string, string> = {};
        
        try {
            // محاولة جلب من الملفات المحلية (static import)
            answersMap = getAnswers(categoryId, questionIds);
            
            // إذا لم نجد إجابات في الملفات، استخدم قاعدة البيانات
            if (Object.keys(answersMap).length === 0) {
                logger.warn('No answers found in files, falling back to database');
                throw new Error('No answers in files');
            }
        } catch (error: any) {
            logger.warn('Failed to load answers from files, falling back to database:', error.message);
            
            // Fallback: جلب من قاعدة البيانات إذا فشل تحميل الملفات
            const questions = await prisma.quizQuestion.findMany({
                where: {
                    id: { in: questionIds },
                    categoryId,
                },
                select: {
                    id: true,
                    correctAnswer: true,
                },
            });

            questions.forEach((q) => {
                answersMap[q.id] = q.correctAnswer;
            });
        }

        res.json({
            status: 'SUCCESS',
            data: answersMap,
        });
    } catch (error: any) {
        logger.error('Error getting quiz answers:', error);
        res.status(500).json({
            status: 'ERROR',
            message: error.message || 'Failed to get answers',
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

      // التحقق من أن النوع مفتوح للمستخدم
      const isOpen = await isCategoryOpenForUser(user.id, categoryId);
      if (!isOpen) {
        res.status(403).json({
          status: 'ERROR',
          message: 'This category is not available for you at the moment',
        });
        return;
      }

      // إرجاع فقط questionIds (الأسئلة موجودة في الفرونت إند)
      // جلب الأسئلة المستخدمة لتحديد الأسئلة المتاحة
      const usedAnswers = await prisma.userQuizAnswer.findMany({
        where: {
          userId: user.id,
          question: {
            categoryId,
          },
        },
        select: {
          questionId: true,
        },
        distinct: ['questionId'],
      });

      const usedQuestionIds = usedAnswers.map((a) => a.questionId);

      // جلب كل questionIds للفئة
      const allQuestions = await prisma.quizQuestion.findMany({
        where: { categoryId },
        select: { id: true },
      });

      // استبعاد الأسئلة المستخدمة
      let availableQuestionIds = allQuestions
        .map((q) => q.id)
        .filter((id) => !usedQuestionIds.includes(id));

      // إذا لم يبقَ أسئلة كافية، إعادة استخدام كل الأسئلة
      if (availableQuestionIds.length < 20) {
        availableQuestionIds = allQuestions.map((q) => q.id);
      }

      // اختيار 20 سؤال عشوائي
      const shuffled = [...availableQuestionIds].sort(() => Math.random() - 0.5);
      const selectedQuestionIds = shuffled.slice(0, 20);

      res.json({
        status: 'SUCCESS',
        data: {
          categoryId: category.id,
          categoryName: category.name,
          questionIds: selectedQuestionIds,
          count: selectedQuestionIds.length,
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

