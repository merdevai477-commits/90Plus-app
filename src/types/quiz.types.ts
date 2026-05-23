export type QuizLanguage = 'ar' | 'en';
export type QuizDifficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type QuizOptionKey = 'A' | 'B' | 'C' | 'D';
export type QuizImageLayout = 'square' | 'wide';

export interface QuizOptionDto {
  key: QuizOptionKey;
  text: string;
}

export interface StoredQuizQuestion {
  id: string;
  question: string;
  options: QuizOptionDto[];
  correctKey: QuizOptionKey;
  difficulty: QuizDifficulty;
  imageUrl?: string | null;
  imageLayout?: QuizImageLayout;
  imageType?: string | null;
  hint?: string | null;
}

export interface QuestionProgress {
  status: 'pending' | 'answered' | 'skipped';
  selectedKey?: QuizOptionKey;
  isCorrect?: boolean;
  hintUsed?: boolean;
  timeTaken?: number;
  xpAwarded?: number;
}

export interface SessionProgress {
  byQuestionId: Record<string, QuestionProgress>;
}

export interface PublicQuizQuestion {
  id: string;
  question: string;
  options: QuizOptionDto[];
  difficulty: QuizDifficulty;
  imageUrl?: string | null;
  imageLayout?: QuizImageLayout;
  index: number;
  status: 'pending' | 'answered' | 'skipped';
  selectedKey?: QuizOptionKey;
  isCorrect?: boolean;
  hintUsed?: boolean;
}
