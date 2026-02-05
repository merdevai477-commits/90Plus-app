/**
 * Quiz API Service
 * API client for quiz-related endpoints
 */

import { getApiUrl } from '../config/api.config';
import { useAuth } from '@clerk/clerk-expo';
import { cacheService } from './cacheService';
import { getQuestionsByIds } from '../data/quizQuestions/index';
import { logger } from '../utils/logger';
import { Image } from 'react-native';

// Types
export interface LocalQuizQuestion {
  id: string;
  categoryId: string;
  question: string;
  options: string[];
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  points: number;
  imageUrl?: string | null;
  imageType?: 'player' | 'club' | 'general' | null;
  hint?: string | null;
  timeLimit?: number;
  displayMode?: 'never' | 'after-answer' | 'before-question' | 'in-question' | 'after-wrong' | 'blur-reveal';
}

const API_URL = getApiUrl();
const API_TIMEOUT = 10000; // 10 seconds

// Cache keys and TTL
const QUIZ_CATEGORIES_CACHE_KEY = 'quiz_categories';
const QUIZ_CATEGORIES_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Memory cache for instant responses
const memoryCache = new Map<string, { data: any; timestamp: number }>();
const MEMORY_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

const getFromMemoryCache = (key: string): any | null => {
    const cached = memoryCache.get(key);
    if (cached && Date.now() - cached.timestamp < MEMORY_CACHE_TTL) {
        return cached.data;
    }
    return null;
};

const setMemoryCache = (key: string, data: any): void => {
    memoryCache.set(key, { data, timestamp: Date.now() });
};

// Type for getToken function from useAuth hook
type GetTokenFunction = () => Promise<string | null>;

// Helper function for fetch with timeout and authentication
const fetchWithAuth = async (
    endpoint: string,
    getToken: GetTokenFunction,
    options: RequestInit = {},
    timeout = API_TIMEOUT
): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const startTime = Date.now();

    try {
        // Get auth token from Clerk using the provided getToken function
        const token = await getToken();
        
        if (!token) {
            console.error('[QuizAPI] No authentication token available', {
                endpoint,
                apiUrl: API_URL,
                fullUrl: `${API_URL}${endpoint}`,
            });
            throw new Error('No authentication token available. Please sign in.');
        }
        
        const url = `${API_URL}${endpoint}`;
        const fullUrl = url;
        
        console.log(`[QuizAPI] Fetching: ${fullUrl}`, {
            method: options.method || 'GET',
            endpoint,
            apiUrl: API_URL,
            hasToken: !!token,
        });
        
        const response = await fetch(fullUrl, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                ...options.headers,
            },
            signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;
        
        // Log response status for debugging
        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unable to read error response');
            console.error(`[QuizAPI] Request failed`, {
                status: response.status,
                statusText: response.statusText,
                url: fullUrl,
                endpoint,
                apiUrl: API_URL,
                duration: `${duration}ms`,
                errorText: errorText.substring(0, 200), // Limit error text length
                headers: Object.fromEntries(response.headers.entries()),
            });
        } else {
            console.log(`[QuizAPI] Request successful`, {
                status: response.status,
                url: fullUrl,
                endpoint,
                duration: `${duration}ms`,
            });
        }
        
        return response;
    } catch (error: any) {
        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;
        
        if (error.name === 'AbortError') {
            console.error('[QuizAPI] Request timeout', {
                endpoint,
                apiUrl: API_URL,
                fullUrl: `${API_URL}${endpoint}`,
                timeout,
                duration: `${duration}ms`,
            });
            throw new Error('Request timeout - please check your connection');
        }
        
        console.error('[QuizAPI] Network error', {
            error: error.message,
            errorName: error.name,
            endpoint,
            apiUrl: API_URL,
            fullUrl: `${API_URL}${endpoint}`,
            duration: `${duration}ms`,
        });
        
        if (error.message) {
            throw error;
        }
        throw new Error(`Network error: ${error.message || 'Unknown error'}`);
    }
};

// Types
export interface QuizCategory {
    id: string;
    name: string;
    icon?: string | null;
    description?: string | null;
    isLocked: boolean;
    unlockLevel: number;
    createdAt: string;
    isOpen?: boolean;
    nextUnlockAt?: string;
}

// QuizQuestion interface - نفس البنية الموجودة في quizQuestions.ts
export type QuizQuestion = LocalQuizQuestion;

export interface QuizAnswer {
    questionId: string;
    userAnswer: string; // index as string (0, 1, 2, 3)
    timeTaken: number; // seconds
}

export interface QuizSubmission {
    answers: QuizAnswer[];
    totalTime: number; // total time in seconds
}

