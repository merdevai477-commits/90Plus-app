/**
 * Daily Quiz Service
 * خدمة إدارة الاختبار اليومي الموحد
 * - كل المستخدمين يحصلون على نفس الاختبار في نفس اليوم
 * - يتم تحديث الاختبار كل 24 ساعة تلقائياً
 */

import prisma from '../lib/prisma';
import { logger } from '../utils/logger';

/**
 * الحصول على الاختبار اليومي الحالي أو إنشاء واحد جديد
 */
export async function getOrCreateDailyQuiz(): Promise<{
  id: string;
  categoryId: string;
  questionIds: string[];
  date: Date;
  expiresAt: Date;
}> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // بداية اليوم
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // محاولة جلب الاختبار اليومي الحالي
    let dailyQuiz = await prisma.dailyQuiz.findUnique({
      where: { date: today },
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // إذا كان الاختبار موجوداً ولم ينتهِ، إرجاعه
    if (dailyQuiz && new Date() < dailyQuiz.expiresAt) {
      return {
        id: dailyQuiz.id,
        categoryId: dailyQuiz.categoryId,
        questionIds: dailyQuiz.questionIds,
        date: dailyQuiz.date,
        expiresAt: dailyQuiz.expiresAt,
      };
    }

    // إذا لم يكن موجوداً أو انتهى، إنشاء اختبار جديد
    logger.info('Creating new daily quiz', { date: today.toISOString() });

    // جلب كل الكاتيجوريز
    const categories = await prisma.quizCategory.findMany({
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });

    if (categories.length === 0) {
      throw new Error('No quiz categories found');
    }

    // اختيار كاتيجوري عشوائية
    const randomIndex = Math.floor(Math.random() * categories.length);
    const selectedCategory = categories[randomIndex];

    // جلب 20 سؤال عشوائي من الكاتيجوري المختارة
    const allQuestions = await prisma.quizQuestion.findMany({
      where: { categoryId: selectedCategory.id },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });

    if (allQuestions.length === 0) {
      throw new Error(`No questions found for category ${selectedCategory.id}`);
    }

    // اختيار 20 سؤال عشوائي
    const shuffled = [...allQuestions].sort(() => Math.random() - 0.5);
    const selectedQuestionIds = shuffled
      .slice(0, Math.min(20, allQuestions.length))
      .map((q) => q.id);

    // حساب وقت انتهاء الاختبار (24 ساعة من بداية اليوم)
    const expiresAt = new Date(today);
    expiresAt.setHours(24, 0, 0, 0);

    // حذف الاختبار القديم إذا كان موجوداً
    if (dailyQuiz) {
      await prisma.dailyQuiz.delete({
        where: { id: dailyQuiz.id },
      });
    }

    // إنشاء الاختبار الجديد
    const newDailyQuiz = await prisma.dailyQuiz.create({
      data: {
        categoryId: selectedCategory.id,
        questionIds: selectedQuestionIds,
        date: today,
        expiresAt,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    logger.info('Daily quiz created successfully', {
      id: newDailyQuiz.id,
      categoryId: selectedCategory.id,
      questionCount: selectedQuestionIds.length,
      expiresAt: expiresAt.toISOString(),
    });

    return {
      id: newDailyQuiz.id,
      categoryId: newDailyQuiz.categoryId,
      questionIds: newDailyQuiz.questionIds,
      date: newDailyQuiz.date,
      expiresAt: newDailyQuiz.expiresAt,
    };
  } catch (error: any) {
    logger.error('Error getting or creating daily quiz:', error);
    throw error;
  }
}

/**
 * الحصول على الاختبار اليومي الحالي فقط (بدون إنشاء)
 */
export async function getCurrentDailyQuiz(): Promise<{
  id: string;
  categoryId: string;
  categoryName: string;
  questionIds: string[];
  date: Date;
  expiresAt: Date;
} | null> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dailyQuiz = await prisma.dailyQuiz.findUnique({
      where: { date: today },
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!dailyQuiz || new Date() >= dailyQuiz.expiresAt) {
      return null;
    }

    return {
      id: dailyQuiz.id,
      categoryId: dailyQuiz.categoryId,
      categoryName: dailyQuiz.category.name,
      questionIds: dailyQuiz.questionIds,
      date: dailyQuiz.date,
      expiresAt: dailyQuiz.expiresAt,
    };
  } catch (error: any) {
    logger.error('Error getting current daily quiz:', error);
    return null;
  }
}

/**
 * التحقق من أن المستخدم يمكنه أخذ الاختبار اليومي
 */
export async function canUserTakeDailyQuiz(userId: string): Promise<{
  canTake: boolean;
  canRetryAt?: Date;
  timeRemaining?: {
    hours: number;
    minutes: number;
    seconds: number;
    totalSeconds: number;
  };
}> {
  try {
    // جلب آخر محاولة للاختبار اليومي
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dailyQuiz = await getCurrentDailyQuiz();
    if (!dailyQuiz) {
      return { canTake: false };
    }

    // البحث عن آخر محاولة للمستخدم في نفس اليوم
    const lastAttempt = await prisma.quizAttempt.findFirst({
      where: {
        userId,
        categoryId: dailyQuiz.categoryId,
        completedAt: {
          gte: today,
        },
      },
      orderBy: {
        completedAt: 'desc',
      },
    });

    if (!lastAttempt) {
      return { canTake: true };
    }

    // التحقق من cooldown (24 ساعة)
    const now = new Date();
    if (now >= lastAttempt.canRetryAt) {
      return { canTake: true };
    }

    // حساب الوقت المتبقي
    const diff = lastAttempt.canRetryAt.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return {
      canTake: false,
      canRetryAt: lastAttempt.canRetryAt,
      timeRemaining: {
        hours,
        minutes,
        seconds,
        totalSeconds: Math.floor(diff / 1000),
      },
    };
  } catch (error: any) {
    logger.error('Error checking if user can take daily quiz:', error);
    return { canTake: false };
  }
}

