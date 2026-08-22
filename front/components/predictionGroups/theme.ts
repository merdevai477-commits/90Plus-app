/**
 * Design tokens for ملك التوقعات — aligned to Figma "Prediction feature"
 * (90plus file, node 469:1388) and the shared 90Plus artboard language
 * (Share & Win / Questions: #030303, #080613, purple CTAs).
 *
 * Spacing/radii are RAW FIGMA-ish units; convert at render with `usePGScale()`.
 */

import { useAppFont } from '../../utils/fontSetup';
import { useDesignScale, type DesignScale } from '../../utils/responsive';

// ─── Palette ──────────────────────────────────────────────────────────────────

export const PG = {
  bgTop: '#080613',
  bgBottom: '#030303',
  bg: '#030303',

  primary: '#A855F7',
  primaryLight: '#C084FC',
  primaryDark: '#6B11D4',
  silver: '#C0C0C0',
  bronze: '#CD7F32',
  card: '#080613',
  cardElevated: '#0E0A1A',

  purple: '#6B11D4',
  purpleLight: '#A855F7',
  purpleSoft: '#C4B5FD',

  gold: '#F5B942',
  goldDeep: '#C98A16',
  goldSoft: 'rgba(245,185,66,0.14)',

  glass: 'rgba(8,6,19,0.94)',
  glassStrong: 'rgba(14,10,26,0.96)',
  border: 'rgba(223,192,252,0.39)',
  borderSoft: 'rgba(223,192,252,0.18)',

  text: '#FFFFFF',
  textSecondary: '#BBBBBB',
  textMuted: 'rgba(255,255,255,0.42)',

  win: '#22C55E',
  draw: '#F5B942',
  loss: '#EF4444',
  lossMuted: '#9B5678',
  lossMutedSoft: 'rgba(155,86,120,0.18)',
  info: '#60A5FA',

  purpleDeep: '#3D0AB3',
  purpleTint: 'rgba(168,85,247,0.22)',
  memberAvatarBg: 'rgba(107,17,212,0.38)',

  heroGlassBorder: 'rgba(223,192,252,0.28)',
  neon: '#7CFF3A',
  neonSoft: 'rgba(124,255,58,0.28)',
  borderBright: 'rgba(168,85,247,0.72)',
} as const;

// ─── Gradients ────────────────────────────────────────────────────────────────

export const PG_GRADIENTS = {
  screen: [PG.bgTop, PG.bgBottom] as const,
  ambient: ['rgba(107,17,212,0.28)', 'transparent'] as const,
  /** Figma primary CTA (Questions / Share & Win action). */
  purple: ['#3D0AB3', '#190448'] as const,
  purpleBright: [PG.primary, PG.primaryDark] as const,
  roundWash: ['rgba(107,17,212,0.28)', 'rgba(168,85,247,0.06)'] as const,
  gold: ['#FCD98A', PG.gold, PG.goldDeep] as const,
  progress: [PG.primary, PG.primaryDark] as const,
  avatarRing: [PG.primary, PG.gold] as const,
  accuracyRing: [PG.primary, PG.gold] as const,
} as const;

export const PG_RADII = {
  sm: 10,
  md: 16,
  lg: 20,
  xl: 25,
  pill: 999,
} as const;

export const PG_SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const PG_TYPE = {
  display: 26,
  title: 18,
  body: 14,
  caption: 12,
} as const;

export const PG_GLOW_PURPLE = {
  shadowColor: PG.primary,
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.45,
  shadowRadius: 16,
  elevation: 8,
} as const;

export const PG_GLOW_GOLD = {
  shadowColor: PG.gold,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.5,
  shadowRadius: 12,
  elevation: 6,
} as const;

export function usePGFonts() {
  const regular = useAppFont(400);
  const medium = useAppFont(600);
  const bold = useAppFont(700);
  const extra = useAppFont(800);
  return { regular, medium, bold, extra };
}

/** Figma artboard scale — same contract as Share & Win / Questions hub. */
export function usePGScale(): DesignScale {
  return useDesignScale();
}
