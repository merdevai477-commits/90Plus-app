/**
 * THE QUESTIONS-HUB AI GENERATOR
 * =============================================================================
 *
 * Builds each playable mode's daily round of ROUND_QUESTION_COUNT questions by
 * asking THE EXISTING FOOTBALL AI AGENT to author them.
 *
 * The agent is reached through questions-challenges.agent.service.ts, which is
 * a thin runner over the shipped agent implementation — its model
 * (resolveAgentModel), its OpenRouter client, its tool schemas (AGENT_TOOLS),
 * its tool executors (executeAgentTool) and its grounding
 * (extractGroundedFacts / buildGroundingSystemMessage). Questions defines no
 * model, no provider and no tools of its own.
 *
 * THE SPLIT, and why it is this way
 * ---------------------------------
 * docs/OMAR_QUIZ_AI_FOOTBALL_API.md is explicit that 90Plus exposes no
 * server-side "generate me questions" endpoint, that the football endpoints are
 * the source of entities, names, crests, portraits and statistics, and that the
 * question itself is authored by the project's own AI over that data
 * (§0-§1, §7, §8). So:
 *
 *   AI agent ......... which entity a question is about, the question text,
 *                      the clue rows, the hints, the connection statements,
 *                      the difficulty and its own confidence — with its
 *                      football tools available throughout, so it can look a
 *                      player or a scorer table up while it writes.
 *   Football data .... every entity, every option label, every image, and every
 *                      number (transfer chains, scorer rankings, founding
 *                      years, nationalities). This is the grounding layer the
 *                      doc names — the same in-process services the agent's own
 *                      tools call (365Scores lookup, API-Football crests).
 *
 * Nothing crosses that line. The AI returns candidate *ids*, never names and
 * never URLs, so a hallucinated player cannot reach an option and a picture is
 * always the picture of the entity it sits next to. Every id, count and
 * relationship the model returns is re-checked here against the candidate pools
 * before a question is accepted; a question that fails is dropped, and a mode
 * that cannot reach a full round fails the whole day's generation rather than
 * being padded out.
 *
 * IMAGE CONTRACT — the fields the app's mapper reads
 * (front/services/questionsModes.ts) are populated per question:
 *   guess-player / guess-club .... question.imageUrl
 *   football-bingo ............... question.bingoBoard[][].imageUrl (+ kind)
 *   football-grid ................ question.rowImages
 *   player-connections ........... question.players[].imageUrl
 *   transfer-puzzle .............. question.transferTimeline[].imageUrl
 *                                  question.options[].imageUrl
 *   top10-challenge .............. question.options[].imageUrl
 */

import { logger } from '../utils/logger';
import { QUIZ_MIN_CONFIDENCE, ROUND_QUESTION_COUNT } from '../constants/quiz.constants';
import type { QuizDifficulty, QuizLanguage } from '../types/quiz.types';
import type {
  GeneratedQuestionChallenge,
  QuestionChallengeAnswer,
  QuestionChallengeEvidence,
  QuestionChallengeOption,
  QuestionChallengeQuestion,
} from '../types/questions-challenges.types';
import {
  buildQuestionsFootballCandidates,
  seededRng,
  shuffle,
  type ClubCandidate,
  type PlayerCandidate,
  type QuestionsFootballCandidates,
} from './questions-challenges.football-data';
import {
  summarizeErrors,
  validateQuestionContract,
  validateRoundContract,
} from './questions-challenges.round-contract';
import { runQuestionsAgent, isQuestionsAgentAvailable } from './questions-challenges.agent.service';
import {
  buildQuestionsSystemPrompt,
  buildQuestionsUserPrompt,
  EVIDENCE_ICONS,
  type AiQuestionsMode,
} from './questions-challenges.ai-prompt';

const OPTION_LETTERS = ['a', 'b', 'c', 'd'] as const;

/** XP a single question is worth, by the difficulty the AI graded it. */
const DIFFICULTY_XP: Record<QuizDifficulty, number> = { EASY: 10, MEDIUM: 15, HARD: 20 };

/** AI calls per mode before the day's generation is declared failed. */
const MODE_ATTEMPTS = 2;

function isFootballDataFallbackEnabled(): boolean {
  const raw = process.env.QUESTIONS_ENABLE_FOOTBALL_DATA_FALLBACK?.trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

const MODES: AiQuestionsMode[] = [
  'guess-player',
  'guess-club',
  'football-bingo',
  'football-grid',
  'player-connections',
  'transfer-puzzle',
  'top10-challenge',
];

const MODE_ICON: Record<AiQuestionsMode, string> = {
  'guess-player': 'user',
  'guess-club': 'shield',
  'football-bingo': 'grid-3x3',
  'football-grid': 'table',
  'player-connections': 'git-branch',
  'transfer-puzzle': 'shuffle',
  'top10-challenge': 'list-ordered',
};

/**
 * Mode titles and the one-line card subtitle. These name the *game*, not any
 * football fact, so they are fixed product copy rather than generated content —
 * the same strings the hub and the screen header have always shown.
 */
const MODE_COPY: Record<AiQuestionsMode, { title: { en: string; ar: string }; description: { en: string; ar: string } }> = {
  'guess-player': {
    title: { en: 'Guess The Player', ar: 'خمن اللاعب' },
    description: { en: 'Guess the player from the clues and photo', ar: 'خمن اللاعب من الأدلة والصورة' },
  },
  'guess-club': {
    title: { en: 'Guess The Club', ar: 'خمن النادي' },
    description: { en: 'Use the clues and crest to guess the club', ar: 'استخدم الأدلة والشعار لتخمين النادي' },
  },
  'football-bingo': {
    title: { en: 'Football Bingo', ar: 'بينجو كرة القدم' },
    description: { en: 'Pick the correct cells from the club card', ar: 'اختر الخلايا الصحيحة من بطاقة الأندية' },
  },
  'football-grid': {
    title: { en: 'Football Grid', ar: 'شبكة كرة القدم' },
    description: { en: 'Place the player in the correct cell', ar: 'حدد الخلية الصحيحة لهذا اللاعب' },
  },
  'player-connections': {
    title: { en: 'Player Connections', ar: 'اتصالات اللاعبين' },
    description: { en: 'What connects these players?', ar: 'ما الرابط بين هؤلاء اللاعبين؟' },
  },
  'transfer-puzzle': {
    title: { en: 'Transfer Puzzle', ar: 'ألغاز الانتقالات' },
    description: { en: "Complete the player's transfer path", ar: 'أكمل مسار انتقالات اللاعب' },
  },
  'top10-challenge': {
    title: { en: 'Top 10 Challenge', ar: 'تحدي أفضل 10' },
    description: { en: "Rank the season's top scorers", ar: 'رتب الهدافين الأوائل هذا الموسم' },
  },
};

/* ────────────────────────── raw AI shapes ────────────────────────── */

type RawQuestion = Record<string, unknown>;

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(asString).filter(Boolean);
}

function asNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : NaN;
  }
  return NaN;
}

function normalizeDifficulty(value: unknown): QuizDifficulty {
  const raw = asString(value).toUpperCase();
  if (raw === 'HARD') return 'HARD';
  if (raw === 'MEDIUM') return 'MEDIUM';
  return 'EASY';
}

