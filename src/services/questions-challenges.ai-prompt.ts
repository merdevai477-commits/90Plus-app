/**
 * PROMPTS FOR THE QUESTIONS-HUB AI
 * =============================================================================
 *
 * One prompt per mode. Each asks the project's quiz AI for exactly
 * ROUND_QUESTION_COUNT questions, chosen from a candidate payload of REAL
 * football entities that the backend gathered
 * (questions-challenges.football-data.ts).
 *
 * Two rules run through every prompt, and they are what keep the round honest:
 *
 *  1. ENTITY SELECTION BY ID. The model never types an entity name into an
 *     answer — it returns the candidate's `id`. The backend then renders the
 *     option label from the real entity name (localized through the shared
 *     football-name translator). A hallucinated player therefore cannot become
 *     an option: an unknown id is rejected.
 *
 *  2. NO IMAGE AUTHORING. The model never returns a URL. Every picture is
 *     attached by the backend from the entity the model selected — 365Scores
 *     portraits and API-Football crests. Per OMAR_QUIZ_AI_FOOTBALL_API.md §8
 *     there is no AI image generation in this system.
 *
 * What the AI genuinely authors: which entities to ask about, the question
 * text, the clue/evidence rows, the hints, the connection statements, the
 * difficulty grading, and its own confidence.
 */

import { QUIZ_MIN_CONFIDENCE, ROUND_QUESTION_COUNT } from '../constants/quiz.constants';
import type { QuizLanguage } from '../types/quiz.types';
import type { QuestionChallengeMode } from '../types/questions-challenges.types';
import type { QuestionsFootballCandidates } from './questions-challenges.football-data';

/** Icon keys the Evidence row renderer understands (QuestionsModeScreen). */
const EVIDENCE_ICON_KEYS = ['calendar', 'globe', 'pitch', 'shirt', 'trophy', 'ball'] as const;

export type AiQuestionsMode = Exclude<QuestionChallengeMode, 'football-quiz'>;

function langLabel(language: QuizLanguage): string {
  return language === 'ar' ? 'Modern Standard Arabic' : 'English';
}

function languageRule(language: QuizLanguage): string {
  return language === 'ar'
    ? `## LANGUAGE RULE (STRICT)
Write EVERY string you author — prompts, hints, evidence labels and values, statements — in Modern Standard Arabic.
Do not mix English words into Arabic sentences. A round containing English authored text is invalid.
Entity NAMES are not yours to write: you only return ids, and the backend renders the localized name.`
    : `## LANGUAGE RULE (STRICT)
Write EVERY string you author — prompts, hints, evidence labels and values, statements — in natural English.
Entity NAMES are not yours to write: you only return ids, and the backend renders the name.`;
}

export function buildQuestionsSystemPrompt(language: QuizLanguage): string {
  return `You are a professional football trivia writer for the 90Plus Questions hub.

## SOURCE OF TRUTH
The CANDIDATES JSON in the user message is the only factual authority. Never state a fact that is not in it.
Never introduce a player, club, country, competition or stadium that is not in CANDIDATES.

${languageRule(language)}

## ENTITY SELECTION RULE (STRICT)
You select entities by their "id" from CANDIDATES. You never type an entity's name into an answer option.
An id that is not present in CANDIDATES invalidates the whole question.

## IMAGE RULE (STRICT)
You never return an image URL, file name or picture description. Artwork is attached by the backend from the
entity you selected. Do not describe what a picture looks like, and never write a question that depends on a
visual detail that is not stated in CANDIDATES.

## CORRECTNESS RULE (STRICT)
Exactly one option is defensible per question; the other three must be clearly wrong.
No opinion questions ("best", "greatest"), no questions about currently-changing form, tables or prices.
Re-read every question before returning it and confirm the marked answer is the only correct one.

## CONFIDENCE RULE
Return "confidence" 0-100 per question. Never return a question below ${QUIZ_MIN_CONFIDENCE}.

## DIFFICULTY
"EASY" a casual fan answers in ~5s, "MEDIUM" a regular fan ~10s, "HARD" needs deeper knowledge.
Grade each question honestly; a mixed round is expected.

## OUTPUT RULE
Return ONLY valid JSON, no markdown, no commentary.
Return EXACTLY ${ROUND_QUESTION_COUNT} questions in "questions", each on a DIFFERENT subject entity,
or {"questions":[],"status":"INSUFFICIENT_DATA"} if the candidates cannot support a full honest round.
Never return a partial round and never repeat a subject entity within the round.
Repeating the same heading across questions is fine where the picture is the question (a crest or a
portrait); what must differ every time is the entity being asked about.`;
}

