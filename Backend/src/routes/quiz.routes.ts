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
import {
  getOrCreateDailyQuiz,
  getCurrentDailyQuiz,
  canUserTakeDailyQuiz,
  createNewDailyQuizFromNow,
} from '../services/daily-quiz.service';
import { getAnswers } from '../data/quiz-answers';

const router = Router();

// Log router initialization for debugging
logger.info('Quiz routes router initialized');
logger.info('Quiz routes endpoints: /health, /test-daily-status, /routes, /categories, /daily-status, /answers, /stats, /history, /:categoryId/start, /:categoryId/submit, /:categoryId/cooldown');

// Verify daily-status route is registered
const verifyRouteRegistration = () => {
    const routes = router.stack
        .filter((layer: any) => layer.route)
        .map((layer: any) => {
            const methods = Object.keys(layer.route.methods);
            return methods.map((method: string) => `${method.toUpperCase()} ${layer.route.path}`);
        })
        .flat();
    
    const hasDailyStatus = routes.some((route: string) => route.includes('daily-status'));
    if (hasDailyStatus) {
        logger.info('✅ /daily-status route is registered in router stack', {
            totalRoutes: routes.length,
            routes: routes,
        });
    } else {
        logger.error('❌ /daily-status route is NOT found in router stack!', {
            totalRoutes: routes.length,
            registeredRoutes: routes,
        });
    }
};

// Call verification after routes are registered
setTimeout(verifyRouteRegistration, 100);

// ============================================
// STATIC ROUTES (يجب أن تكون قبل Dynamic Routes)
// ============================================

/**
 * GET /api/quiz
 * Root endpoint - معلومات عن Quiz API
 */
router.get('/', (_req: Request, res: Response): void => {
    res.json({
        status: 'SUCCESS',
        message: 'Quiz API is available',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        endpoints: {
            public: [
                'GET /api/quiz - API information (this endpoint)',
                'GET /api/quiz/health - Health check',
                'GET /api/quiz/test-daily-status - Test endpoint',
                'GET /api/quiz/routes - List all routes',
            ],
            authenticated: [
                'GET /api/quiz/categories - Get open category',
                'GET /api/quiz/daily-status - Get daily quiz status',
                'POST /api/quiz/answers - Get answers',
                'GET /api/quiz/stats - Get user stats',
                'GET /api/quiz/history - Get quiz history',
                'GET /api/quiz/:categoryId/start - Start quiz',
                'POST /api/quiz/:categoryId/submit - Submit answers',
                'GET /api/quiz/:categoryId/cooldown - Check cooldown',
            ],
        },
    });
});

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

/**
 * GET /api/quiz/test-daily-status
 * Test endpoint للتحقق من أن daily-status route يعمل (بدون authentication)
 */
router.get('/test-daily-status', (_req: Request, res: Response): void => {
    res.json({
        status: 'SUCCESS',
        message: 'Daily status route is accessible',
        timestamp: new Date().toISOString(),
        path: '/quiz/daily-status',
        note: 'This is a test endpoint. The actual endpoint requires authentication.',
    });
});

/**
 * GET /api/quiz/routes
 * Debug endpoint لعرض جميع الـ routes المسجلة في quiz router
 */
