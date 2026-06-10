import { calculateQuestionQuality } from '../quiz-question-quality.service';

describe('quiz-question-quality.service', () => {
  test('scores high-quality balanced question highly', () => {
    const result = calculateQuestionQuality({
      shownCount: 100,
      correctCount: 55,
      wrongCount: 35,
      skipCount: 8,
      hintCount: 12,
      totalAnswerTimeMs: 90 * 12_000,
    });

    expect(result.correctRate).toBeCloseTo(0.611, 2);
    expect(result.qualityScore).toBeGreaterThanOrEqual(70);
  });

  test('penalizes extremely low correct rate', () => {
    const result = calculateQuestionQuality({
      shownCount: 50,
      correctCount: 2,
      wrongCount: 40,
      skipCount: 5,
      hintCount: 20,
      totalAnswerTimeMs: 500_000,
    });

    expect(result.qualityScore).toBeLessThan(50);
  });

  test('computes avg answer time from bigint total', () => {
    const result = calculateQuestionQuality({
      shownCount: 10,
      correctCount: 5,
      wrongCount: 5,
      skipCount: 0,
      hintCount: 0,
      totalAnswerTimeMs: BigInt(50_000),
    });

    expect(result.avgAnswerTimeMs).toBe(5000);
  });
});
