/**
 * Quiz Local State Service
 * إدارة حالة الكويز المحلية
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/logger';

// Types
export interface QuizResult {
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  timeTaken: number;
  completedAt?: string;
  categoryId?: string;
}

export interface QuizState {
  currentCategoryId: string | null;
  currentQuestionIndex: number;
  answers: Record<string, string>;
  startTime: number;
  isActive: boolean;
}

export interface QuizQuestion {
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

// Storage keys
const QUIZ_RESULTS_KEY = 'quiz_results_history';
const QUIZ_STATE_KEY = 'quiz_current_state';
const QUIZ_QUESTIONS_KEY = 'quiz_current_questions';

/**
 * حفظ نتيجة الكويز المكتمل
 */
export async function markQuizCompleted(result: QuizResult): Promise<void> {
  try {
    const completedResult: QuizResult = {
      ...result,
      completedAt: new Date().toISOString(),
    };

    // جلب النتائج السابقة
    const existingResults = await getQuizResults();
    
    // إضافة النتيجة الجديدة
    const updatedResults = [completedResult, ...existingResults];
    
    // الاحتفاظ بآخر 50 نتيجة فقط
    const limitedResults = updatedResults.slice(0, 50);
    
    // حفظ النتائج المحدثة
    await AsyncStorage.setItem(QUIZ_RESULTS_KEY, JSON.stringify(limitedResults));
    
    logger.debug('[QuizLocalState] Quiz result saved', {
      score: result.score,
      correctAnswers: result.correctAnswers,
      totalQuestions: result.totalQuestions,
      timeTaken: result.timeTaken,
    });
    
    // مسح الحالة الحالية بعد الانتهاء
    await clearCurrentQuizState();
    
  } catch (error: any) {
    logger.error('[QuizLocalState] Error saving quiz result:', error);
    throw error;
  }
}

/**
 * جلب حالة الكويز الحالية
 */
export async function getCurrentQuizState(): Promise<QuizState | null> {
  try {
    const stateJson = await AsyncStorage.getItem(QUIZ_STATE_KEY);
    if (!stateJson) {
      return null;
    }
    
    const state: QuizState = JSON.parse(stateJson);
    return state;
  } catch (error: any) {
    logger.error('[QuizLocalState] Error getting current quiz state:', error);
    return null;
  }
}

/**
 * حفظ حالة الكويز الحالية
 */
export async function saveCurrentQuizState(state: QuizState): Promise<void> {
  try {
    await AsyncStorage.setItem(QUIZ_STATE_KEY, JSON.stringify(state));
    logger.debug('[QuizLocalState] Quiz state saved', {
      categoryId: state.currentCategoryId,
      questionIndex: state.currentQuestionIndex,
      isActive: state.isActive,
    });
  } catch (error: any) {
    logger.error('[QuizLocalState] Error saving quiz state:', error);
    throw error;
  }
}

/**
 * جلب الأسئلة الحالية
 */
export async function getCurrentQuestions(): Promise<QuizQuestion[] | null> {
  try {
    const questionsJson = await AsyncStorage.getItem(QUIZ_QUESTIONS_KEY);
    if (!questionsJson) {
      return null;
    }
    
    const questions: QuizQuestion[] = JSON.parse(questionsJson);
    return questions;
  } catch (error: any) {
    logger.error('[QuizLocalState] Error getting current questions:', error);
    return null;
  }
}

/**
 * حفظ الأسئلة الحالية
 */
export async function saveCurrentQuestions(questions: QuizQuestion[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUIZ_QUESTIONS_KEY, JSON.stringify(questions));
    logger.debug('[QuizLocalState] Questions saved', {
      count: questions.length,
    });
  } catch (error: any) {
    logger.error('[QuizLocalState] Error saving questions:', error);
    throw error;
  }
}

/**
 * مسح حالة الكويز الحالية
 */
export async function clearCurrentQuizState(): Promise<void> {
  try {
    await Promise.all([
      AsyncStorage.removeItem(QUIZ_STATE_KEY),
      AsyncStorage.removeItem(QUIZ_QUESTIONS_KEY),
    ]);
    
    logger.debug('[QuizLocalState] Current quiz state cleared');
  } catch (error: any) {
    logger.error('[QuizLocalState] Error clearing quiz state:', error);
  }
}

/**
 * جلب تاريخ نتائج الكويز
 */
export async function getQuizResults(): Promise<QuizResult[]> {
  try {
    const resultsJson = await AsyncStorage.getItem(QUIZ_RESULTS_KEY);
    if (!resultsJson) {
      return [];
    }
    
    const results: QuizResult[] = JSON.parse(resultsJson);
    return results;
  } catch (error: any) {
    logger.error('[QuizLocalState] Error getting quiz results:', error);
    return [];
  }
}

/**
 * حساب إحصائيات الكويز
 */
export async function getQuizStatistics(): Promise<{
  totalQuizzes: number;
  totalScore: number;
  averageScore: number;
  totalCorrectAnswers: number;
  totalQuestions: number;
  accuracy: number;
  bestScore: number;
  averageTime: number;
}> {
  try {
    const results = await getQuizResults();
    
    if (results.length === 0) {
      return {
        totalQuizzes: 0,
        totalScore: 0,
        averageScore: 0,
        totalCorrectAnswers: 0,
        totalQuestions: 0,
        accuracy: 0,
        bestScore: 0,
        averageTime: 0,
      };
    }
    
    const totalQuizzes = results.length;
    const totalScore = results.reduce((sum, r) => sum + r.score, 0);
    const totalCorrectAnswers = results.reduce((sum, r) => sum + r.correctAnswers, 0);
    const totalQuestions = results.reduce((sum, r) => sum + r.totalQuestions, 0);
    const totalTime = results.reduce((sum, r) => sum + r.timeTaken, 0);
    const bestScore = Math.max(...results.map(r => r.score));
    
    return {
      totalQuizzes,
      totalScore,
      averageScore: Math.round(totalScore / totalQuizzes),
      totalCorrectAnswers,
      totalQuestions,
      accuracy: totalQuestions > 0 ? Math.round((totalCorrectAnswers / totalQuestions) * 100) : 0,
      bestScore,
      averageTime: Math.round(totalTime / totalQuizzes),
    };
  } catch (error: any) {
    logger.error('[QuizLocalState] Error calculating statistics:', error);
    return {
      totalQuizzes: 0,
      totalScore: 0,
      averageScore: 0,
      totalCorrectAnswers: 0,
      totalQuestions: 0,
      accuracy: 0,
      bestScore: 0,
      averageTime: 0,
    };
  }
}

/**
 * مسح جميع بيانات الكويز (للتطوير أو إعادة التعيين)
 */
export async function clearAllQuizData(): Promise<void> {
  try {
    await Promise.all([
      AsyncStorage.removeItem(QUIZ_RESULTS_KEY),
      AsyncStorage.removeItem(QUIZ_STATE_KEY),
      AsyncStorage.removeItem(QUIZ_QUESTIONS_KEY),
    ]);
    
    logger.debug('[QuizLocalState] All quiz data cleared');
  } catch (error: any) {
    logger.error('[QuizLocalState] Error clearing all quiz data:', error);
    throw error;
  }
}