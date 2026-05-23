/**
 * Daily quiz API client (backend AI packs + XP + coins).
 */

import { getApiUrl } from '../config/api.config';
import { safeJsonParse } from '../utils/safeJsonParse';
import type { QuizImageLayout } from '../components/Quiz/quiz.constants';

export type QuizApiLanguage = 'ar' | 'en';
export type QuizApiDifficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type QuizApiOptionKey = 'A' | 'B' | 'C' | 'D';

export interface QuizApiOption {
  key: QuizApiOptionKey;
  text: string;
}

export interface QuizApiQuestion {
  id: string;
  question: string;
  options: QuizApiOption[];
  difficulty: QuizApiDifficulty;
  imageUrl?: string | null;
  imageLayout?: QuizImageLayout;
  index: number;
  status: 'pending' | 'answered' | 'skipped';
  selectedKey?: QuizApiOptionKey;
  isCorrect?: boolean;
  hintUsed?: boolean;
}

export interface QuizDailyPayload {
  language: QuizApiLanguage;
  packDate: string;
  expiresAt: string;
  timeLimitSec: number;
  totalQuestions: number;
  coinCost: number;
  currentIndex: number;
  questions: QuizApiQuestion[];
  coins: number;
  xp: number;
  level: number;
  stats: {
    correct: number;
    answered: number;
    skipped: number;
    xpEarned: number;
    completed: boolean;
  };
}

export interface XpEventPayload {
  action: string;
  amount: number;
  leveledUp: boolean;
  newLevel: number;
}

function getTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

async function authFetch(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<Response> {
  const res = await fetch(`${getApiUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'x-user-timezone': getTimezone(),
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 429) {
    throw new Error('RATE_LIMIT');
  }
  return res;
}

export const QuizApiService = {
  async fetchDaily(
    token: string,
    language: QuizApiLanguage,
  ): Promise<QuizDailyPayload | null> {
    const res = await authFetch(
      `/quiz/daily?language=${language}`,
      token,
    );
    const json = await safeJsonParse<{ status: string; data: QuizDailyPayload }>(
      res,
      { status: 'ERROR', data: null as unknown as QuizDailyPayload },
    );
    if (!res.ok || json?.status !== 'SUCCESS' || !json.data) return null;
    return json.data;
  },

  async submitAnswer(
    token: string,
    body: {
      questionId: string;
      selectedKey: QuizApiOptionKey;
      timeTaken: number;
      language: QuizApiLanguage;
    },
  ) {
    const res = await authFetch('/quiz/answer', token, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return safeJsonParse(res, { status: 'ERROR', data: null });
  },

  async skipQuestion(
    token: string,
    body: { questionId: string; language: QuizApiLanguage },
  ) {
    const res = await authFetch('/quiz/skip', token, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return safeJsonParse(res, { status: 'ERROR', data: null });
  },

  async useHint(
    token: string,
    body: { questionId: string; language: QuizApiLanguage },
  ) {
    const res = await authFetch('/quiz/hint', token, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return safeJsonParse(res, { status: 'ERROR', data: null });
  },
};
