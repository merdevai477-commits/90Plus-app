/**
 * Quiz Questions Index
 * نقطة دخول موحدة لجميع أسئلة الكويز
 */

// Types
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
  displayMode?: DisplayMode;
}

export type DisplayMode = 
  | 'never'           // لا تظهر الصورة قبل الإجابة
  | 'after-answer'    // تظهر بعد الإجابة (صحيحة أو خاطئة)
  | 'before-question' // تظهر قبل السؤال
  | 'in-question'     // تظهر مع السؤال
  | 'after-wrong'     // تظهر فقط بعد الإجابة الخاطئة
  | 'blur-reveal';    // تظهر مشوشة ثم تتضح

// Mock data for fallback (since we're now using backend)
const MOCK_QUESTIONS: QuizQuestion[] = [
  {
    id: 'mock-1',
    categoryId: 'legends',
    question: 'من فاز بكأس العالم 2022؟',
    options: ['الأرجنتين', 'فرنسا', 'البرازيل', 'ألمانيا'],
    difficulty: 'EASY',
    points: 10,
    displayMode: 'never',
    timeLimit: 20,
  },
  {
    id: 'mock-2',
    categoryId: 'legends',
    question: 'كم عدد كؤوس العالم التي فاز بها البرازيل؟',
    options: ['4', '5', '3', '6'],
    difficulty: 'MEDIUM',
    points: 15,
    displayMode: 'never',
    timeLimit: 20,
  },
  {
    id: 'mock-3',
    categoryId: 'legends',
    question: 'من هو أفضل هداف في تاريخ كأس العالم؟',
    options: ['ميروسلاف كلوزه', 'رونالدو', 'بيليه', 'جيرد مولر'],
    difficulty: 'HARD',
    points: 20,
    displayMode: 'never',
    timeLimit: 20,
  },
];

/**
 * جلب الأسئلة حسب المعرفات
 * @param questionIds - قائمة بمعرفات الأسئلة
 * @returns قائمة بالأسئلة
 */
export function getQuestionsByIds(questionIds: string[]): QuizQuestion[] {
  // هذه دالة fallback - الأسئلة الآن تأتي من الباك إند
  console.warn('[QuizQuestions] Using fallback mock questions. Questions should come from backend.');
  return MOCK_QUESTIONS.filter(q => questionIds.includes(q.id));
}

/**
 * جلب سؤال واحد حسب المعرف
 * @param questionId - معرف السؤال
 * @returns السؤال أو null
 */
export function getQuestionById(questionId: string): QuizQuestion | null {
  // هذه دالة fallback - الأسئلة الآن تأتي من الباك إند
  console.warn('[QuizQuestions] Using fallback mock question. Questions should come from backend.');
  return MOCK_QUESTIONS.find(q => q.id === questionId) || null;
}

/**
 * جلب الأسئلة حسب الكاتيجوري
 * @param categoryId - معرف الكاتيجوري
 * @returns قائمة بالأسئلة
 */
export function getQuestionsByCategoryId(categoryId: string): QuizQuestion[] {
  // هذه دالة fallback - الأسئلة الآن تأتي من الباك إند
  console.warn('[QuizQuestions] Using fallback mock questions. Questions should come from backend.');
  return MOCK_QUESTIONS.filter(q => q.categoryId === categoryId);
}

/**
 * جلب الأسئلة حسب الكاتيجوري مع توزيع الصعوبة
 * @param categoryId - معرف الكاتيجوري
 * @returns قائمة بالأسئلة موزعة حسب الصعوبة
 */
export function getQuestionsByCategoryIdWithDifficulty(categoryId: string): QuizQuestion[] {
  // هذه دالة fallback - الأسئلة الآن تأتي من الباك إند
  console.warn('[QuizQuestions] Using fallback mock questions. Questions should come from backend.');
  
  const allQuestions = MOCK_QUESTIONS.filter(q => q.categoryId === categoryId);
  
  // توزيع الأسئلة: 8 سهلة، 8 متوسطة، 4 صعبة
  const easyQuestions = allQuestions.filter(q => q.difficulty === 'EASY');
  const mediumQuestions = allQuestions.filter(q => q.difficulty === 'MEDIUM');
  const hardQuestions = allQuestions.filter(q => q.difficulty === 'HARD');
  
  const selectedQuestions: QuizQuestion[] = [
    ...easyQuestions.slice(0, Math.min(8, easyQuestions.length)),
    ...mediumQuestions.slice(0, Math.min(8, mediumQuestions.length)),
    ...hardQuestions.slice(0, Math.min(4, hardQuestions.length)),
  ];
  
  // خلط الأسئلة
  return selectedQuestions.sort(() => Math.random() - 0.5);
}

// Export mock data for development
export const MOCK_QUIZ_QUESTIONS = MOCK_QUESTIONS;