/**
 * Shared constants, types, and design tokens for the Quiz feature.
 */

import { Platform } from 'react-native';

export const BLUR_INTENSITY = Platform.OS === 'ios' ? 30 : 90;

/**
 * Page background for the Football Quiz screen. Matches GAME_COLOR.background
 * in ./gameChrome.tsx so every game mode sits on the same black.
 */
export const QUIZ_SCREEN_BG = '#030303';

export const ACCENT = '#9333EA';
export const ACCENT_SOFT = '#A855F7';
export const NEON_PURPLE = '#C026FF';
export const QUIZ_COUNT_PURPLE = '#9333EA';
export const QUIZ_CARD_BG = '#12101F';
export const QUIZ_CARD_BORDER = 'rgba(139, 92, 246, 0.32)';
export const QUIZ_OPTION_BG = '#16132A';
export const QUIZ_OPTION_BORDER = 'rgba(255, 255, 255, 0.06)';
export const QUIZ_TRACK_BG = '#221E38';
export const QUIZ_CHIP_BG = '#12101F';
export const CARD_BORDER = '#2A2A45';
export const TRACK_BG = '#1B1B35';

export const QUIZ_RADIUS_LG = 20;
export const QUIZ_RADIUS_MD = 14;
export const QUIZ_RADIUS_SM = 12;

export const OPTION_KEYS = ['A', 'B', 'C', 'D'] as const;
export type OptionKey = (typeof OPTION_KEYS)[number];

/** How the API wants the question image displayed */
export type QuizImageLayout = 'square' | 'wide';

export interface QuizOption {
  key: OptionKey;
  text: string;
}

export interface QuizQuestionData {
  id: string | number;
  question: string;
  /**
   * Image URL — preview sources:
   * - Matches API: teams.home.logo | teams.away.logo | league.logo
   * - Future quiz API: question.imageUrl
   * - Venues API (wide): GET /api/football/venues/:id → image field when available
   */
  imageUrl?: string | null;
  /**
   * square — player, trophy, logo, badge (1:1)
   * wide — stadium, pitch, panorama (16:9 full card width)
   */
  imageLayout?: QuizImageLayout;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  categoryLabel?: string;
  options: QuizOption[];
}

export const QUIZ_SESSION_TOTAL = 15;
export const QUIZ_TIME_LIMIT_SEC = 20;
export const QUIZ_COIN_COST = 10;

/**
 * TIMED PROGRESSION — currently OFF.
 *
 * When enabled, the Football Quiz ran a per-question countdown that, on expiry,
 * revealed the answer and marked the question as timed out (`handleTimeout` in
 * QuizHubScreen — which also selects the correct option, so an untouched screen
 * appeared to answer itself), and a 3s timer that advanced to the next question
 * after every reveal.
 *
 * Both are disabled while the flow is being tested: an answer must only ever
 * become selected because the player tapped it, and the next question must only
 * ever come from the "Next" action. Nothing else is removed — flipping this back
 * to `true` restores the countdown and the auto-advance exactly as they were.
 */
export const QUIZ_AUTO_ADVANCE_ENABLED = false;

// Figma node 238:374 ("Football Quiz") palette — shared visual language with
// QuestionsModeScreen.tsx (top bar / progress card / choice rows / bottom bar).
export const QUIZ_FIGMA_BG = '#05010e';
export const QUIZ_FIGMA_PROGRESS_BORDER = '#590aa4';
export const QUIZ_FIGMA_PROGRESS_PURPLE = '#5f00b9';
export const QUIZ_FIGMA_SEG_FILL_START = '#5f00b9';
export const QUIZ_FIGMA_SEG_FILL_END = '#2b0053';
export const QUIZ_FIGMA_SEG_EMPTY = '#202020';
export const QUIZ_FIGMA_ROW_BORDER = '#2b2539';
export const QUIZ_FIGMA_ROW_GRAD_START = '#07040d';
export const QUIZ_FIGMA_ROW_GRAD_END = '#0c051a';
export const QUIZ_FIGMA_LETTER_BADGE_BG = '#0a0412';
export const QUIZ_FIGMA_LETTER_BADGE_BORDER = '#a855f7';
export const QUIZ_FIGMA_ACTION_GRAD_START = '#3d0ab3';
export const QUIZ_FIGMA_ACTION_GRAD_END = '#190448';
export const QUIZ_FIGMA_XP_GRAD = ['#efe5ff', '#5c14ca', '#120335'] as const;
export const QUIZ_FIGMA_XP_GRAD_LOCATIONS = [0, 0.62388, 1] as const;
/** Bloom behind the XP disc and its value pill — Figma 0 0 4.3px. */
export const QUIZ_FIGMA_XP_GLOW = 'rgba(92,20,202,0.58)';

/** 1:1 slot — player / trophy / club logo */
export const QUIZ_MEDIA_SQUARE = 140;

/** 16:9 banner — stadium / wide pitch photos */
export const QUIZ_MEDIA_WIDE_RATIO = 16 / 9;
