/**
 * THE QUESTIONS-HUB AI GENERATOR
 * =============================================================================
 *
 * Builds each playable mode's daily round of ROUND_QUESTION_COUNT questions by
 * asking the project's quiz AI (questions-challenges.ai-client.ts) to author
 * them over a payload of REAL football entities
 * (questions-challenges.football-data.ts).
 *
 * THE SPLIT, and why it is this way
 * ---------------------------------
 * OMAR_QUIZ_AI_FOOTBALL_API.md is explicit that 90Plus exposes no server-side
 * "generate me questions" endpoint, that the football endpoints are the source
 * of entities, names, crests, portraits and statistics, and that the question
 * itself is authored by the project's own AI over that data (§0-§1, §7, §8).
 * So:
 *
 *   AI authors ....... which entity a question is about, the question text,
 *                      the clue rows, the hints, the connection statements,
 *                      the difficulty and its own confidence.
 *   Football data .... every entity, every option label, every image, and every
 *                      number (transfer chains, scorer rankings, founding
 *                      years, nationalities).
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
  imageUrlOrNull,
  seededRng,
  shuffle,
  type ClubCandidate,
  type PlayerCandidate,
  type QuestionsFootballCandidates,
} from './questions-challenges.football-data';
import { callQuestionsAiJson, isQuestionsAiConfigured } from './questions-challenges.ai-client';
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
): { options: QuestionChallengeOption[]; correctIds: string[] } | null {
  if (entities.length !== 4) return null;
  const labels = entities.map((e) => e.label.trim().toLowerCase());
  if (labels.some((label) => !label) || !allUnique(labels)) return null;
  if (entities.filter((e) => e.isCorrect).length !== 1) return null;

  const ordered = shuffle(entities, rng);
  const options = ordered.map((entity, index) => ({
    id: OPTION_LETTERS[index]!,
    label: entity.label,
    ...(entity.imageUrl ? { imageUrl: entity.imageUrl } : {}),
    ...(entity.example ? { example: entity.example } : {}),
  }));
  const correctIndex = ordered.findIndex((entity) => entity.isCorrect);
  if (correctIndex < 0) return null;
  return { options, correctIds: [OPTION_LETTERS[correctIndex]!] };
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
): { id: string; difficulty: QuizDifficulty; xpReward: number; prompt: string; hint?: string } | null {
  const prompt = asString(raw.prompt);
  if (!prompt) return null;

  const confidence = asNumber(raw.confidence);
  if (!Number.isFinite(confidence) || confidence < QUIZ_MIN_CONFIDENCE) return null;

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

function buildGuessPlayer(raw: RawQuestion, ctx: QuestionBuildContext, index: number): QuestionChallengeQuestion | null {
  const base = baseQuestion(raw, index);
  if (!base) return null;

  const target = ctx.playersById.get(asString(raw.targetPlayerId));
  if (!target || ctx.usedSubjects.has(target.id)) return null;

  const distractorIds = asStringArray(raw.distractorPlayerIds);
  if (distractorIds.length !== 3 || !allUnique(distractorIds) || distractorIds.includes(target.id)) return null;
  const distractors = distractorIds.map((id) => ctx.playersById.get(id));
  if (distractors.some((player) => !player)) return null;

  const built = buildOptions(
    [
      { label: localized(ctx.candidates, target.name), isCorrect: true },
      ...distractors.map((player) => ({ label: localized(ctx.candidates, player!.name), isCorrect: false })),
    ],
    ctx.rng,
  );
  if (!built) return null;

  const evidence = buildEvidence(raw.evidence, ctx.language);
  if (evidence.length === 0) return null;

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

function buildGuessClub(raw: RawQuestion, ctx: QuestionBuildContext, index: number): QuestionChallengeQuestion | null {
  const base = baseQuestion(raw, index);
  if (!base) return null;

  const target = ctx.clubsById.get(asString(raw.targetClubId));
  if (!target || ctx.usedSubjects.has(target.id)) return null;

  const distractorIds = asStringArray(raw.distractorClubIds);
  if (distractorIds.length !== 3 || !allUnique(distractorIds) || distractorIds.includes(target.id)) return null;
  const distractors = distractorIds.map((id) => ctx.clubsById.get(id));
  if (distractors.some((club) => !club)) return null;

  const built = buildOptions(
    [
      { label: localized(ctx.candidates, target.name), isCorrect: true },
      ...distractors.map((club) => ({ label: localized(ctx.candidates, club!.name), isCorrect: false })),
    ],
    ctx.rng,
  );
  if (!built) return null;

  const evidence = buildEvidence(raw.evidence, ctx.language);
  if (evidence.length === 0) return null;

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

function buildFootballBingo(raw: RawQuestion, ctx: QuestionBuildContext, index: number): QuestionChallengeQuestion | null {
  const base = baseQuestion(raw, index);
  if (!base) return null;

  const country = asString(raw.country);
  const countryClubs = ctx.candidates.clubsByCountry[country];
  if (!countryClubs || countryClubs.length < 3) return null;
  if ((ctx.countryUsage.get(country) ?? 0) >= MAX_BINGO_CARDS_PER_COUNTRY) return null;

  const countryIds = new Set(countryClubs.map((club) => club.id));
  const correctIds = asStringArray(raw.correctClubIds);
  const otherIds = asStringArray(raw.otherClubIds);
  if (correctIds.length !== 3 || otherIds.length !== 6) return null;
  // Two cards may share a country, but never the same trio of clubs.
  const trioKey = `bingo:${[...correctIds].sort().join('|')}`;
  if (ctx.usedSubjects.has(trioKey)) return null;
  if (!allUnique([...correctIds, ...otherIds])) return null;
  // The objective is "these three are from <country>" — it has to be true of
  // exactly the three cells the answer names, and of none of the others.
  if (!correctIds.every((id) => countryIds.has(id))) return null;
  if (otherIds.some((id) => countryIds.has(id))) return null;

  const correctClubs = correctIds.map((id) => ctx.clubsById.get(id));
  const otherClubs = otherIds.map((id) => ctx.clubsById.get(id));
  if (correctClubs.some((club) => !club) || otherClubs.some((club) => !club)) return null;

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
  if (cellAnswerIds.length !== 3) return null;

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

function buildFootballGrid(raw: RawQuestion, ctx: QuestionBuildContext, index: number): QuestionChallengeQuestion | null {
  const base = baseQuestion(raw, index);
  if (!base) return null;

  const target = ctx.playersById.get(asString(raw.targetPlayerId));
  if (!target || !target.nationality || ctx.usedSubjects.has(target.id)) return null;
  const targetClub = ctx.clubByTeamId.get(target.teamId);
  if (!targetClub) return null;

  const otherClubIds = asStringArray(raw.otherClubIds);
  if (otherClubIds.length !== 2 || !allUnique(otherClubIds) || otherClubIds.includes(targetClub.id)) return null;
  const otherClubs = otherClubIds.map((id) => ctx.clubsById.get(id));
  if (otherClubs.some((club) => !club)) return null;

  const knownNationalities = new Set(
    ctx.candidates.players.map((player) => player.nationality).filter((value): value is string => Boolean(value)),
  );
  const otherNationalities = asStringArray(raw.otherNationalities);
  if (otherNationalities.length !== 2 || !allUnique(otherNationalities)) return null;
  if (otherNationalities.includes(target.nationality)) return null;
  if (!otherNationalities.every((value) => knownNationalities.has(value))) return null;

  const rowClubs = shuffle([targetClub, ...otherClubs.map((club) => club!)], ctx.rng);
  const columns = shuffle([target.nationality, ...otherNationalities], ctx.rng);
  const rowIndex = rowClubs.findIndex((club) => club.id === targetClub.id);
  const colIndex = columns.indexOf(target.nationality);
  if (rowIndex < 0 || colIndex < 0) return null;

  ctx.usedSubjects.add(target.id);
  return {
    ...base,
    entity: { kind: 'player', id: target.id, name: target.name, imageUrl: target.photoUrl },
    rows: rowClubs.map((club) => localized(ctx.candidates, club.name)),
    columns,
    rowImages: rowClubs.map((club) => club.logoUrl),
    columnImages: columns.map(() => undefined),
    validationRules: [base.prompt],
    answer: { correctIds: [`r${rowIndex}-c${colIndex}`] },
  };
}

function buildPlayerConnections(raw: RawQuestion, ctx: QuestionBuildContext, index: number): QuestionChallengeQuestion | null {
  const base = baseQuestion(raw, index);
  if (!base) return null;

  const group = ctx.candidates.teammateGroups.find((entry) => entry.id === asString(raw.groupId));
  if (!group || ctx.usedSubjects.has(group.id)) return null;

  const rawOptions = Array.isArray(raw.options) ? raw.options : [];
  if (rawOptions.length !== 4) return null;

  const parsed = rawOptions.map((item) => {
    const row = (item ?? {}) as Record<string, unknown>;
    return { clubId: asString(row.clubId), text: asString(row.text), example: asString(row.example) };
  });
  if (parsed.some((option) => !option.clubId || !option.text)) return null;
  if (!allUnique(parsed.map((option) => option.clubId))) return null;
  if (!parsed.every((option) => ctx.clubsById.has(option.clubId))) return null;

  // Exactly one statement must be about the club these four actually share.
  const correctCount = parsed.filter((option) => option.clubId === group.clubId).length;
  if (correctCount !== 1) return null;

  const built = buildOptions(
    parsed.map((option) => ({
      label: option.text,
      example: option.example || undefined,
      isCorrect: option.clubId === group.clubId,
    })),
    ctx.rng,
  );
  if (!built) return null;

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

function buildTransferPuzzle(raw: RawQuestion, ctx: QuestionBuildContext, index: number): QuestionChallengeQuestion | null {
  const base = baseQuestion(raw, index);
  if (!base) return null;

  const transfer = ctx.candidates.transfers.find((entry) => entry.id === asString(raw.transferId));
  if (!transfer || ctx.usedSubjects.has(transfer.id)) return null;

  const priorNames = new Set(transfer.priorSteps.map((step) => step.clubName));
  const distractorIds = asStringArray(raw.distractorClubIds);
  if (distractorIds.length !== 3 || !allUnique(distractorIds)) return null;
  const distractors = distractorIds.map((id) => ctx.clubsById.get(id));
  if (distractors.some((club) => !club)) return null;
  // A distractor that is the real answer — or a club already visible earlier in
  // the same chain — makes the question unanswerable or trivially wrong.
  if (distractors.some((club) => club!.name === transfer.finalStep.clubName || priorNames.has(club!.name))) {
    return null;
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
  if (!built) return null;

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

function buildTop10(raw: RawQuestion, ctx: QuestionBuildContext, index: number): QuestionChallengeQuestion | null {
  const base = baseQuestion(raw, index);
  if (!base) return null;

  const ranking = ctx.candidates.rankings.find((entry) => entry.id === asString(raw.rankingId));
  if (!ranking || ctx.usedSubjects.has(ranking.id)) return null;

  // The order is the real goal ranking, not anything the model chose.
  const items = ranking.rows.map((row, rowIndex) => ({
    id: String(rowIndex + 1),
    label: localized(ctx.candidates, row.name),
    imageUrl: row.photoUrl,
  }));
  if (items.length < 3) return null;
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

const BUILDERS: Record<AiQuestionsMode, (raw: RawQuestion, ctx: QuestionBuildContext, index: number) => QuestionChallengeQuestion | null> = {
  'guess-player': buildGuessPlayer,
  'guess-club': buildGuessClub,
  'football-bingo': buildFootballBingo,
  'football-grid': buildFootballGrid,
  'player-connections': buildPlayerConnections,
  'transfer-puzzle': buildTransferPuzzle,
  'top10-challenge': buildTop10,
};

/* ────────────────────────── integrity ────────────────────────── */

