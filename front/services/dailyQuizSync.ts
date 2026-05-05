/**
 * Daily Quiz Background Sync Service
 * خدمة مزامنة الكويز اليومي في الخلفية
 * تحديث تلقائي كل ساعة، تحميل مسبق للصور
 */

import { AppState, AppStateStatus } from 'react-native';
import { getDailyQuiz, isDailyQuizCached, clearDailyQuizCache } from './quizApi';
import { logger } from '../utils/logger';

type GetTokenFunction = () => Promise<string | null>;

class DailyQuizSyncService {
    private syncInterval: ReturnType<typeof setTimeout> | null = null;
    private getToken: GetTokenFunction | null = null;
    private isActive = false;
    private lastSyncTime = 0;
    private appStateSubscription: any = null;

    // Sync every hour
    private readonly SYNC_INTERVAL = 60 * 60 * 1000; // 1 hour
    private readonly MIN_SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes minimum

    /**
     * بدء خدمة المزامنة
     */
    start(getToken: GetTokenFunction): void {
        if (this.isActive) {
            logger.debug('[DailyQuizSync] Service already active');
            return;
        }

        this.getToken = getToken;
        this.isActive = true;

        logger.info('[DailyQuizSync] Starting background sync service');

        // مزامنة فورية عند البدء
        this.performSync();

        // مزامنة دورية كل ساعة
        this.syncInterval = setInterval(() => {
            this.performSync();
        }, this.SYNC_INTERVAL);

        // مراقبة حالة التطبيق
        this.setupAppStateListener();

        logger.info('[DailyQuizSync] Background sync service started');
    }

    /**
     * إيقاف خدمة المزامنة
     */
    stop(): void {
        if (!this.isActive) {
            return;
        }

        logger.info('[DailyQuizSync] Stopping background sync service');

        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }

        if (this.appStateSubscription) {
            this.appStateSubscription.remove();
            this.appStateSubscription = null;
        }

        this.isActive = false;
        this.getToken = null;

        logger.info('[DailyQuizSync] Background sync service stopped');
    }

    /**
     * مزامنة يدوية فورية
     */
    async syncNow(force: boolean = false): Promise<boolean> {
        if (!this.getToken) {
            logger.warn('[DailyQuizSync] No getToken function available');
            return false;
        }

        return await this.performSync(force);
    }

    /**
     * تنفيذ المزامنة
     */
    private async performSync(force: boolean = false): Promise<boolean> {
        if (!this.getToken) {
            logger.warn('[DailyQuizSync] No getToken function available');
            return false;
        }

        const now = Date.now();
        
        // تجنب المزامنة المتكررة
        if (!force && (now - this.lastSyncTime) < this.MIN_SYNC_INTERVAL) {
            logger.debug('[DailyQuizSync] Skipping sync - too soon since last sync');
            return false;
        }

        try {
            logger.debug('[DailyQuizSync] Starting sync process');
            this.lastSyncTime = now;

            // فحص حالة الـ Cache الحالي
            const cacheStatus = await isDailyQuizCached();
            
            if (cacheStatus.cached && !force) {
                const hoursUntilExpiry = cacheStatus.expiresAt 
                    ? Math.max(0, (cacheStatus.expiresAt.getTime() - now) / (1000 * 60 * 60))
                    : 0;

                // إذا باقي أكتر من ساعة، لا حاجة للمزامنة
                if (hoursUntilExpiry > 1) {
                    logger.debug('[DailyQuizSync] Cache still fresh, skipping sync', {
                        hoursRemaining: hoursUntilExpiry.toFixed(1),
                        questionCount: cacheStatus.questionCount,
                        imagesCached: cacheStatus.imagesCached,
                    });
                    return true;
                }

                logger.debug('[DailyQuizSync] Cache expiring soon, refreshing', {
                    hoursRemaining: hoursUntilExpiry.toFixed(1),
                });
            }

            // جلب الكويز اليومي الجديد
            const result = await getDailyQuiz(this.getToken, force);
            
            logger.info('[DailyQuizSync] Sync completed successfully', {
                questionCount: result.questions.length,
                answersCount: Object.keys(result.answers).length,
                fromCache: result.fromCache,
                expiresAt: result.expiresAt.toISOString(),
            });

            return true;

        } catch (error: any) {
            logger.error('[DailyQuizSync] Sync failed:', error);
            return false;
        }
    }

    /**
     * إعداد مراقب حالة التطبيق
     */
    private setupAppStateListener(): void {
        this.appStateSubscription = AppState.addEventListener(
            'change',
            this.handleAppStateChange.bind(this)
        );
    }

    /**
     * معالج تغيير حالة التطبيق
     */
    private handleAppStateChange(nextAppState: AppStateStatus): void {
        if (nextAppState === 'active') {
            logger.debug('[DailyQuizSync] App became active, checking for sync');
            
            // مزامنة عند العودة للتطبيق (إذا مر وقت كافي)
            const timeSinceLastSync = Date.now() - this.lastSyncTime;
            if (timeSinceLastSync > this.MIN_SYNC_INTERVAL) {
                this.performSync();
            }
        }
    }

    /**
     * مسح Cache ومزامنة جديدة
     */
    async refreshCache(): Promise<boolean> {
        if (!this.getToken) {
            logger.warn('[DailyQuizSync] No getToken function available');
            return false;
        }

        try {
            logger.info('[DailyQuizSync] Refreshing cache');
            
            // مسح Cache الحالي
            await clearDailyQuizCache();
            
            // جلب كويز جديد
            const result = await getDailyQuiz(this.getToken, true);
            
            logger.info('[DailyQuizSync] Cache refreshed successfully', {
                questionCount: result.questions.length,
                answersCount: Object.keys(result.answers).length,
            });

            return true;
        } catch (error: any) {
            logger.error('[DailyQuizSync] Cache refresh failed:', error);
            return false;
        }
    }

    /**
     * الحصول على حالة الخدمة
     */
    getStatus(): {
        isActive: boolean;
        lastSyncTime: Date | null;
        nextSyncTime: Date | null;
    } {
        return {
            isActive: this.isActive,
            lastSyncTime: this.lastSyncTime > 0 ? new Date(this.lastSyncTime) : null,
            nextSyncTime: this.isActive && this.lastSyncTime > 0 
                ? new Date(this.lastSyncTime + this.SYNC_INTERVAL)
                : null,
        };
    }
}

// Singleton instance
export const dailyQuizSyncService = new DailyQuizSyncService();

// Helper functions
export const startDailyQuizSync = (getToken: GetTokenFunction) => {
    dailyQuizSyncService.start(getToken);
};

export const stopDailyQuizSync = () => {
    dailyQuizSyncService.stop();
};

export const syncDailyQuizNow = (force: boolean = false) => {
    return dailyQuizSyncService.syncNow(force);
};

export const refreshDailyQuizCache = () => {
    return dailyQuizSyncService.refreshCache();
};

export const getDailyQuizSyncStatus = () => {
    return dailyQuizSyncService.getStatus();
};