function allUnique(values: string[]): boolean {
  return new Set(values).size === values.length;
}

/**
 * Reads the model's reply envelope. Accepts `{questions:[…]}` and a bare array;
 * an INSUFFICIENT_DATA status comes back as an empty list, never as a partial
 * round that gets topped up from somewhere else.
 */
export function parseAiQuestionsPayload(payload: Record<string, unknown> | null | undefined): {
  questions: RawQuestion[];
  insufficient: boolean;
} {
  if (!payload) return { questions: [], insufficient: false };
  if (asString(payload.status) === 'INSUFFICIENT_DATA') {
    return { questions: [], insufficient: true };
  }
  const raw = Array.isArray(payload.questions) ? payload.questions : [];
  const questions = raw.filter((item): item is RawQuestion => Boolean(item) && typeof item === 'object');
  return { questions, insufficient: false };
}

/* ────────────────────────── shared assembly ────────────────────────── */

function localized(candidates: QuestionsFootballCandidates, name: string): string {
  return candidates.nameMap[name] ?? name;
}

function buildEvidence(raw: unknown, language: QuizLanguage): QuestionChallengeEvidence[] {
  if (!Array.isArray(raw)) return [];
  const out: QuestionChallengeEvidence[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const label = asString(row.label) || asString(row.text);
    const value = asString(row.value);
    if (!label) continue;
    const iconRaw = asString(row.icon);
    const icon = (EVIDENCE_ICONS as readonly string[]).includes(iconRaw) ? iconRaw : undefined;
    out.push({
      id: `e${out.length + 1}`,
      label,
      value: value || undefined,
      // The flat `text` is what a single-column clue row renders; for a
      // label/value pair it reads as one sentence.
      text: value ? `${label}: ${value}` : label,
      icon,
    });
    if (out.length >= 4) break;
  }
  // A round in Arabic must not silently fall back to English clue rows; an
  // empty result simply means this question has no evidence block.
  void language;
  return out;
}

/**
 * Turns 4 chosen entities into lettered options in a backend-decided order, so
 * the correct answer's position is never something the model controls.
 */
function buildOptions(
  entities: Array<{ label: string; imageUrl?: string; example?: string; isCorrect: boolean }>,
  rng: () => number,
): { options: QuestionChallengeOption[]; correctIds: string[] } | string {
  if (entities.length !== 4) return 'OPTION_ENTITY_COUNT_NOT_4';
  const labels = entities.map((e) => e.label.trim().toLowerCase());
  if (labels.some((label) => !label)) return 'OPTION_LABEL_EMPTY';
  if (!allUnique(labels)) return 'OPTION_LABEL_DUPLICATE';
  if (entities.filter((e) => e.isCorrect).length !== 1) return 'CORRECT_ENTITY_COUNT_NOT_1';

  const ordered = shuffle(entities, rng);
  const options = ordered.map((entity, index) => ({
    id: OPTION_LETTERS[index]!,
    label: entity.label,
    ...(entity.imageUrl ? { imageUrl: entity.imageUrl } : {}),
    ...(entity.example ? { example: entity.example } : {}),
  }));
  const correctIndex = ordered.findIndex((entity) => entity.isCorrect);
  if (correctIndex < 0) return 'CORRECT_ENTITY_LOST_IN_SHUFFLE';
  return { options, correctIds: [OPTION_LETTERS[correctIndex]!] };
}

/**
 * What one raw AI question turned into: the assembled question, or the reason
 * code it was refused for. Refusals are never silent — `buildModeRound` collects
 * them so a rejected round is logged as WHY it was rejected.
 */
type BuildResult = QuestionChallengeQuestion | string;

function isRejection<T extends object>(result: T | string): result is string {
  return typeof result === 'string';
}

interface QuestionBuildContext {
  language: QuizLanguage;
  candidates: QuestionsFootballCandidates;
  rng: () => number;
  playersById: Map<string, PlayerCandidate>;
  clubsById: Map<string, ClubCandidate>;
  clubByTeamId: Map<number, ClubCandidate>;
  /** Subject entity ids already used this round — no repeats. */
  usedSubjects: Set<string>;
  /** How many bingo cards this round have already used a given country. */
  countryUsage: Map<string, number>;
}

/**
 * How many bingo cards in one round may share a country. Two is a deliberate
 * ceiling rather than one: keying the card purely on its country would cap the
 * round at "however many countries this dataset happens to cover", which fails
 * a whole day over a thin country spread rather than over missing data.
 */
const MAX_BINGO_CARDS_PER_COUNTRY = 2;

function baseQuestion(
  raw: RawQuestion,
  index: number,
): { id: string; difficulty: QuizDifficulty; xpReward: number; prompt: string; hint?: string } | string {
  const prompt = asString(raw.prompt);
  if (!prompt) return 'PROMPT_MISSING';

  const confidence = asNumber(raw.confidence);
  if (!Number.isFinite(confidence)) return 'CONFIDENCE_MISSING';
  if (confidence < QUIZ_MIN_CONFIDENCE) return `CONFIDENCE_BELOW_${QUIZ_MIN_CONFIDENCE}:got=${confidence}`;

  const difficulty = normalizeDifficulty(raw.difficulty);
  const hint = asString(raw.hint);
  return {
    id: `q${index + 1}`,
    difficulty,
    xpReward: DIFFICULTY_XP[difficulty],
    prompt,
    ...(hint ? { hint } : {}),
  };
}

/* ────────────────────────── per-mode builders ────────────────────────── */

function buildGuessPlayer(raw: RawQuestion, ctx: QuestionBuildContext, index: number): BuildResult {
  const base = baseQuestion(raw, index);
  if (isRejection(base)) return base;

  const targetId = asString(raw.targetPlayerId);
  const target = ctx.playersById.get(targetId);
  if (!target) return `TARGET_PLAYER_NOT_A_CANDIDATE:${targetId || 'missing'}`;
  if (ctx.usedSubjects.has(target.id)) return `SUBJECT_ALREADY_USED:${target.id}`;

  const distractorIds = asStringArray(raw.distractorPlayerIds);
  if (distractorIds.length !== 3) return `DISTRACTOR_COUNT_NOT_3:got=${distractorIds.length}`;
  if (!allUnique(distractorIds)) return 'DISTRACTOR_DUPLICATE';
  if (distractorIds.includes(target.id)) return 'DISTRACTOR_IS_THE_ANSWER';
  const distractors = distractorIds.map((id) => ctx.playersById.get(id));
  const unknown = distractorIds.find((id) => !ctx.playersById.has(id));
  if (unknown) return `DISTRACTOR_PLAYER_NOT_A_CANDIDATE:${unknown}`;

  const built = buildOptions(
    [
      { label: localized(ctx.candidates, target.name), isCorrect: true },
      ...distractors.map((player) => ({ label: localized(ctx.candidates, player!.name), isCorrect: false })),
    ],
    ctx.rng,
  );
  if (typeof built === 'string') return built;

  const evidence = buildEvidence(raw.evidence, ctx.language);
  if (evidence.length === 0) return 'EVIDENCE_MISSING';

  ctx.usedSubjects.add(target.id);
  return {
    ...base,
    imageUrl: target.photoUrl,
    entity: { kind: 'player', id: target.id, name: target.name, imageUrl: target.photoUrl },
    evidence,
    options: built.options,
    answer: { correctIds: built.correctIds },
  };
}

