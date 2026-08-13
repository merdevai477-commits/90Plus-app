/**
 * Daily quiz API client (backend AI packs + XP + coins).
 */

import { getApiUrl } from '../config/api.config';
import { safeJsonParse } from '../utils/safeJsonParse';
import type { QuizImageLayout } from '../components/Quiz/quiz.constants';

export type QuizApiLanguage = 'ar' | 'en';
export type QuizApiDifficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type QuizApiOptionKey = 'A' | 'B' | 'C' | 'D';
export type QuizApiQuestionStatus = 'pending' | 'answered' | 'skipped' | 'timed_out';

export interface QuizApiOption {
  key: QuizApiOptionKey;
  text: string;
}

export type QuizApiQuestionType =
  | 'normal'
  | 'image'
  | 'guess_player'
  | 'logo'
  | 'stadium';

export interface QuizApiQuestion {
  id: string;
  question: string;
  type?: QuizApiQuestionType;
  options: QuizApiOption[];
  difficulty: QuizApiDifficulty;
  imageUrl?: string | null;
  imageLayout?: QuizImageLayout;
  index: number;
  status: QuizApiQuestionStatus;
  selectedKey?: QuizApiOptionKey;
  isCorrect?: boolean;
  correctKey?: QuizApiOptionKey;
  penaltyApplied?: boolean;
  hintUsed?: boolean;
  hint?: string | null;
  /**
   * True when the question came from the bundled bank in
   * data/footballQuizFallback.ts rather than the API. QuizHubScreen grades
   * these on-device and never POSTs them, which keeps the API contract
   * untouched — the same convention `QuestionModeQuestion.isStatic` uses.
   */
  isStatic?: boolean;
}

export interface QuizDailyStats {
  correct: number;
  answered: number;
  skipped: number;
  timedOut: number;
  closed: number;
  xpEarned: number;
  completed: boolean;
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
  stats: QuizDailyStats;
  /** True for a pack built from the bundled bank; never written to the cache. */
  isStatic?: boolean;
}

export interface QuizTimeoutResponse {
  correctKey?: QuizApiOptionKey;
  imageUrl?: string | null;
  penaltyApplied: boolean;
  errorCode?: 'INSUFFICIENT_COINS_FOR_TIMEOUT_PENALTY';
  alreadyDone?: boolean;
  coins: number;
  stats: Omit<QuizDailyStats, 'completed'> & { xp?: number };
  completed: boolean;
  currentIndex: number;
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

const QUIZ_FETCH_TIMEOUT_MS = 25_000;

type DailyErrorResponse = {
  status?: string;
  data?: QuizDailyPayload;
  error?: string;
  message?: string;
  details?: { code?: string };
};

function isPackGeneratingResponse(
  res: Response,
  json: DailyErrorResponse | null,
): boolean {
  if (res.status === 503) return true;
  if (res.status === 502 && json?.error === 'E008') return true;
  if (json?.details?.code === 'PACK_GENERATING') return true;
  const msg = typeof json?.message === 'string' ? json.message.toLowerCase() : '';
  return msg.includes('pack is being prepared') || msg.includes('being prepared');
}

async function authFetch(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), QUIZ_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${getApiUrl()}${path}`, {
      ...init,
      signal: controller.signal,
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
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('REQUEST_TIMEOUT');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const QuizApiService = {
  async fetchDaily(
    token: string,
    language: QuizApiLanguage,
  ): Promise<QuizDailyPayload> {
    const res = await authFetch(
      `/quiz/daily?language=${language}`,
      token,
    );
    if (res.status === 401) throw new Error('AUTH_REQUIRED');
    if (res.status === 404) throw new Error('USER_NOT_FOUND');

    const json = await safeJsonParse<DailyErrorResponse>(
      res,
      { status: 'ERROR' },
    );

    if (isPackGeneratingResponse(res, json)) {
      throw new Error('PACK_GENERATING');
    }

    if (res.status === 502 || res.status === 503) {
      throw new Error('SERVER_WARMING');
    }

    if (!res.ok || json?.status !== 'SUCCESS' || !json.data) {
      throw new Error(`API_ERROR_${res.status}`);
    }
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

  /**
   * 50:50 — the two option keys to keep, resolved by the server from the real
   * answer key. `null` means the lifeline could not be resolved (offline, or a
   * question the server will not halve); the caller then spends no use and
   * changes nothing on screen. The correct key is never sent on its own, and
   * the app never picks the survivor itself.
   */
  async fiftyFifty(
    token: string,
    params: { questionId: string; language: QuizApiLanguage },
  ): Promise<{ questionId: string; keepKeys: QuizApiOptionKey[] } | null> {
    const query = new URLSearchParams({
      questionId: params.questionId,
      language: params.language,
    }).toString();
    const res = await authFetch(`/quiz/fifty-fifty?${query}`, token);
    const json = await safeJsonParse<{
      status: string;
      data?: { questionId: string; keepKeys: QuizApiOptionKey[] };
    }>(res, { status: 'ERROR' });
    if (!res.ok || json.status !== 'SUCCESS' || !json.data) return null;
    return json.data;
  },

  async submitTimeout(
    token: string,
    body: { questionId: string; language: QuizApiLanguage },
  ) {
    const res = await authFetch('/quiz/timeout', token, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return safeJsonParse<{ status: string; data: QuizTimeoutResponse | null }>(
      res,
      { status: 'ERROR', data: null },
    );
  },
};
