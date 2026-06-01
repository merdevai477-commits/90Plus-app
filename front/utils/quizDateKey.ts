/**
 * Daily quiz date key — must match backend packDate (user timezone midnight).
 */

import * as Localization from 'expo-localization';

import type { QuizApiLanguage } from '../services/quizApi.service';

export function getDeviceTimezone(): string {
  try {
    return Localization.getCalendars()[0]?.timeZone ?? 'UTC';
  } catch {
    return 'UTC';
  }
}

/** YYYY-MM-DD in the user's timezone (same basis as backend x-user-timezone). */
export function todayQuizDateKey(timezone = getDeviceTimezone()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}

export function dailyQuizQueryKey(lang: QuizApiLanguage, dateKey = todayQuizDateKey()) {
  return ['dailyQuiz', lang, dateKey] as const;
}

export function dailyQuizStorageKey(lang: QuizApiLanguage, dateKey = todayQuizDateKey()) {
  return `quiz_daily_${lang}_${dateKey}`;
}
