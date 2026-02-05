/**
 * Image Cache Service
 * خدمة تحميل وتخزين الصور محلياً للكويز
 * تستخدم expo-image مع Image.prefetch() لتحميل الصور في الخلفية
 * Progressive Loading مع Retry Logic متقدم
 */

import { Image } from 'expo-image';
import { logger } from '../utils/logger';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Cache keys
const IMAGE_CACHE_STATUS_KEY = 'quiz_images_cache_status';
const IMAGE_CACHE_METADATA_KEY = 'quiz_images_metadata';

interface ImageCacheMetadata {
    url: string;
    cached: boolean;
    lastAttempt: number;
    attempts: number;
    size?: number;
    error?: string;
}

interface ImageCacheStatus {
    totalImages: number;
    cachedImages: number;
    failedImages: number;
    lastUpdate: number;
    metadata: Record<string, ImageCacheMetadata>;
}

/**
 * تحميل مجموعة من الصور في الخلفية مع Progressive Loading
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

        logger.debug('[ImageCache] Starting progressive image prefetch', { count: validUrls.length });

        // جلب حالة الـ Cache الحالية
        const cacheStatus = await getImageCacheStatus();
        
        // تصفية الصور المحملة بالفعل
        const uncachedUrls = validUrls.filter(url => {
            const metadata = cacheStatus.metadata[url];
            return !metadata || !metadata.cached;
        });

        if (uncachedUrls.length === 0) {
            logger.debug('[ImageCache] All images already cached');
            return;
        }

        logger.debug('[ImageCache] Prefetching uncached images', { 
            total: validUrls.length,
            uncached: uncachedUrls.length,
            alreadyCached: validUrls.length - uncachedUrls.length
        });

        // تحميل الصور بالتوازي مع Progressive Loading
        await prefetchImagesProgressive(uncachedUrls, cacheStatus);
        
    } catch (error: any) {
        logger.error('[ImageCache] Error prefetching images', { error: error.message });
        // لا نرمي الخطأ، نترك التطبيق يعمل حتى لو فشل تحميل الصور
    }
}

/**
 * تحميل الصور بشكل تدريجي مع Retry Logic
 */
