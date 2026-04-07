/**
 * Export Quiz Answers to Separate Files
 * Script to export quiz answers from database to separate files per category
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface AnswerData {
  questionId: string;
  correctAnswer: string;
}

async function exportAnswers() {
  try {
    console.log('📤 Starting to export quiz answers...');

    // جلب جميع الكاتيجوري
    const categories = await prisma.quizCategory.findMany({
      orderBy: { name: 'asc' },
    });

    console.log(`✅ Found ${categories.length} categories`);

    // إنشاء مجلد للإجابات
    const answersDir = path.join(__dirname, '../src/data/quiz-answers');
    if (!fs.existsSync(answersDir)) {
      fs.mkdirSync(answersDir, { recursive: true });
    }

    // تصدير إجابات كل كاتيجوري
    for (const category of categories) {
      // جلب جميع الأسئلة لهذه الكاتيجوري
      const questions = await prisma.quizQuestion.findMany({
        where: { categoryId: category.id },
        select: {
          id: true,
          correctAnswer: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      // إنشاء map للإجابات
      const answers: Record<string, string> = {};
      questions.forEach((q) => {
        answers[q.id] = q.correctAnswer;
      });

      // إنشاء اسم الملف من اسم الكاتيجوري
      const fileName = category.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      // إنشاء محتوى الملف
      const fileContent = `/**
 * Quiz Answers for "${category.name}"
 * جميع الإجابات الصحيحة لأسئلة ${category.name}
 * تم تصديرها تلقائياً من قاعدة البيانات
 * Generated at: ${new Date().toISOString()}
 * Total Questions: ${questions.length}
 */

export const ${fileName.toUpperCase().replace(/-/g, '_')}_ANSWERS: Record<string, string> = ${JSON.stringify(answers, null, 2)};

/**
 * Get correct answer for a question ID
 */
export function getAnswer(questionId: string): string | undefined {
  return ${fileName.toUpperCase().replace(/-/g, '_')}_ANSWERS[questionId];
}

/**
 * Get all answers as a map
 */
export function getAllAnswers(): Record<string, string> {
  return ${fileName.toUpperCase().replace(/-/g, '_')}_ANSWERS;
}

`;

      // كتابة الملف
      const filePath = path.join(answersDir, `${fileName}.ts`);
      fs.writeFileSync(filePath, fileContent, 'utf-8');

      console.log(`✅ Exported ${questions.length} answers for "${category.name}" → ${fileName}.ts`);
    }

    // إنشاء ملف index.ts لتصدير كل الملفات
    const indexContent = `/**
 * Quiz Answers Index
 * جميع ملفات الإجابات لكل كاتيجوري
 * Generated at: ${new Date().toISOString()}
 */

${categories
  .map((cat) => {
    const fileName = cat.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return `import { ${fileName.toUpperCase().replace(/-/g, '_')}_ANSWERS } from './${fileName}';`;
  })
  .join('\n')}

/**
 * Map category ID to answers
 */
export const ANSWERS_BY_CATEGORY_ID: Record<string, Record<string, string>> = {
${categories
  .map((cat) => {
    const fileName = cat.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return `  '${cat.id}': ${fileName.toUpperCase().replace(/-/g, '_')}_ANSWERS,`;
  })
  .join('\n')}
};

/**
 * Map category name to answers
 */
export const ANSWERS_BY_CATEGORY_NAME: Record<string, Record<string, string>> = {
${categories
  .map((cat) => {
    const fileName = cat.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return `  '${cat.name}': ${fileName.toUpperCase().replace(/-/g, '_')}_ANSWERS,`;
  })
  .join('\n')}
};

/**
 * Get answers by category ID
 */
export function getAnswersByCategoryId(categoryId: string): Record<string, string> | undefined {
  return ANSWERS_BY_CATEGORY_ID[categoryId];
}

/**
 * Get answers by category name
 */
export function getAnswersByCategoryName(categoryName: string): Record<string, string> | undefined {
  return ANSWERS_BY_CATEGORY_NAME[categoryName];
}

/**
 * Get answer for a specific question
 */
export function getAnswer(categoryId: string, questionId: string): string | undefined {
  const answers = ANSWERS_BY_CATEGORY_ID[categoryId];
  return answers?.[questionId];
}

/**
 * Get answers for multiple questions
 */
export function getAnswers(categoryId: string, questionIds: string[]): Record<string, string> {
  const answers = ANSWERS_BY_CATEGORY_ID[categoryId];
  if (!answers) return {};
  
  const result: Record<string, string> = {};
  questionIds.forEach((id) => {
    if (answers[id]) {
      result[id] = answers[id];
    }
  });
  
  return result;
}

`;

    const indexPath = path.join(answersDir, 'index.ts');
    fs.writeFileSync(indexPath, indexContent, 'utf-8');

    console.log(`✅ Created index.ts`);
    console.log(`✅ Export completed successfully!`);
    console.log(`📁 Files location: ${answersDir}`);
  } catch (error) {
    console.error('❌ Error exporting answers:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// تشغيل الـ export
exportAnswers()
  .then(() => {
    console.log('🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Failed:', error);
    process.exit(1);
  });