function buildGuessClub(raw: RawQuestion, ctx: QuestionBuildContext, index: number): BuildResult {
  const base = baseQuestion(raw, index);
  if (isRejection(base)) return base;

  const targetId = asString(raw.targetClubId);
  const target = ctx.clubsById.get(targetId);
  if (!target) return `TARGET_CLUB_NOT_A_CANDIDATE:${targetId || 'missing'}`;
  if (ctx.usedSubjects.has(target.id)) return `SUBJECT_ALREADY_USED:${target.id}`;

  const distractorIds = asStringArray(raw.distractorClubIds);
  if (distractorIds.length !== 3) return `DISTRACTOR_COUNT_NOT_3:got=${distractorIds.length}`;
  if (!allUnique(distractorIds)) return 'DISTRACTOR_DUPLICATE';
  if (distractorIds.includes(target.id)) return 'DISTRACTOR_IS_THE_ANSWER';
  const distractors = distractorIds.map((id) => ctx.clubsById.get(id));
  const unknown = distractorIds.find((id) => !ctx.clubsById.has(id));
  if (unknown) return `DISTRACTOR_CLUB_NOT_A_CANDIDATE:${unknown}`;

  const built = buildOptions(
    [
      { label: localized(ctx.candidates, target.name), isCorrect: true },
      ...distractors.map((club) => ({ label: localized(ctx.candidates, club!.name), isCorrect: false })),
    ],
    ctx.rng,
  );
  if (typeof built === 'string') return built;

  const evidence = buildEvidence(raw.evidence, ctx.language);
  if (evidence.length === 0) return 'EVIDENCE_MISSING';

  ctx.usedSubjects.add(target.id);
  return {
    ...base,
    imageUrl: target.logoUrl,
    entity: { kind: 'team', id: target.id, name: target.name, imageUrl: target.logoUrl },
    evidence,
    options: built.options,
    answer: { correctIds: built.correctIds },
  };
}

function buildFootballBingo(raw: RawQuestion, ctx: QuestionBuildContext, index: number): BuildResult {
  const base = baseQuestion(raw, index);
  if (isRejection(base)) return base;

  const country = asString(raw.country);
  const countryClubs = ctx.candidates.clubsByCountry[country];
  if (!countryClubs || countryClubs.length < 3) return `COUNTRY_HAS_FEWER_THAN_3_CLUBS:${country || 'missing'}`;
  if ((ctx.countryUsage.get(country) ?? 0) >= MAX_BINGO_CARDS_PER_COUNTRY) {
    return `COUNTRY_USED_MORE_THAN_${MAX_BINGO_CARDS_PER_COUNTRY}_TIMES:${country}`;
  }

  const countryIds = new Set(countryClubs.map((club) => club.id));
  const correctIds = asStringArray(raw.correctClubIds);
  const otherIds = asStringArray(raw.otherClubIds);
  if (correctIds.length !== 3) return `CORRECT_CELL_COUNT_NOT_3:got=${correctIds.length}`;
  if (otherIds.length !== 6) return `OTHER_CELL_COUNT_NOT_6:got=${otherIds.length}`;
  // Two cards may share a country, but never the same trio of clubs.
  const trioKey = `bingo:${[...correctIds].sort().join('|')}`;
  if (ctx.usedSubjects.has(trioKey)) return 'BINGO_TRIO_ALREADY_USED';
  if (!allUnique([...correctIds, ...otherIds])) return 'BOARD_CLUB_DUPLICATE';
  // The objective is "these three are from <country>" — it has to be true of
  // exactly the three cells the answer names, and of none of the others.
  if (!correctIds.every((id) => countryIds.has(id))) return 'CORRECT_CELL_NOT_FROM_COUNTRY';
  if (otherIds.some((id) => countryIds.has(id))) return 'OTHER_CELL_ALSO_SATISFIES_OBJECTIVE';

  const correctClubs = correctIds.map((id) => ctx.clubsById.get(id));
  const otherClubs = otherIds.map((id) => ctx.clubsById.get(id));
  const unknownClub = [...correctIds, ...otherIds].find((id) => !ctx.clubsById.has(id));
  if (unknownClub) return `BOARD_CLUB_NOT_A_CANDIDATE:${unknownClub}`;
  if (correctClubs.some((club) => !club) || otherClubs.some((club) => !club)) {
    return 'BOARD_CLUB_NOT_A_CANDIDATE';
  }

  const objective = asString(raw.objective) || base.prompt;
  const boardClubs = shuffle(
    [
      ...correctClubs.map((club) => ({ club: club!, correct: true })),
      ...otherClubs.map((club) => ({ club: club!, correct: false })),
    ],
    ctx.rng,
  );

  const board: NonNullable<QuestionChallengeQuestion['bingoBoard']> = [];
  const cellAnswerIds: string[] = [];
  for (let row = 0; row < 3; row += 1) {
    const cells = [];
    for (let col = 0; col < 3; col += 1) {
      const entry = boardClubs[row * 3 + col]!;
      const id = `r${row}-c${col}`;
      if (entry.correct) cellAnswerIds.push(id);
      cells.push({
        id,
        label: localized(ctx.candidates, entry.club.name),
        imageUrl: entry.club.logoUrl,
        kind: 'club' as const,
      });
    }
    board.push(cells);
  }
  if (cellAnswerIds.length !== 3) return 'ANSWER_CELL_COUNT_NOT_3';

  ctx.usedSubjects.add(trioKey);
  ctx.countryUsage.set(country, (ctx.countryUsage.get(country) ?? 0) + 1);
  return {
    ...base,
    prompt: objective,
    bingoBoard: board,
    objectives: [objective],
    answer: { correctIds: cellAnswerIds },
  };
}