/** Per-mode response schema + authoring guidance. */
function modeContract(mode: AiQuestionsMode, language: QuizLanguage): string {
  const iconList = EVIDENCE_ICON_KEYS.join('" | "');
  const evidenceField = `- "evidence": 2-4 objects {"label": string, "value": string, "icon": "${iconList}"}
  Each row is one fact taken from the subject's candidate record, in ${langLabel(language)}.
  Never put the answer itself in a clue, and never use a clue that identifies the subject on its own.`;

  switch (mode) {
    case 'guess-player':
      return `## MODE: GUESS THE PLAYER
The player sees a portrait and clue rows, then picks a name from four options.

Each question object:
- "id": "q1".."q${ROUND_QUESTION_COUNT}"
- "difficulty", "confidence"
- "targetPlayerId": id from CANDIDATES.players — the player in the portrait and the correct answer
- "distractorPlayerIds": exactly 3 other ids from CANDIDATES.players, all different from the target
  Prefer players in the same position, then the same league, so the four names are plausible.
- "prompt": the question heading, e.g. a natural way of asking who this player is
- "hint": one short nudge that does not name the player
${evidenceField}`;

    case 'guess-club':
      return `## MODE: GUESS THE CLUB
The player sees a crest and clue rows, then picks a club from four options.

Each question object:
- "id": "q1".."q${ROUND_QUESTION_COUNT}"
- "difficulty", "confidence"
- "targetClubId": id from CANDIDATES.clubs — the club whose crest is shown, and the correct answer
- "distractorClubIds": exactly 3 other ids from CANDIDATES.clubs
  Prefer clubs from the same country so the crest question is meaningfully hard.
- "prompt", "hint"
${evidenceField}
  Use only the club's real "country", "founded" and "stadiumName" fields for clue values.`;

    case 'football-bingo':
      return `## MODE: FOOTBALL BINGO
A 3x3 card of club crests. The player taps the three cells that satisfy one objective.

Each question object:
- "id": "q1".."q${ROUND_QUESTION_COUNT}"
- "difficulty", "confidence"
- "country": a key of CANDIDATES.clubsByCountry that has at least 3 clubs
- "correctClubIds": exactly 3 club ids, all from that country
- "otherClubIds": exactly 6 club ids, none of them from that country
- "objective": the instruction shown above the card, in ${langLabel(language)}
- "prompt": may repeat the objective
- "hint"
Vary the country across the round: no country may be the answer to more than ${Math.max(2, Math.ceil(ROUND_QUESTION_COUNT / 3))} cards, and no two
cards may name the same three clubs.`;

    case 'player-connections':
      return `## MODE: PLAYER CONNECTIONS
Four portraits, and four statements about what links them. Exactly one is true.

Each question object:
- "id": "q1".."q${ROUND_QUESTION_COUNT}"
- "difficulty", "confidence"
- "groupId": id from CANDIDATES.teammateGroups — the four players shown
- "options": exactly 4 objects {"clubId": string, "text": string, "example": string}
  Exactly ONE option's "clubId" must equal that group's "clubId" — that option is the correct answer.
  The other three "clubId"s must be different clubs from CANDIDATES.clubs.
  "text" is the statement the player reads, in ${langLabel(language)}; write it about that club without
  naming it in a way that gives the answer away by formatting alone — keep all four phrased alike.
  "example" is a short muted second line, or an empty string.
- "prompt", "hint"`;

    case 'transfer-puzzle':
      return `## MODE: TRANSFER PUZZLE
A player's real move history with the last destination hidden. The player picks the missing club.

Each question object:
- "id": "q1".."q${ROUND_QUESTION_COUNT}"
- "difficulty", "confidence"
- "transferId": id from CANDIDATES.transfers — its "finalStep" club is the correct answer
- "distractorClubIds": exactly 3 ids from CANDIDATES.clubs, none of which is the final-step club
  and none of which appears in that transfer's "priorSteps"
- "prompt": asks where the player moved next
- "hint"`;

    /*
     * football-grid and top10-challenge are NOT authored by a model. Their
     * content is a recorded relationship — who won what, who played where, who
     * scored most — so both rounds are composed straight from stored football
     * data (questions-challenges.ai-generator.service.ts → buildFootballGridRound
     * / buildTop10Round) and this module is never asked for a prompt for them.
     */
    default:
      return '';
  }
}

