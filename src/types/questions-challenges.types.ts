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
  /** football-grid */
  rows?: string[];
  columns?: string[];
  rowImages?: Array<string | undefined>;
  columnImages?: Array<string | undefined>;
  validationRules?: string[];
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
  /** The graded answer for THIS question. */
  answer: QuestionChallengeAnswer;
}

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

export interface QuestionChallengeAnswer {
  correctIds?: string[];
  acceptedIds?: string[];
  orderedIds?: string[];
  freeTextAnswers?: string[];
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
   * 'FOOTBALL_DATA' / 'STATIC_FALLBACK' are legacy values still present on rows
   * written by earlier builds — kept in the union so those rows deserialize.
   */
  source: 'AI' | 'MANUAL' | 'FOOTBALL_DATA' | 'STATIC_FALLBACK';
  /** Model that authored the round, for observability. */
  model?: string;
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
  answer?: QuestionChallengeAnswer;
  attempts: number;
  completed: boolean;
  score: number;
  elapsedTime: number;
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

export interface QuestionChallengeSubmitResult {
  challengeId: string;
  questionId: string;
  isCorrect: boolean;
  completionPercentage: number;
  completed: boolean;
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