function buildFootballGrid(raw: RawQuestion, ctx: QuestionBuildContext, index: number): BuildResult {
  const base = baseQuestion(raw, index);
  if (isRejection(base)) return base;

  const targetId = asString(raw.targetPlayerId);
  const target = ctx.playersById.get(targetId);
  if (!target) return `TARGET_PLAYER_NOT_A_CANDIDATE:${targetId || 'missing'}`;
  if (!target.nationality) return `TARGET_PLAYER_HAS_NO_NATIONALITY:${target.id}`;
  if (ctx.usedSubjects.has(target.id)) return `SUBJECT_ALREADY_USED:${target.id}`;
  const targetClub = ctx.clubByTeamId.get(target.teamId);
  if (!targetClub) return `TARGET_PLAYERS_CLUB_NOT_A_CANDIDATE:team=${target.teamId}`;

  const otherClubIds = asStringArray(raw.otherClubIds);
  if (otherClubIds.length !== 2) return `OTHER_CLUB_COUNT_NOT_2:got=${otherClubIds.length}`;
  if (!allUnique(otherClubIds)) return 'OTHER_CLUB_DUPLICATE';
  if (otherClubIds.includes(targetClub.id)) return 'OTHER_CLUB_IS_THE_TARGETS_OWN_CLUB';
  const otherClubs = otherClubIds.map((id) => ctx.clubsById.get(id));
  const unknownClub = otherClubIds.find((id) => !ctx.clubsById.has(id));
  if (unknownClub) return `OTHER_CLUB_NOT_A_CANDIDATE:${unknownClub}`;

  const knownNationalities = new Set(
    ctx.candidates.players.map((player) => player.nationality).filter((value): value is string => Boolean(value)),
  );
  const otherNationalities = asStringArray(raw.otherNationalities);
  if (otherNationalities.length !== 2) return `OTHER_NATIONALITY_COUNT_NOT_2:got=${otherNationalities.length}`;
  if (!allUnique(otherNationalities)) return 'OTHER_NATIONALITY_DUPLICATE';
  if (otherNationalities.includes(target.nationality)) return 'OTHER_NATIONALITY_IS_THE_TARGETS';
  const inventedNationality = otherNationalities.find((value) => !knownNationalities.has(value));
  if (inventedNationality) return `NATIONALITY_NOT_IN_CANDIDATES:${inventedNationality}`;

  const rowClubs = shuffle([targetClub, ...otherClubs.map((club) => club!)], ctx.rng);
  const columns = shuffle([target.nationality, ...otherNationalities], ctx.rng);
  const rowIndex = rowClubs.findIndex((club) => club.id === targetClub.id);
  const colIndex = columns.indexOf(target.nationality);
  if (rowIndex < 0 || colIndex < 0) return 'ANSWER_CELL_LOST_IN_SHUFFLE';

  ctx.usedSubjects.add(target.id);
  return {
    ...base,
    entity: { kind: 'player', id: target.id, name: target.name, imageUrl: target.photoUrl },
    rows: rowClubs.map((club) => localized(ctx.candidates, club.name)),
    columns,
    rowImages: rowClubs.map((club) => club.logoUrl),
    /*
     * Columns are nationalities and carry no crest, so this used to be
     * `columns.map(() => undefined)` — an array of `undefined`, which Prisma
     * refuses to write into a JSON column ("Invalid value ... provided
     * undefined"). Every grid round was built correctly and then died at the
     * upsert, so the mode looked like a generation failure. The field is
     * optional; omit it rather than storing a row of holes.
     */
    validationRules: [base.prompt],
    answer: { correctIds: [`r${rowIndex}-c${colIndex}`] },
  };
}

function buildPlayerConnections(raw: RawQuestion, ctx: QuestionBuildContext, index: number): BuildResult {
  const base = baseQuestion(raw, index);
  if (isRejection(base)) return base;

  const groupId = asString(raw.groupId);
  const group = ctx.candidates.teammateGroups.find((entry) => entry.id === groupId);
  if (!group) return `TEAMMATE_GROUP_NOT_A_CANDIDATE:${groupId || 'missing'}`;
  if (ctx.usedSubjects.has(group.id)) return `SUBJECT_ALREADY_USED:${group.id}`;

  const rawOptions = Array.isArray(raw.options) ? raw.options : [];
  if (rawOptions.length !== 4) return `OPTION_COUNT_NOT_4:got=${rawOptions.length}`;

  const parsed = rawOptions.map((item) => {
    const row = (item ?? {}) as Record<string, unknown>;
    return { clubId: asString(row.clubId), text: asString(row.text), example: asString(row.example) };
  });
  if (parsed.some((option) => !option.clubId)) return 'OPTION_CLUB_ID_MISSING';
  if (parsed.some((option) => !option.text)) return 'OPTION_TEXT_MISSING';
  if (!allUnique(parsed.map((option) => option.clubId))) return 'OPTION_CLUB_DUPLICATE';
  const unknownClub = parsed.find((option) => !ctx.clubsById.has(option.clubId));
  if (unknownClub) return `OPTION_CLUB_NOT_A_CANDIDATE:${unknownClub.clubId}`;

  // Exactly one statement must be about the club these four actually share.
  const correctCount = parsed.filter((option) => option.clubId === group.clubId).length;
  if (correctCount !== 1) return `TRUE_STATEMENT_COUNT_NOT_1:got=${correctCount}`;

  const built = buildOptions(
    parsed.map((option) => ({
      label: option.text,
      example: option.example || undefined,
      isCorrect: option.clubId === group.clubId,
    })),
    ctx.rng,
  );
  if (typeof built === 'string') return built;

  ctx.usedSubjects.add(group.id);
  return {
    ...base,
    entity: { kind: 'team', id: group.clubId, name: group.teamName },
    players: group.players.map((player, playerIndex) => ({
      id: `p${playerIndex + 1}`,
      name: localized(ctx.candidates, player.name),
      imageUrl: player.photoUrl,
    })),
    options: built.options,
    relationships: [built.options.find((option) => built.correctIds.includes(option.id))!.label],
    answer: { correctIds: built.correctIds },
  };
}

function buildTransferPuzzle(raw: RawQuestion, ctx: QuestionBuildContext, index: number): BuildResult {
  const base = baseQuestion(raw, index);
  if (isRejection(base)) return base;

  const transferId = asString(raw.transferId);
  const transfer = ctx.candidates.transfers.find((entry) => entry.id === transferId);
  if (!transfer) return `TRANSFER_NOT_A_CANDIDATE:${transferId || 'missing'}`;
  if (ctx.usedSubjects.has(transfer.id)) return `SUBJECT_ALREADY_USED:${transfer.id}`;

  const priorNames = new Set(transfer.priorSteps.map((step) => step.clubName));
  const distractorIds = asStringArray(raw.distractorClubIds);
  if (distractorIds.length !== 3) return `DISTRACTOR_COUNT_NOT_3:got=${distractorIds.length}`;
  if (!allUnique(distractorIds)) return 'DISTRACTOR_DUPLICATE';
  const distractors = distractorIds.map((id) => ctx.clubsById.get(id));
  const unknownClub = distractorIds.find((id) => !ctx.clubsById.has(id));
  if (unknownClub) return `DISTRACTOR_CLUB_NOT_A_CANDIDATE:${unknownClub}`;
  // A distractor that is the real answer — or a club already visible earlier in
  // the same chain — makes the question unanswerable or trivially wrong.
  if (distractors.some((club) => club!.name === transfer.finalStep.clubName)) {
    return 'DISTRACTOR_IS_THE_REAL_DESTINATION';
  }
  if (distractors.some((club) => priorNames.has(club!.name))) {
    return 'DISTRACTOR_ALREADY_VISIBLE_IN_THE_CHAIN';
  }

  const built = buildOptions(
    [
      {
        label: localized(ctx.candidates, transfer.finalStep.clubName),
        imageUrl: transfer.finalStep.logoUrl,
        isCorrect: true,
      },
      ...distractors.map((club) => ({
        label: localized(ctx.candidates, club!.name),
        imageUrl: club!.logoUrl,
        isCorrect: false,
      })),
    ],
    ctx.rng,
  );
  if (typeof built === 'string') return built;

  const timeline = [
    ...transfer.priorSteps.map((step, stepIndex) => ({
      id: `t${stepIndex + 1}`,
      label: localized(ctx.candidates, step.clubName),
      year: step.year,
      imageUrl: step.logoUrl,
    })),
    { id: `t${transfer.priorSteps.length + 1}`, label: '?', hidden: true },
  ];

  ctx.usedSubjects.add(transfer.id);
  return {
    ...base,
    entity: { kind: 'player', id: transfer.playerId, name: transfer.playerName },
    transferTimeline: timeline,
    clubs: transfer.priorSteps.map((step) => localized(ctx.candidates, step.clubName)),
    years: transfer.priorSteps.map((step) => step.year),
    hiddenSteps: [timeline[timeline.length - 1]!.id],
    options: built.options,
    answer: { correctIds: built.correctIds },
  };
}

