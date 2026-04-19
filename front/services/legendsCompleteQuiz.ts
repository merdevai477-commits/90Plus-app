/**
 * Legends Complete Quiz Service
 * خدمة الكويز الكامل للأساطير
 */

import { getApiUrl } from '../utils/getApiUrl';

export interface CompleteQuizQuestion {
  id: string;
  question: string;
  options: string[];
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  points: number;
  imageUrl?: string;
  imageType?: 'player' | 'club' | 'trophy' | 'stadium' | 'flag' | 'general';
  displayMode?: 'NEVER' | 'AFTER_ANSWER' | 'BEFORE_QUESTION' | 'IN_QUESTION' | 'AFTER_WRONG' | 'BLUR_REVEAL';
  hint?: string;
  timeLimit?: number;
}

export interface LegendsCompleteResponse {
  status: 'SUCCESS' | 'ERROR';
  data?: {
    questions: CompleteQuizQuestion[];
    totalAvailable: number;
  };
  message?: string;
}

export interface LegendsAnswersResponse {
  status: 'SUCCESS' | 'ERROR';
  data?: {
    answers: Record<string, string>;
  };
  message?: string;
}

/**
 * جلب أسئلة الأساطير الكاملة
 */
export async function fetchLegendsCompleteQuestions(count: number = 20): Promise<LegendsCompleteResponse> {
  try {
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/api/quiz/legends-complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ count }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('[LegendsCompleteQuiz] Error fetching questions:', error);
    return {
      status: 'ERROR',
      message: error.message || 'Failed to fetch questions',
    };
  }
}

/**
 * جلب إجابات أسئلة الأساطير الكاملة
 */
export async function fetchLegendsCompleteAnswers(questionIds: string[]): Promise<LegendsAnswersResponse> {
  try {
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/api/quiz/legends-complete/answers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ questionIds }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('[LegendsCompleteQuiz] Error fetching answers:', error);
    return {
      status: 'ERROR',
      message: error.message || 'Failed to fetch answers',
    };
  }
}

/**
 * تحويل displayMode من الباك إند للفرونت إند
 */
export function convertDisplayMode(backendMode?: string): 'NEVER' | 'AFTER_ANSWER' | 'BEFORE_QUESTION' | 'IN_QUESTION' | 'AFTER_WRONG' | 'BLUR_REVEAL' {
  if (!backendMode) return 'NEVER';
  
  const validModes = ['NEVER', 'AFTER_ANSWER', 'BEFORE_QUESTION', 'IN_QUESTION', 'AFTER_WRONG', 'BLUR_REVEAL'];
  
  if (validModes.includes(backendMode)) {
    return backendMode as 'NEVER' | 'AFTER_ANSWER' | 'BEFORE_QUESTION' | 'IN_QUESTION' | 'AFTER_WRONG' | 'BLUR_REVEAL';
  }
  
  return 'NEVER';
}

/**
 * تحويل الأسئلة للتنسيق المطلوب في الفرونت إند
 */
export function formatQuestionsForFrontend(questions: CompleteQuizQuestion[]) {
  return questions.map(q => ({
    ...q,
    displayMode: convertDisplayMode(q.displayMode),
    timeLimit: q.timeLimit || 20,
    points: q.points || (q.difficulty === 'EASY' ? 10 : q.difficulty === 'MEDIUM' ? 15 : 25),
  }));
}

/**
 * Cache للأسئلة والإجابات
 */
class LegendsCompleteCache {
  private questionsCache: Map<string, CompleteQuizQuestion[]> = new Map();
  private answersCache: Map<string, Record<string, string>> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 دقائق

  async getQuestions(count: number = 20): Promise<CompleteQuizQuestion[]> {
    const cacheKey = `questions_${count}`;
    const cached = this.questionsCache.get(cacheKey);
    
    if (cached) {
      return cached;
    }

    const response = await fetchLegendsCompleteQuestions(count);
    if (response.status === 'SUCCESS' && response.data) {
      const formatted = formatQuestionsForFrontend(response.data.questions);
      this.questionsCache.set(cacheKey, formatted);
      
      // مسح الكاش بعد المهلة المحددة
      setTimeout(() => {
        this.questionsCache.delete(cacheKey);
      }, this.cacheTimeout);
      
      return formatted;
    }

    throw new Error(response.message || 'Failed to fetch questions');
  }

  async getAnswers(questionIds: string[]): Promise<Record<string, string>> {
    const cacheKey = questionIds.sort().join(',');
    const cached = this.answersCache.get(cacheKey);
    
    if (cached) {
      return cached;
    }

    const response = await fetchLegendsCompleteAnswers(questionIds);
    if (response.status === 'SUCCESS' && response.data) {
      this.answersCache.set(cacheKey, response.data.answers);
      
      // مسح الكاش بعد المهلة المحددة
      setTimeout(() => {
        this.answersCache.delete(cacheKey);
      }, this.cacheTimeout);
      
      return response.data.answers;
    }

    throw new Error(response.message || 'Failed to fetch answers');
  }

  clearCache(): void {
    this.questionsCache.clear();
    this.answersCache.clear();
  }
}

// إنشاء instance واحد للكاش
export const legendsCompleteCache = new LegendsCompleteCache();

/**
 * Hook للاستخدام في React Components
 */
export function useLegendsCompleteQuiz() {
  const getQuestions = async (count: number = 20) => {
    try {
      return await legendsCompleteCache.getQuestions(count);
    } catch (error) {
      console.error('[useLegendsCompleteQuiz] Error getting questions:', error);
      throw error;
    }
  };

  const getAnswers = async (questionIds: string[]) => {
    try {
      return await legendsCompleteCache.getAnswers(questionIds);
    } catch (error) {
      console.error('[useLegendsCompleteQuiz] Error getting answers:', error);
      throw error;
    }
  };

  const clearCache = () => {
    legendsCompleteCache.clearCache();
  };

  return {
    getQuestions,
    getAnswers,
    clearCache,
  };
}