export interface QuizResult {
    attemptId: string;
    score: number;
    correctAnswers: number;
    totalQuestions: number;
    bestStreak: number;
    rewards: {
        coins: number;
        xp: number;
    };
    canRetryAt: string;
}

export interface QuizCooldown {
    canStart: boolean;
    canRetryAt?: string;
    hoursRemaining?: number;
}

export interface DailyQuizStatus {
    canTake: boolean;
    categoryId: string | null;
    categoryName: string | null;
    canRetryAt: string | null;
    timeRemaining: {
        hours: number;
        minutes: number;
        seconds: number;
        totalSeconds: number;
    } | null;
}

export interface QuizStats {
    totalAttempts: number;
    totalScore: number;
    totalCoinsEarned: number;
    totalXpEarned: number;
    totalCorrectAnswers: number;
    totalQuestions: number;
    bestScore: number;
    bestStreak: number;
    accuracy: number;
    byCategory: Array<{
        categoryId: string;
        attempts: number;
        totalScore: number;
        bestScore: number;
        bestStreak: number;
    }>;
}

export interface QuizHistoryItem {
    id: string;
    category: {
        id: string;
        name: string;
        icon?: string | null;
    };
    score: number;
    totalQuestions: number;
    correctAnswers: number;
    coinsEarned: number;
    xpEarned: number;
    bestStreak: number;
    completedAt: string;
    canRetryAt: string;
}

/**
 * Get daily quiz status (can take, cooldown, etc.)
 * جلب حالة الكويز اليومي
 */
