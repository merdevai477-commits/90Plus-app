/**
 * Shared constants, types, and design tokens for the Quiz feature.
 */

import { Platform } from 'react-native';

export const BLUR_INTENSITY = Platform.OS === 'ios' ? 30 : 90;

export const QUIZ_SCREEN_BG = '#05010D';

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

/** 1:1 slot — player / trophy / club logo */
export const QUIZ_MEDIA_SQUARE = 140;

/** 16:9 banner — stadium / wide pitch photos */
export const QUIZ_MEDIA_WIDE_RATIO = 16 / 9;
