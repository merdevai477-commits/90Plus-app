/**
 * Design tokens for the "ملك التوقعات" (King of Predictions) prediction-groups
 * feature. Kept local to the feature so the visual language (deep purple-black
 * background, purple accent gradients, gold highlights, glassmorphism) can be
 * tuned independently while still leaning on the app-wide tokens where sensible.
 *
 * All numeric values are unitless (React Native density-independent pixels).
 */

import { useAppFont } from '../../utils/fontSetup';

// ─── Palette ──────────────────────────────────────────────────────────────────

export const PG = {
  // Background — deep purple-black, subtle top→bottom gradient.
  bgTop: '#150A22',
  bgBottom: '#0B0710',
  bg: '#0B0710',

  // Primary purple accent (buttons, featured cards).
  purple: '#7C3AED',
  purpleLight: '#9F5AFB',
  purpleSoft: '#A78BFA',

  // Gold — crown, medals, and the "you" row only.
  gold: '#F5B942',
  goldDeep: '#C98A16',
  goldSoft: 'rgba(245,185,66,0.14)',

  // Glass surfaces.
  glass: 'rgba(255,255,255,0.05)',
  glassStrong: 'rgba(255,255,255,0.08)',
  border: 'rgba(255,255,255,0.10)',
  borderSoft: 'rgba(255,255,255,0.06)',

  // Text.
  text: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.72)',
  textMuted: 'rgba(255,255,255,0.42)',

  // Semantic.
  win: '#22C55E',
  draw: '#F5B942',
  loss: '#EF4444',
  info: '#60A5FA',
} as const;

// ─── Gradients (expo-linear-gradient color arrays) ─────────────────────────────

export const PG_GRADIENTS = {
  /** Full screen background — top→bottom. */
  screen: [PG.bgTop, PG.bgBottom] as const,
  /** Purple ambient glow bleeding from the top of the screen. */
  ambient: ['rgba(124,58,237,0.30)', 'transparent'] as const,
  /** Primary purple CTA / featured card. */
  purple: [PG.purple, PG.purpleLight] as const,
  /** Translucent purple round card wash over the dark background. */
  roundWash: ['rgba(124,58,237,0.22)', 'rgba(159,90,251,0.05)'] as const,
  /** Gold badge fill (used for the SVG radial gradient stops). */
  gold: ['#FCD98A', PG.gold, PG.goldDeep] as const,
  /** Progress bar fill. */
  progress: [PG.purpleLight, PG.purple] as const,
} as const;

// ─── Radii ──────────────────────────────────────────────────────────────────

export const PG_RADII = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  pill: 999,
} as const;

// ─── Spacing ──────────────────────────────────────────────────────────────────

export const PG_SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

// ─── Type scale (24 / 18 / 14 / 12) ────────────────────────────────────────────

export const PG_TYPE = {
  display: 24,
  title: 18,
  body: 14,
  caption: 12,
} as const;

// ─── Elevation / glow presets ───────────────────────────────────────────────

/** Purple glow used behind the primary CTA / selected chips. */
export const PG_GLOW_PURPLE = {
  shadowColor: PG.purple,
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.55,
  shadowRadius: 16,
  elevation: 8,
} as const;

/** Gold glow used for the "you" row and medal badges. */
export const PG_GLOW_GOLD = {
  shadowColor: PG.gold,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.5,
  shadowRadius: 12,
  elevation: 6,
} as const;

// ─── Font weights (language-aware Cairo / Inter) ───────────────────────────────

/**
 * Convenience hook that returns the feature's four font weights in one call so
 * components don't have to invoke `useAppFont` repeatedly. Numbers/scores use
 * `bold`/`extra`, labels use `regular`/`medium`.
 */
export function usePGFonts() {
  const regular = useAppFont(400);
  const medium = useAppFont(600);
  const bold = useAppFont(700);
  const extra = useAppFont(800);
  return { regular, medium, bold, extra };
}
