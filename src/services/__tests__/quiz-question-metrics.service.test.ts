import { calculateQuestionQuality } from '../quiz-question-quality.service';

/**
 * Metrics DB writes require Prisma — validate scoring pipeline used by analytics.
 */
describe('quiz-question-metrics integration (quality pipeline)', () => {
  test('quality breakdown reflects metric counters', () => {
    const metric = {
      shownCount: 20,
      correctCount: 12,
      wrongCount: 6,
      skipCount: 2,
      hintCount: 3,
      totalAnswerTimeMs: 18 * 10_000,
    };

    const quality = calculateQuestionQuality(metric);
    expect(quality.sampleSize).toBe(20);
    expect(quality.skipRate).toBeCloseTo(0.1, 2);
    expect(quality.hintRate).toBeCloseTo(0.15, 2);
    expect(quality.qualityScore).toBeGreaterThan(0);
    expect(quality.qualityScore).toBeLessThanOrEqual(100);
  });
});
