import type { QuizDifficulty, QuizLanguage } from './quiz.types';

export type QuestionChallengeMode =
  | 'guess-player'
  | 'football-bingo'
  | 'football-grid'
  | 'player-connections'
  | 'guess-club'
  | 'transfer-puzzle'
  | 'top10-challenge'
  | 'football-quiz';

export interface QuestionChallengeOption {
  id: string;
  label: string;
  imageUrl?: string;
  badge?: string;
  /** Muted second line under the label (player-connections illustrates each link). */
  example?: string;
}

/** One clue row in the Evidence block. */
export interface QuestionChallengeEvidence {
  id: string;
  text: string;
  label?: string;
  value?: string;
  icon?: string;
}

/**
 * The real football entity a question's artwork belongs to. Carried alongside
 * the image so a picture can never be paired with a different entity's name:
 * the image URL is resolved from THIS entity, never from the option label.
 */
export interface QuestionChallengeEntityRef {
  kind: 'player' | 'team' | 'league' | 'venue';
  /** Dataset id — "player:154" / "team:541". */
  id: string;
  /** Source (English) entity name, before localization. */
  name: string;
  /** Image resolved for this entity by the football layer. */
  imageUrl?: string;
}

/**
 * ONE question inside a mode's daily round. A round is `ROUND_QUESTION_COUNT`
 * of these — see questions-challenges.ai-generator.service.ts.
 *
 * `prompt` / `hint` / `evidence[].text` are authored by the AI.
 * `options[].label`, every `imageUrl` and every `entity` come from real
 * football data and are verified against it before the question is stored.
 */
export interface QuestionChallengeQuestion {
  id: string;
  difficulty: QuizDifficulty;
  xpReward: number;
  prompt: string;
  description?: string;
  hint?: string;
  /** Hero artwork — resolved for `entity`, never authored by the AI. */
  imageUrl?: string;
  entity?: QuestionChallengeEntityRef;
  evidence?: QuestionChallengeEvidence[];
  options?: QuestionChallengeOption[];
  /** football-bingo */
  bingoBoard?: Array<Array<{ id: string; label?: string; imageUrl?: string; kind?: 'club' | 'player' | 'country' | 'stadium' }>>;
  objectives?: string[];
  /**
   * football-grid — the shared 3×3 board, repeated on every question of the
   * round so the app can draw the whole board while answering one cell.
   * `rows` are clubs / national teams, `columns` are awards.
   */
  rows?: string[];
  columns?: string[];
  rowImages?: Array<string | undefined>;
  columnImages?: Array<string | undefined>;
  validationRules?: string[];
  /** football-grid: which cell of that board THIS question fills. */
  gridCell?: { row: number; column: number };
  /** player-connections */
  players?: Array<{ id: string; name: string; imageUrl?: string }>;
  relationships?: string[];
  /** transfer-puzzle */
  transferTimeline?: Array<{ id: string; label: string; year?: string; imageUrl?: string; hidden?: boolean }>;
  clubs?: string[];
  years?: string[];
  hiddenSteps?: string[];
  /** top10-challenge */
  orderedAnswers?: Array<{ id: string; label: string; imageUrl?: string }>;
  acceptedAnswers?: string[];
  scoring?: { exact: number; partial: number };
  /**
   * top10-challenge (text entry). Non-secret framing for the ten inputs: what
   * the list is OF and how many slots it has. The names themselves stay in
   * `answer` — the client never receives them before grading.
   */
  top10?: {
    slots: number;
    /** "Premier League", "FIFA World Cup" … — the list's subject. */
    categoryLabel: string;
    /** "2010", "2024/25" … — the year the list belongs to. */
    seasonLabel?: string;
  };
  /** The graded answer for THIS question. */
  answer: QuestionChallengeAnswer;
}

/**
 * WHAT A QUESTION EXPECTS FROM THE PLAYER — counts only, never identities.
 *
 * Sent to the client so it can cap selection, know when an answer is complete
 * and auto-submit a board placement. Carrying "three cells" leaks nothing:
 * every bingo card takes three, and which three stays server-side.
 */
export type QuestionSelectionMode = 'single' | 'multiple' | 'text';

export interface QuestionSelectionRules {
  selectionMode: QuestionSelectionMode;
  requiredSelections: number;
  maxSelections: number;
  /** Submit as soon as `requiredSelections` is reached — no confirm button. */
  autoSubmit: boolean;
}

/** A question as the client receives it: no answer key, plus selection rules. */
export type SanitizedQuestion = Omit<QuestionChallengeQuestion, 'answer'> & {
  selection: QuestionSelectionRules;
};

export interface ChallengeContentBase {
  title: string;
  description: string;
  prompt: string;
  imageUrl?: string;
  hint?: string;
  timer?: number;
  /**
   * THE ROUND. Every playable mode stores its full set of questions here, and
   * the app plays them in order (front/services/questionsModes.ts). The
   * `prompt`/`imageUrl`/`options` fields above mirror `questions[0]` so an
   * older client that only reads the flat shape still gets a real question.
   */
  questions?: QuestionChallengeQuestion[];
}

