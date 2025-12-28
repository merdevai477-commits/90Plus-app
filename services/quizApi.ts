/**
 * Quiz API Service
 * API client for quiz-related endpoints
 */

import { getApiUrl } from '../config/api.config';
import * as Clerk from '@clerk/clerk-expo';

const API_URL = getApiUrl();
const API_TIMEOUT = 10000; // 10 seconds

// Helper function for fetch with timeout and authentication
const fetchWithAuth = async (
    endpoint: string,
    options: RequestInit = {},
    timeout = API_TIMEOUT
): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        // Get auth token from Clerk
        const token = await Clerk.getToken();
        
        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                ...options.headers,
            },
            signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        return response;
    } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('Request timeout - please check your connection');
        }
        throw error;
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
}

export interface QuizQuestion {
    id: string;
    question: string;
    options: string[];
    difficulty: 'EASY' | 'MEDIUM' | 'HARD';
    points: number;
    imageUrl?: string | null;
    imageType?: string | null;
    hint?: string | null;
    timeLimit?: number | null;
}

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
 * Get all quiz categories
 */
export async function getQuizCategories(): Promise<QuizCategory[]> {
    try {
        const response = await fetchWithAuth('/quiz/categories', {
            method: 'GET',
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch categories: ${response.statusText}`);
        }

        const data = await response.json();
        if (data.status === 'SUCCESS') {
            return data.data || [];
        }

        throw new Error(data.message || 'Failed to fetch categories');
    } catch (error: any) {
        console.error('Error fetching quiz categories:', error);
        throw error;
    }
}

/**
 * Start a new quiz - get questions for a category
 */
export async function startQuiz(categoryId: string, count?: number): Promise<{
    category: QuizCategory;
    questions: QuizQuestion[];
    count: number;
}> {
    try {
        const url = `/quiz/${categoryId}/start${count ? `?count=${count}` : ''}`;
        const response = await fetchWithAuth(url, {
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
            return data.data;
        }

        throw new Error(data.message || 'Failed to start quiz');
    } catch (error: any) {
        console.error('Error starting quiz:', error);
        throw error;
    }
}

/**
 * Submit quiz answers
 */
export async function submitQuiz(
    categoryId: string,
    submission: QuizSubmission
): Promise<QuizResult> {
    try {
        const response = await fetchWithAuth(`/quiz/${categoryId}/submit`, {
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
export async function getQuizStats(): Promise<QuizStats> {
    try {
        const response = await fetchWithAuth('/quiz/stats', {
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
export async function getQuizHistory(limit?: number): Promise<QuizHistoryItem[]> {
    try {
        const url = `/quiz/history${limit ? `?limit=${limit}` : ''}`;
        const response = await fetchWithAuth(url, {
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
export async function checkQuizCooldown(categoryId: string): Promise<QuizCooldown> {
    try {
        const response = await fetchWithAuth(`/quiz/${categoryId}/cooldown`, {
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

// Export all functions as default object for convenience
export const quizApi = {
    getCategories: getQuizCategories,
    startQuiz,
    submitQuiz,
    getStats: getQuizStats,
    getHistory: getQuizHistory,
    checkCooldown: checkQuizCooldown,
};

