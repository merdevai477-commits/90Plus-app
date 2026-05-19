/**
 * Shared constants, types, and tiny primitives for the Quiz feature.
 * Import from here instead of duplicating across components.
 */

import { Platform } from 'react-native';

// ─── Design tokens ────────────────────────────────────────────────────────────

export const BLUR_INTENSITY = Platform.OS === 'ios' ? 30 : 90;

export const ACCENT       = '#B026FF';
export const ACCENT_SOFT  = '#A855F7';
export const NEON_PURPLE  = '#C026FF';
export const CARD_BORDER  = '#2A2A45';
export const TRACK_BG     = '#1B1B35';

// ─── Option types ─────────────────────────────────────────────────────────────

export const OPTION_KEYS = ['A', 'B', 'C', 'D'] as const;
export type OptionKey = (typeof OPTION_KEYS)[number];

export interface QuizOption {
  key: OptionKey;
  text: string;
}
