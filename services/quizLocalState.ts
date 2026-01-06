/**
 * Quiz Local State Service
 * إدارة حالة الكويز محلياً في الفرونت إند
 * - تتبع آخر كويز تم فتحه
 * - إدارة فتح الكويز كل 24 ساعة
 * - حفظ نتائج الحل محلياً
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { QUIZ_CATEGORIES } from '../data/quizCategories';
import { 
  QUIZ_QUESTIONS_BY_CATEGORY, 
  getQuestionsByCategoryId, 
  QuizQuestion 
} from '../data/quizQuestions/index';

const STORAGE_KEY_PREFIX = '@quiz_local_state';
const QUIZ_DURATION_MS = 24 * 60 * 60 * 1000; // 24 ساعة

// Helper function: الحصول على مفتاح التخزين للمستخدم
function getStorageKey(userId: string | null): string {
  if (!userId) {
    // إذا لم يكن هناك userId، نستخدم مفتاح عام (للمستخدمين غير المسجلين)
    return `${STORAGE_KEY_PREFIX}_guest`;
  }
  return `${STORAGE_KEY_PREFIX}_${userId}`;
}

// Mapping بين categoryName و categoryId
// يتم إنشاؤه ديناميكياً من quizQuestions.ts
function getCategoryIdFromName(categoryName: string): string | null {
  // البحث في جميع الكاتيجوريز للعثور على categoryId
  for (const [categoryId, questions] of Object.entries(QUIZ_QUESTIONS_BY_CATEGORY)) {
    if (questions.length > 0) {
      // نحتاج إلى معرفة اسم الكاتيجوري من categoryId
      // سنستخدم أول سؤال للحصول على categoryId
      // لكن هذا لا يعطينا الاسم مباشرة
      // الحل: نحتاج إلى mapping من الباك إند أو نستخدم طريقة أخرى
    }
  }
  return null;
}

// Helper function: الحصول على categoryId من categoryName
// نبحث في جميع الأسئلة للعثور على categoryId الذي يطابق categoryName
// لكن هذا يتطلب معرفة mapping من الباك إند
// بدلاً من ذلك، سنستخدم أول categoryId متاح ونختار عشوائياً
function getRandomCategoryId(): string | null {
  const categoryIds = Object.keys(QUIZ_QUESTIONS_BY_CATEGORY);
  if (categoryIds.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * categoryIds.length);
  return categoryIds[randomIndex];
}

export interface QuizLocalState {
  lastQuizOpenedAt: number; // timestamp
  currentCategoryName: string | null; // اسم الكاتيجوري من QUIZ_CATEGORIES
  currentCategoryId: string | null; // categoryId من quizQuestions.ts
  currentQuestionIds: string[]; // IDs من quizQuestions.ts (UUID strings)
  isCompleted: boolean;
  completedAt: number | null;
  results: {
    score: number;
    correctAnswers: number;
    totalQuestions: number;
    timeTaken: number;
    categoryName: string;
    categoryId: string;
  } | null;
  pendingSubmission: boolean; // هل تم الإرسال للباك إند
}

const defaultState: QuizLocalState = {
  lastQuizOpenedAt: 0,
  currentCategoryName: null,
  currentCategoryId: null,
  currentQuestionIds: [],
  isCompleted: false,
  completedAt: null,
  results: null,
  pendingSubmission: false,
};

/**
 * جلب حالة الكويز الحالية من AsyncStorage
 */
export async function getCurrentQuizState(userId: string | null = null): Promise<QuizLocalState> {
  try {
    const storageKey = getStorageKey(userId);
    const stored = await AsyncStorage.getItem(storageKey);
    if (stored) {
      const state: QuizLocalState = JSON.parse(stored);
      return state;
    }
    return { ...defaultState };
  } catch (error) {
    console.error('[QuizLocalState] Error getting state:', error);
    return { ...defaultState };
  }
}

/**
 * حفظ حالة الكويز في AsyncStorage
 */
async function saveQuizState(state: QuizLocalState, userId: string | null = null): Promise<void> {
  try {
    const storageKey = getStorageKey(userId);
    await AsyncStorage.setItem(storageKey, JSON.stringify(state));
  } catch (error) {
    console.error('[QuizLocalState] Error saving state:', error);
  }
}

/**
 * التحقق من الحاجة لفتح كويز جديد (مرت 24 ساعة)
 */
export async function shouldOpenNewQuiz(userId: string | null = null): Promise<boolean> {
  const state = await getCurrentQuizState(userId);
  
  if (!state.lastQuizOpenedAt || state.lastQuizOpenedAt === 0) {
    return true; // لا يوجد كويز سابق، يجب فتح واحد جديد
  }

  const now = Date.now();
  const timeSinceLastQuiz = now - state.lastQuizOpenedAt;

  return timeSinceLastQuiz >= QUIZ_DURATION_MS;
}

/**
 * فتح كويز جديد
 * يختار كاتيجوري عشوائية و20 سؤال عشوائي
 * categoryMapping: mapping من الباك إند { categoryId: categoryName }
 */