export interface GuessPlayerContent extends ChallengeContentBase {
  options: QuestionChallengeOption[];
  playerFacts?: string[];
}

export interface FootballBingoContent extends ChallengeContentBase {
  bingoBoard: Array<Array<{ id: string; label?: string; imageUrl?: string }>>;
  objectives: string[];
}

export interface FootballGridContent extends ChallengeContentBase {
  rows: string[];
  columns: string[];
  validationRules: string[];
}

export interface PlayerConnectionsContent extends ChallengeContentBase {
  players: Array<{ id: string; name: string; imageUrl?: string }>;
  options: QuestionChallengeOption[];
  relationships: string[];
}

export interface GuessClubContent extends ChallengeContentBase {
  clubFacts: string[];
  logo?: string;
  images?: string[];
  options: QuestionChallengeOption[];
}

export interface TransferPuzzleContent extends ChallengeContentBase {
  transferTimeline: Array<{ id: string; label: string; year?: string; imageUrl?: string; hidden?: boolean }>;
  clubs: string[];
  years: string[];
  hiddenSteps: string[];
  options: QuestionChallengeOption[];
}

export interface Top10ChallengeContent extends ChallengeContentBase {
  orderedAnswers: Array<{ id: string; label: string; imageUrl?: string }>;
  acceptedAnswers: string[];
  scoring: {
    exact: number;
    partial: number;
  };
  options: QuestionChallengeOption[];
}

export interface FootballQuizContent extends ChallengeContentBase {
  question: string;
  options: QuestionChallengeOption[];
  explanation?: string;
}

export type QuestionChallengeContent =
  | GuessPlayerContent
  | FootballBingoContent
  | FootballGridContent
  | PlayerConnectionsContent
  | GuessClubContent
  | TransferPuzzleContent
  | Top10ChallengeContent
  | FootballQuizContent;

/** One slot of a Top 10 answer key: the real name and what else counts as it. */
export interface Top10AnswerSlot {
  /** 1-based position in the real ranking. */
  rank: number;
  /** The player's name as the data records it — what the reveal shows. */
  canonical: string;
  /**
   * Other spellings that count as this player: short names, the surname on its
   * own, the localized name. Taken from stored records, never invented.
   */
  aliases: string[];
  imageUrl?: string;
  /** The number behind the ranking (goals), for the reveal. */
  value?: number;
}

export interface QuestionChallengeAnswer {
  correctIds?: string[];
  acceptedIds?: string[];
  orderedIds?: string[];
  freeTextAnswers?: string[];
  /** top10-challenge — the ten real names, in rank order. Never sent to a client. */
  orderedAnswers?: Top10AnswerSlot[];
  /**
   * Per-question answers for a multi-question round, keyed by
   * `QuestionChallengeQuestion.id`. The flat fields above stay populated with
   * `questions[0]`'s answer for back-compat with clients that submit without a
   * `questionId`.
   */
  byQuestionId?: Record<string, Omit<QuestionChallengeAnswer, 'byQuestionId'>>;
}

export interface QuestionChallengeMetadata {
  refreshTime: string;
  streakContribution: boolean;
  leaderboardEligibility: boolean;
  localized: boolean;
  /**
   * 'AI' — authored by the project's quiz AI (Gemini → OpenRouter) over a real
   * 90Plus football-entity payload, with every image resolved by the football
   * layer. This is the only source new rows are written with; see
   * questions-challenges.ai-generator.service.ts.
   *
   * 'DETERMINISTIC' — composed with no model at all, from the same verified
   * candidate payload an AI round is built from: real squads, real crests, real
   * portraits, answers taken from the data rather than written. Used when no AI
   * provider can answer. Distinct from 'FOOTBALL_DATA' on purpose — see below.
   *
   * 'FOOTBALL_DATA' / 'STATIC_FALLBACK' are legacy values still present on rows
   * written by earlier builds — kept in the union so those rows deserialize.
   * They denote CANNED authored content (stock prompts over stock images) and
   * stay permanently unservable via isCannedLegacySource(). A deterministic
   * round is not canned, which is why it needed its own value rather than
   * reusing this one or weakening that guard.
   */
  source: 'AI' | 'MANUAL' | 'DETERMINISTIC' | 'FOOTBALL_DATA' | 'STATIC_FALLBACK';
  /** Model that authored the round, for observability. */
  model?: string;
  /**
   * Agent tools the model actually called while writing the round (search_player,
   * get_top_scorers, …). Proof, on the row itself, that the round came through
   * the football agent rather than the model's memory.
   */
  agentTools?: string[];
}

export interface DailyQuestionChallengeDto {
  id: string;
  type: QuestionChallengeMode;
  title: string;
  description: string;
  image: string;
  icon: string;
  difficulty: QuizDifficulty;
  xpReward: number;
  refreshTime: string;
  completionState: 'locked' | 'available' | 'completed';
  completionPercentage: number;
  unlockState: boolean;
  streakContribution: boolean;
  leaderboardEligibility: boolean;
}

/**
 * Real counters behind the Questions hub stats strip. Derived from the user's
 * own answer rows and today's published challenges — never from a bundled
 * question bank or a hardcoded XP table.
 */
