/**
 * Quiz State Service
 * خدمة إدارة حالة الكويز للمستخدمين
 * - تتبع النوع المفتوح حالياً
 * - إدارة فتح الأنواع كل 24 ساعة
 * - منع تكرار الأنواع حتى يتم فتح كل الأنواع
 */

import prisma from '../lib/prisma';
import { logger } from '../utils/logger';

const QUIZ_CATEGORIES_COUNT = 8; // عدد أنواع الاختبارات
const HOURS_UNTIL_NEXT_UNLOCK = 24; // ساعات حتى فتح النوع التالي

/**
 * جلب حالة الكويز للمستخدم
 */
export async function getUserQuizState(userId: string) {
  try {
    let state = await prisma.userQuizState.findUnique({
      where: { userId },
      include: {
        user: {
          select: { id: true },
        },
      },
    });

    // إنشاء state جديد إذا لم يكن موجوداً
    if (!state) {
      // إنشاء state جديد
      state = await prisma.userQuizState.create({
        data: {
          userId,
          completedCategoryIds: [],
        },
        include: {
          user: {
            select: { id: true },
          },
        },
      });

      // فتح كويز عشوائي تلقائياً للمستخدم الجديد
      const newCategoryId = await openNextCategory(userId);
      if (newCategoryId) {
        // إعادة جلب state مع الكويز المفتوح
        state = await prisma.userQuizState.findUnique({
          where: { userId },
          include: {
            user: {
              select: { id: true },
            },
          },
        });
        logger.info(`Auto-opened category ${newCategoryId} for new user ${userId}`);
      }
    }

    return state;
  } catch (error: any) {
    logger.error('Error getting user quiz state:', error);
    throw error;
  }
}

/**
 * تحديد النوع التالي المتاح (عشوائي من غير المفتوحة)
 */
export async function getNextAvailableCategory(userId: string): Promise<string | null> {
  try {
    const state = await getUserQuizState(userId);

    // جلب كل الأنواع
    const allCategories = await prisma.quizCategory.findMany({
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });

    if (allCategories.length === 0) {
      return null;
    }

    // استبعاد الأنواع المكتملة
    const availableCategories = allCategories.filter(
      (cat) => !state.completedCategoryIds.includes(cat.id)
    );

    // إذا تم فتح كل الأنواع، إعادة تعيين القائمة
    if (availableCategories.length === 0) {
      // إعادة تعيين completedCategoryIds
      await prisma.userQuizState.update({
        where: { userId },
        data: {
          completedCategoryIds: [],
        },
      });

      // إرجاع نوع عشوائي من كل الأنواع
      const randomIndex = Math.floor(Math.random() * allCategories.length);
      return allCategories[randomIndex].id;
    }

    // اختيار عشوائي من الأنواع المتاحة
    const randomIndex = Math.floor(Math.random() * availableCategories.length);
    return availableCategories[randomIndex].id;
  } catch (error: any) {
    logger.error('Error getting next available category:', error);
    throw error;
  }
}

/**
 * فتح النوع التالي للمستخدم
 */
export async function openNextCategory(userId: string): Promise<string | null> {
  try {
    const nextCategoryId = await getNextAvailableCategory(userId);

    if (!nextCategoryId) {
      return null;
    }

    const now = new Date();
    const nextUnlockAt = new Date(now);
    nextUnlockAt.setHours(nextUnlockAt.getHours() + HOURS_UNTIL_NEXT_UNLOCK);

    await prisma.userQuizState.update({
      where: { userId },
      data: {
        currentOpenCategoryId: nextCategoryId,
        lastCategoryOpenedAt: now,
        nextCategoryUnlockAt: nextUnlockAt,
      },
    });

    logger.info(`Opened category ${nextCategoryId} for user ${userId}`);
    return nextCategoryId;
  } catch (error: any) {
    logger.error('Error opening next category:', error);
    throw error;
  }
}

/**
 * فحص إذا كان يجب فتح نوع جديد (كل 24 ساعة)
 */
export async function checkAndUnlockCategory(userId: string): Promise<{
  shouldUnlock: boolean;
  currentCategoryId: string | null;
  nextUnlockAt: Date | null;
}> {
  try {
    const state = await getUserQuizState(userId);
    const now = new Date();

    // إذا لم يكن هناك نوع مفتوح، فتح واحد جديد
    if (!state.currentOpenCategoryId) {
      const newCategoryId = await openNextCategory(userId);
      // إعادة جلب state المحدث للحصول على nextUnlockAt الصحيح
      const updatedState = await prisma.userQuizState.findUnique({
        where: { userId },
      });
      return {
        shouldUnlock: true,
        currentCategoryId: newCategoryId,
        nextUnlockAt: updatedState?.nextCategoryUnlockAt || null,
      };
    }

    // إذا انتهت الـ 24 ساعة، فتح النوع التالي
    if (state.nextCategoryUnlockAt && now >= state.nextCategoryUnlockAt) {
      const newCategoryId = await openNextCategory(userId);
      // إعادة جلب state المحدث للحصول على nextUnlockAt الصحيح
      const updatedState = await prisma.userQuizState.findUnique({
        where: { userId },
      });
      return {
        shouldUnlock: true,
        currentCategoryId: newCategoryId,
        nextUnlockAt: updatedState?.nextCategoryUnlockAt || null,
      };
    }

    return {
      shouldUnlock: false,
      currentCategoryId: state.currentOpenCategoryId,
      nextUnlockAt: state.nextCategoryUnlockAt,
    };
  } catch (error: any) {
    logger.error('Error checking and unlocking category:', error);
    throw error;
  }
}

/**
 * إغلاق النوع بعد الحل وفتح التالي
 */
export async function markCategoryCompleted(
  userId: string,
  categoryId: string
): Promise<string | null> {
  try {
    const state = await getUserQuizState(userId);

    // إضافة النوع إلى المكتملة إذا لم يكن موجوداً
    const updatedCompletedIds = state.completedCategoryIds.includes(categoryId)
      ? state.completedCategoryIds
      : [...state.completedCategoryIds, categoryId];

    // تحديث lastAttemptAt
    await prisma.userQuizState.update({
      where: { userId },
      data: {
        completedCategoryIds: updatedCompletedIds,
        lastAttemptAt: new Date(),
        currentOpenCategoryId: null, // إغلاق النوع الحالي
      },
    });

    // فتح النوع التالي فوراً
    const nextCategoryId = await openNextCategory(userId);

    logger.info(
      `Marked category ${categoryId} as completed for user ${userId}, opened next: ${nextCategoryId}`
    );

    return nextCategoryId;
  } catch (error: any) {
    logger.error('Error marking category as completed:', error);
    throw error;
  }
}

/**
 * التحقق من أن النوع مفتوح للمستخدم
 */
export async function isCategoryOpenForUser(
  userId: string,
  categoryId: string
): Promise<boolean> {
  try {
    const state = await getUserQuizState(userId);
    return state.currentOpenCategoryId === categoryId;
  } catch (error: any) {
    logger.error('Error checking if category is open:', error);
    return false;
  }
}