/**
 * Candidate payload for one mode. Only the pools that mode needs are sent, so
 * the model is not handed 40kB of JSON it has no use for.
 */
function candidatePayload(
  mode: AiQuestionsMode,
  candidates: QuestionsFootballCandidates,
): Record<string, unknown> {
  const players = candidates.players.map((p) => ({
    id: p.id,
    name: p.name,
    position: p.position,
    club: p.teamName,
    clubId: `team:${p.teamId}`,
    nationality: p.nationality,
    shirtNumber: p.jerseyNumber,
  }));
  const clubs = candidates.clubs.map((c) => ({
    id: c.id,
    name: c.name,
    country: c.country,
    founded: c.founded,
    stadiumName: c.stadiumName,
  }));

  switch (mode) {
    case 'guess-player':
      return { players };
    case 'guess-club':
      return { clubs };
    case 'football-bingo':
      return {
        clubsByCountry: Object.fromEntries(
          Object.entries(candidates.clubsByCountry).map(([country, list]) => [
            country,
            list.map((c) => ({ id: c.id, name: c.name })),
          ]),
        ),
      };
    case 'player-connections':
      return {
        teammateGroups: candidates.teammateGroups.map((g) => ({
          id: g.id,
          clubId: g.clubId,
          club: g.teamName,
          players: g.players.map((p) => ({ id: p.id, name: p.name, position: p.position })),
        })),
        clubs,
      };
    case 'transfer-puzzle':
      return {
        transfers: candidates.transfers.map((t) => ({
          id: t.id,
          player: t.playerName,
          priorSteps: t.priorSteps.map((s) => ({ club: s.clubName, year: s.year })),
          finalStep: { club: t.finalStep.clubName, year: t.finalStep.year },
        })),
        clubs,
      };
    default:
      return {};
  }
}

export function buildQuestionsUserPrompt(params: {
  mode: AiQuestionsMode;
  language: QuizLanguage;
  refreshDate: string;
  candidates: QuestionsFootballCandidates;
  /** Recent prompts for this mode, so a day doesn't repeat the last one. */
  avoidPrompts?: string[];
}): string {
  const payload = candidatePayload(params.mode, params.candidates);
  const avoid = params.avoidPrompts?.length
    ? `\n\nDo NOT repeat or paraphrase these recent questions: ${params.avoidPrompts
        .slice(0, 24)
        .map((p) => p.slice(0, 90))
        .join(' | ')}`
    : '';

  return `Write the ${params.refreshDate} round for this mode in ${langLabel(params.language)}.

${modeContract(params.mode, params.language)}

CANDIDATES (the only entities that exist for this round — select by "id"):
${JSON.stringify(payload)}

Return {"questions":[ ... ]} with exactly ${ROUND_QUESTION_COUNT} objects in the schema above,
or {"questions":[],"status":"INSUFFICIENT_DATA"}.${avoid}`;
}

/** Exposed for tests — the icon vocabulary the Evidence renderer accepts. */
export const EVIDENCE_ICONS = EVIDENCE_ICON_KEYS;