function isRemoteImage(value: unknown): boolean {
  return imageUrlOrNull(value) !== null;
}

function checkMcqOptions(
  options: QuestionChallengeOption[] | undefined,
  correctIds: string[] | undefined,
  requireImages = false,
): boolean {
  if (!Array.isArray(options) || options.length !== 4) return false;
  const ids = options.map((option) => option.id);
  if (ids.some((id) => !id) || !allUnique(ids)) return false;
  const labels = options.map((option) => (option.label ?? '').trim().toLowerCase());
  if (labels.some((label) => !label) || !allUnique(labels)) return false;
  if (requireImages && !options.every((option) => isRemoteImage(option.imageUrl))) return false;
  if (!correctIds || correctIds.length === 0) return false;
  return correctIds.every((id) => ids.includes(id));
}

/**
 * Shape/answer/image check on ONE assembled question, independent of how it was
 * produced. Guards the invariants the Questions UI and the grader depend on:
 * every option-bearing mode carries exactly 4 unique options, the recorded
 * answer references options that exist, and every entity the UI will draw a
 * picture for has a real remote image URL.
 */
export function validateQuestionIntegrity(mode: AiQuestionsMode, question: QuestionChallengeQuestion): boolean {
  if (!question.id || !question.prompt.trim()) return false;
  const answer = question.answer ?? {};

  switch (mode) {
    case 'guess-player':
    case 'guess-club':
      // The picture IS the question.
      if (!isRemoteImage(question.imageUrl)) return false;
      if (!question.entity || !isRemoteImage(question.entity.imageUrl)) return false;
      if (question.entity.imageUrl !== question.imageUrl) return false;
      if (!question.evidence?.length) return false;
      return checkMcqOptions(question.options, answer.correctIds);

    case 'player-connections': {
      const players = question.players;
      if (!Array.isArray(players) || players.length !== 4) return false;
      if (!players.every((player) => player.name?.trim() && isRemoteImage(player.imageUrl))) return false;
      if (new Set(players.map((player) => player.imageUrl)).size !== 4) return false;
      return checkMcqOptions(question.options, answer.correctIds);
    }

    case 'transfer-puzzle': {
      const timeline = question.transferTimeline;
      if (!Array.isArray(timeline) || timeline.length < 2) return false;
      const visible = timeline.filter((step) => !step.hidden);
      const hidden = timeline.filter((step) => step.hidden);
      if (visible.length === 0 || hidden.length !== 1) return false;
      if (!visible.every((step) => isRemoteImage(step.imageUrl))) return false;
      // Every option renders a crest in this mode.
      return checkMcqOptions(question.options, answer.correctIds, true);
    }

    case 'football-bingo': {
      const board = question.bingoBoard;
      if (!Array.isArray(board) || board.length !== 3) return false;
      const cells = board.flat();
      if (cells.length !== 9) return false;
      const ids = cells.map((cell) => cell.id);
      if (ids.some((id) => !id) || !allUnique(ids)) return false;
      if (!cells.every((cell) => isRemoteImage(cell.imageUrl))) return false;
      const correctIds = answer.correctIds ?? [];
      if (correctIds.length !== 3 || !allUnique(correctIds)) return false;
      return correctIds.every((id) => ids.includes(id));
    }

    case 'football-grid': {
      if (question.rows?.length !== 3 || question.columns?.length !== 3) return false;
      const rowImages = question.rowImages;
      if (!Array.isArray(rowImages) || rowImages.length !== 3 || !rowImages.every(isRemoteImage)) return false;
      const correctId = answer.correctIds?.[0];
      if (!correctId) return false;
      return /^r[0-2]-c[0-2]$/.test(correctId);
    }

    case 'top10-challenge': {
      const options = question.options;
      if (!Array.isArray(options) || options.length < 3) return false;
      const ids = options.map((option) => option.id);
      if (ids.some((id) => !id) || !allUnique(ids)) return false;
      if (!options.every((option) => isRemoteImage(option.imageUrl))) return false;
      const orderedIds = answer.orderedIds ?? [];
      if (orderedIds.length !== 3 || !allUnique(orderedIds)) return false;
      return orderedIds.every((id) => ids.includes(id));
    }

    default:
      return false;
  }
}

