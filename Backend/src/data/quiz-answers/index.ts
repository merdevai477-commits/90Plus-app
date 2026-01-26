/**
 * Quiz Answers Index
 * نقطة دخول موحدة لجميع إجابات الكويز
 */

import { LEGENDS_ANSWERS } from './legends';

// Map category IDs to their answer files
export const ANSWERS_BY_CATEGORY_ID: Record<string, Record<string, string>> = {
  'b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36': LEGENDS_ANSWERS, // Legends category
};

/**
 * Get answers for specific questions in a category
 * @param categoryId - Category ID
 * @param questionIds - Array of question IDs
 * @returns Object mapping question IDs to correct answers
 */
export function getAnswers(categoryId: string, questionIds: string[]): Record<string, string> {
  const categoryAnswers = ANSWERS_BY_CATEGORY_ID[categoryId];
  
  if (!categoryAnswers) {
    console.warn(`No answers found for category: ${categoryId}`);
    return {};
  }

  const answers: Record<string, string> = {};
  
  questionIds.forEach(questionId => {
    if (categoryAnswers[questionId]) {
      answers[questionId] = categoryAnswers[questionId];
    }
  });

  return answers;
}

/**
 * Get all answers for a category
 * @param categoryId - Category ID
 * @returns All answers for the category
 */
export function getAllAnswersForCategory(categoryId: string): Record<string, string> {
  return ANSWERS_BY_CATEGORY_ID[categoryId] || {};
}

/**
 * Check if a category has answers
 * @param categoryId - Category ID
 * @returns True if category has answers
 */
export function hasAnswersForCategory(categoryId: string): boolean {
  return !!ANSWERS_BY_CATEGORY_ID[categoryId];
}