router.get('/routes', (_req: Request, res: Response): void => {
    const routes: Array<{ method: string; path: string; requiresAuth: boolean }> = [];
    
    // Extract routes from router stack
    router.stack.forEach((middleware: any) => {
        if (middleware.route) {
            const methods = Object.keys(middleware.route.methods);
            methods.forEach((method: string) => {
                routes.push({
                    method: method.toUpperCase(),
                    path: middleware.route.path,
                    requiresAuth: middleware.route.stack.some((layer: any) => 
                        layer.name === 'requireAuth' || 
                        (layer.handle && layer.handle.toString().includes('requireAuth'))
                    ),
                });
            });
        }
    });

    res.json({
        status: 'SUCCESS',
        message: 'Quiz routes registered',
        timestamp: new Date().toISOString(),
        totalRoutes: routes.length,
        routes: routes.sort((a, b) => {
            // Sort static routes before dynamic routes
            const aIsStatic = !a.path.includes(':');
            const bIsStatic = !b.path.includes(':');
            if (aIsStatic !== bIsStatic) return aIsStatic ? -1 : 1;
            return a.path.localeCompare(b.path);
        }),
        endpoints: {
            static: [
                'GET /api/quiz/health',
                'GET /api/quiz/test-daily-status',
                'GET /api/quiz/routes',
                'GET /api/quiz/categories (requires auth)',
                'GET /api/quiz/daily-status (requires auth)',
                'POST /api/quiz/answers (requires auth)',
                'GET /api/quiz/stats (requires auth)',
                'GET /api/quiz/history (requires auth)',
            ],
            dynamic: [
                'GET /api/quiz/:categoryId/start (requires auth)',
                'POST /api/quiz/:categoryId/submit (requires auth)',
                'GET /api/quiz/:categoryId/cooldown (requires auth)',
            ],
        },
    });
});

// Quiz categories cache (5 minutes TTL)
const quizCategoriesCache = new Map<string, { data: any; timestamp: number }>();
const QUIZ_CATEGORIES_CACHE_TTL = 5 * 60 * 1000;

/**
 * GET /api/quiz/categories
 * جلب قائمة الكاتيجوريز المتاحة
 * الكاتيجوري والأسئلة موجودة في الفرونت إند
 * يتم إدارة الكاتيجوري المفتوح محلياً في الفرونت إند
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

        // جلب جميع الكاتيجوريز المتاحة
        const categories = await prisma.quizCategory.findMany({
            select: {
                id: true,
                name: true,
                icon: true,
                description: true,
                isLocked: true,
                unlockLevel: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'asc' },
        });

        if (categories.length === 0) {
            res.status(503).json({
                status: 'ERROR',
                message: 'Quiz system is not initialized. Please contact administrator.',
                code: 'QUIZ_NOT_INITIALIZED',
            });
            return;
        }

        const responseData = {
            status: 'SUCCESS',
            data: {
                categories: categories.map((cat) => ({
                    id: cat.id,
                    name: cat.name,
                    icon: cat.icon,
                    description: cat.description,
                    isLocked: cat.isLocked,
                    unlockLevel: cat.unlockLevel,
                    createdAt: cat.createdAt.toISOString(),
                })),
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
 * GET /api/quiz/daily-status
 * التحقق من حالة الكويز اليومي (هل يمكن أخذ الكويز أم هناك cooldown)
 * Requires authentication
 * 
 * IMPORTANT: This route MUST be defined before any dynamic routes like /:categoryId/*
 * to prevent Express from matching "daily-status" as a categoryId parameter
 */
