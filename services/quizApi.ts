/**
 * Quiz API Service
 * API client for quiz-related endpoints
 */

import { getApiUrl } from '../config/api.config';
import { useAuth } from '@clerk/clerk-expo';
import { cacheService } from './cacheService';
import { getQuestionsByIds, getQuestionById, QuizQuestion as LocalQuizQuestion } from '../data/quizQuestions';

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

    try {
        // Get auth token from Clerk using the provided getToken function
        const token = await getToken();
        
        if (!token) {
            throw new Error('No authentication token available. Please sign in.');
        }
        
        const url = `${API_URL}${endpoint}`;
        console.log(`[QuizAPI] Fetching: ${url}`);
        
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                ...options.headers,
            },
            signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        // Log response status for debugging
        if (!response.ok) {
            console.error(`[QuizAPI] Request failed: ${response.status} ${response.statusText} for ${url}`);
        }
        
        return response;
    } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('Request timeout - please check your connection');
        }
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
 * Get open quiz category with questionIds and answers
 * الكاتيجوري موجودة في الفرونت إند
 * يتم جلب questionIds والإجابات عند تسجيل الدخول وكل 24 ساعة
 */
export async function getQuizCategories(getToken: GetTokenFunction, retryCount: number = 0): Promise<{
    openCategoryId: string | null;
    openCategoryName: string | null;
    questionIds: string[];
    answers: Record<string, string>; // { questionId: correctAnswer }
    nextUnlockAt: string | null;
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
        // محاولة جلب من memory cache أولاً
        const cacheKey = `quiz_answers_${questionIds.sort().join('_')}`;
        const memoryCached = getFromMemoryCache(cacheKey);
        if (memoryCached) {
            return memoryCached;
        }

        // محاولة جلب من AsyncStorage cache
        const cached = await cacheService.get<Record<string, string>>(cacheKey);
        if (cached) {
            setMemoryCache(cacheKey, cached);
            return cached;
        }

        // يجب إرسال categoryId أيضاً
        // نحتاج categoryId من context أو من questionIds
        // للآن سنستخدم طريقة بديلة: جلب categoryId من أول سؤال
        const firstQuestion = getQuestionById(questionIds[0]);
        const categoryId = firstQuestion?.categoryId;
        
        if (!categoryId) {
            throw new Error('Category ID not found for questions');
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
            
            // حفظ في cache (24 ساعة)
            setMemoryCache(cacheKey, answers);
            await cacheService.set(cacheKey, answers, 24 * 60 * 60 * 1000);
            
            return answers;
        }

        throw new Error(data.message || 'Failed to get answers');
    } catch (error: any) {
        console.error('Error getting quiz answers:', error);
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

