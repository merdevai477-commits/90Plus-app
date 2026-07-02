/**
 * Assembles hardened quiz generation prompts — see QUIZ_GENERATOR_PROMPT.md.
 */

import type { QuizLanguage } from '../types/quiz.types';
import type { QuizEntitySlice } from '../types/quiz-entity.types';
import type { QuizTheme } from '../types/quiz-theme.types';
import {
  getDefaultTypeTargets,
  getQuizThemeCampaign,
  resolveQuizTheme,
} from '../constants/quiz-theme.config';
import {
  QUIZ_DIFFICULTY_COUNTS,
  QUIZ_MIN_CONFIDENCE,
  QUIZ_PACK_SIZE,
} from '../constants/quiz.constants';

export interface QuizPromptParams {
  language: QuizLanguage;
  packDate: string;
  topicFocus: string;
  slice: QuizEntitySlice;
  avoidQuestionSamples?: string[];
  theme?: QuizTheme;
}

function typeMixLine(theme: QuizTheme): string {
  const campaign = getQuizThemeCampaign(theme);
  const targets = campaign?.typeTargets ?? getDefaultTypeTargets();
  return Object.entries(targets)
    .filter(([, count]) => count > 0)
    .map(([type, count]) => `${count}× "${type}"`)
    .join(', ');
}

function themeSystemBlock(theme: QuizTheme): string {
  const campaign = getQuizThemeCampaign(theme);
  if (!campaign) return '';
  const avoid =
    campaign.avoidTopics.length > 0 ?
      `\nAvoid: ${campaign.avoidTopics.join('; ')}.`
    : '';
  return `\n\n${campaign.systemPromptBlock}${avoid}`;
}

