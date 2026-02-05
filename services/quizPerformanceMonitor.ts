/**
 * Quiz Performance Monitor
 * مراقب أداء الكويز - تتبع الأداء والإحصائيات
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/logger';

// Cache keys
const PERFORMANCE_STATS_KEY = 'quiz_performance_stats';
const PERFORMANCE_SESSION_KEY = 'quiz_performance_session';

interface PerformanceMetrics {
    // Loading Performance
    cacheHits: number;
    cacheMisses: number;
    apiCalls: number;
    averageLoadTime: number;
    
    // Image Performance
    imagesTotal: number;
    imagesLoaded: number;
    imagesFailed: number;
    averageImageLoadTime: number;
    
    // User Experience
    questionsAnswered: number;
    correctAnswers: number;
    averageAnswerTime: number;
    
    // Session Data
    sessionsCount: number;
    totalPlayTime: number;
    lastSessionDate: number;
    
    // Error Tracking
    errors: {
        networkErrors: number;
        cacheErrors: number;
        imageErrors: number;
        apiErrors: number;
    };
}

interface SessionMetrics {
    sessionId: string;
    startTime: number;
    endTime?: number;
    loadTime?: number;
    cacheHit: boolean;
    questionsAnswered: number;
    correctAnswers: number;
    imagesLoaded: number;
    imagesFailed: number;
    errors: string[];
}

class QuizPerformanceMonitor {
    private currentSession: SessionMetrics | null = null;
    private metrics: PerformanceMetrics | null = null;

    /**
     * بدء جلسة جديدة
     */
    async startSession(): Promise<string> {
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        this.currentSession = {
            sessionId,
            startTime: Date.now(),
            cacheHit: false,
            questionsAnswered: 0,
            correctAnswers: 0,
            imagesLoaded: 0,
            imagesFailed: 0,
            errors: [],
        };

        logger.debug('[PerformanceMonitor] Session started', { sessionId });
        return sessionId;
    }

    /**
     * إنهاء الجلسة الحالية
     */
    async endSession(): Promise<void> {
        if (!this.currentSession) {
            return;
        }

        this.currentSession.endTime = Date.now();
        
        // حفظ بيانات الجلسة
        await this.saveSessionData();
        
        // تحديث الإحصائيات العامة
        await this.updateOverallMetrics();

        logger.debug('[PerformanceMonitor] Session ended', {
            sessionId: this.currentSession.sessionId,
            duration: this.currentSession.endTime - this.currentSession.startTime,
            questionsAnswered: this.currentSession.questionsAnswered,
            correctAnswers: this.currentSession.correctAnswers,
        });

        this.currentSession = null;
    }

    /**
     * تسجيل وقت تحميل الكويز
     */
    recordLoadTime(loadTime: number, fromCache: boolean): void {
        if (!this.currentSession) {
            return;
        }

        this.currentSession.loadTime = loadTime;
        this.currentSession.cacheHit = fromCache;

        logger.debug('[PerformanceMonitor] Load time recorded', {
            loadTime: `${loadTime}ms`,
            fromCache,
        });
    }

    /**
     * تسجيل إجابة سؤال
     */
    recordAnswer(isCorrect: boolean, answerTime: number): void {
        if (!this.currentSession) {
            return;
        }

        this.currentSession.questionsAnswered++;
        if (isCorrect) {
            this.currentSession.correctAnswers++;
        }

        logger.debug('[PerformanceMonitor] Answer recorded', {
            isCorrect,
            answerTime: `${answerTime}ms`,
            totalAnswered: this.currentSession.questionsAnswered,
        });
    }

    /**
     * تسجيل تحميل صورة
     */
    recordImageLoad(success: boolean, loadTime?: number): void {
        if (!this.currentSession) {
            return;
        }

        if (success) {
            this.currentSession.imagesLoaded++;
        } else {
            this.currentSession.imagesFailed++;
        }

        logger.debug('[PerformanceMonitor] Image load recorded', {
            success,
            loadTime: loadTime ? `${loadTime}ms` : 'unknown',
            totalLoaded: this.currentSession.imagesLoaded,
            totalFailed: this.currentSession.imagesFailed,
        });
    }

    /**
     * تسجيل خطأ
     */
    recordError(errorType: 'network' | 'cache' | 'image' | 'api', error: string): void {
        if (!this.currentSession) {
            return;
        }

        this.currentSession.errors.push(`${errorType}: ${error}`);

        logger.debug('[PerformanceMonitor] Error recorded', {
            errorType,
            error,
            totalErrors: this.currentSession.errors.length,
        });
    }

    /**
     * الحصول على إحصائيات الأداء
     */
    async getPerformanceStats(): Promise<PerformanceMetrics> {
        if (!this.metrics) {
            this.metrics = await this.loadMetrics();
        }
        return this.metrics;
    }

    /**
     * الحصول على إحصائيات الجلسة الحالية
     */
    getCurrentSessionStats(): SessionMetrics | null {
        return this.currentSession;
    }

    /**
     * مسح جميع الإحصائيات
     */
    async clearStats(): Promise<void> {
        try {
            await AsyncStorage.removeItem(PERFORMANCE_STATS_KEY);
            await AsyncStorage.removeItem(PERFORMANCE_SESSION_KEY);
            this.metrics = null;
            this.currentSession = null;
            logger.debug('[PerformanceMonitor] Stats cleared');
        } catch (error) {
            logger.error('[PerformanceMonitor] Error clearing stats:', error);
        }
    }

    /**
     * تحميل الإحصائيات من التخزين
     */
    private async loadMetrics(): Promise<PerformanceMetrics> {
        try {
            const stored = await AsyncStorage.getItem(PERFORMANCE_STATS_KEY);
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (error) {
            logger.warn('[PerformanceMonitor] Error loading metrics:', error);
        }

        // إرجاع إحصائيات افتراضية
        return {
            cacheHits: 0,
            cacheMisses: 0,
            apiCalls: 0,
            averageLoadTime: 0,
            imagesTotal: 0,
            imagesLoaded: 0,
            imagesFailed: 0,
            averageImageLoadTime: 0,
            questionsAnswered: 0,
            correctAnswers: 0,
            averageAnswerTime: 0,
            sessionsCount: 0,
            totalPlayTime: 0,
            lastSessionDate: 0,
            errors: {
                networkErrors: 0,
                cacheErrors: 0,
                imageErrors: 0,
                apiErrors: 0,
            },
        };
    }

    /**
     * حفظ بيانات الجلسة
     */
    private async saveSessionData(): Promise<void> {
        if (!this.currentSession) {
            return;
        }

        try {
            const sessionKey = `${PERFORMANCE_SESSION_KEY}_${this.currentSession.sessionId}`;
            await AsyncStorage.setItem(sessionKey, JSON.stringify(this.currentSession));
        } catch (error) {
            logger.error('[PerformanceMonitor] Error saving session data:', error);
        }
    }

    /**
     * تحديث الإحصائيات العامة
     */
    private async updateOverallMetrics(): Promise<void> {
        if (!this.currentSession) {
            return;
        }

        try {
            const metrics = await this.loadMetrics();
            const session = this.currentSession;
            const sessionDuration = (session.endTime || Date.now()) - session.startTime;

            // تحديث إحصائيات التحميل
            if (session.cacheHit) {
                metrics.cacheHits++;
            } else {
                metrics.cacheMisses++;
                metrics.apiCalls++;
            }

            if (session.loadTime) {
                metrics.averageLoadTime = this.updateAverage(
                    metrics.averageLoadTime,
                    session.loadTime,
                    metrics.cacheHits + metrics.cacheMisses
                );
            }

            // تحديث إحصائيات الصور
            metrics.imagesTotal += session.imagesLoaded + session.imagesFailed;
            metrics.imagesLoaded += session.imagesLoaded;
            metrics.imagesFailed += session.imagesFailed;

            // تحديث إحصائيات الأسئلة
            metrics.questionsAnswered += session.questionsAnswered;
            metrics.correctAnswers += session.correctAnswers;

            // تحديث إحصائيات الجلسة
            metrics.sessionsCount++;
            metrics.totalPlayTime += sessionDuration;
            metrics.lastSessionDate = Date.now();

            // تحديث إحصائيات الأخطاء
            session.errors.forEach(error => {
                if (error.includes('network')) metrics.errors.networkErrors++;
                else if (error.includes('cache')) metrics.errors.cacheErrors++;
                else if (error.includes('image')) metrics.errors.imageErrors++;
                else if (error.includes('api')) metrics.errors.apiErrors++;
            });

            // حفظ الإحصائيات المحدثة
            await AsyncStorage.setItem(PERFORMANCE_STATS_KEY, JSON.stringify(metrics));
            this.metrics = metrics;

        } catch (error) {
            logger.error('[PerformanceMonitor] Error updating metrics:', error);
        }
    }

    /**
     * تحديث المتوسط
     */
    private updateAverage(currentAverage: number, newValue: number, count: number): number {
        if (count <= 1) {
            return newValue;
        }
        return ((currentAverage * (count - 1)) + newValue) / count;
    }

    /**
     * الحصول على تقرير الأداء
     */
    async getPerformanceReport(): Promise<{
        summary: {
            cacheHitRate: number;
            averageLoadTime: number;
            imageSuccessRate: number;
            quizAccuracy: number;
            totalSessions: number;
            totalPlayTime: string;
        };
        details: PerformanceMetrics;
    }> {
        const metrics = await this.getPerformanceStats();
        
        const totalRequests = metrics.cacheHits + metrics.cacheMisses;
        const cacheHitRate = totalRequests > 0 ? (metrics.cacheHits / totalRequests) * 100 : 0;
        
        const imageSuccessRate = metrics.imagesTotal > 0 
            ? (metrics.imagesLoaded / metrics.imagesTotal) * 100 
            : 0;
            
        const quizAccuracy = metrics.questionsAnswered > 0 
            ? (metrics.correctAnswers / metrics.questionsAnswered) * 100 
            : 0;

        const totalPlayTimeFormatted = this.formatDuration(metrics.totalPlayTime);

        return {
            summary: {
                cacheHitRate: Math.round(cacheHitRate * 100) / 100,
                averageLoadTime: Math.round(metrics.averageLoadTime),
                imageSuccessRate: Math.round(imageSuccessRate * 100) / 100,
                quizAccuracy: Math.round(quizAccuracy * 100) / 100,
                totalSessions: metrics.sessionsCount,
                totalPlayTime: totalPlayTimeFormatted,
            },
            details: metrics,
        };
    }

    /**
     * تنسيق المدة الزمنية
     */
    private formatDuration(milliseconds: number): string {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }
}

// Singleton instance
export const quizPerformanceMonitor = new QuizPerformanceMonitor();

// Helper functions
export const startQuizSession = () => quizPerformanceMonitor.startSession();
export const endQuizSession = () => quizPerformanceMonitor.endSession();
export const recordQuizLoadTime = (loadTime: number, fromCache: boolean) => 
    quizPerformanceMonitor.recordLoadTime(loadTime, fromCache);
export const recordQuizAnswer = (isCorrect: boolean, answerTime: number) => 
    quizPerformanceMonitor.recordAnswer(isCorrect, answerTime);
export const recordQuizImageLoad = (success: boolean, loadTime?: number) => 
    quizPerformanceMonitor.recordImageLoad(success, loadTime);
export const recordQuizError = (errorType: 'network' | 'cache' | 'image' | 'api', error: string) => 
    quizPerformanceMonitor.recordError(errorType, error);
export const getQuizPerformanceStats = () => quizPerformanceMonitor.getPerformanceStats();
export const getQuizPerformanceReport = () => quizPerformanceMonitor.getPerformanceReport();
export const clearQuizPerformanceStats = () => quizPerformanceMonitor.clearStats();