async function prefetchImagesProgressive(
    imageUrls: string[], 
    cacheStatus: ImageCacheStatus
): Promise<void> {
    const batchSize = 3; // تحميل 3 صور في نفس الوقت
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second base delay

    for (let i = 0; i < imageUrls.length; i += batchSize) {
        const batch = imageUrls.slice(i, i + batchSize);
        
        logger.debug('[ImageCache] Processing batch', { 
            batchIndex: Math.floor(i / batchSize) + 1,
            totalBatches: Math.ceil(imageUrls.length / batchSize),
            batchSize: batch.length
        });

        // تحميل الـ batch الحالي بالتوازي
        const batchPromises = batch.map(url => 
            prefetchSingleImageWithRetry(url, maxRetries, retryDelay, cacheStatus)
        );

        await Promise.allSettled(batchPromises);
        
        // انتظار قصير بين الـ batches لتجنب إرهاق الشبكة
        if (i + batchSize < imageUrls.length) {
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }

    // حفظ حالة الـ Cache المحدثة
    await saveImageCacheStatus(cacheStatus);
    
    const successCount = Object.values(cacheStatus.metadata)
        .filter(meta => meta.cached).length;
    const failedCount = Object.values(cacheStatus.metadata)
        .filter(meta => !meta.cached && meta.attempts >= maxRetries).length;

    logger.debug('[ImageCache] Progressive prefetch completed', {
        total: imageUrls.length,
        success: successCount,
        failed: failedCount,
        successRate: `${Math.round((successCount / imageUrls.length) * 100)}%`
    });
}

/**
 * تحميل صورة واحدة مع Retry Logic متقدم
 */
async function prefetchSingleImageWithRetry(
    imageUrl: string,
    maxRetries: number,
    baseDelay: number,
    cacheStatus: ImageCacheStatus
): Promise<boolean> {
    const metadata = cacheStatus.metadata[imageUrl] || {
        url: imageUrl,
        cached: false,
        lastAttempt: 0,
        attempts: 0
    };

    // تجنب المحاولة المتكررة للصور الفاشلة حديثاً
    const now = Date.now();
    const timeSinceLastAttempt = now - metadata.lastAttempt;
    const minRetryInterval = Math.pow(2, metadata.attempts) * 60000; // Exponential backoff in minutes

    if (metadata.attempts >= maxRetries && timeSinceLastAttempt < minRetryInterval) {
        logger.debug('[ImageCache] Skipping recent failed image', { 
            url: imageUrl.substring(0, 50),
            attempts: metadata.attempts,
            minutesSinceLastAttempt: Math.round(timeSinceLastAttempt / 60000)
        });
        return false;
    }

    for (let attempt = metadata.attempts; attempt < maxRetries; attempt++) {
        try {
            metadata.lastAttempt = now;
            metadata.attempts = attempt + 1;

            // تحديث الـ metadata في الـ cache status
            cacheStatus.metadata[imageUrl] = metadata;

            const startTime = Date.now();
            
            await Promise.race([
                Image.prefetch(imageUrl),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout')), 15000) // 15 seconds timeout
                )
            ]);
            
            const loadTime = Date.now() - startTime;
            
            // نجح التحميل
            metadata.cached = true;
            metadata.error = undefined;
            
            logger.debug('[ImageCache] Image cached successfully', { 
                url: imageUrl.substring(0, 50),
                attempt: attempt + 1,
                loadTime: `${loadTime}ms`
            });
            
            return true;

        } catch (error: any) {
            const delay = baseDelay * Math.pow(2, attempt); // Exponential backoff
            metadata.error = error.message;
            
            logger.warn('[ImageCache] Image prefetch failed', { 
                url: imageUrl.substring(0, 50),
                attempt: attempt + 1,
                maxRetries,
                error: error.message,
                nextRetryIn: attempt < maxRetries - 1 ? `${delay}ms` : 'none'
            });
            
            // انتظار قبل المحاولة التالية
            if (attempt < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    // فشل في جميع المحاولات
    metadata.cached = false;
    cacheStatus.metadata[imageUrl] = metadata;
    
    return false;
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

/**
 * تحميل صورة واحدة مع retry logic
 * @param imageUrl - مسار الصورة
 * @param retries - عدد المحاولات (افتراضي 3)
 * @returns Promise<boolean> - true إذا نجح التحميل
 */
export async function prefetchSingleImage(imageUrl: string, retries: number = 3): Promise<boolean> {
    if (!imageUrl || imageUrl.trim() === '') {
        return false;
    }

    const cacheStatus = await getImageCacheStatus();
    return await prefetchSingleImageWithRetry(imageUrl, retries, 1000, cacheStatus);
}

/**
 * جلب حالة الـ Image Cache
 */
async function getImageCacheStatus(): Promise<ImageCacheStatus> {
    try {
        const cached = await AsyncStorage.getItem(IMAGE_CACHE_STATUS_KEY);
        if (cached) {
            return JSON.parse(cached);
        }
    } catch (error) {
        logger.warn('[ImageCache] Error loading cache status:', error);
    }

    // إرجاع حالة افتراضية
    return {
        totalImages: 0,
        cachedImages: 0,
        failedImages: 0,
        lastUpdate: Date.now(),
        metadata: {}
    };
}

/**
 * حفظ حالة الـ Image Cache
 */
async function saveImageCacheStatus(status: ImageCacheStatus): Promise<void> {
    try {
        status.lastUpdate = Date.now();
        status.totalImages = Object.keys(status.metadata).length;
        status.cachedImages = Object.values(status.metadata).filter(m => m.cached).length;
        status.failedImages = Object.values(status.metadata).filter(m => !m.cached).length;

        await AsyncStorage.setItem(IMAGE_CACHE_STATUS_KEY, JSON.stringify(status));
    } catch (error) {
        logger.warn('[ImageCache] Error saving cache status:', error);
    }
}

/**
 * الحصول على إحصائيات الـ Image Cache
 */
export async function getImageCacheStats(): Promise<{
    totalImages: number;
    cachedImages: number;
    failedImages: number;
    successRate: number;
    lastUpdate: Date | null;
}> {
    const status = await getImageCacheStatus();
    
    return {
        totalImages: status.totalImages,
        cachedImages: status.cachedImages,
        failedImages: status.failedImages,
        successRate: status.totalImages > 0 ? (status.cachedImages / status.totalImages) * 100 : 0,
        lastUpdate: status.lastUpdate > 0 ? new Date(status.lastUpdate) : null,
    };
}

/**
 * مسح Image Cache
 */
export async function clearImageCache(): Promise<void> {
    try {
        await AsyncStorage.removeItem(IMAGE_CACHE_STATUS_KEY);
        await AsyncStorage.removeItem(IMAGE_CACHE_METADATA_KEY);
        logger.debug('[ImageCache] Cache cleared successfully');
    } catch (error) {
        logger.error('[ImageCache] Error clearing cache:', error);
    }
}

