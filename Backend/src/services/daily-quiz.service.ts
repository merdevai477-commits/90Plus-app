/**
 * Daily Quiz Service
 * خدمة إدارة الاختبار اليومي الموحد
 * - كل المستخدمين يحصلون على نفس الاختبار في نفس اليوم
 * - يتم تحديث الاختبار كل 24 ساعة تلقائياً
 */

import prisma from '../lib/prisma';
import { logger } from '../utils/logger';

/**
 * إنشاء كاتيجوري افتراضية إذا لم تكن موجودة
 */
async function ensureDefaultCategories(): Promise<void> {
  const categoryCount = await prisma.quizCategory.count();
  
  if (categoryCount === 0) {
    logger.warn('No quiz categories found. Creating default categories...');
    
    const defaultCategories = [
      { name: 'In Common', description: 'What do they have in common?', icon: '🔗', isLocked: false, unlockLevel: 1 },
      { name: 'Flash', description: 'Quick fire questions', icon: '⚡', isLocked: false, unlockLevel: 1 },
      { name: 'Who Am I?', description: 'Guess the player from clues', icon: '🎭', isLocked: false, unlockLevel: 2 },
      { name: 'High Five', description: 'Name 5 things', icon: '🖐️', isLocked: false, unlockLevel: 1 },
      { name: 'Q&A', description: 'Multiple choice questions', icon: '❓', isLocked: false, unlockLevel: 1 },
      { name: 'Teammates', description: 'Questions about teammates', icon: '👥', isLocked: true, unlockLevel: 3 },
      { name: 'Guess the Number', description: 'Guess numbers and statistics', icon: '🔢', isLocked: false, unlockLevel: 1 },
      { name: 'Legends', description: 'Questions about football legends', icon: '👑', isLocked: true, unlockLevel: 3 },
    ];

    await prisma.quizCategory.createMany({
      data: defaultCategories,
      skipDuplicates: true,
    });

    logger.info(`Created ${defaultCategories.length} default quiz categories`);
  }
}

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

    // التأكد من وجود كاتيجوريز افتراضية
    await ensureDefaultCategories();

    // جلب كل الكاتيجوريز
    const categories = await prisma.quizCategory.findMany({
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });

    if (categories.length === 0) {
      logger.error('No quiz categories found after ensuring defaults. Database may be corrupted.');
      throw new Error('No quiz categories found. Please contact administrator.');
    }

    // اختيار كاتيجوري عشوائية
    const randomIndex = Math.floor(Math.random() * categories.length);
    let selectedCategory = categories[randomIndex];

    // جلب 20 سؤال عشوائي من الكاتيجوري المختارة
    let allQuestions = await prisma.quizQuestion.findMany({
      where: { categoryId: selectedCategory.id },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });

    // إذا لم تكن هناك أسئلة في هذه الكاتيجوري، جرب كاتيجوري أخرى
    if (allQuestions.length === 0) {
      logger.warn(`No questions found for category ${selectedCategory.id}, trying other categories...`);
      
      // جرب كل الكاتيجوريز حتى نجد واحدة بها أسئلة
      for (const cat of categories) {
        const questions = await prisma.quizQuestion.findMany({
          where: { categoryId: cat.id },
          select: { id: true },
          take: 20,
        });
        
        if (questions.length > 0) {
          allQuestions = questions;
          selectedCategory = cat;
          logger.info(`Using category ${cat.id} with ${questions.length} questions`);
          break;
        }
      }
      
      if (allQuestions.length === 0) {
        throw new Error('No questions found in any quiz category. Please seed the database with questions.');
      }
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

    // محاولة جلب daily quiz الحالي، وإذا لم يكن موجوداً، إنشاء واحد جديد
    let dailyQuiz = await getCurrentDailyQuiz();
    if (!dailyQuiz) {
      // إنشاء daily quiz جديد إذا لم يكن موجوداً
      logger.info('No current daily quiz found, creating new one...');
      const newDailyQuiz = await getOrCreateDailyQuiz();
      dailyQuiz = await getCurrentDailyQuiz();
      
      if (!dailyQuiz) {
        logger.error('Failed to create daily quiz');
        return { canTake: false };
      }
    }

    // البحث عن آخر محاولة للمستخدم للكويز اليومي الحالي
    // نبحث عن محاولات بعد وقت إنشاء daily quiz الحالي (ليس فقط اليوم)
    const lastAttempt = await prisma.quizAttempt.findFirst({
      where: {
        userId,
        categoryId: dailyQuiz.categoryId,
        completedAt: {
          gte: dailyQuiz.date, // استخدام تاريخ daily quiz بدلاً من بداية اليوم
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

/**
 * إنشاء كويز يومي جديد يبدأ من الوقت الحالي (ليس من بداية اليوم)
 * وإعادة تعيين cooldown لجميع المستخدمين
 */
export async function createNewDailyQuizFromNow(): Promise<{
  id: string;
  categoryId: string;
  categoryName: string;
  questionIds: string[];
  date: Date;
  expiresAt: Date;
  usersReset: number;
}> {
  try {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    // حذف جميع الكويزات اليومية القديمة
    await prisma.dailyQuiz.deleteMany({
      where: {
        date: today,
      },
    });

    logger.info('Creating new daily quiz from current time', { 
      currentTime: now.toISOString() 
    });

    // التأكد من وجود كاتيجوريز افتراضية
    await ensureDefaultCategories();

    // جلب كل الكاتيجوريز
    const categories = await prisma.quizCategory.findMany({
      select: { id: true, name: true },
      orderBy: { createdAt: 'asc' },
    });

    if (categories.length === 0) {
      logger.error('No quiz categories found after ensuring defaults. Database may be corrupted.');
      throw new Error('No quiz categories found. Please contact administrator.');
    }

    // اختيار كاتيجوري عشوائية
    const randomIndex = Math.floor(Math.random() * categories.length);
    let selectedCategory = categories[randomIndex];

    // جلب 20 سؤال عشوائي من الكاتيجوري المختارة
    let allQuestions = await prisma.quizQuestion.findMany({
      where: { categoryId: selectedCategory.id },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });

    // إذا لم تكن هناك أسئلة في هذه الكاتيجوري، جرب كاتيجوري أخرى
    if (allQuestions.length === 0) {
      logger.warn(`No questions found for category ${selectedCategory.id}, trying other categories...`);
      
      // جرب كل الكاتيجوريز حتى نجد واحدة بها أسئلة
      for (const cat of categories) {
        const questions = await prisma.quizQuestion.findMany({
          where: { categoryId: cat.id },
          select: { id: true },
          take: 20,
        });
        
        if (questions.length > 0) {
          allQuestions = questions;
          selectedCategory = cat;
          logger.info(`Using category ${cat.id} (${cat.name}) with ${questions.length} questions`);
          break;
        }
      }
      
      if (allQuestions.length === 0) {
        throw new Error('No questions found in any quiz category. Please seed the database with questions.');
      }
    }

    // اختيار 20 سؤال عشوائي
    const shuffled = [...allQuestions].sort(() => Math.random() - 0.5);
    const selectedQuestionIds = shuffled
      .slice(0, Math.min(20, allQuestions.length))
      .map((q) => q.id);

    // حساب وقت انتهاء الاختبار (24 ساعة من الوقت الحالي)
    const expiresAt = new Date(now);
    expiresAt.setHours(expiresAt.getHours() + 24);

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

    // إعادة تعيين cooldown لجميع المستخدمين للكويز اليومي الجديد
    // حذف جميع محاولات الكويز اليومي القديمة لهذا اليوم
    // وأيضاً حذف محاولات الكاتيجوري المختارة من اليوم السابق
    const deletedAttempts = await prisma.quizAttempt.deleteMany({
      where: {
        categoryId: selectedCategory.id,
        completedAt: {
          gte: today,
        },
      },
    });
    
    // أيضاً حذف محاولات من daily quiz القديم (إذا كان هناك daily quiz سابق)
    const oldDailyQuizzes = await prisma.dailyQuiz.findMany({
      where: {
        date: {
          lt: today,
        },
      },
      select: {
        categoryId: true,
      },
    });
    
    // حذف محاولات من الكاتيجوريز القديمة للكويزات اليومية السابقة
    let additionalDeleted = 0;
    if (oldDailyQuizzes.length > 0) {
      const oldCategoryIds = oldDailyQuizzes.map(q => q.categoryId);
      const additionalResult = await prisma.quizAttempt.deleteMany({
        where: {
          categoryId: {
            in: oldCategoryIds,
          },
          completedAt: {
            gte: today,
          },
        },
      });
      additionalDeleted = additionalResult.count;
    }

    logger.info('Daily quiz created and cooldowns reset', {
      id: newDailyQuiz.id,
      categoryId: selectedCategory.id,
      categoryName: selectedCategory.name,
      questionCount: selectedQuestionIds.length,
      expiresAt: expiresAt.toISOString(),
      deletedAttempts: deletedAttempts.count,
    });

    return {
      id: newDailyQuiz.id,
      categoryId: newDailyQuiz.categoryId,
      categoryName: selectedCategory.name,
      questionIds: newDailyQuiz.questionIds,
      date: newDailyQuiz.date,
      expiresAt: newDailyQuiz.expiresAt,
      usersReset: deletedAttempts.count + additionalDeleted,
    };
  } catch (error: any) {
    logger.error('Error creating new daily quiz from now:', error);
    throw error;
  }
}