/** Whole-round check: exactly ROUND_QUESTION_COUNT valid, non-duplicate questions. */
export function validateRoundIntegrity(challenge: GeneratedQuestionChallenge): boolean {
  const mode = challenge.mode as AiQuestionsMode;
  if (!BUILDERS[mode]) return false;

  const questions = challenge.content.questions ?? [];
  if (questions.length !== ROUND_QUESTION_COUNT) return false;
  if (!allUnique(questions.map((question) => question.id))) return false;
  if (!allUnique(questions.map((question) => question.prompt.trim().toLowerCase()))) return false;

  const byQuestionId = challenge.answer.byQuestionId ?? {};
  for (const question of questions) {
    if (!validateQuestionIntegrity(mode, question)) return false;
    if (!byQuestionId[question.id]) return false;
  }
  return true;
}

/* ────────────────────────── round assembly ────────────────────────── */

function assembleChallenge(
  mode: AiQuestionsMode,
  language: QuizLanguage,
  questions: QuestionChallengeQuestion[],
  model: string,
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
      source: 'AI',
      model,
    },
  };
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
    const result = await callQuestionsAiJson({
      system,
      user,
      label: `${mode}:${language}:${refreshDateYmd}`,
      temperature: attempt === 1 ? 0.8 : 0.5,
    });

    if (!result) continue;

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
    for (const item of raw) {
      if (accepted.length >= ROUND_QUESTION_COUNT) break;
      const question = build(item, ctx, accepted.length);
      if (!question) continue;
      if (!validateQuestionIntegrity(mode, question)) continue;
      accepted.push(question);
    }

    if (accepted.length === ROUND_QUESTION_COUNT) {
      const challenge = assembleChallenge(mode, language, accepted, result.model);
      if (validateRoundIntegrity(challenge)) return challenge;
    }

    logger.warn('[QuestionsAI] round rejected, retrying', {
      mode,
      language,
      refreshDateYmd,
      attempt,
      returned: raw.length,
      accepted: accepted.length,
      needed: ROUND_QUESTION_COUNT,
    });
  }

  return null;
}

