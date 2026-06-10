/**
 * Reusable quality scoring for quiz question metrics.
 */

export interface QuestionMetricSnapshot {
  shownCount: number;
  correctCount: number;
  wrongCount: number;
  skipCount: number;
  hintCount: number;
  totalAnswerTimeMs: number | bigint;
}

export interface QuestionQualityBreakdown {
  correctRate: number;
  skipRate: number;
  hintRate: number;
  avgAnswerTimeMs: number;
  qualityScore: number;
  sampleSize: number;
}

function toNumberMs(value: number | bigint): number {
  return typeof value === 'bigint' ? Number(value) : value;
}

export function calculateQuestionQuality(
  metric: QuestionMetricSnapshot,
): QuestionQualityBreakdown {
  const shown = Math.max(0, metric.shownCount);
  const answered = Math.max(0, metric.correctCount + metric.wrongCount);
  const totalMs = toNumberMs(metric.totalAnswerTimeMs);

  const correctRate = answered > 0 ? metric.correctCount / answered : 0;
  const skipRate = shown > 0 ? metric.skipCount / shown : 0;
  const hintRate = shown > 0 ? metric.hintCount / shown : 0;
  const avgAnswerTimeMs = answered > 0 ? totalMs / answered : 0;

  let qualityScore = 50;

  // Answer rate quality (target ~40–75% correct for engaging difficulty)
  if (answered >= 5) {
    if (correctRate >= 0.35 && correctRate <= 0.8) {
      qualityScore += 25;
    } else if (correctRate >= 0.2 && correctRate < 0.35) {
      qualityScore += 10;
    } else if (correctRate > 0.8) {
      qualityScore += 15;
    } else {
      qualityScore -= 20;
    }
  }

  // Low ambiguity: reasonable skip/hint rates
  if (skipRate <= 0.15) qualityScore += 10;
  else if (skipRate > 0.35) qualityScore -= 15;

  if (hintRate <= 0.2) qualityScore += 10;
  else if (hintRate > 0.4) qualityScore -= 15;

  // Extremely low correct rate penalty
  if (answered >= 10 && correctRate < 0.1) qualityScore -= 25;

  // Reasonable pacing (5s–25s average)
  if (avgAnswerTimeMs >= 3_000 && avgAnswerTimeMs <= 25_000) qualityScore += 5;
  if (avgAnswerTimeMs > 45_000) qualityScore -= 5;

  qualityScore = Math.max(0, Math.min(100, Math.round(qualityScore)));

  return {
    correctRate: Math.round(correctRate * 1000) / 1000,
    skipRate: Math.round(skipRate * 1000) / 1000,
    hintRate: Math.round(hintRate * 1000) / 1000,
    avgAnswerTimeMs: Math.round(avgAnswerTimeMs),
    qualityScore,
    sampleSize: shown,
  };
}