function buildTop10(raw: RawQuestion, ctx: QuestionBuildContext, index: number): BuildResult {
  const base = baseQuestion(raw, index);
  if (isRejection(base)) return base;

  const rankingId = asString(raw.rankingId);
  const ranking = ctx.candidates.rankings.find((entry) => entry.id === rankingId);
  if (!ranking) return `RANKING_NOT_A_CANDIDATE:${rankingId || 'missing'}`;
  if (ctx.usedSubjects.has(ranking.id)) return `SUBJECT_ALREADY_USED:${ranking.id}`;

  // The order is the real goal ranking, not anything the model chose.
  const items = ranking.rows.map((row, rowIndex) => ({
    id: String(rowIndex + 1),
    label: localized(ctx.candidates, row.name),
    imageUrl: row.photoUrl,
  }));
  if (items.length < 3) return `RANKING_HAS_FEWER_THAN_3_ROWS:got=${items.length}`;
  const orderedTop3 = items.slice(0, 3);

  ctx.usedSubjects.add(ranking.id);
  return {
    ...base,
    entity: { kind: 'league', id: `league:${ranking.leagueId}`, name: ranking.leagueLabel },
    options: items,
    orderedAnswers: orderedTop3,
    acceptedAnswers: orderedTop3.map((item) => item.id),
    scoring: { exact: 10, partial: 5 },
    answer: { orderedIds: orderedTop3.map((item) => item.id) },
  };
}

const BUILDERS: Record<AiQuestionsMode, (raw: RawQuestion, ctx: QuestionBuildContext, index: number) => BuildResult> = {
  'guess-player': buildGuessPlayer,
  'guess-club': buildGuessClub,
  'football-bingo': buildFootballBingo,
  'football-grid': buildFootballGrid,
  'player-connections': buildPlayerConnections,
  'transfer-puzzle': buildTransferPuzzle,
  'top10-challenge': buildTop10,
};

/* ────────────────────────── integrity ────────────────────────── */

/**
 * Shape/answer/image check on ONE assembled question.
 *
 * The rules themselves live in questions-challenges.round-contract.ts — the
 * SAME module the persistence layer and the session endpoint validate with — so
 * a question can no longer be accepted here under one set of rules and then
 * served (or refused) later under another. This wrapper keeps the boolean
 * signature the generator and its tests use.
 */
export function validateQuestionIntegrity(mode: AiQuestionsMode, question: QuestionChallengeQuestion): boolean {
  return validateQuestionContract(mode, question).length === 0;
}

/**
 * Whole-round check: exactly ROUND_QUESTION_COUNT valid questions, all on
 * DIFFERENT subject entities, each with a recorded answer.
 */
export function validateRoundIntegrity(challenge: GeneratedQuestionChallenge): boolean {
  return validateGeneratedRound(challenge).ok;
}

/** The same check, reporting WHY — this is what the rejection log line carries. */
export function validateGeneratedRound(challenge: GeneratedQuestionChallenge): { ok: boolean; errors: string[] } {
  const mode = challenge.mode as AiQuestionsMode;
  if (!BUILDERS[mode]) return { ok: false, errors: [`UNKNOWN_MODE:${challenge.mode}`] };
  const result = validateRoundContract({
    mode,
    questions: challenge.content.questions ?? [],
    answer: challenge.answer,
  });
  return { ok: result.ok, errors: result.errors };
}

/* ────────────────────────── round assembly ────────────────────────── */

function assembleChallenge(
  mode: AiQuestionsMode,
  language: QuizLanguage,
  questions: QuestionChallengeQuestion[],
  model: string,
  /** Agent tools the model called while writing this round — for observability. */
  toolsUsed: string[] = [],
  source: GeneratedQuestionChallenge['metadata']['source'] = 'AI',
): GeneratedQuestionChallenge {
  const copy = MODE_COPY[mode];
  const title = copy.title[language];
  const description = copy.description[language];
  const first = questions[0]!;

  const byQuestionId: NonNullable<QuestionChallengeAnswer['byQuestionId']> = {};
  for (const question of questions) {
    byQuestionId[question.id] = question.answer;
  }

  // Round difficulty is the hardest question in it; XP is the sum of what the
  // questions are actually worth, so the hub card and `xpAvailableToday` stay
  // derived from real content rather than a table.
  const difficulty: QuizDifficulty = questions.some((q) => q.difficulty === 'HARD')
    ? 'HARD'
    : questions.some((q) => q.difficulty === 'MEDIUM')
      ? 'MEDIUM'
      : 'EASY';

  return {
    mode,
    difficulty,
    xpReward: questions.reduce((total, question) => total + question.xpReward, 0),
    title,
    description,
    // Hub card artwork is the app's own per-mode illustration; the backend does
    // not send a football photo here, so the card never shows a player's face
    // as if it were the mode's identity.
    image: '',
    icon: MODE_ICON[mode],
    content: {
      title,
      description,
      questions,
      // Mirror of questions[0] for the flat legacy shape.
      prompt: first.prompt,
      imageUrl: first.imageUrl,
      hint: first.hint,
      options: first.options,
    } as GeneratedQuestionChallenge['content'],
    answer: { ...first.answer, byQuestionId },
    metadata: {
      refreshTime: '00:00',
      streakContribution: true,
      leaderboardEligibility: true,
      localized: true,
      source,
      model,
      ...(toolsUsed.length ? { agentTools: [...new Set(toolsUsed)] } : {}),
    },
  };
}

function difficultyForIndex(index: number): QuizDifficulty {
  const mod = index % 3;
  if (mod === 0) return 'EASY';
  if (mod === 1) return 'MEDIUM';
  return 'HARD';
}

function buildGuessPlayerDataRaw(
  language: QuizLanguage,
  candidates: QuestionsFootballCandidates,
  rng: () => number,
): RawQuestion[] {
  const players = shuffle(candidates.players, rng);
  if (players.length < Math.max(ROUND_QUESTION_COUNT, 4)) return [];

  const out: RawQuestion[] = [];
  for (let index = 0; index < ROUND_QUESTION_COUNT; index += 1) {
    const target = players[index]!;
    const distractorIds = shuffle(
      players.filter((player) => player.id !== target.id),
      rng,
    )
      .slice(0, 3)
      .map((player) => player.id);
    if (distractorIds.length !== 3) return [];

    const evidence = [
      {
        icon: 'globe',
        label: language === 'ar' ? 'الجنسية' : 'Nationality',
        value: target.nationality || (language === 'ar' ? 'غير متاح' : 'Unknown'),
      },
      {
        icon: 'shirt',
        label: language === 'ar' ? 'النادي' : 'Club',
        value: localized(candidates, target.teamName),
      },
      {
        icon: 'pitch',
        label: language === 'ar' ? 'المركز' : 'Position',
        value: target.position || (language === 'ar' ? 'غير متاح' : 'Unknown'),
      },
    ];

    out.push({
      prompt: language === 'ar' ? 'من هو هذا اللاعب؟' : 'Who is this player?',
      hint:
        language === 'ar'
          ? `يلعب في ${localized(candidates, target.teamName)}`
          : `Plays for ${localized(candidates, target.teamName)}`,
      confidence: 96,
      difficulty: difficultyForIndex(index),
      targetPlayerId: target.id,
      distractorPlayerIds: distractorIds,
      evidence,
    });
  }
  return out;
}

