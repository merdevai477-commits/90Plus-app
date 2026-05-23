export type QuizLanguage = 'ar' | 'en';
export type QuizDifficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type QuizOptionKey = 'A' | 'B' | 'C' | 'D';
export type QuizQuestionType = 'normal' | 'image' | 'guess_player' | 'logo' | 'stadium';
export type QuizImageType = 'player' | 'team' | 'league' | 'flag' | 'venue' | null;
export type QuizImageLayout = 'square' | 'wide';
export type QuizQuestionStatus = 'pending' | 'answered' | 'skipped' | 'timed_out';

export interface QuizOptionDto {
  key: QuizOptionKey;
  text: string;
}

export interface StoredQuizQuestion {
  id: string;
  question: string;
  type: QuizQuestionType;
  options: QuizOptionDto[];
  correctKey: QuizOptionKey;
  difficulty: QuizDifficulty;
  imageUrl?: string | null;
  imageLayout?: QuizImageLayout;
  imageType?: QuizImageType;
  hint?: string | null;
  imageBinding?: {
    kind: 'player' | 'team' | 'venue' | 'league';
    entityName: string;
    teamName?: string;
    apiId?: number;
    imageUrl?: string;
  } | null;
}

export interface QuestionProgress {
  status: QuizQuestionStatus;
  selectedKey?: QuizOptionKey;
  isCorrect?: boolean;
  correctKey?: QuizOptionKey;
  hintUsed?: boolean;
  skipped?: boolean;
  penaltyApplied?: boolean;
  timeTaken?: number;
  xpAwarded?: number;
  answeredAt?: Date | string;
  skippedAt?: Date | string;
  timedOutAt?: Date | string;
}

export interface SessionProgress {
  byQuestionId: Record<string, QuestionProgress>;
}

export interface QuizSessionStats {
  correct: number;
  answered: number;
  skipped: number;
  timedOut: number;
  closed: number;
  xp: number;
}

export interface QuizTimeoutResult {
  correctKey?: QuizOptionKey;
  imageUrl?: string | null;
  penaltyApplied: boolean;
  errorCode?: 'INSUFFICIENT_COINS_FOR_TIMEOUT_PENALTY';
  alreadyDone?: boolean;
  coins: number;
  stats: QuizSessionStats;
  completed: boolean;
  currentIndex: number;
  progress: SessionProgress['byQuestionId'];
}

export interface PublicQuizQuestion {
  id: string;
  question: string;
  type: QuizQuestionType;
  options: QuizOptionDto[];
  difficulty: QuizDifficulty;
  imageUrl?: string | null;
  imageLayout?: QuizImageLayout;
  index: number;
  status: QuizQuestionStatus;
  selectedKey?: QuizOptionKey;
  isCorrect?: boolean;
  correctKey?: QuizOptionKey;
  penaltyApplied?: boolean;
  hintUsed?: boolean;
  hint?: string | null;
}
