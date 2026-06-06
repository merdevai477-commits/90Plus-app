import { logger } from '../utils/logger';
import type { StoredQuizQuestion } from '../types/quiz.types';
import { scoreEntityNameMatch } from './quiz-name-match.util';

const MIN_OPTION_MATCH = 0.72;

function bestMatchingOptionKey(
  q: StoredQuizQuestion,
  entityName: string,
): { key: StoredQuizQuestion['correctKey']; score: number } | null {
  let best: { key: StoredQuizQuestion['correctKey']; score: number } | null = null;
  for (const option of q.options) {
    const score = scoreEntityNameMatch(entityName, option.text);
    if (!best || score > best.score) {
      best = { key: option.key, score };
    }
  }
  return best;
}

/**
 * Align correctKey with imageBinding.entityName when the AI mismarked the answer.
 * Returns null when no option plausibly matches the bound entity.
 */
export function alignCorrectKeyWithBinding(
  q: StoredQuizQuestion,
): StoredQuizQuestion | null {
  const binding = q.imageBinding;
  if (!binding?.entityName?.trim()) return q;

  const entityName = binding.entityName.trim();
  const needsAlignment =
    (q.type === 'guess_player' && binding.kind === 'player') ||
    (q.type === 'logo' && binding.kind === 'team') ||
    (q.type === 'stadium' && binding.kind === 'venue') ||
    (q.type === 'image' && (binding.kind === 'team' || binding.kind === 'league'));

  if (!needsAlignment) return q;

  const best = bestMatchingOptionKey(q, entityName);
  if (!best || best.score < MIN_OPTION_MATCH) {
    logger.warn(
      `[QuizValidate] No option matches "${entityName}" for ${q.id} (best ${best?.score.toFixed(2) ?? '0'})`,
    );
    return null;
  }

  const current = q.options.find((o) => o.key === q.correctKey);
  const currentScore = current
    ? scoreEntityNameMatch(entityName, current.text)
    : 0;

  if (currentScore >= MIN_OPTION_MATCH && best.key === q.correctKey) {
    return q;
  }

  if (best.score >= MIN_OPTION_MATCH) {
    if (best.key !== q.correctKey) {
      logger.info(
        `[QuizValidate] Fixed correctKey for ${q.id}: ${q.correctKey} -> ${best.key} ("${entityName}")`,
      );
    }
    return { ...q, correctKey: best.key };
  }

  return null;
}

/** Final consistency check after image enrichment. */
export function verifyQuestionConsistency(
  q: StoredQuizQuestion,
): StoredQuizQuestion | null {
  const aligned = alignCorrectKeyWithBinding(q);
  if (!aligned) return null;

  const binding = aligned.imageBinding;
  if (!binding?.entityName) return aligned;

  const correctText =
    aligned.options.find((o) => o.key === aligned.correctKey)?.text ?? '';
  const matchScore = scoreEntityNameMatch(binding.entityName, correctText);

  if (matchScore < MIN_OPTION_MATCH) {
    logger.warn(
      `[QuizValidate] Rejected ${aligned.id}: answer "${correctText}" does not match binding "${binding.entityName}" (${matchScore.toFixed(2)})`,
    );
    return null;
  }

  if (matchScore < 0.95 && correctText.trim()) {
    return {
      ...aligned,
      imageBinding: { ...binding, entityName: correctText.trim() },
    };
  }

  return aligned;
}
