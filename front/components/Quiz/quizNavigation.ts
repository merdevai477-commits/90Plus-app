/**
 * =============================================================================
 * QUIZ NAVIGATION
 * =============================================================================
 *
 * Leaving a game screen always lands the player back on the Questions hub —
 * the screen they entered from.
 *
 * WHY THIS EXISTS
 * ---------------
 * The Football Quiz used to `router.push('/(tabs)/rank')` on back, which threw
 * the player out of the questions flow entirely and grew the stack instead of
 * unwinding it (so the hardware back button then walked them through every
 * screen they had "left"). The real route is:
 *
 *   (tabs)/quiz  →  quiz/[mode]  →  back  →  (tabs)/quiz
 *
 * `router.back()` is the correct call there, because `quiz/[mode]` is always
 * PUSHED onto the tab. `canGoBack()` guards the one case where it is not: a
 * deep link / notification opening `quiz/football-quiz` as the first screen,
 * which has nothing to pop, so the hub is put in its place instead.
 * =============================================================================
 */

import { router } from 'expo-router';

/** The Questions hub — front/app/(tabs)/quiz.tsx. */
export const QUESTIONS_HUB_ROUTE = '/(tabs)/quiz' as const;

/**
 * Returns from a game screen to the Questions hub.
 *
 * Prefers popping the stack so the hub keeps its scroll position and the
 * back-stack does not grow; falls back to replacing the route when this screen
 * was opened directly (deep link, push notification, reload on a dev client).
 */
export function goBackToQuestionsHub(): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(QUESTIONS_HUB_ROUTE);
}
