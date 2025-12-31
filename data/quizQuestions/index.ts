/**
 * Quiz Questions Index
 * تجميع جميع أنواع الأسئلة
 */

/**
 * Quiz Question Interface
 * واجهة السؤال في الكويز
 */
export type DisplayMode = 
  | 'after-answer'      // الصورة تظهر بعد الإجابة (guess-the-number, qa)
  | 'before-question'   // الصورة تظهر أولاً ثم السؤال يظهر فوقها (flash)
  | 'in-question'       // الصورة في السؤال بدون hint (high-five, who-am-i)
  | 'after-wrong'       // الصورة تظهر فقط بعد الإجابة الخاطئة (in-common)
  | 'blur-reveal'       // الصورة تظهر مشوشة في البداية وتتضح عند الإجابة
  | 'never';            // لا صورة قبل الإجابة (qa, in-common)

export interface QuizQuestion {
  id: string;
  categoryId: string;
  question: string;
  options: string[];
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  points: number;
  imageUrl?: string | null;
  imageType?: string | null;
  hint?: string | null;
  timeLimit?: number | null;
  displayMode?: DisplayMode; // طريقة عرض الصورة حسب نوع السؤال
}

import { TEAMMATES_QUESTIONS } from './teammates';
import { IN_COMMON_QUESTIONS } from './in-common';
import { HIGH_FIVE_QUESTIONS } from './high-five';
import { FLASH_QUESTIONS } from './flash';
import { WHO_AM_I_QUESTIONS } from './who-am-i';
import { GUESS_THE_NUMBER_QUESTIONS } from './guess-the-number';
import { QA_QUESTIONS } from './qa';
import { LEGENDS_QUESTIONS } from './legends';

/**
 * Questions grouped by category ID
 */
export const QUIZ_QUESTIONS_BY_CATEGORY: Record<string, QuizQuestion[]> = {
  // Teammates
  "04025ae4-15ac-4165-8113-e4b3f75d4145": TEAMMATES_QUESTIONS,
  
  // In Common
  "0c64124c-0479-48d5-a315-c5ca16852635": IN_COMMON_QUESTIONS,
  
  // High Five
  "476c5563-2e0d-406b-b103-60784b120624": HIGH_FIVE_QUESTIONS,
  
  // Flash
  "4fa29ec6-3a01-4452-a28a-8d38113efb0e": FLASH_QUESTIONS,
  
  // Who Am I?
  "5bd54170-2e8f-402c-a4da-bf1d09098027": WHO_AM_I_QUESTIONS,
  
  // Guess the Number
  "623f7528-7cb8-44a1-891c-a970e62a8b8b": GUESS_THE_NUMBER_QUESTIONS,
  
  // Q&A
  "867da722-843e-4ef5-851c-9c64e4ca96ba": QA_QUESTIONS,
  
  // Legends
  "b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36": LEGENDS_QUESTIONS,
};

/**
 * Get questions by category ID
 */
export function getQuestionsByCategoryId(categoryId: string): QuizQuestion[] {
  return QUIZ_QUESTIONS_BY_CATEGORY[categoryId] || [];
}

/**
 * Get questions by category ID with difficulty filtering
 * يجلب الأسئلة مع تصفية حسب الصعوبة: 5 سهلة، 10 متوسطة، 5 صعبة
 * باستثناء الأنواع التي تعتمد على الصورة (Flash, Who Am I?, Legends)
 */
export function getQuestionsByCategoryIdWithDifficulty(categoryId: string): QuizQuestion[] {
  const allQuestions = QUIZ_QUESTIONS_BY_CATEGORY[categoryId] || [];
  
  // الأنواع التي تعتمد على الصورة - لا نطبق تصفية الصعوبة عليها
  const imageBasedCategories = [
    '4fa29ec6-3a01-4452-a28a-8d38113efb0e', // Flash
    '5bd54170-2e8f-402c-a4da-bf1d09098027', // Who Am I?
    'b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36', // Legends
  ];
  
  // إذا كان النوع يعتمد على الصورة، أرجع كل الأسئلة كما هي
  if (imageBasedCategories.includes(categoryId)) {
    return allQuestions;
  }
  
  // تصفية الأسئلة حسب الصعوبة
  const easyQuestions = allQuestions.filter(q => q.difficulty === 'EASY');
  const mediumQuestions = allQuestions.filter(q => q.difficulty === 'MEDIUM');
  const hardQuestions = allQuestions.filter(q => q.difficulty === 'HARD');
  
  // دالة لخلط المصفوفة
  const shuffle = <T>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };
  
  // خلط واختيار العدد المطلوب
  const selectedEasy = shuffle(easyQuestions).slice(0, Math.min(5, easyQuestions.length));
  const selectedMedium = shuffle(mediumQuestions).slice(0, Math.min(10, mediumQuestions.length));
  const selectedHard = shuffle(hardQuestions).slice(0, Math.min(5, hardQuestions.length));
  
  // دمج النتائج وخلطها مرة أخرى
  const selectedQuestions = [...selectedEasy, ...selectedMedium, ...selectedHard];
  return shuffle(selectedQuestions);
}

/**
 * Get question by ID
 */
export function getQuestionById(questionId: string): QuizQuestion | undefined {
  for (const questions of Object.values(QUIZ_QUESTIONS_BY_CATEGORY)) {
    const question = questions.find(q => q.id === questionId);
    if (question) return question;
  }
  return undefined;
}

/**
 * Get questions by IDs
 */
export function getQuestionsByIds(questionIds: string[]): QuizQuestion[] {
  const questions: QuizQuestion[] = [];
  for (const questionsArray of Object.values(QUIZ_QUESTIONS_BY_CATEGORY)) {
    for (const question of questionsArray) {
      if (questionIds.includes(question.id)) {
        questions.push(question);
      }
    }
  }
  return questions;
}

/**
 * Export all questions as flat array (for backward compatibility)
 */
export const QUIZ_QUESTIONS: QuizQuestion[] = Object.values(QUIZ_QUESTIONS_BY_CATEGORY).flat();

/**
 * Export QUESTION_MAP for backward compatibility
 */
export const QUESTION_MAP: Record<string, QuizQuestion> = QUIZ_QUESTIONS.reduce((acc, q) => {
  acc[q.id] = q;
  return acc;
}, {} as Record<string, QuizQuestion>);