export async function openNewQuiz(
  userId: string | null = null,
  categoryMapping?: Record<string, string>
): Promise<{
  categoryName: string;
  categoryId: string;
  questionIds: string[];
}> {
  // اختيار كويز الأساطير فقط (Legends) لجميع الحسابات
  const LEGENDS_CATEGORY_ID = 'b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36';
  const selectedCategoryId = LEGENDS_CATEGORY_ID;
  
  // التحقق من وجود الأسئلة للأساطير
  if (!QUIZ_QUESTIONS_BY_CATEGORY[selectedCategoryId]) {
    throw new Error('Legends quiz category not found');
  }

  // جلب الأسئلة من الكاتيجوري المختارة
  const categoryQuestions = getQuestionsByCategoryId(selectedCategoryId);

  if (categoryQuestions.length === 0) {
    throw new Error(`No questions found for categoryId: ${selectedCategoryId}`);
  }

  // استخدام جميع الأسئلة المتاحة (حالياً سؤال واحد فقط لكل كاتيجوري)
  // في المستقبل يمكن إضافة المزيد من الأسئلة
  const selectedQuestions = categoryQuestions;
  const questionIds = selectedQuestions.map((q) => q.id);
  
  // ملاحظة: حالياً كل كاتيجوري يحتوي على سؤال واحد فقط
  // عند إضافة المزيد من الأسئلة، سيتم استخدامها تلقائياً

  // الحصول على categoryName من mapping الباك إند
  let selectedCategoryName = categoryMapping?.[selectedCategoryId];
  
  // إذا لم نجد في mapping، نستخدم اسم "Legends" مباشرة
  if (!selectedCategoryName) {
    selectedCategoryName = 'Legends'; // اسم كويز الأساطير
  }

  // حفظ الحالة الجديدة
  const newState: QuizLocalState = {
    lastQuizOpenedAt: Date.now(),
    currentCategoryName: selectedCategoryName,
    currentCategoryId: selectedCategoryId,
    currentQuestionIds: questionIds,
    isCompleted: false,
    completedAt: null,
    results: null,
    pendingSubmission: false,
  };

  await saveQuizState(newState, userId);

  console.log(`[QuizLocalState] Opened new quiz for user ${userId || 'guest'}: ${selectedCategoryName} (${selectedCategoryId}) with ${questionIds.length} questions`);

  return {
    categoryName: selectedCategoryName,
    categoryId: selectedCategoryId,
    questionIds,
  };
}

/**
 * تسجيل حل الكويز
 */
export async function markQuizCompleted(
  results: {
    score: number;
    correctAnswers: number;
    totalQuestions: number;
    timeTaken: number;
  },
  userId: string | null = null
): Promise<void> {
  const state = await getCurrentQuizState(userId);

  if (!state.currentCategoryName || !state.currentCategoryId) {
    throw new Error('No active quiz to mark as completed');
  }

  const updatedState: QuizLocalState = {
    ...state,
    isCompleted: true,
    completedAt: Date.now(),
    results: {
      ...results,
      categoryName: state.currentCategoryName,
      categoryId: state.currentCategoryId,
    },
    pendingSubmission: true, // يحتاج إرسال للباك إند
  };

  await saveQuizState(updatedState, userId);

  console.log(`[QuizLocalState] Quiz marked as completed for user ${userId || 'guest'}:`, results);
}

/**
 * جلب النتائج المعلقة للإرسال
 */
export async function getPendingSubmissions(userId: string | null = null): Promise<QuizLocalState[]> {
  const state = await getCurrentQuizState(userId);
  
  if (state.pendingSubmission && state.isCompleted && state.results) {
    return [state];
  }

  return [];
}

/**
 * تحديث حالة الإرسال بعد إرسال النتائج للباك إند
 */
export async function markSubmissionSent(userId: string | null = null): Promise<void> {
  const state = await getCurrentQuizState(userId);
  
  if (state.pendingSubmission) {
    const updatedState: QuizLocalState = {
      ...state,
      pendingSubmission: false,
    };

    await saveQuizState(updatedState, userId);
    console.log(`[QuizLocalState] Submission marked as sent for user ${userId || 'guest'}`);
  }
}

/**
 * جلب الأسئلة الحالية بناءً على questionIds
 */
export function getCurrentQuestions(questionIds: string[]): QuizQuestion[] {
  return questionIds
    .map((id) => {
      // البحث في جميع الكاتيجوريز
      for (const questions of Object.values(QUIZ_QUESTIONS_BY_CATEGORY)) {
        const question = questions.find((q) => q.id === id);
        if (question) return question;
      }
      return null;
    })
    .filter((q): q is QuizQuestion => q !== null);
}

/**
 * إعادة تعيين حالة الكويز (للتطوير/التجربة)
 */
export async function resetQuizState(userId: string | null = null): Promise<void> {
  const storageKey = getStorageKey(userId);
  await AsyncStorage.removeItem(storageKey);
  console.log(`[QuizLocalState] Quiz state reset for user ${userId || 'guest'}`);
}

