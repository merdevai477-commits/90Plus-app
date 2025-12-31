/**
 * Quiz Answers Index
 * جميع ملفات الإجابات لكل كاتيجوري
 * Generated at: 2025-12-31T01:11:26.498Z
 */

import { FLASH_ANSWERS } from './flash';
import { GUESS_THE_NUMBER_ANSWERS } from './guess-the-number';
import { HIGH_FIVE_ANSWERS } from './high-five';
import { IN_COMMON_ANSWERS } from './in-common';
import { LEGENDS_ANSWERS } from './legends';
import { Q_A_ANSWERS } from './q-a';
import { TEAMMATES_ANSWERS } from './teammates';
import { WHO_AM_I_ANSWERS } from './who-am-i';

/**
 * Map category ID to answers
 */
export const ANSWERS_BY_CATEGORY_ID: Record<string, Record<string, string>> = {
  '4fa29ec6-3a01-4452-a28a-8d38113efb0e': FLASH_ANSWERS,
  '623f7528-7cb8-44a1-891c-a970e62a8b8b': GUESS_THE_NUMBER_ANSWERS,
  '476c5563-2e0d-406b-b103-60784b120624': HIGH_FIVE_ANSWERS,
  '0c64124c-0479-48d5-a315-c5ca16852635': IN_COMMON_ANSWERS,
  'b2f62d8d-81b6-4e1e-a6c6-8f662ee4eb36': LEGENDS_ANSWERS,
  '867da722-843e-4ef5-851c-9c64e4ca96ba': Q_A_ANSWERS,
  '04025ae4-15ac-4165-8113-e4b3f75d4145': TEAMMATES_ANSWERS,
  '5bd54170-2e8f-402c-a4da-bf1d09098027': WHO_AM_I_ANSWERS,
};

/**
 * Map category name to answers
 */
export const ANSWERS_BY_CATEGORY_NAME: Record<string, Record<string, string>> = {
  'Flash': FLASH_ANSWERS,
  'Guess the Number': GUESS_THE_NUMBER_ANSWERS,
  'High Five': HIGH_FIVE_ANSWERS,
  'In Common': IN_COMMON_ANSWERS,
  'Legends': LEGENDS_ANSWERS,
  'Q&A': Q_A_ANSWERS,
  'Teammates': TEAMMATES_ANSWERS,
  'Who Am I?': WHO_AM_I_ANSWERS,
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

