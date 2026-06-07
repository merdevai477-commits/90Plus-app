import { logger } from '../utils/logger';
import type { StoredQuizQuestion, QuizLanguage } from '../types/quiz.types';
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

function inferQuizLanguage(q: StoredQuizQuestion): QuizLanguage | null {
  const match = q.id.match(/daily-\d{4}-\d{2}-\d{2}-(ar|en)-/);
  return match ? (match[1] as QuizLanguage) : null;
}

function isArabicLanguagePack(q: StoredQuizQuestion, language?: QuizLanguage): boolean {
  if (language === 'ar') return true;
  if (language === 'en') return false;
  if (inferQuizLanguage(q) === 'ar') return true;
  return q.options.filter((o) => containsArabicScript(o.text)).length >= 2;
}

function matchThreshold(entityName: string, optionText: string): number {
  return isCrossScriptNamePair(entityName, optionText)
    ? MIN_CROSS_SCRIPT_MATCH
    : MIN_OPTION_MATCH;
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
  language?: QuizLanguage,
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

  // Arabic daily packs keep imageBinding.entityName in English (for API lookup).
  // Option text may be Arabic OR Latin — EN↔option fuzzy match is unreliable.
  // correctKey was already validated at parse time; trust it for ar packs.
  if (
    isArabicLanguagePack(q, language) &&
    isLatinEntityName(entityName) &&
    hasValidCorrectKey(q)
  ) {
    return q;
  }

  const best = bestMatchingOptionKey(q, entityName);
  const current = q.options.find((o) => o.key === q.correctKey);
  const threshold = matchThreshold(
    entityName,
    current?.text ?? q.options[0]?.text ?? entityName,
  );

  if (!best || best.score < threshold) {
    logger.warn(
      `[QuizValidate] No option matches "${entityName}" for ${q.id} (best ${best?.score.toFixed(2) ?? '0'})`,
    );
    return null;
  }

  const currentScore = current
    ? scoreEntityNameMatch(entityName, current.text)
    : 0;

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
  language?: QuizLanguage,
): StoredQuizQuestion | null {
  const aligned = alignCorrectKeyWithBinding(q, language);
  if (!aligned) return null;

  const binding = aligned.imageBinding;
  if (!binding?.entityName) return aligned;

  const correctText =
    aligned.options.find((o) => o.key === aligned.correctKey)?.text ?? '';

  if (
    isArabicLanguagePack(aligned, language) &&
    isLatinEntityName(binding.entityName) &&
    hasValidCorrectKey(aligned)
  ) {
    return aligned;
  }

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
