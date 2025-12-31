/**
 * Image Cache Service
 * خدمة تحميل وتخزين الصور محلياً للكويز
 * تستخدم expo-image مع Image.prefetch() لتحميل الصور في الخلفية
 */

import { Image } from 'expo-image';
import { logger } from '../utils/logger';

/**
 * تحميل مجموعة من الصور في الخلفية
 * @param imageUrls - قائمة بمسارات الصور
 * @returns Promise الذي يحل عند اكتمال التحميل
 */
export async function prefetchQuizImages(imageUrls: string[]): Promise<void> {
  try {
    // تصفية الصور الفارغة
    const validUrls = imageUrls.filter((url) => url && url.trim() !== '');
    
    if (validUrls.length === 0) {
      logger.debug('[ImageCache] No valid image URLs to prefetch');
      return;
    }

    logger.debug('[ImageCache] Prefetching images', { count: validUrls.length });

    // تحميل الصور بالتوازي
    // Image.prefetch() تقوم بتحميل الصور وتخزينها في cache تلقائياً
    const prefetchPromises = validUrls.map((url) => 
      Image.prefetch(url).catch((error) => {
        logger.warn('[ImageCache] Failed to prefetch image', { url, error: error.message });
        // لا نرمي خطأ، نستمر في تحميل باقي الصور
        return null;
      })
    );

    await Promise.all(prefetchPromises);
    
    logger.debug('[ImageCache] Completed prefetching images', { 
      total: validUrls.length,
      attempted: prefetchPromises.length 
    });
  } catch (error: any) {
    logger.error('[ImageCache] Error prefetching images', { error: error.message });
    // لا نرمي الخطأ، نترك التطبيق يعمل حتى لو فشل تحميل الصور
  }
}

/**
 * استخراج جميع URLs للصور من الأسئلة
 * @param questions - قائمة بالأسئلة
 * @returns قائمة بمسارات الصور
 */
export function extractImageUrlsFromQuestions(questions: Array<{ imageUrl?: string | null }>): string[] {
  const imageUrls: string[] = [];
  
  for (const question of questions) {
    if (question.imageUrl && question.imageUrl.trim() !== '') {
      imageUrls.push(question.imageUrl);
    }
  }
  
  return imageUrls;
}

