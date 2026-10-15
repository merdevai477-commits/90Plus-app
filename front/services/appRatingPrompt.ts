/**
 * Decides when to show the in-app rating prompt.
 * Persists first-open, snooze, and completion in AsyncStorage.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@90plus_app_rating_prompt_v1';

/** Wait this long after first open before the first prompt. */
export const RATING_MIN_DAYS_SINCE_INSTALL = 2;
/** How long the user must be in the current session before showing. */
export const RATING_MIN_SESSION_MS = 90_000;
/** After "Later", wait this many days before asking again. */
export const RATING_SNOOZE_DAYS = 7;
/** Cap how many times we ask so we never spam. */
export const RATING_MAX_PROMPTS = 3;

export type AppRatingState = {
  firstOpenAt: number;
  promptCount: number;
  snoozeUntil: number | null;
  completedAt: number | null;
  lastRating: number | null;
};

const DEFAULT_STATE: AppRatingState = {
  firstOpenAt: 0,
  promptCount: 0,
  snoozeUntil: null,
  completedAt: null,
  lastRating: null,
};

function daysToMs(days: number): number {
  return days * 24 * 60 * 60 * 1000;
}

async function readState(): Promise<AppRatingState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw) as Partial<AppRatingState>;
    return {
      firstOpenAt: typeof parsed.firstOpenAt === 'number' ? parsed.firstOpenAt : 0,
      promptCount: typeof parsed.promptCount === 'number' ? parsed.promptCount : 0,
      snoozeUntil: typeof parsed.snoozeUntil === 'number' ? parsed.snoozeUntil : null,
      completedAt: typeof parsed.completedAt === 'number' ? parsed.completedAt : null,
      lastRating: typeof parsed.lastRating === 'number' ? parsed.lastRating : null,
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

async function writeState(state: AppRatingState): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* non-critical */
  }
}

/** Ensure firstOpenAt is set on cold start. */
export async function ensureRatingFirstOpenRecorded(): Promise<AppRatingState> {
  const state = await readState();
  if (state.firstOpenAt > 0) return state;
  const next = { ...state, firstOpenAt: Date.now() };
  await writeState(next);
  return next;
}

export async function shouldShowRatingPrompt(sessionStartedAt: number): Promise<boolean> {
  const state = await ensureRatingFirstOpenRecorded();
  if (state.completedAt) return false;
  if (state.promptCount >= RATING_MAX_PROMPTS) return false;

  const now = Date.now();
  if (now - sessionStartedAt < RATING_MIN_SESSION_MS) return false;
  if (now - state.firstOpenAt < daysToMs(RATING_MIN_DAYS_SINCE_INSTALL)) return false;
  if (state.snoozeUntil && now < state.snoozeUntil) return false;

  return true;
}

export async function markRatingPromptShown(): Promise<void> {
  const state = await readState();
  await writeState({
    ...state,
    promptCount: state.promptCount + 1,
  });
}

export async function snoozeRatingPrompt(): Promise<void> {
  const state = await readState();
  await writeState({
    ...state,
    snoozeUntil: Date.now() + daysToMs(RATING_SNOOZE_DAYS),
  });
}

export async function completeRatingPrompt(stars: number): Promise<void> {
  const state = await readState();
  await writeState({
    ...state,
    completedAt: Date.now(),
    lastRating: stars,
    snoozeUntil: null,
  });
}
