export type QuizLanguage = 'ar' | 'en';
export type QuizDifficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type QuizOptionKey = 'A' | 'B' | 'C' | 'D';
export type QuizQuestionType = 'normal' | 'image' | 'guess_player' | 'logo' | 'stadium';
export type QuizImageType = 'player' | 'team' | 'league' | 'flag' | 'venue' | null;
export type QuizImageLayout = 'square' | 'wide';

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
}

export interface QuestionProgress {
  status: 'pending' | 'answered' | 'skipped';
  selectedKey?: QuizOptionKey;
  isCorrect?: boolean;
  correctKey?: QuizOptionKey;
  hintUsed?: boolean;
  skipped?: boolean;
  timeTaken?: number;
  xpAwarded?: number;
  answeredAt?: Date | string;
  skippedAt?: Date | string;
}

export interface SessionProgress {
  byQuestionId: Record<string, QuestionProgress>;
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
  status: 'pending' | 'answered' | 'skipped';
  selectedKey?: QuizOptionKey;
  isCorrect?: boolean;
  hintUsed?: boolean;
  hint?: string | null;
}