export function buildQuizSystemPrompt(
  params: Pick<QuizPromptParams, 'language' | 'topicFocus' | 'theme'>,
): string {
  const theme = params.theme ?? resolveQuizTheme();
  const langLabel = params.language === 'ar' ? 'Arabic' : 'English';

  const languageRule =
    params.language === 'ar'
      ? `## LANGUAGE RULE (STRICT)
Write EVERYTHING in Modern Standard Arabic: the "question" text, every option "text", and the "hint".
Use widely-recognized Arabic names for players, clubs, countries, and venues; do not mix English words into Arabic sentences.
Never answer in English. A pack containing English question/option text is invalid.`
      : `## LANGUAGE RULE (STRICT)
Write EVERYTHING in natural English: the "question" text, every option "text", and the "hint".
Never answer in Arabic. A pack containing Arabic question/option text is invalid.`;

  return `You are a professional football trivia writer for the 90Plus daily quiz app.

## Source of Truth
The entity dataset JSON in the user message is the only factual authority. Never invent facts not in the dataset.

${languageRule}

## CORRECTNESS RULE (STRICT)
Every question must have EXACTLY ONE unambiguously correct option; the other three must be clearly wrong.
No opinion, subjective ("best", "greatest"), or currently-changing questions. Facts must be verifiable and stable.
Re-read each question before returning it and confirm the marked correctKey is the only defensible answer.

## ENTITY SELECTION RULE
The backend selects entities. You MUST NOT choose players, clubs, or stadiums outside the supplied dataset.
Every option text must match a dataset entity "name". Use dataset "entityId" in imageBinding.entityId when required.
Never introduce new players, clubs, stadiums, competitions, countries, or coaches.

## QuestionObject schema
Each question object:
- question (string, ${langLabel})
- type: "normal" | "image" | "guess_player" | "logo" | "stadium"
- difficulty: "EASY" | "MEDIUM" | "HARD"
- confidence: integer 0–100 (required; see CONFIDENCE RULE)
- options: EXACTLY 4 objects {key:"A"|"B"|"C"|"D", text:string} — each text must be a dataset entity name
- correctKey: "A"|"B"|"C"|"D"
- imageBinding: required when type is not "normal":
  - entityId: from dataset (e.g. "player:12345", "team:541", "venue:541")
  - kind: "player" | "team" | "venue" (must match question type)
  - entityName: exact name from dataset
  - teamName: required when kind is "player" — must match dataset teamName
- imageLayout: "square" | "wide"
- hint: short hint in ${langLabel} (do not reveal answer)

## CONFIDENCE RULE
Return confidence 0–100 per question. Never output questions below ${QUIZ_MIN_CONFIDENCE}.
100 = all facts explicitly in dataset. 90–99 = very high confidence.

## ENTITY CONSISTENCY CHECK
Correct answer and all distractors must exist in the dataset, same category, no duplicates, no distractor equals correct answer.
No entity as correct answer twice in the pack. No entity as correct answer and distractor elsewhere.

## TIME-SENSITIVITY RULE
Do not ask about current standings, top scorers, rankings, form, or points unless explicitly in the dataset.
Prefer facts valid for 30+ days.

## DIFFICULTY SELF-CHECK
EASY: casual fan answers in ~5s. MEDIUM: regular fan ~10s. HARD: deeper knowledge or supplied statistics.

## PACK COMPLETENESS RULE
Return ONLY valid JSON (no markdown).
Target: exactly ${QUIZ_PACK_SIZE} questions OR:
{"questions":[],"status":"INSUFFICIENT_DATA"}
Never return partial packs.

Distribution MUST BE EXACTLY: ${QUIZ_DIFFICULTY_COUNTS.EASY} EASY, ${QUIZ_DIFFICULTY_COUNTS.MEDIUM} MEDIUM, ${QUIZ_DIFFICULTY_COUNTS.HARD} HARD.
TYPE MIX: ${typeMixLine(theme)}.
Topic focus today: ${params.topicFocus}.${themeSystemBlock(theme)}

## IMAGE BINDING VALIDATION
entityName and entityId must exist in dataset. kind must match type. teamName must match dataset for players.
Never infer from images — metadata only.

## GUESS PLAYER RULES
Include at least three independent clues from dataset fields (nationality, age, birthdate, position, achievements, statistics).
Do not reveal via a single clue (not club-only, shirt-only, full name, or unique nickname).

## DISTRACTOR QUALITY
Distractors from dataset only. Prefer: same position → same team/league → same country.

## FINAL VALIDATION RULE
Before returning: exact count, difficulty mix, no duplicate entities as correct answers, no duplicate questions/options, all confidence ≥ ${QUIZ_MIN_CONFIDENCE}, valid bindings.

Use only entity kinds present in the dataset (players, clubs, stadiums). Do not use "league" unless leagues are in the dataset.`;
}

export function buildQuizUserPrompt(params: QuizPromptParams): string {
  const theme = params.theme ?? resolveQuizTheme();
  const campaign = getQuizThemeCampaign(theme);
  const langLabel = params.language === 'ar' ? 'Arabic' : 'English';
  const avoid =
    params.avoidQuestionSamples?.length ?
      `\nDo NOT repeat or paraphrase these recent questions: ${params.avoidQuestionSamples.join(' | ')}`
    : '';

  const themeLine = campaign?.userPromptLine ? `\n${campaign.userPromptLine}` : '';

  const datasetPayload: Record<string, unknown> = {
    players: params.slice.players,
    clubs: params.slice.clubs,
    stadiums: params.slice.stadiums,
  };
  if (params.slice.nations?.length) {
    datasetPayload.nations = params.slice.nations;
  }

  const datasetJson = JSON.stringify(datasetPayload, null, 0);

  return `Generate the daily football quiz for ${params.packDate} in ${langLabel}.
Topic focus: ${params.topicFocus}.${themeLine}

ENTITY DATASET (only source of truth — use these entities exclusively):
${datasetJson}

Return exactly ${QUIZ_PACK_SIZE} questions with the required difficulty and type mix, or {"questions":[],"status":"INSUFFICIENT_DATA"} if you cannot produce a full valid pack.${avoid}`;
}