export async function getDailyQuizStatus(getToken: GetTokenFunction): Promise<DailyQuizStatus> {
    const startTime = Date.now();
    try {
        if (!getToken) {
            logger.error('[QuizAPI] getDailyQuizStatus - No getToken function provided', {
                apiUrl: API_URL,
                endpoint: '/quiz/daily-status',
                fullUrl: `${API_URL}/quiz/daily-status`,
            });
            throw new Error('Authentication token function is not available');
        }

        logger.debug('[QuizAPI] getDailyQuizStatus - Starting request', {
            apiUrl: API_URL,
            endpoint: '/quiz/daily-status',
            fullUrl: `${API_URL}/quiz/daily-status`,
        });

        const response = await fetchWithAuth('/quiz/daily-status', getToken, {
            method: 'GET',
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = `Failed to fetch daily quiz status: ${response.status} ${response.statusText}`;
            let errorData: any = null;
            
            try {
                errorData = JSON.parse(errorText);
                errorMessage = errorData.message || errorData.error || errorMessage;
            } catch {
                if (errorText) {
                    errorMessage = errorText;
                }
            }
            
            logger.error('[QuizAPI] getDailyQuizStatus - Request failed', {
                status: response.status,
                statusText: response.statusText,
                errorMessage,
                errorData,
                apiUrl: API_URL,
                endpoint: '/quiz/daily-status',
                fullUrl: `${API_URL}/quiz/daily-status`,
                duration: `${Date.now() - startTime}ms`,
            });
            
            // If 404, provide helpful error message
            if (response.status === 404) {
                throw new Error(`Endpoint not found. Please check if the server is running and the route is registered. URL: ${API_URL}/quiz/daily-status`);
            }
            
            throw new Error(errorMessage);
        }

        const data = await response.json();
        const duration = Date.now() - startTime;
        
        if (data.status === 'SUCCESS') {
            console.log('[QuizAPI] getDailyQuizStatus - Success', {
                canTake: data.data?.canTake,
                categoryId: data.data?.categoryId,
                duration: `${duration}ms`,
            });
            
            return data.data || {
                canTake: false,
                categoryId: null,
                categoryName: null,
                canRetryAt: null,
                timeRemaining: null,
            };
        }

        throw new Error(data.message || 'Failed to fetch daily quiz status');
    } catch (error: any) {
        const duration = Date.now() - startTime;
        console.error('[QuizAPI] getDailyQuizStatus - Error', {
            error: error.message,
            errorName: error.name,
            apiUrl: API_URL,
            endpoint: '/quiz/daily-status',
            fullUrl: `${API_URL}/quiz/daily-status`,
            duration: `${duration}ms`,
        });
        
        // Return default on error
        return {
            canTake: false,
            categoryId: null,
            categoryName: null,
            canRetryAt: null,
            timeRemaining: null,
        };
    }
}

/**
 * Get quiz answers for a specific category and questionIds
 * جلب الإجابات لكاتيجوري معينة و questionIds
 * يتم استخدامها عند فتح كويز جديد محلياً
 */
export async function fetchAnswersForCategory(
    categoryId: string,
    questionIds: string[],
    getToken: GetTokenFunction
): Promise<Record<string, string>> {
    try {
        return await getQuizAnswers(questionIds, getToken);
    } catch (error: any) {
        console.error('Error fetching answers for category:', error);
        throw error;
    }
}

/**
 * Get category mapping from backend (categoryId -> categoryName)
 * جلب mapping الكاتيجوريز من الباك إند
 */
export async function getCategoryMapping(getToken: GetTokenFunction): Promise<Record<string, string>> {
    try {
        // Check if getToken is available
        if (!getToken) {
            console.warn('[QuizAPI] getCategoryMapping - No getToken function provided');
            return {};
        }

        const response = await fetchWithAuth('/quiz/categories', getToken, {
            method: 'GET',
        });

        if (!response.ok) {
            // Log warning instead of error for non-critical failures
            console.warn(`[QuizAPI] getCategoryMapping - Request failed: ${response.status} ${response.statusText}`);
            return {}; // Return empty mapping instead of throwing
        }

        const data = await response.json();
        
        // Check if response has the expected structure
        if (data.status === 'SUCCESS' && data.data?.categories) {
            const mapping: Record<string, string> = {};
            data.data.categories.forEach((cat: { id: string; name: string }) => {
                if (cat.id && cat.name) {
                    mapping[cat.id] = cat.name;
                }
            });
            console.log(`[QuizAPI] getCategoryMapping - Successfully loaded ${Object.keys(mapping).length} categories`);
            return mapping;
        }

        // If response structure is different, try alternative formats
        if (data.status === 'SUCCESS' && Array.isArray(data.data)) {
            const mapping: Record<string, string> = {};
            data.data.forEach((cat: { id: string; name: string }) => {
                if (cat.id && cat.name) {
                    mapping[cat.id] = cat.name;
                }
            });
            console.log(`[QuizAPI] getCategoryMapping - Successfully loaded ${Object.keys(mapping).length} categories (alternative format)`);
            return mapping;
        }

        // Log warning for unexpected response structure
        console.warn('[QuizAPI] getCategoryMapping - Unexpected response structure:', {
            status: data.status,
            hasData: !!data.data,
            hasCategories: !!data.data?.categories,
            message: data.message,
        });
        
        return {}; // Return empty mapping instead of throwing
    } catch (error: any) {
        // Log as warning instead of error since this is non-critical
        console.warn('[QuizAPI] getCategoryMapping - Error (non-critical):', {
            error: error.message,
            errorName: error.name,
        });
        return {}; // إرجاع mapping فارغ في حالة الخطأ
    }
}

/**
 * Get open quiz category with questionIds and answers
 * الكاتيجوري موجودة في الفرونت إند
 * يتم جلب questionIds والإجابات عند تسجيل الدخول وكل 24 ساعة
 * 
 * @deprecated This function is being replaced by local quiz state management
 * Use quizLocalState instead for managing quiz state locally
 */
export async function getQuizCategories(getToken: GetTokenFunction, retryCount: number = 0): Promise<{
    openCategoryId: string | null;
    openCategoryName: string | null;
    questionIds: string[];
    answers: Record<string, string>; // { questionId: correctAnswer }
    nextUnlockAt: string | null;
    canTake: boolean; // هل يمكن أخذ الكويز
    canRetryAt: string | null;
    timeRemaining: {
        hours: number;
        minutes: number;
        seconds: number;
        totalSeconds: number;
    } | null;
}> {
    try {
        // Check if getToken is available
        if (!getToken) {
            throw new Error('Authentication token function is not available');
        }

        // Check memory cache first (instant)
        const memoryCached = getFromMemoryCache(QUIZ_CATEGORIES_CACHE_KEY);
        if (memoryCached) {
            return memoryCached;
        }

        const token = await getToken();
        if (!token) {
            throw new Error('No authentication token available. Please sign in.');
        }

        const response = await fetchWithAuth('/quiz/categories', getToken, {
            method: 'GET',
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = `Failed to fetch categories: ${response.status} ${response.statusText}`;
            
            try {
                const errorData = JSON.parse(errorText);
                errorMessage = errorData.message || errorData.error || errorMessage;
            } catch {
                if (errorText) {
                    errorMessage = errorText;
                }
            }
            
            throw new Error(errorMessage);
        }

        const data = await response.json();
        if (data.status === 'SUCCESS') {
            const result = data.data || {
                openCategoryId: null,
                openCategoryName: null,
                questionIds: [],
                nextUnlockAt: null,
            };

            // إذا كان هناك questionIds، جلب الإجابات
            let answers: Record<string, string> = {};
            if (result.questionIds && result.questionIds.length > 0) {
                try {
                    answers = await getQuizAnswers(result.questionIds, getToken);
                    // حفظ الإجابات في cache
                    const answersCacheKey = `quiz_answers_${result.openCategoryId}`;
                    await cacheService.set(answersCacheKey, answers, 24 * 60 * 60 * 1000); // 24 hours
                    setMemoryCache(answersCacheKey, answers);
                } catch (error) {
                    console.error('Error fetching answers:', error);
                    // محاولة جلب الإجابات من cache إذا فشل الطلب
                    const answersCacheKey = `quiz_answers_${result.openCategoryId}`;
                    const cachedAnswers = await cacheService.get<Record<string, string>>(answersCacheKey);
                    if (cachedAnswers) {
                        answers = cachedAnswers;
                    }
                }
            }

            const finalResult = {
                openCategoryId: result.openCategoryId,
                openCategoryName: result.openCategoryName,
                questionIds: result.questionIds || [],
                answers,
                nextUnlockAt: result.nextUnlockAt,
                canTake: result.canTake ?? true, // افتراضياً يمكن أخذ الكويز
                canRetryAt: result.canRetryAt || null,
                timeRemaining: result.timeRemaining || null,
            };
            
            // Cache in memory
            setMemoryCache(QUIZ_CATEGORIES_CACHE_KEY, finalResult);
            
            return finalResult;
        }

        throw new Error(data.message || 'Failed to fetch categories');
    } catch (error: any) {
        console.error('Error fetching quiz categories:', error);
        
        // Retry with exponential backoff (max 2 retries)
        if (retryCount < 2) {
            const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s
            await new Promise(resolve => setTimeout(resolve, delay));
            return getQuizCategories(getToken, retryCount + 1);
        }
        
        // Return default if retries failed
        return {
            openCategoryId: null,
            openCategoryName: null,
            questionIds: [],
            answers: {},
            nextUnlockAt: null,
            canTake: false,
            canRetryAt: null,
            timeRemaining: null,
        };
    }
}

/**
 * Start a new quiz - get questionIds and load questions from local
 * الأسئلة موجودة في الفرونت إند - يتم جلبها محلياً بناءً على questionIds
 */
export async function startQuiz(
    categoryId: string,
    getToken: GetTokenFunction,
    count?: number
): Promise<{
    categoryId: string;
    categoryName: string;
    questionIds: string[];
    questions: QuizQuestion[]; // الأسئلة من الفرونت إند
    count: number;
}> {
    try {
        const url = `/quiz/${categoryId}/start${count ? `?count=${count}` : ''}`;
        const response = await fetchWithAuth(url, getToken, {
            method: 'GET',
        });

        if (!response.ok) {
            if (response.status === 429) {
                // Cooldown active
                const errorData = await response.json();
                throw new Error('COOLDOWN_ACTIVE');
            }
            throw new Error(`Failed to start quiz: ${response.statusText}`);
        }

        const data = await response.json();
        if (data.status === 'SUCCESS') {
            const { questionIds, categoryId: catId, categoryName } = data.data;
            
            // جلب الأسئلة من الفرونت إند بناءً على questionIds
            const questions = getQuestionsByIds(questionIds);
            
            if (questions.length !== questionIds.length) {
                console.warn(`⚠️ Some questions not found locally. Expected ${questionIds.length}, found ${questions.length}`);
            }
            
            return {
                categoryId: catId,
                categoryName,
                questionIds,
                questions,
                count: questions.length,
            };
        }

        throw new Error(data.message || 'Failed to start quiz');
    } catch (error: any) {
        console.error('Error starting quiz:', error);
        throw error;
    }
}

/**
 * Get correct answers for questions
 * جلب الإجابات الصحيحة للأسئلة
 * يتم cache الإجابات لمدة 24 ساعة
 */
export async function getQuizAnswers(
    questionIds: string[],
    getToken: GetTokenFunction
): Promise<Record<string, string>> {
    try {
        // إنشاء cache key من questionIds مرتبة
        const sortedIds = [...questionIds].sort();
        const cacheKey = `quiz_answers_${sortedIds.join('_')}`;
        
        // 1. محاولة جلب من memory cache أولاً (أسرع)
        const memoryCached = getFromMemoryCache(cacheKey);
        if (memoryCached) {
            logger.debug('[QuizAPI] getQuizAnswers - Using memory cache', { 
                questionCount: questionIds.length,
                answersCount: Object.keys(memoryCached).length 
            });
            return memoryCached;
        }

        // 2. محاولة جلب من AsyncStorage cache (24 ساعة)
        const cached = await cacheService.get<Record<string, string>>(cacheKey);
        if (cached) {
            // تحديث memory cache للوصول السريع
            setMemoryCache(cacheKey, cached);
            logger.debug('[QuizAPI] getQuizAnswers - Using AsyncStorage cache', { 
                questionCount: questionIds.length,
                answersCount: Object.keys(cached).length 
            });
            return cached;
        }

        // 3. جلب من الباك إند (إذا لم يكن في cache)
        logger.debug('[QuizAPI] getQuizAnswers - Fetching from API', { 
            questionCount: questionIds.length 
        });
        
        // استخدام categoryId افتراضي للأساطير (لأن الأسئلة الآن تأتي من الباك إند)
        const categoryId = 'legends'; // Default to legends category for daily quiz
        
        if (!categoryId) {
            throw new Error('Category ID not found - using default legends category');
        }

        const response = await fetchWithAuth('/quiz/answers', getToken, {
            method: 'POST',
            body: JSON.stringify({ questionIds, categoryId }),
        });

        if (!response.ok) {
            throw new Error(`Failed to get answers: ${response.statusText}`);
        }

        const data = await response.json();
        if (data.status === 'SUCCESS') {
            const answers = data.data; // { questionId: correctAnswer }
            
            // حفظ في cache (24 ساعة) - memory + AsyncStorage
            setMemoryCache(cacheKey, answers);
            await cacheService.set(cacheKey, answers, 24 * 60 * 60 * 1000);
            
            logger.debug('[QuizAPI] getQuizAnswers - Saved to cache', { 
                questionCount: questionIds.length,
                answersCount: Object.keys(answers).length 
            });
            
            return answers;
        }

        throw new Error(data.message || 'Failed to get answers');
    } catch (error: any) {
        logger.error('[QuizAPI] Error getting quiz answers:', error);
        throw error;
    }
}

/**
 * Submit quiz answers
 */
export async function submitQuiz(
    categoryId: string,
    submission: QuizSubmission,
    getToken: GetTokenFunction
): Promise<QuizResult> {
    try {
        const response = await fetchWithAuth(`/quiz/${categoryId}/submit`, getToken, {
            method: 'POST',
            body: JSON.stringify(submission),
        });

        if (!response.ok) {
            throw new Error(`Failed to submit quiz: ${response.statusText}`);
        }

        const data = await response.json();
        if (data.status === 'SUCCESS') {
            return data.data;
        }

        throw new Error(data.message || 'Failed to submit quiz');
    } catch (error: any) {
        console.error('Error submitting quiz:', error);
        throw error;
    }
}

/**
 * Submit quiz results (simplified version for sync service)
 * إرسال نتائج الكويز للباك إند
 */
export async function submitQuizResults(
    categoryId: string,
    results: {
        questionIds: string[];
        answers: Record<string, string>; // { questionId: correctAnswer } - غير مستخدم حالياً
        score: number;
        correctAnswers: number;
        totalQuestions: number;
        timeTaken: number;
    },
    getToken: GetTokenFunction
): Promise<QuizResult> {
    try {
        // تحويل النتائج إلى تنسيق QuizSubmission
        // نحتاج إلى إنشاء QuizAnswer[] من questionIds
        // لكننا لا نملك userAnswer لكل سؤال، لذا سنستخدم إجابات افتراضية
        const quizAnswers: QuizAnswer[] = results.questionIds.map((questionId, index) => {
            // استخدام الإجابة الصحيحة من results.answers إن وجدت
            // أو استخدام index 0 كافتراضي
            const correctAnswer = results.answers[questionId] || '0';
            return {
                questionId,
                userAnswer: correctAnswer, // استخدام الإجابة الصحيحة
                timeTaken: Math.floor(results.timeTaken / results.totalQuestions), // توزيع الوقت بالتساوي
            };
        });

        const submission: QuizSubmission = {
            answers: quizAnswers,
            totalTime: results.timeTaken,
        };

        return await submitQuiz(categoryId, submission, getToken);
    } catch (error: any) {
        console.error('Error submitting quiz results:', error);
        throw error;
    }
}

/**
 * Get user quiz statistics
 */
export async function getQuizStats(getToken: GetTokenFunction): Promise<QuizStats> {
    try {
        const response = await fetchWithAuth('/quiz/stats', getToken, {
            method: 'GET',
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch stats: ${response.statusText}`);
        }

        const data = await response.json();
        if (data.status === 'SUCCESS') {
            return data.data;
        }

        throw new Error(data.message || 'Failed to fetch stats');
    } catch (error: any) {
        console.error('Error fetching quiz stats:', error);
        throw error;
    }
}

/**
 * Get user quiz history
 */
export async function getQuizHistory(getToken: GetTokenFunction, limit?: number): Promise<QuizHistoryItem[]> {
    try {
        const url = `/quiz/history${limit ? `?limit=${limit}` : ''}`;
        const response = await fetchWithAuth(url, getToken, {
            method: 'GET',
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch history: ${response.statusText}`);
        }

        const data = await response.json();
        if (data.status === 'SUCCESS') {
            return data.data || [];
        }

        throw new Error(data.message || 'Failed to fetch history');
    } catch (error: any) {
        console.error('Error fetching quiz history:', error);
        throw error;
    }
}

/**
 * Check cooldown status for a category
 */
export async function checkQuizCooldown(categoryId: string, getToken: GetTokenFunction): Promise<QuizCooldown> {
    try {
        const response = await fetchWithAuth(`/quiz/${categoryId}/cooldown`, getToken, {
            method: 'GET',
        });

        if (!response.ok) {
            throw new Error(`Failed to check cooldown: ${response.statusText}`);
        }

        const data = await response.json();
        if (data.status === 'SUCCESS') {
            return data.data;
        }

        throw new Error(data.message || 'Failed to check cooldown');
    } catch (error: any) {
        console.error('Error checking quiz cooldown:', error);
        throw error;
    }
}

// Export GetTokenFunction type for use in components
export type { GetTokenFunction };

// Export all functions as default object for convenience
export const quizApi = {
    getCategories: getQuizCategories,
    getAnswers: getQuizAnswers,
    startQuiz,
    submitQuiz,
    getStats: getQuizStats,
    getHistory: getQuizHistory,
    checkCooldown: checkQuizCooldown,
};



/**
 * Get quiz questions from backend (without correct answers)
 * يتم cache الأسئلة لمدة 1 ساعة
 * يسمح بإضافة أسئلة جديدة بدون تحديث التطبيق
 */
export async function getQuizQuestions(
    categoryId: string,
    getToken: GetTokenFunction,
    count: number = 20
): Promise<LocalQuizQuestion[]> {
    try {
        const cacheKey = `quiz_questions_${categoryId}_${count}`;
        
        // 1. محاولة جلب من memory cache أولاً (أسرع)
        const memoryCached = getFromMemoryCache(cacheKey);
        if (memoryCached) {
            logger.debug('[QuizAPI] getQuizQuestions - Using memory cache', { 
                categoryId,
                count: memoryCached.length 
            });
            return memoryCached;
        }

        // 2. محاولة جلب من AsyncStorage cache (1 ساعة)
        const cached = await cacheService.get<LocalQuizQuestion[]>(cacheKey);
        if (cached) {
            // تحديث memory cache للوصول السريع
            setMemoryCache(cacheKey, cached);
            logger.debug('[QuizAPI] getQuizQuestions - Using AsyncStorage cache', { 
                categoryId,
                count: cached.length 
            });
            return cached;
        }

        // 3. جلب من الباك إند (إذا لم يكن في cache)
        logger.debug('[QuizAPI] getQuizQuestions - Fetching from API', { 
            categoryId,
            count 
        });

        const response = await fetchWithAuth('/quiz/questions', getToken, {
            method: 'POST',
            body: JSON.stringify({ categoryId, count }),
        });

        if (!response.ok) {
            throw new Error(`Failed to get questions: ${response.statusText}`);
        }

        const data = await response.json();
        if (data.status === 'SUCCESS') {
            const questions = data.data as LocalQuizQuestion[];
            
            // حفظ في cache (1 ساعة) - memory + AsyncStorage
            setMemoryCache(cacheKey, questions);
            await cacheService.set(cacheKey, questions, 60 * 60 * 1000); // 1 hour
            
            logger.debug('[QuizAPI] getQuizQuestions - Saved to cache', { 
                categoryId,
                count: questions.length 
            });
            
            return questions;
        }

        throw new Error(data.message || 'Failed to get questions');
    } catch (error: any) {
        logger.error('[QuizAPI] Error getting quiz questions:', error);
        throw error;
    }
}

/**
 * Daily Quiz API - نظام الكويز اليومي الاحترافي
 * 20 سؤال يومياً من الأساطير، Cache 24 ساعة، Offline support
 */

// Types for Daily Quiz
export interface DailyQuizData {
    id: string;
    categoryId: string;
    questions: LocalQuizQuestion[];
    expiresAt: string;
    date: string;
}

export interface DailyQuizCache {
    data: DailyQuizData;
    answers: Record<string, string>;
    imagesCached: boolean;
    timestamp: number;
    expiresAt: number;
}

// Cache keys
const DAILY_QUIZ_CACHE_KEY = 'daily_quiz_complete';
const DAILY_QUIZ_MEMORY_KEY = 'daily_quiz_memory';

/**
 * جلب الكويز اليومي الكامل (أسئلة + إجابات + صور)
 * مع Cache احترافي و Offline support
 */
export async function getDailyQuiz(
    getToken: GetTokenFunction,
    forceRefresh: boolean = false
): Promise<{
    questions: LocalQuizQuestion[];
    answers: Record<string, string>;
    expiresAt: Date;
    fromCache: boolean;
}> {
    try {
        const now = Date.now();
        
        // 1. محاولة جلب من Memory Cache (فوري)
        if (!forceRefresh) {
            const memoryCached = getFromMemoryCache(DAILY_QUIZ_MEMORY_KEY) as DailyQuizCache;
            if (memoryCached && now < memoryCached.expiresAt) {
                logger.debug('[DailyQuiz] Using memory cache', {
                    questionCount: memoryCached.data.questions.length,
                    answersCount: Object.keys(memoryCached.answers).length,
                    imagesCached: memoryCached.imagesCached,
                });
                
                return {
                    questions: memoryCached.data.questions,
                    answers: memoryCached.answers,
                    expiresAt: new Date(memoryCached.expiresAt),
                    fromCache: true,
                };
            }
        }

        // 2. محاولة جلب من AsyncStorage Cache (24 ساعة)
        if (!forceRefresh) {
            const cached = await cacheService.get<DailyQuizCache>(DAILY_QUIZ_CACHE_KEY);
            if (cached && now < cached.expiresAt) {
                // تحديث Memory Cache
                setMemoryCache(DAILY_QUIZ_MEMORY_KEY, cached);
                
                logger.debug('[DailyQuiz] Using AsyncStorage cache', {
                    questionCount: cached.data.questions.length,
                    answersCount: Object.keys(cached.answers).length,
                    imagesCached: cached.imagesCached,
                    hoursRemaining: Math.round((cached.expiresAt - now) / (1000 * 60 * 60)),
                });
                
                // إذا الصور مش متحملة، حملها في الخلفية
                if (!cached.imagesCached) {
                    preloadDailyQuizImages(cached.data.questions).catch(error => {
                        logger.warn('[DailyQuiz] Background image preload failed:', error);
                    });
                }
                
                return {
                    questions: cached.data.questions,
                    answers: cached.answers,
                    expiresAt: new Date(cached.expiresAt),
                    fromCache: true,
                };
            }
        }

        // 3. جلب من الباك إند
        logger.debug('[DailyQuiz] Fetching from API');
        
        const [quizResponse, answersResponse] = await Promise.all([
            // جلب الأسئلة
            fetchWithAuth('/quiz/daily', getToken, {
                method: 'POST',
                body: JSON.stringify({}),
            }),
            // جلب الإجابات (بالتوازي للسرعة)
            null, // سنجلبها بعد الحصول على الأسئلة
        ]);

        if (!quizResponse.ok) {
            throw new Error(`Failed to get daily quiz: ${quizResponse.statusText}`);
        }

        const quizData = await quizResponse.json();
        if (quizData.status !== 'SUCCESS') {
            throw new Error(quizData.message || 'Failed to get daily quiz');
        }

        const dailyQuizData: DailyQuizData = quizData.data;
        const questionIds = dailyQuizData.questions.map(q => q.id);

        // جلب الإجابات
        const answersResponse2 = await fetchWithAuth('/quiz/daily/answers', getToken, {
            method: 'POST',
            body: JSON.stringify({ questionIds }),
        });

        if (!answersResponse2.ok) {
            throw new Error(`Failed to get daily quiz answers: ${answersResponse2.statusText}`);
        }

        const answersData = await answersResponse2.json();
        if (answersData.status !== 'SUCCESS') {
            throw new Error(answersData.message || 'Failed to get daily quiz answers');
        }

        const answers: Record<string, string> = answersData.data;

        // تحميل الصور في الخلفية
        const imagesCached = await preloadDailyQuizImages(dailyQuizData.questions);

        // إنشاء Cache object
        const cacheData: DailyQuizCache = {
            data: dailyQuizData,
            answers,
            imagesCached,
            timestamp: now,
            expiresAt: new Date(dailyQuizData.expiresAt).getTime(),
        };

        // حفظ في Cache (Memory + AsyncStorage)
        setMemoryCache(DAILY_QUIZ_MEMORY_KEY, cacheData);
        await cacheService.set(DAILY_QUIZ_CACHE_KEY, cacheData, 24 * 60 * 60 * 1000); // 24 hours

        logger.debug('[DailyQuiz] Fetched and cached successfully', {
            questionCount: dailyQuizData.questions.length,
            answersCount: Object.keys(answers).length,
            imagesCached,
            expiresAt: dailyQuizData.expiresAt,
        });

        return {
            questions: dailyQuizData.questions,
            answers,
            expiresAt: new Date(dailyQuizData.expiresAt),
            fromCache: false,
        };

    } catch (error: any) {
        logger.error('[DailyQuiz] Error getting daily quiz:', error);
        
        // Fallback: محاولة استخدام Cache منتهي الصلاحية
        try {
            const expiredCache = await cacheService.get<DailyQuizCache>(DAILY_QUIZ_CACHE_KEY);
            if (expiredCache) {
                logger.warn('[DailyQuiz] Using expired cache as fallback');
                return {
                    questions: expiredCache.data.questions,
                    answers: expiredCache.answers,
                    expiresAt: new Date(expiredCache.expiresAt),
                    fromCache: true,
                };
            }
        } catch (fallbackError) {
            logger.error('[DailyQuiz] Fallback cache also failed:', fallbackError);
        }
        
        throw error;
    }
}

/**
 * تحميل صور الكويز اليومي مع Retry Logic
 */
async function preloadDailyQuizImages(questions: LocalQuizQuestion[]): Promise<boolean> {
    try {
        const imageUrls = questions
            .map(q => q.imageUrl)
            .filter((url): url is string => !!url && url.trim() !== '');

        if (imageUrls.length === 0) {
            logger.debug('[DailyQuiz] No images to preload');
            return true;
        }

        logger.debug('[DailyQuiz] Preloading images', { count: imageUrls.length });

        // تحميل الصور بالتوازي مع timeout
        const results = await Promise.allSettled(
            imageUrls.map(url => 
                Promise.race([
                    Image.prefetch(url),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Timeout')), 15000) // 15 seconds
                    )
                ])
            )
        );

        const successCount = results.filter(r => r.status === 'fulfilled').length;
        const failedCount = results.length - successCount;

        logger.debug('[DailyQuiz] Image preloading completed', {
            total: imageUrls.length,
            success: successCount,
            failed: failedCount,
            successRate: `${Math.round((successCount / imageUrls.length) * 100)}%`,
        });

        // نعتبر التحميل ناجح إذا نجح 80% من الصور
        const successRate = successCount / imageUrls.length;
        return successRate >= 0.8;

    } catch (error: any) {
        logger.error('[DailyQuiz] Error preloading images:', error);
        return false;
    }
}

/**
 * التحقق من توفر الكويز اليومي في Cache
 */
export async function isDailyQuizCached(): Promise<{
    cached: boolean;
    expiresAt?: Date;
    questionCount?: number;
    imagesCached?: boolean;
}> {
    try {
        const now = Date.now();
        
        // فحص Memory Cache أولاً
        const memoryCached = getFromMemoryCache(DAILY_QUIZ_MEMORY_KEY) as DailyQuizCache;
        if (memoryCached && now < memoryCached.expiresAt) {
            return {
                cached: true,
                expiresAt: new Date(memoryCached.expiresAt),
                questionCount: memoryCached.data.questions.length,
                imagesCached: memoryCached.imagesCached,
            };
        }

        // فحص AsyncStorage Cache
        const cached = await cacheService.get<DailyQuizCache>(DAILY_QUIZ_CACHE_KEY);
        if (cached && now < cached.expiresAt) {
            return {
                cached: true,
                expiresAt: new Date(cached.expiresAt),
                questionCount: cached.data.questions.length,
                imagesCached: cached.imagesCached,
            };
        }

        return { cached: false };
    } catch (error: any) {
        logger.error('[DailyQuiz] Error checking cache:', error);
        return { cached: false };
    }
}

/**
 * مسح Cache الكويز اليومي (للتطوير أو إعادة التحميل)
 */
export async function clearDailyQuizCache(): Promise<void> {
    try {
        memoryCache.delete(DAILY_QUIZ_MEMORY_KEY);
        await cacheService.remove(DAILY_QUIZ_CACHE_KEY);
        logger.debug('[DailyQuiz] Cache cleared successfully');
    } catch (error: any) {
        logger.error('[DailyQuiz] Error clearing cache:', error);
    }
}

/**
 * تحديث quizApi exports
 */
export const dailyQuizApi = {
    getDailyQuiz,
    isDailyQuizCached,
    clearDailyQuizCache,
};