import { logger } from '../utils/logger';
import type { StoredQuizQuestion } from '../types/quiz.types';
import {
  scoreEntityNameMatch,
  isCrossScriptNamePair,
  containsArabicScript,
  containsLatinLetters,
} from './quiz-name-match.util';

// Same-script: raised from 0.72 → 0.80 to cut homonym false alignments.
// Cross-script (Arabic options + English entityName): lower bar — transliteration
// is approximate but still blocks totally unrelated options.
const MIN_OPTION_MATCH = 0.8;
const MIN_CROSS_SCRIPT_MATCH = 0.55;

function matchThreshold(entityName: string, optionText: string): number {
  return isCrossScriptNamePair(entityName, optionText)
    ? MIN_CROSS_SCRIPT_MATCH
    : MIN_OPTION_MATCH;
}

function isArabicQuizQuestion(q: StoredQuizQuestion): boolean {
  const arabicOptions = q.options.filter((o) => containsArabicScript(o.text)).length;
  return arabicOptions >= 2;
}

function isLatinEntityName(entityName: string): boolean {
  return containsLatinLetters(entityName) && !containsArabicScript(entityName);
}

function hasValidCorrectKey(q: StoredQuizQuestion): boolean {
  return q.options.some((o) => o.key === q.correctKey);
}

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

  // Arabic daily packs keep imageBinding.entityName in English (for API lookup)
  // while options are Arabic — trust correctKey when we can't align cross-script.
  if (isArabicQuizQuestion(q) && isLatinEntityName(entityName) && hasValidCorrectKey(q)) {
    const best = bestMatchingOptionKey(q, entityName);
    const threshold = MIN_CROSS_SCRIPT_MATCH;
    if (!best || best.score < threshold) {
      logger.info(
        `[QuizValidate] Cross-script quiz ${q.id}: keeping correctKey ${q.correctKey} (entity "${entityName}", best ${best?.score.toFixed(2) ?? '0'})`,
      );
      return q;
    }
  }

  const best = bestMatchingOptionKey(q, entityName);
  const threshold = matchThreshold(entityName, q.options[0]?.text ?? entityName);
  if (!best || best.score < threshold) {
    logger.warn(
      `[QuizValidate] No option matches "${entityName}" for ${q.id} (best ${best?.score.toFixed(2) ?? '0'})`,
    );
    return null;
  }

  const current = q.options.find((o) => o.key === q.correctKey);
  const currentScore = current
    ? scoreEntityNameMatch(entityName, current.text)
    : 0;
  const threshold = matchThreshold(entityName, current?.text ?? entityName);

  if (currentScore >= threshold && best.key === q.correctKey) {
    return q;
  }

  if (best.score >= threshold) {
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
  const threshold = matchThreshold(binding.entityName, correctText);

  // Cross-script ar packs: entityName is English, answer text is Arabic.
  if (isCrossScriptNamePair(binding.entityName, correctText) && hasValidCorrectKey(aligned)) {
    return aligned;
  }

  if (matchScore < threshold) {
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