function buildGuessClubDataRaw(
  language: QuizLanguage,
  candidates: QuestionsFootballCandidates,
  rng: () => number,
): RawQuestion[] {
  const clubs = shuffle(candidates.clubs, rng);
  if (clubs.length < Math.max(ROUND_QUESTION_COUNT, 4)) return [];

  const out: RawQuestion[] = [];
  for (let index = 0; index < ROUND_QUESTION_COUNT; index += 1) {
    const target = clubs[index]!;
    const distractorIds = shuffle(
      clubs.filter((club) => club.id !== target.id),
      rng,
    )
      .slice(0, 3)
      .map((club) => club.id);
    if (distractorIds.length !== 3) return [];

    const evidence = [
      {
        icon: 'globe',
        label: language === 'ar' ? 'الدولة' : 'Country',
        value: target.country || (language === 'ar' ? 'غير متاح' : 'Unknown'),
      },
      {
        icon: 'calendar',
        label: language === 'ar' ? 'سنة التأسيس' : 'Founded',
        value: target.founded ? String(target.founded) : language === 'ar' ? 'غير متاح' : 'Unknown',
      },
      {
        icon: 'pitch',
        label: language === 'ar' ? 'الملعب' : 'Stadium',
        value: target.stadiumName || (language === 'ar' ? 'غير متاح' : 'Unknown'),
      },
    ];

    out.push({
      prompt: language === 'ar' ? 'ما اسم هذا النادي؟' : 'Which club is this?',
      hint:
        language === 'ar'
          ? `النادي من ${target.country || 'بلد غير محدد'}`
          : `This club is from ${target.country || 'an unknown country'}`,
      confidence: 96,
      difficulty: difficultyForIndex(index),
      targetClubId: target.id,
      distractorClubIds: distractorIds,
      evidence,
    });
  }
  return out;
}

/**
 * Transfer Puzzle, composed without a model.
 *
 * The chain, its clubs and its seasons are all facts on the candidate. The only
 * open choices are three wrong destination clubs, which the builder re-checks
 * are neither the real destination nor already visible in the chain.
 */
function buildTransferPuzzleDataRaw(
  language: QuizLanguage,
  candidates: QuestionsFootballCandidates,
  rng: () => number,
): RawQuestion[] {
  const transfers = shuffle(candidates.transfers, rng);
  if (transfers.length < ROUND_QUESTION_COUNT || candidates.clubs.length < 4) return [];

  const out: RawQuestion[] = [];
  for (const transfer of transfers) {
    if (out.length >= ROUND_QUESTION_COUNT) break;
    const visible = new Set([
      transfer.finalStep.clubName,
      ...transfer.priorSteps.map((step) => step.clubName),
    ]);
    const distractors = shuffle(
      candidates.clubs.filter((club) => !visible.has(club.name)),
      rng,
    ).slice(0, 3);
    if (distractors.length !== 3) continue;

    out.push({
      prompt:
        language === 'ar'
          ? `إلى أي نادٍ انتقل ${transfer.playerName}؟`
          : `Which club did ${transfer.playerName} move to?`,
      confidence: 96,
      difficulty: difficultyForIndex(out.length),
      transferId: transfer.id,
      distractorClubIds: distractors.map((club) => club.id),
    });
  }
  return out.length >= ROUND_QUESTION_COUNT ? out : [];
}

/**
 * Top 10, composed without a model.
 *
 * The ranking IS the answer: order comes from recorded goal totals on the
 * candidate, and the builder rebuilds it from those rows regardless of anything
 * stated here. Only the question sentence is authored.
 */
function buildTop10DataRaw(
  language: QuizLanguage,
  candidates: QuestionsFootballCandidates,
  rng: () => number,
): RawQuestion[] {
  const rankings = shuffle(candidates.rankings, rng);
  if (rankings.length < ROUND_QUESTION_COUNT) return [];

  return rankings.slice(0, ROUND_QUESTION_COUNT).map((ranking, index) => ({
    prompt:
      language === 'ar'
        ? `رتّب أفضل الهدافين في ${ranking.leagueLabel} موسم ${ranking.season}`
        : `Rank the top scorers in ${ranking.leagueLabel}, ${ranking.season}`,
    confidence: 96,
    difficulty: difficultyForIndex(index),
    rankingId: ranking.id,
  }));
}

/**
 * Football Bingo, composed without a model.
 *
 * The card is "three of these nine clubs are from <country>". Country and
 * membership are attributes of the candidate clubs themselves, so the whole
 * card is a selection problem over verified crests — the model contributed only
 * the sentence. Correct cells come from the country's own club list; the other
 * six are drawn from clubs that are NOT from that country, which is exactly
 * what the builder re-verifies.
 */
function buildFootballBingoDataRaw(
  language: QuizLanguage,
  candidates: QuestionsFootballCandidates,
  rng: () => number,
): RawQuestion[] {
  const countries = shuffle(
    Object.entries(candidates.clubsByCountry).filter(([, clubs]) => clubs.length >= 3),
    rng,
  );
  if (countries.length === 0) return [];

  const out: RawQuestion[] = [];
  const usedTrios = new Set<string>();

  for (let index = 0; out.length < ROUND_QUESTION_COUNT; index += 1) {
    // Cycle the country list, honouring the per-country cap the builder enforces.
    if (index >= countries.length * MAX_BINGO_CARDS_PER_COUNTRY) return [];
    const [country, countryClubs] = countries[index % countries.length]!;

    const correct = shuffle(countryClubs, rng).slice(0, 3);
    if (correct.length !== 3) continue;
    const trioKey = correct.map((club) => club.id).sort().join('|');
    if (usedTrios.has(trioKey)) continue;

    // Every other cell must fail the objective, so exclude the whole country.
    const others = shuffle(
      candidates.clubs.filter((club) => club.country !== country),
      rng,
    ).slice(0, 6);
    if (others.length !== 6) return [];

    usedTrios.add(trioKey);
    out.push({
      prompt:
        language === 'ar'
          ? `اختر الأندية الثلاثة من ${country}`
          : `Pick the three clubs from ${country}`,
      objective:
        language === 'ar' ? `ثلاثة أندية من ${country}` : `Three clubs from ${country}`,
      confidence: 96,
      difficulty: difficultyForIndex(out.length),
      country,
      correctClubIds: correct.map((club) => club.id),
      otherClubIds: others.map((club) => club.id),
    });
  }
  return out;
}