/**
 * Builds every playable mode's round for one day/language.
 *
 * Returns null — never a partial or mixed batch — when the AI is unavailable,
 * the football candidate pools are too thin, or any mode cannot reach a full
 * round of real questions. Callers fall back to recycling a previous real day;
 * there is no authored-content tier behind this.
 */
export async function buildAiQuestionChallenges(
  language: QuizLanguage,
  refreshDateYmd: string,
  options?: { avoidPromptsByMode?: Partial<Record<AiQuestionsMode, string[]>> },
): Promise<GeneratedQuestionChallenge[] | null> {
  if (!isQuestionsAiConfigured()) {
    logger.warn('[QuestionsAI] no quiz AI provider configured — cannot generate a round');
    return null;
  }

  const candidates = await buildQuestionsFootballCandidates(language, refreshDateYmd);
  if (!candidates) return null;

  const out: GeneratedQuestionChallenge[] = [];
  for (const mode of MODES) {
    const challenge = await buildModeRound(
      mode,
      language,
      refreshDateYmd,
      candidates,
      options?.avoidPromptsByMode?.[mode] ?? [],
    );
    if (!challenge) {
      logger.warn('[QuestionsAI] mode produced no usable round — failing the day', {
        mode,
        language,
        refreshDateYmd,
        builtSoFar: out.map((entry) => entry.mode),
      });
      return null;
    }
    out.push(challenge);
  }

  logger.info('[QuestionsAI] built AI rounds for every mode', {
    language,
    refreshDateYmd,
    modes: out.length,
    questionsPerMode: ROUND_QUESTION_COUNT,
  });
  return out;
}

/** Exposed for tests. */
export const AI_QUESTION_MODES = MODES;
