/**
 * Export Quiz Questions to Frontend
 * Script to export all quiz questions from database to frontend file
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface ExportedQuestion {
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
}

async function exportQuestions() {
  try {
    console.log('📤 Starting to export quiz questions...');

    // جلب جميع الأسئلة مع الكاتيجوري
    const questions = await prisma.quizQuestion.findMany({
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { categoryId: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    console.log(`✅ Found ${questions.length} questions`);

    // تجميع الأسئلة حسب الكاتيجوري
    const questionsByCategory: Record<string, ExportedQuestion[]> = {};

    questions.forEach((q) => {
      if (!questionsByCategory[q.categoryId]) {
        questionsByCategory[q.categoryId] = [];
      }

      questionsByCategory[q.categoryId].push({
        id: q.id,
        categoryId: q.categoryId,
        question: q.question,
        options: q.options,
        difficulty: q.difficulty,
        points: q.points,
        imageUrl: q.imageUrl,
        imageType: q.imageType,
        hint: q.hint,
        timeLimit: q.timeLimit,
      });
    });

    // إنشاء محتوى الملف
    const fileContent = `/**
 * Quiz Questions
 * جميع أسئلة الكويز من قاعدة البيانات
 * تم تصديرها تلقائياً - لا تعدل هذا الملف يدوياً
 * Generated at: ${new Date().toISOString()}
 */

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
}

/**
 * Questions grouped by category ID
 */
export const QUIZ_QUESTIONS_BY_CATEGORY: Record<string, QuizQuestion[]> = ${JSON.stringify(questionsByCategory, null, 2)};

/**
 * All questions as a flat array
 */
export const QUIZ_QUESTIONS: QuizQuestion[] = ${JSON.stringify(
      questions.map((q) => ({
        id: q.id,
        categoryId: q.categoryId,
        question: q.question,
        options: q.options,
        difficulty: q.difficulty,
        points: q.points,
        imageUrl: q.imageUrl,
        imageType: q.imageType,
        hint: q.hint,
        timeLimit: q.timeLimit,
      })),
      null,
      2
    )};

/**
 * Map question ID to question
 */
export const QUESTION_MAP: Record<string, QuizQuestion> = QUIZ_QUESTIONS.reduce((acc, q) => {
  acc[q.id] = q;
  return acc;
}, {} as Record<string, QuizQuestion>);

/**
 * Get questions by category ID
 */
export function getQuestionsByCategoryId(categoryId: string): QuizQuestion[] {
  return QUIZ_QUESTIONS_BY_CATEGORY[categoryId] || [];
}

/**
 * Get question by ID
 */
export function getQuestionById(questionId: string): QuizQuestion | undefined {
  return QUESTION_MAP[questionId];
}

/**
 * Get questions by IDs
 */
export function getQuestionsByIds(questionIds: string[]): QuizQuestion[] {
  return questionIds.map((id) => QUESTION_MAP[id]).filter((q) => q !== undefined);
}

`;

    // تحديد مسار الملف في الفرونت إند
    const frontendPath = path.join(__dirname, '../../front/data/quizQuestions.ts');
    
    // التأكد من وجود المجلد
    const dir = path.dirname(frontendPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // كتابة الملف
    fs.writeFileSync(frontendPath, fileContent, 'utf-8');

    console.log(`✅ Exported ${questions.length} questions to ${frontendPath}`);
    console.log(`📊 Questions by category:`);
    
    // عرض إحصائيات
    Object.entries(questionsByCategory).forEach(([categoryId, questions]) => {
      console.log(`   - Category ${categoryId}: ${questions.length} questions`);
    });

    console.log('✅ Export completed successfully!');
  } catch (error) {
    console.error('❌ Error exporting questions:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// تشغيل الـ export
exportQuestions()
  .then(() => {
    console.log('🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Failed:', error);
    process.exit(1);
  });