router.get('/daily-status', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    logger.info(`📥 Quiz daily status endpoint called`, {
        path: req.path,
        method: req.method,
        originalUrl: req.originalUrl,
        baseUrl: req.baseUrl,
        url: req.url,
        query: req.query,
        headers: {
            'authorization': req.headers.authorization ? 'Bearer ***' : 'missing',
            'user-agent': req.headers['user-agent'],
            'x-forwarded-for': req.headers['x-forwarded-for'],
        },
        ip: req.ip,
    });
    
    try {
        const clerkUserId = req.auth?.userId;
        if (!clerkUserId) {
            logger.warn('Daily status endpoint called without valid authentication', {
                path: req.path,
                originalUrl: req.originalUrl,
            });
            res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
            return;
        }
        
        logger.info('Daily status endpoint - User authenticated', {
            userId: clerkUserId,
            path: req.path,
        });

        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true },
        });

        if (!user) {
            res.status(404).json({ status: 'ERROR', message: 'User not found' });
            return;
        }

        // جلب الاختبار اليومي الموحد
        let dailyQuiz = null;
        try {
            dailyQuiz = await getCurrentDailyQuiz();
        } catch (error: any) {
            logger.error('Error getting current daily quiz in daily-status endpoint', {
                error: error.message,
                stack: error.stack,
            });
            // المتابعة لإعادة المحاولة
        }

        if (!dailyQuiz) {
            // إنشاء اختبار جديد إذا لم يكن موجوداً
            let newDailyQuiz;
            try {
                newDailyQuiz = await getOrCreateDailyQuiz();
            } catch (error: any) {
                logger.error('Error creating daily quiz in daily-status endpoint', {
                    error: error.message,
                    stack: error.stack,
                });
                res.status(500).json({
                    status: 'ERROR',
                    message: 'Failed to create daily quiz',
                });
                return;
            }

            let canTakeInfo;
            try {
                canTakeInfo = await canUserTakeDailyQuiz(user.id);
            } catch (error: any) {
                logger.error('Error checking if user can take daily quiz', {
                    error: error.message,
                    stack: error.stack,
                    userId: user.id,
                });
                res.status(500).json({
                    status: 'ERROR',
                    message: 'Failed to check quiz availability',
                });
                return;
            }

            // جلب اسم الكاتيجوري
            let category = null;
            try {
                category = await prisma.quizCategory.findUnique({
                    where: { id: newDailyQuiz.categoryId },
                    select: { name: true },
                });
            } catch (error: any) {
                logger.error('Error fetching category in daily-status endpoint', {
                    error: error.message,
                    categoryId: newDailyQuiz.categoryId,
                });
                // المتابعة بدون اسم الكاتيجوري
            }

            res.json({
                status: 'SUCCESS',
                data: {
                    canTake: canTakeInfo.canTake,
                    categoryId: newDailyQuiz.categoryId,
                    categoryName: category?.name || 'Daily Quiz',
                    canRetryAt: canTakeInfo.canRetryAt?.toISOString() || null,
                    timeRemaining: canTakeInfo.timeRemaining || null,
                },
            });
            return;
        }

        // التحقق من أن المستخدم يمكنه أخذ الاختبار اليومي
        let canTakeInfo;
        try {
            canTakeInfo = await canUserTakeDailyQuiz(user.id);
        } catch (error: any) {
            logger.error('Error checking if user can take daily quiz', {
                error: error.message,
                stack: error.stack,
                userId: user.id,
            });
            res.status(500).json({
                status: 'ERROR',
                message: 'Failed to check quiz availability',
            });
            return;
        }

        const responseData = {
            status: 'SUCCESS',
            data: {
                canTake: canTakeInfo.canTake,
                categoryId: dailyQuiz.categoryId,
                categoryName: dailyQuiz.categoryName || 'Daily Quiz',
                canRetryAt: canTakeInfo.canRetryAt?.toISOString() || null,
                timeRemaining: canTakeInfo.timeRemaining || null,
            },
        };
        
        const duration = Date.now() - startTime;
        logger.info('Daily status endpoint - Success', {
            userId: user.id,
            canTake: canTakeInfo.canTake,
            categoryId: dailyQuiz.categoryId,
            duration: `${duration}ms`,
        });
        
        res.json(responseData);
    } catch (error: any) {
        const duration = Date.now() - startTime;
        logger.error('Error getting daily quiz status', {
            error: error.message,
            stack: error.stack,
            path: req.path,
            originalUrl: req.originalUrl,
            userId: req.auth?.userId,
            duration: `${duration}ms`,
        });
        res.status(500).json({
            status: 'ERROR',
            message: error.message || 'Failed to get daily quiz status',
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
 * POST /api/quiz/daily
 * جلب الكويز اليومي (20 سؤال من الأساطير)
 * يتجدد كل 24 ساعة تلقائياً
 * Requires authentication
 */
router.post('/daily', requireAuth, async (req: Request, res: Response): Promise<void> => {
    logger.info(`📥 Daily quiz endpoint called - Path: ${req.path}, Method: ${req.method}`);
    try {
        const clerkUserId = req.auth?.userId;
        if (!clerkUserId) {
            res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
            return;
        }

        // جلب أو إنشاء الكويز اليومي
        const dailyQuiz = await getOrCreateDailyQuiz();
        
        // جلب الأسئلة من قاعدة البيانات
        const questions = await prisma.quizQuestion.findMany({
            where: {
                id: { in: dailyQuiz.questionIds },
                categoryId: dailyQuiz.categoryId,
            },
            select: {
                id: true,
                question: true,
                options: true,
                difficulty: true,
                points: true,
                imageUrl: true,
                imageType: true,
                hint: true,
                timeLimit: true,
                categoryId: true,
                // لا نرسل correctAnswer للفرونت إند
            },
            orderBy: {
                createdAt: 'asc',
            },
        });

        // جلب displayMode باستخدام raw query لتجنب مشاكل TypeScript
        const displayModeResults = await prisma.$queryRaw<Array<{id: string, displayMode: string}>>`
            SELECT id, "displayMode"::text as "displayMode" 
            FROM quiz_questions 
            WHERE id = ANY(${dailyQuiz.questionIds})
        `;

        // تحويل إلى map للوصول السريع
        const displayModeMap = new Map(
            displayModeResults.map(item => [
                item.id, 
                item.displayMode.toLowerCase().replace('_', '-')
            ])
        );

        // ترتيب الأسئلة حسب questionIds في dailyQuiz (للحفاظ على الترتيب العشوائي)
        const orderedQuestions = dailyQuiz.questionIds.map(id => {
            const question = questions.find(q => q.id === id);
            if (!question) return null;
            
            return {
                ...question,
                displayMode: displayModeMap.get(id) || 'never',
            };
        }).filter(Boolean);

        logger.info(`Daily quiz fetched successfully`, {
            dailyQuizId: dailyQuiz.id,
            categoryId: dailyQuiz.categoryId,
            questionCount: orderedQuestions.length,
            expiresAt: dailyQuiz.expiresAt.toISOString(),
        });

        res.json({
            status: 'SUCCESS',
            data: {
                id: dailyQuiz.id,
                categoryId: dailyQuiz.categoryId,
                questions: orderedQuestions,
                expiresAt: dailyQuiz.expiresAt,
                date: dailyQuiz.date,
            },
        });
    } catch (error: any) {
        logger.error('Error getting daily quiz:', error);
        res.status(500).json({
            status: 'ERROR',
            message: error.message || 'Failed to get daily quiz',
        });
    }
});

/**
 * POST /api/quiz/daily/answers
 * جلب إجابات الكويز اليومي
 * Requires authentication
 */
router.post('/daily/answers', requireAuth, async (req: Request, res: Response): Promise<void> => {
    logger.info(`📥 Daily quiz answers endpoint called - Path: ${req.path}, Method: ${req.method}`);
    try {
        const clerkUserId = req.auth?.userId;
        if (!clerkUserId) {
            res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
            return;
        }

        const { questionIds } = req.body;

        if (!questionIds || !Array.isArray(questionIds) || questionIds.length === 0) {
            res.status(400).json({
                status: 'ERROR',
                message: 'questionIds array is required',
            });
            return;
        }

        // التحقق من أن الأسئلة من الكويز اليومي الحالي
        const currentDailyQuiz = await getCurrentDailyQuiz();
        if (!currentDailyQuiz) {
            res.status(404).json({
                status: 'ERROR',
                message: 'No active daily quiz found',
            });
            return;
        }

        // التحقق من أن جميع الأسئلة المطلوبة موجودة في الكويز اليومي
        const invalidQuestions = questionIds.filter(id => !currentDailyQuiz.questionIds.includes(id));
        if (invalidQuestions.length > 0) {
            res.status(400).json({
                status: 'ERROR',
                message: 'Some questions are not part of today\'s quiz',
                invalidQuestions,
            });
            return;
        }

        // جلب الإجابات من قاعدة البيانات
        const questions = await prisma.quizQuestion.findMany({
            where: {
                id: { in: questionIds },
                categoryId: currentDailyQuiz.categoryId,
            },
            select: {
                id: true,
                correctAnswer: true,
            },
        });

        const answersMap: Record<string, string> = {};
        questions.forEach((q) => {
            answersMap[q.id] = q.correctAnswer;
        });

        logger.info(`Daily quiz answers fetched successfully`, {
            dailyQuizId: currentDailyQuiz.id,
            questionCount: questionIds.length,
            answersCount: Object.keys(answersMap).length,
        });

        res.json({
            status: 'SUCCESS',
            data: answersMap,
        });
    } catch (error: any) {
        logger.error('Error getting daily quiz answers:', error);
        res.status(500).json({
            status: 'ERROR',
            message: error.message || 'Failed to get daily quiz answers',
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

/**
 * POST /api/quiz/reset-daily
 * إعادة تعيين الكويز اليومي وإنشاء واحد جديد يبدأ من الوقت الحالي
 * وإعادة تعيين cooldown لجميع المستخدمين
 * يمكن استدعاؤه بـ:
 * 1. Authentication (Bearer token) - للمستخدمين المسجلين
 * 2. Secret key (X-API-Key header) - للاستدعاء المباشر من Railway أو التطبيق
 */
router.post('/reset-daily', async (req: Request, res: Response): Promise<void> => {
  try {
    // التحقق من Secret Key أولاً (للاستدعاء المباشر)
    const apiKey = req.headers['x-api-key'] as string;
    const secretKey = process.env.QUIZ_RESET_SECRET_KEY || process.env.ADMIN_SECRET_KEY;
    
    // إذا كان هناك secret key وكان صحيح، السماح بالوصول مباشرة
    if (secretKey && apiKey === secretKey) {
      logger.info('Resetting daily quiz via API key');
      
      const result = await createNewDailyQuizFromNow();
      
      res.json({
        status: 'SUCCESS',
        message: 'Daily quiz reset successfully',
        data: {
          quizId: result.id,
          categoryId: result.categoryId,
          categoryName: result.categoryName,
          questionCount: result.questionIds.length,
          expiresAt: result.expiresAt.toISOString(),
          usersReset: result.usersReset,
        },
      });
      return;
    }
    
    // إذا لم يكن هناك secret key، التحقق من authentication
    const clerkUserId = req.auth?.userId;
    if (!clerkUserId) {
      res.status(401).json({ 
        status: 'ERROR', 
        message: 'Unauthorized. Provide either Bearer token or X-API-Key header' 
      });
      return;
    }

    logger.info('Resetting daily quiz', { userId: clerkUserId });

    const result = await createNewDailyQuizFromNow();

    res.json({
      status: 'SUCCESS',
      message: 'Daily quiz reset successfully',
      data: {
        quizId: result.id,
        categoryId: result.categoryId,
        categoryName: result.categoryName,
        questionCount: result.questionIds.length,
        expiresAt: result.expiresAt.toISOString(),
        usersReset: result.usersReset,
      },
    });
  } catch (error: any) {
    logger.error('Error resetting daily quiz:', error);
    res.status(500).json({
      status: 'ERROR',
      message: error.message || 'Failed to reset daily quiz',
    });
  }
});

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

      // جلب الاختبار اليومي الموحد
      const dailyQuiz = await getCurrentDailyQuiz();

      // إذا كان categoryId هو نفس الاختبار اليومي، استخدم الأسئلة من الاختبار اليومي
      if (dailyQuiz && dailyQuiz.categoryId === categoryId) {
        // التحقق من أن المستخدم يمكنه أخذ الاختبار
        const canTakeInfo = await canUserTakeDailyQuiz(user.id);
        
        if (!canTakeInfo.canTake) {
          res.status(429).json({
            status: 'ERROR',
            message: 'Quiz cooldown active',
            canRetryAt: canTakeInfo.canRetryAt,
            hoursRemaining: canTakeInfo.timeRemaining?.hours,
          });
          return;
        }

        res.json({
          status: 'SUCCESS',
          data: {
            categoryId: dailyQuiz.categoryId,
            categoryName: dailyQuiz.categoryName,
            questionIds: dailyQuiz.questionIds,
            count: dailyQuiz.questionIds.length,
          },
        });
        return;
      }

      // إذا لم يكن الاختبار اليومي، استخدم النظام القديم
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