export interface QuestionsModesSummary {
  /** Challenges this user has actually attempted at least once. */
  answeredCount: number;
  /** XP this user has earned from Questions challenges, all time. */
  xpEarnedTotal: number;
  /** XP obtainable from today's published challenges. */
  xpAvailableToday: number;
}

export interface QuestionChallengeSessionDto {
  challengeId: string;
  type: QuestionChallengeMode;
  title: string;
  description: string;
  image: string;
  icon: string;
  difficulty: QuizDifficulty;
  xpReward: number;
  refreshDate: string;
  refreshTime: string;
  completionState: 'locked' | 'available' | 'completed';
  completionPercentage: number;
  unlockState: boolean;
  streakContribution: boolean;
  leaderboardEligibility: boolean;
  content: QuestionChallengeContent;
  /** @deprecated Server no longer exposes correct answers on session load. */
  answer?: QuestionChallengeAnswer;
  attempts: number;
  completed: boolean;
  score: number;
  elapsedTime: number;
  /** Game-flow session state — server authoritative. */
  status?: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  /** 1-based index of the question the player may answer now. */
  currentQuestion?: number;
  totalQuestions?: number;
  /** Current question payload without the graded answer. */
  question?: SanitizedQuestion;
  questionStartedAt?: string;
  questionExpiresAt?: string;
  serverNow?: string;
  timeLimitSec?: number;
  /** 0-based index — mirrors `currentQuestion - 1` while in progress. */
  currentQuestionIndex?: number;
  finalResult?: {
    totalQuestions: number;
    correctAnswers: number;
    wrongAnswers: number;
    expiredQuestions: number;
    totalScore: number;
  };
  /**
   * FOOTBALL GRID — the cells this player has already filled, `r{row}-c{col}`
   * → the player they placed there.
   *
   * The board is drawn from the round, but WHICH cells are already won is per
   * user, and the app cannot hold it: leaving the screen (or a reload, or the
   * app being backgrounded) drops the component state, and the board came back
   * empty even though the server had every placement. It is sent on session
   * load so a reopened board redraws exactly as it was left.
   *
   * Only ACCEPTED placements appear here. A refused one leaves its cell empty
   * on the board, so replaying it would say nothing the player has not already
   * been told, and no unanswered cell is ever described.
   */
  gridPlacements?: Record<string, { label: string; imageUrl?: string }>;
}

/**
 * "Ask the crowd" — the real distribution of what other players picked on one
 * question, read off UserQuestionChallenge.answeredPayload. Never synthesised:
 * when too few players have answered, `available` is false and `percentages`
 * is empty so the app shows its existing not-enough-data state.
 */
export interface QuestionCrowdStats {
  challengeId: string;
  questionId: string;
  available: boolean;
  sampleSize: number;
  /** optionId → whole-number percentage of players who picked it. */
  percentages: Record<string, number>;
}

/**
 * "50:50" — which two option ids should remain visible: the real correct
 * option plus exactly one real wrong option, both resolved server-side from
 * the round's stored answer. The client never sees the full answer key and
 * never picks the survivor itself.
 */
export interface QuestionFiftyFiftyResult {
  challengeId: string;
  questionId: string;
  keepIds: string[];
}

export interface QuestionChallengeSubmitResult {
  challengeId: string;
  questionId: string;
  isCorrect: boolean;
  completionPercentage: number;
  completed: boolean;
  /** Final aggregate score — populated only when the round is complete. */
  score: number;
  attempts: number;
  elapsedTime: number;
  xpEarned: number;
  bonusXp: number;
  streakBonus: number;
  totalXpAwarded: number;
  currentStreak: number;
  longestStreak: number;
  answer: QuestionChallengeAnswer;
  hint?: string | null;
  timeExpired?: boolean;
  pointsEarned?: number;
  finalResult?: QuestionChallengeSessionDto['finalResult'];
  idempotent?: boolean;
  /**
   * top10-challenge — per slot, whether the server matched what was typed
   * there. Sent only with the graded result, so the reveal can mark each row
   * without the app ever holding the answer key beforehand.
   */
  slotResults?: boolean[];
  /** Authoritative XP total and level after this answer was graded. */
  xp?: number;
  level?: number;
  /** Authoritative coin balance after this answer was graded. */
  coins?: number;
  /** Coins the wrong-answer penalty actually took (0 when none was charged). */
  coinsDeducted?: number;
}

export interface QuestionChallengeLeaderboardRow {
  rank: number;
  userId: string;
  username: string;
  displayName: string | null;
  avatar: string | null;
  xp: number;
  completedChallenges: number;
  accuracy: number;
}

export interface GeneratedQuestionChallenge {
  mode: QuestionChallengeMode;
  difficulty: QuizDifficulty;
  xpReward: number;
  title: string;
  description: string;
  image: string;
  icon: string;
  content: QuestionChallengeContent;
  answer: QuestionChallengeAnswer;
  metadata: QuestionChallengeMetadata;
}

export interface GeneratedQuestionChallengesPayload {
  language: QuizLanguage;
  refreshDate: string;
  refreshTime: string;
  challenges: GeneratedQuestionChallenge[];
}
