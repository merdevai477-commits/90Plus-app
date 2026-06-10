import {
  isCompletePack,
  remapPackQuestionsForDate,
} from '../quiz-fallback.service';
import type { StoredQuizQuestion } from '../../types/quiz.types';
import { QUIZ_PACK_SIZE } from '../../constants/quiz.constants';

function sampleQuestions(count = QUIZ_PACK_SIZE): StoredQuizQuestion[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `daily-2026-06-09-en-${i + 1}`,
    question: `Question ${i + 1}?`,
    type: 'normal' as const,
    options: [
      { key: 'A' as const, text: 'A' },
      { key: 'B' as const, text: 'B' },
      { key: 'C' as const, text: 'C' },
      { key: 'D' as const, text: 'D' },
    ],
    correctKey: 'A' as const,
    difficulty: 'EASY' as const,
    confidence: 95,
  }));
}

describe('quiz-fallback.service', () => {
  test('isCompletePack accepts exactly 15 questions', () => {
    expect(isCompletePack(sampleQuestions())).toBe(true);
    expect(isCompletePack(sampleQuestions(14))).toBe(false);
    expect(isCompletePack(null)).toBe(false);
  });

  test('remapPackQuestionsForDate assigns new ids for target date', () => {
    const remapped = remapPackQuestionsForDate(sampleQuestions(), '2026-06-10', 'en');
    expect(remapped).toHaveLength(QUIZ_PACK_SIZE);
    expect(remapped[0]?.id).toBe('daily-2026-06-10-en-1');
    expect(remapped[14]?.id).toBe('daily-2026-06-10-en-15');
    expect(remapped[0]?.question).toBe('Question 1?');
  });
});