/**
 * Football Grid, composed without a model.
 *
 * The grid asks which cell matches one player's club AND nationality — both
 * recorded on the candidate. The two decoy clubs and two decoy nationalities
 * are drawn from other candidates, so every axis label is a real club or a
 * nationality some real player in the pool actually holds.
 */
function buildFootballGridDataRaw(
  language: QuizLanguage,
  candidates: QuestionsFootballCandidates,
  rng: () => number,
): RawQuestion[] {
  const clubByTeamId = new Map(candidates.clubs.map((club) => [club.apiTeamId, club]));
  const eligible = shuffle(
    candidates.players.filter((player) => player.nationality && clubByTeamId.has(player.teamId)),
    rng,
  );
  const nationalities = [
    ...new Set(
      candidates.players
        .map((player) => player.nationality)
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  if (eligible.length < ROUND_QUESTION_COUNT || nationalities.length < 3) return [];

  const out: RawQuestion[] = [];
  for (const target of eligible) {
    if (out.length >= ROUND_QUESTION_COUNT) break;
    const targetClub = clubByTeamId.get(target.teamId)!;

    const otherClubs = shuffle(
      candidates.clubs.filter((club) => club.id !== targetClub.id),
      rng,
    ).slice(0, 2);
    const otherNationalities = shuffle(
      nationalities.filter((value) => value !== target.nationality),
      rng,
    ).slice(0, 2);
    if (otherClubs.length !== 2 || otherNationalities.length !== 2) continue;

    out.push({
      prompt:
        language === 'ar'
          ? `أين يقع ${target.name} في الشبكة؟`
          : `Where does ${target.name} belong on the grid?`,
      confidence: 96,
      difficulty: difficultyForIndex(out.length),
      targetPlayerId: target.id,
      otherClubIds: otherClubs.map((club) => club.id),
      otherNationalities,
    });
  }
  return out.length >= ROUND_QUESTION_COUNT ? out : [];
}

/**
 * Player Connections, composed without a model.
 *
 * Nothing in this mode is generative: the four portraits are a real squad, the
 * answer is the club they actually share, and the distractors are other real
 * clubs from the candidate pool. The model was only ever phrasing a fixed
 * question and picking three wrong clubs — neither of which is a football fact,
 * and both of which are seeded here instead. Every id still goes through the
 * same builder and round contract as an AI round, so nothing reaches the
 * database on a laxer path.
 */
function buildPlayerConnectionsDataRaw(
  language: QuizLanguage,
  candidates: QuestionsFootballCandidates,
  rng: () => number,
): RawQuestion[] {
  const groups = shuffle(candidates.teammateGroups, rng);
  if (groups.length < ROUND_QUESTION_COUNT) return [];

  const out: RawQuestion[] = [];
  for (let index = 0; index < ROUND_QUESTION_COUNT; index += 1) {
    const group = groups[index]!;
    // Distractors must be real clubs, and never the club that is the answer.
    const distractors = shuffle(
      candidates.clubs.filter((club) => club.id !== group.clubId),
      rng,
    ).slice(0, 3);
    if (distractors.length !== 3) return [];

    const statement = (clubName: string) =>
      language === 'ar' ? `لعبوا جميعًا لنادي ${clubName}` : `They all played for ${clubName}`;

    const options = shuffle(
      [
        { clubId: group.clubId, text: statement(group.teamName) },
        ...distractors.map((club) => ({ clubId: club.id, text: statement(club.name) })),
      ],
      rng,
    );

    out.push({
      prompt:
        language === 'ar'
          ? 'ما الذي يجمع هؤلاء اللاعبين الأربعة؟'
          : 'What connects these four players?',
      confidence: 96,
      difficulty: difficultyForIndex(index),
      groupId: group.id,
      options,
    });
  }
  return out;
}

function buildRoundFromFootballData(
  mode: AiQuestionsMode,
  language: QuizLanguage,
  refreshDateYmd: string,
  candidates: QuestionsFootballCandidates,
): GeneratedQuestionChallenge | null {
  const DETERMINISTIC_RAW: Partial<
    Record<AiQuestionsMode, (l: QuizLanguage, c: QuestionsFootballCandidates, r: () => number) => RawQuestion[]>
  > = {
    'guess-player': buildGuessPlayerDataRaw,
    'guess-club': buildGuessClubDataRaw,
    'player-connections': buildPlayerConnectionsDataRaw,
    'football-bingo': buildFootballBingoDataRaw,
    'football-grid': buildFootballGridDataRaw,
    'transfer-puzzle': buildTransferPuzzleDataRaw,
    'top10-challenge': buildTop10DataRaw,
  };

  const compose = DETERMINISTIC_RAW[mode];
  if (!compose) return null;

  const rng = seededRng(`${refreshDateYmd}:${language}:${mode}:football-data`);
  const rawQuestions = compose(language, candidates, rng);

  if (rawQuestions.length < ROUND_QUESTION_COUNT) {
    return null;
  }

  const ctx: QuestionBuildContext = {
    language,
    candidates,
    rng,
    playersById: new Map(candidates.players.map((player) => [player.id, player])),
    clubsById: new Map(candidates.clubs.map((club) => [club.id, club])),
    clubByTeamId: new Map(candidates.clubs.map((club) => [club.apiTeamId, club])),
    usedSubjects: new Set<string>(),
    countryUsage: new Map<string, number>(),
  };

  const build = BUILDERS[mode];
  const accepted: QuestionChallengeQuestion[] = [];
  /** Why each composed question was refused — this path used to fail silently. */
  const refusals: string[] = [];
  for (const [index, item] of rawQuestions.entries()) {
    const built = build(item, ctx, index);
    if (isRejection(built)) {
      refusals.push(`#${index + 1}:${built}`);
      continue;
    }
    const integrity = validateQuestionContract(mode, built);
    if (integrity.length) {
      refusals.push(`#${index + 1}:${integrity.join(',')}`);
      continue;
    }
    accepted.push(built);
    if (accepted.length >= ROUND_QUESTION_COUNT) break;
  }

  if (accepted.length < ROUND_QUESTION_COUNT) {
    logger.warn('[QuestionsAI] deterministic round short of a full round', {
      mode,
      language,
      composed: rawQuestions.length,
      accepted: accepted.length,
      needed: ROUND_QUESTION_COUNT,
      refusals: refusals.slice(0, 6),
    });
    return null;
  }

  /*
   * 'DETERMINISTIC', not 'FOOTBALL_DATA'. The latter marks retired canned
   * content and is permanently unservable (isCannedLegacySource), so tagging
   * these rounds with it published them and then had the session gate archive
   * them on first read — the mode looked generated and played as missing.
   * These rounds are composed from the same verified candidates an AI round
   * uses, so they get a source that says so and are held to the identical
   * contract below.
   */
  const challenge = assembleChallenge(
    mode,
    language,
    accepted,
    'football-data-pipeline',
    [],
    'DETERMINISTIC',
  );
  const verdict = validateGeneratedRound(challenge);
  if (!verdict.ok) {
    logger.warn('[QuestionsAI] deterministic round failed the round contract', {
      mode,
      language,
      questionCount: accepted.length,
      errors: verdict.errors.slice(0, 8),
    });
    return null;
  }
  return challenge;
}

async function buildModeRound(
  mode: AiQuestionsMode,
  language: QuizLanguage,
  refreshDateYmd: string,
  candidates: QuestionsFootballCandidates,
  avoidPrompts: string[],
): Promise<GeneratedQuestionChallenge | null> {
  const system = buildQuestionsSystemPrompt(language);

  for (let attempt = 1; attempt <= MODE_ATTEMPTS; attempt += 1) {
    const user = buildQuestionsUserPrompt({ mode, language, refreshDate: refreshDateYmd, candidates, avoidPrompts });
    const result = await runQuestionsAgent({
      system,
      user,
      language,
      label: `${mode}:${language}:${refreshDateYmd}`,
      temperature: attempt === 1 ? 0.8 : 0.5,
    });

    if (!result && isFootballDataFallbackEnabled()) {
      const dataRound = buildRoundFromFootballData(mode, language, refreshDateYmd, candidates);
      if (dataRound) {
        logger.warn('[QuestionsAI] AI unavailable, built round from football data pipeline', {
          mode,
          language,
          refreshDateYmd,
          source: dataRound.metadata.source,
        });
        return dataRound;
      }
      continue;
    }

    if (!result) {
      continue;
    }

    const { questions: raw, insufficient } = parseAiQuestionsPayload(result.payload);
    if (insufficient) {
      logger.warn('[QuestionsAI] model reported INSUFFICIENT_DATA', { mode, language, refreshDateYmd });
      continue;
    }

    const ctx: QuestionBuildContext = {
      language,
      candidates,
      // Seeded per mode/day so a regeneration of the same day is stable.
      rng: seededRng(`${refreshDateYmd}:${language}:${mode}:${attempt}`),
      playersById: new Map(candidates.players.map((player) => [player.id, player])),
      clubsById: new Map(candidates.clubs.map((club) => [club.id, club])),
      clubByTeamId: new Map(candidates.clubs.map((club) => [club.apiTeamId, club])),
      usedSubjects: new Set<string>(),
      countryUsage: new Map<string, number>(),
    };

    const build = BUILDERS[mode];
    const accepted: QuestionChallengeQuestion[] = [];
    /** Why each refused question was refused — one entry per dropped item. */
    const questionErrors: string[] = [];

    for (const [rawIndex, item] of raw.entries()) {
      if (accepted.length >= ROUND_QUESTION_COUNT) break;
      const position = rawIndex + 1;
      const built = build(item, ctx, accepted.length);
      if (isRejection(built)) {
        questionErrors.push(`#${position}:${built}`);
        continue;
      }
      const integrity = validateQuestionContract(mode, built);
      if (integrity.length) {
        questionErrors.push(...integrity.map((error) => `#${position}:${error}`));
        continue;
      }
      accepted.push(built);
    }

    let roundErrors: string[] = [];
    if (accepted.length === ROUND_QUESTION_COUNT) {
      const challenge = assembleChallenge(mode, language, accepted, result.model, result.toolsUsed);
      const verdict = validateGeneratedRound(challenge);
      if (verdict.ok) return challenge;
      // Six questions were accepted and the round STILL failed — this is the
      // case that used to log `accepted === needed` with no reason at all.
      roundErrors = verdict.errors;
    }

    /*
     * The rejection is reported as what it actually was. `reason` names the
     * stage that refused the round; `validationErrors` carries the exact codes,
     * so a round that dies on its sixth question no longer looks identical to
     * one that dies on a whole-round rule.
     */
    const reason =
      accepted.length < ROUND_QUESTION_COUNT
        ? `NOT_ENOUGH_VALID_QUESTIONS:${accepted.length}/${ROUND_QUESTION_COUNT}`
        : 'ROUND_LEVEL_VALIDATION_FAILED';

    logger.warn('[QuestionsAI] round rejected, retrying', {
      mode,
      language,
      refreshDateYmd,
      attempt,
      returned: raw.length,
      accepted: accepted.length,
      needed: ROUND_QUESTION_COUNT,
      reason,
      validationErrors: summarizeErrors([...roundErrors, ...questionErrors], 12),
    });
  }

  if (isFootballDataFallbackEnabled()) {
    const dataRound = buildRoundFromFootballData(mode, language, refreshDateYmd, candidates);
    if (dataRound) {
      logger.warn('[QuestionsAI] AI attempts exhausted, built round from football data pipeline', {
        mode,
        language,
        refreshDateYmd,
        source: dataRound.metadata.source,
      });
      return dataRound;
    }
  }

  return null;
}

/**
 * Builds each playable mode's round for one day/language.
 *
 * PER-MODE, NOT ALL-OR-NOTHING. A mode that cannot be authored honestly is left
 * out; the modes that WERE authored are returned and published. This is the
 * difference between "guess-club found no honest round today" and "the Questions
 * hub is unavailable today": the old behaviour discarded a finished, valid
 * guess-player round because a later mode failed, which is exactly what left
 * yesterday's unplayable rows in place and 502'd the guess-player session.
 *
 * Nothing here is padded or invented to fill a gap — a missing mode stays
 * missing, and the caller fills it from a previous REAL day or not at all.
 *
 * Returns null only when nothing at all could be built: no AI provider, no
 * candidate pools, or every mode failed.
 */
export async function buildAiQuestionChallenges(
  language: QuizLanguage,
  refreshDateYmd: string,
  options?: { avoidPromptsByMode?: Partial<Record<AiQuestionsMode, string[]>> },
): Promise<GeneratedQuestionChallenge[] | null> {
  if (!isQuestionsAgentAvailable()) {
    logger.warn('[QuestionsAI] no quiz AI provider configured — cannot generate a round');
    return null;
  }

  const candidates = await buildQuestionsFootballCandidates(language, refreshDateYmd);
  if (!candidates) return null;

  const out: GeneratedQuestionChallenge[] = [];
  const failed: AiQuestionsMode[] = [];

  for (const mode of MODES) {
    const challenge = await buildModeRound(
      mode,
      language,
      refreshDateYmd,
      candidates,
      options?.avoidPromptsByMode?.[mode] ?? [],
    );
    if (!challenge) {
      failed.push(mode);
      logger.warn('[QuestionsAI] mode produced no usable round — skipping it', {
        mode,
        language,
        refreshDateYmd,
        builtSoFar: out.map((entry) => entry.mode),
      });
      continue;
    }
    out.push(challenge);
  }

  if (!out.length) {
    logger.error('[QuestionsAI] no mode produced a usable round', { language, refreshDateYmd });
    return null;
  }

  if (failed.length) {
    logger.warn('[QuestionsAI] built a partial day — the missing modes are not padded', {
      language,
      refreshDateYmd,
      built: out.map((entry) => entry.mode),
      missing: failed,
    });
  } else {
    logger.info('[QuestionsAI] built AI rounds for every mode', {
      language,
      refreshDateYmd,
      modes: out.length,
      questionsPerMode: ROUND_QUESTION_COUNT,
    });
  }

  return out;
}

/** Exposed for tests. */
export const AI_QUESTION_MODES = MODES;
