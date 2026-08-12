import { logger } from '../utils/logger';
import type { StoredQuizQuestion, QuizLanguage, QuizQuestionType } from '../types/quiz.types';
import type { QuizEntitySlice, QuizPackValidationContext } from '../types/quiz-entity.types';
import { QUIZ_MIN_CONFIDENCE } from '../constants/quiz.constants';
import {
  scoreEntityNameMatch,
  isCrossScriptNamePair,
  containsArabicScript,
  containsLatinLetters,
} from './quiz-name-match.util';
import {
  getDatasetPlayer,
  getEntityNameById,
  resolveEntityIdInSlice,
  resolveNationIdInSlice,
} from './quiz-entity-dataset.service';

// Same-script: raised from 0.72 → 0.80 to cut homonym false alignments.
// Cross-script (Arabic options + English entityName): lower bar — transliteration
// is approximate but still blocks totally unrelated options.
const MIN_OPTION_MATCH = 0.8;
const MIN_CROSS_SCRIPT_MATCH = 0.55;

const TIME_SENSITIVE_PATTERNS = [
  /\bcurrent\s+(league\s+)?standings?\b/i,
  /\bcurrent\s+top\s+scorer/i,
  /\bcurrent\s+ranking/i,
  /\bcurrent\s+form\b/i,
  /\bcurrent\s+points?\b/i,
  /\bthis\s+season(?:'s)?\s+top\s+scorer/i,
  /\bleading\s+the\s+(table|standings)\b/i,
  /\bمتصدر\s+الدوري\b/,
  /\bترتيب\s+الدوري\s+الحالي\b/,
  /\bهداف\s+الدوري\s+الحالي\b/,
];

const INVALID_OPTION_TEXT =
  /^(midfielder|defender|goalkeeper|attacker|forward|winger|unknown|midfield|defence|attack)$/i;

const WORLD_CUP_CLUE_PATTERN = /world cup|كأس العالم|fifa|mundial|بطولة العالم/i;

const WEAK_SINGLE_CLUE_PATTERNS = [
  /^(who is|guess the player|من هو|خمن اللاعب)\s*$/i,
  /plays?\s+for\s+[\w\s]+\s*[-—]?\s*(who|من)/i,
  /number\s+\d+\s*[-—]?\s*(who|guess|من)/i,
  /يلعب\s+(في|لـ?)\s+[\w\s\u0600-\u06FF]+\s*[-—]?\s*من/i,
];

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

function optionEntityCategory(type: QuizQuestionType, bindingKind?: string): 'player' | 'club' | 'stadium' {
  if (type === 'guess_player' || bindingKind === 'player') return 'player';
  if (type === 'stadium' || bindingKind === 'venue') return 'stadium';
  return 'club';
}

function entityPoolForCategory(
  slice: QuizEntitySlice,
  category: 'player' | 'club' | 'stadium',
): Array<{ id: string; name: string }> {
  if (category === 'player') return slice.players;
  if (category === 'stadium') return slice.stadiums;
  return slice.clubs;
}

/**
 * The AI occasionally hallucinates distractors outside the supplied dataset
 * (real football entities not in today's narrow slice, or junk like a raw
 * position label / number) despite explicit prompt instructions. Rejecting
 * the whole question for one bad distractor tanks yield to 0/N on tight
 * slices. Instead, substitute unresolvable distractor text with an unused
 * same-category dataset entity (matching position for players when
 * possible) before falling back to outright rejection.
 */
function repairUnresolvedDistractors(
  q: StoredQuizQuestion,
  slice: QuizEntitySlice,
  packContext: QuizPackValidationContext,
  bindingKind?: string,
): StoredQuizQuestion | null {
  const category = optionEntityCategory(q.type, bindingKind);
  const usedIds = new Set<string>();

  // Seed with whatever already resolves so replacements don't collide.
  for (const opt of q.options) {
    const id = resolveOptionEntityId(slice, opt.text, q.type, bindingKind);
    if (id) usedIds.add(id);
  }

  const correctOpt = q.options.find((o) => o.key === q.correctKey);
  const correctPlayer =
    category === 'player' && correctOpt
      ? slice.players.find((p) => scoreEntityNameMatch(correctOpt.text, p.name) >= 0.78)
      : undefined;

  const pool = entityPoolForCategory(slice, category);
  const playerPool = category === 'player' ? slice.players : null;
  let changed = false;

  const repairedOptions = q.options.map((opt) => {
    // Never touch the correct answer's own option — only genuine distractors
    // get substituted. If the correct answer itself doesn't resolve, that's
    // a real rejection (handled by the caller's post-repair re-validation).
    if (opt.key === q.correctKey) return opt;

    // Anything that doesn't resolve gets replaced — whether a hallucinated
    // out-of-dataset name or junk like a bare position label/number
    // (INVALID_OPTION_TEXT also never resolves via resolveOptionEntityId).
    const resolved = resolveOptionEntityId(slice, opt.text, q.type, bindingKind);
    if (resolved) return opt;

    // Prefer same-position candidates for players, otherwise any unused entity.
    const candidates: Array<{ id: string; name: string }> =
      playerPool && correctPlayer
        ? [...playerPool.filter((p) => p.position === correctPlayer.position), ...pool]
        : pool;

    const replacement = candidates.find(
      (e) => !usedIds.has(e.id) && !packContext.distractorEntityIds.has(e.id) && !packContext.correctAnswerEntityIds.has(e.id),
    );

    if (!replacement) return opt;

    usedIds.add(replacement.id);
    changed = true;
    return { ...opt, text: replacement.name };
  });

  if (!changed) return q;

  logger.info(`[QuizValidate] Repaired ${q.id}: substituted unresolvable distractor(s) with dataset entities`);
  return { ...q, options: repairedOptions };
}

function resolveOptionEntityId(slice: QuizEntitySlice, text: string, type: QuizQuestionType, bindingKind?: string): string | null {
  const nationId = resolveNationIdInSlice(slice, text);
  if (nationId) return nationId;

  if (type === 'normal') {
    return (
      resolveEntityIdInSlice(slice, text, 'player') ??
      resolveEntityIdInSlice(slice, text, 'club') ??
      resolveEntityIdInSlice(slice, text, 'stadium')
    );
  }
  return resolveEntityIdInSlice(slice, text, optionEntityCategory(type, bindingKind));
}

export function isTimeSensitiveQuestionText(question: string, hasExplicitStats: boolean): boolean {
  if (hasExplicitStats) return false;
  return TIME_SENSITIVE_PATTERNS.some((re) => re.test(question));
}

export function countGuessPlayerClues(q: StoredQuizQuestion, slice: QuizEntitySlice): number {
  const binding = q.imageBinding;
  if (!binding?.entityId?.startsWith('player:')) return 0;
  const player = getDatasetPlayer(slice, binding.entityId);
  if (!player) return 0;

  const text = q.question.toLowerCase();
  let clues = 0;

  if (player.nationality && text.includes(player.nationality.toLowerCase())) clues += 1;
  if (player.country && text.includes(player.country.toLowerCase())) clues += 1;
  if (player.position && text.toLowerCase().includes(player.position.toLowerCase())) clues += 1;
  if (player.age != null && new RegExp(`\\b${player.age}\\b`).test(text)) clues += 1;
  if (player.birthdate && text.includes(player.birthdate)) clues += 1;
  if (player.jerseyNumber != null && new RegExp(`\\b${player.jerseyNumber}\\b`).test(text)) clues += 1;
  if (player.achievements?.some((a) => text.includes(a.toLowerCase()))) clues += 1;
  if (player.statistics) {
    for (const val of Object.values(player.statistics)) {
      if (String(val).length > 0 && text.includes(String(val).toLowerCase())) clues += 1;
    }
  }

  if (WORLD_CUP_CLUE_PATTERN.test(q.question)) clues += 1;

  return clues;
}

export function hasWeakGuessPlayerClue(q: StoredQuizQuestion, playerName: string): boolean {
  const qText = q.question.trim();
  if (WEAK_SINGLE_CLUE_PATTERNS.some((re) => re.test(qText))) return true;
  const normalizedName = playerName.toLowerCase();
  if (qText.toLowerCase().includes(normalizedName)) return true;
  return false;
}

/**
 * Attempts to resolve every option to a dataset entity, returning the
 * resolved id list or null (with a rejection log) on first unrepairable
 * failure. Shared by validateQuestionAgainstDataset's first pass and its
 * repaired-retry pass.
 */
function resolveAllOptionIds(
  q: StoredQuizQuestion,
  slice: QuizEntitySlice,
  bindingKind?: string,
): string[] | null {
  const optionIds: string[] = [];
  for (const opt of q.options) {
    if (INVALID_OPTION_TEXT.test(opt.text.trim())) {
      logger.info(`[QuizValidate] Rejected ${q.id}: invalid option text "${opt.text}"`);
      return null;
    }
    const id = resolveOptionEntityId(slice, opt.text, q.type, bindingKind);
    if (!id) {
      logger.info(`[QuizValidate] Rejected ${q.id}: distractor "${opt.text}" not in dataset`);
      return null;
    }
    optionIds.push(id);
  }
  return optionIds;
}

export function validateQuestionAgainstDataset(
  q: StoredQuizQuestion,
  slice: QuizEntitySlice,
  packContext: QuizPackValidationContext,
  confidence?: number,
): StoredQuizQuestion | null {
  if (confidence != null && (typeof confidence !== 'number' || confidence < QUIZ_MIN_CONFIDENCE)) {
    logger.info(`[QuizValidate] Rejected ${q.id}: confidence ${confidence} < ${QUIZ_MIN_CONFIDENCE}`);
    return null;
  }

  const bindingKind = q.imageBinding?.kind;

  let optionIds = resolveAllOptionIds(q, slice, bindingKind);
  if (!optionIds) {
    // One or more distractors don't resolve to a dataset entity (hallucinated
    // name, or junk like a bare position label/number). Try substituting the
    // unresolvable option(s) with unused same-category dataset entities
    // before giving up on the whole question.
    const repaired = repairUnresolvedDistractors(q, slice, packContext, bindingKind);
    if (!repaired) return null;
    const repairedIds = resolveAllOptionIds(repaired, slice, bindingKind);
    if (!repairedIds) return null;
    q = repaired;
    optionIds = repairedIds;
  }

  const uniqueOptions = new Set(optionIds);
  if (uniqueOptions.size !== optionIds.length) {
    logger.info(`[QuizValidate] Rejected ${q.id}: duplicate distractors`);
    return null;
  }

  const correctOpt = q.options.find((o) => o.key === q.correctKey);
  const correctId =
    q.imageBinding?.entityId && getEntityNameById(slice, q.imageBinding.entityId)
      ? q.imageBinding.entityId
      : resolveOptionEntityId(slice, correctOpt?.text ?? '', q.type, bindingKind);

  if (!correctId) {
    logger.info(`[QuizValidate] Rejected ${q.id}: correct answer not in dataset`);
    return null;
  }

  if (!optionIds.includes(correctId)) {
    logger.info(`[QuizValidate] Rejected ${q.id}: correctKey does not map to dataset entity`);
    return null;
  }

  if (packContext.correctAnswerEntityIds.has(correctId)) {
    logger.info(`[QuizValidate] Rejected ${q.id}: entity ${correctId} already used as correct answer`);
    return null;
  }

  const correctOptionCount = optionIds.filter((id) => id === correctId).length;
  if (correctOptionCount !== 1) {
    logger.info(`[QuizValidate] Rejected ${q.id}: correct answer entity not unique in options`);
    return null;
  }

  for (const distractorId of optionIds) {
    if (distractorId === correctId) continue;
    if (
      packContext.correctAnswerEntityIds.has(distractorId) &&
      !distractorId.startsWith('nation:')
    ) {
      logger.info(`[QuizValidate] Rejected ${q.id}: distractor ${distractorId} is correct answer elsewhere`);
      return null;
    }
    if (
      packContext.distractorEntityIds.has(distractorId) &&
      !distractorId.startsWith('nation:')
    ) {
      logger.info(`[QuizValidate] Rejected ${q.id}: distractor ${distractorId} reused in pack`);
      return null;
    }
  }

  if (q.imageBinding) {
    const binding = q.imageBinding;
    if (binding.entityId && !getEntityNameById(slice, binding.entityId)) {
      logger.info(`[QuizValidate] Rejected ${q.id}: imageBinding.entityId not in dataset`);
      return null;
    }
    if (binding.entityId && binding.entityId !== correctId) {
      logger.info(`[QuizValidate] Rejected ${q.id}: imageBinding.entityId mismatch`);
      return null;
    }

    if (
      (q.type === 'guess_player' && binding.kind !== 'player') ||
      (q.type === 'logo' && binding.kind !== 'team') ||
      (q.type === 'stadium' && binding.kind !== 'venue')
    ) {
      logger.info(`[QuizValidate] Rejected ${q.id}: imageBinding kind mismatch for type ${q.type}`);
      return null;
    }

    if (binding.kind === 'player' && binding.entityId) {
      const player = getDatasetPlayer(slice, binding.entityId);
      if (player && binding.teamName && binding.teamName !== player.teamName) {
        logger.info(`[QuizValidate] Rejected ${q.id}: teamName does not match dataset`);
        return null;
      }
    }

    if (binding.entityName && binding.entityId) {
      const expectedName = getEntityNameById(slice, binding.entityId);
      if (expectedName && scoreEntityNameMatch(binding.entityName, expectedName) < 0.75) {
        logger.info(`[QuizValidate] Rejected ${q.id}: entityName does not match dataset id`);
        return null;
      }
    }

  }

  if (q.type === 'guess_player') {
    const player = bindingKind === 'player' && q.imageBinding?.entityId
      ? getDatasetPlayer(slice, q.imageBinding.entityId)
      : null;
    if (player && hasWeakGuessPlayerClue(q, player.name)) {
      logger.info(`[QuizValidate] Rejected ${q.id}: weak guess_player clue`);
      return null;
    }
    const clueCount = countGuessPlayerClues(q, slice);
    const minClues = slice.nations?.length ? 1 : 2;
    if (clueCount < minClues) {
      logger.info(`[QuizValidate] Rejected ${q.id}: insufficient dataset-backed clues (${clueCount})`);
      return null;
    }
  }

  const hasStats = Boolean(
    q.imageBinding?.entityId &&
    getDatasetPlayer(slice, q.imageBinding.entityId)?.statistics,
  );
  if (isTimeSensitiveQuestionText(q.question, hasStats)) {
    logger.info(`[QuizValidate] Rejected ${q.id}: time-sensitive question`);
    return null;
  }

  if (
    (q.type === 'guess_player' || correctId.startsWith('player:')) &&
    !correctId.startsWith('nation:')
  ) {
    const correctPlayer = getDatasetPlayer(slice, correctId);
    const distractorPlayers = optionIds
      .filter((id) => id !== correctId && id.startsWith('player:'))
      .map((id) => getDatasetPlayer(slice, id))
      .filter((p): p is NonNullable<typeof p> => p != null);

    if (correctPlayer && distractorPlayers.length === 3 && !slice.nations?.length) {
      const samePosition = distractorPlayers.filter(
        (d) => d.position === correctPlayer.position,
      ).length;
      if (samePosition < 2) {
        logger.info(`[QuizValidate] Rejected ${q.id}: distractors lack position plausibility`);
        return null;
      }
    }
  }

  packContext.correctAnswerEntityIds.add(correctId);
  for (const id of optionIds) {
    if (id !== correctId && !id.startsWith('nation:')) {
      packContext.distractorEntityIds.add(id);
    }
  }

  const enriched = { ...q };

  if (enriched.imageBinding?.entityId) {
    const entityId = enriched.imageBinding.entityId;

    if (enriched.type === 'logo' || (enriched.type === 'image' && enriched.imageBinding.kind === 'team')) {
      const club = slice.clubs.find((c) => c.id === entityId);
      if (club?.logoUrl) {
        enriched.imageUrl = club.logoUrl;
        enriched.imageBinding = {
          ...enriched.imageBinding,
          imageUrl: club.logoUrl,
          apiId: club.apiTeamId,
        };
      }
    }

    if (enriched.type === 'stadium' || enriched.imageBinding.kind === 'venue') {
      const stadium = slice.stadiums.find((s) => s.id === entityId);
      if (stadium?.imageUrl) {
        enriched.imageUrl = stadium.imageUrl;
        enriched.imageBinding = {
          ...enriched.imageBinding,
          imageUrl: stadium.imageUrl,
          apiId: stadium.apiTeamId,
        };
      }
    }

    if (enriched.type === 'guess_player' || enriched.imageBinding.kind === 'player') {
      const player = getDatasetPlayer(slice, entityId);
      if (player) {
        enriched.imageBinding = {
          ...enriched.imageBinding,
          apiId: player.apiPlayerId,
          teamName: player.teamName,
          entityName: player.name,
        };
      }
    }
  }

  return enriched;
}

export function createPackValidationContext(): QuizPackValidationContext {
  return { correctAnswerEntityIds: new Set(), distractorEntityIds: new Set() };
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
