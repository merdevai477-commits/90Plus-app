import { useMemo } from 'react';
import { AUTH_LIGHT } from '@/src/components/auth/AuthTokens';
import { useResolvedAppScheme } from '@/hooks/useResolvedAppScheme';

export type MatchesThemeColors = {
  pageBg: string;
  cardBg: string;
  cardBorder: string;
  elevatedBg: string;
  chipBg: string;
  chipBorder: string;
  chipBorderActive: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  /** Idle filter-chip label color. */
  chipText: string;
  primary: string;
  primarySoft: string;
  primaryMuted: string;
  primaryBorder: string;
  divider: string;
  icon: string;
  iconMuted: string;
  headerBorder: string;
  logoPillBg: string;
  logoPillBorder: string;
  searchBg: string;
  searchBorder: string;
  glassTint: string;
  sheetBg: string;
  sheetBorder: string;
  sheetHandle: string;
  modalOverlay: string;
  calendarBg: string;
  calendarBorder: string;
  calendarNavBg: string;
  calendarNavBorder: string;
  staleBg: string;
  staleBorder: string;
  staleText: string;
  liveBadgeBg: string;
  scoreDash: string;
  predBtnBorder: string;
  predBtnPct: string;
  predBtnTxt: string;
  predBtnTxtMuted: string;
  logoStubBg: string;
  logoStubBorder: string;
  initialsBg: string;
  initialsTxt: string;
  wcCardBg: string;
  wcCardBorder: string;
  wcSub: string;
  blurTint: 'light' | 'dark';
  headerGlassTint: string;
};

export const MATCHES_THEME: { light: MatchesThemeColors; dark: MatchesThemeColors } = {
  light: {
    // Slightly tinted page so white cards lift off the surface.
    pageBg: '#F4F1FA',
    cardBg: '#FFFFFF',
    cardBorder: 'rgba(106,43,217,0.2)',
    elevatedBg: '#FFFFFF',
    // Figma filter chips — pale lavender idle, solid primary when selected.
    chipBg: '#F3EDFF',
    chipBorder: 'rgba(106,43,217,0.28)',
    chipBorderActive: 'rgba(106,43,217,0.55)',
    textPrimary: AUTH_LIGHT.textPrimary,
    textSecondary: AUTH_LIGHT.textSecondary,
    textMuted: AUTH_LIGHT.textMuted,
    textInverse: '#FFFFFF',
    chipText: AUTH_LIGHT.textPrimary,
    primary: AUTH_LIGHT.primary,
    primarySoft: '#A78BFA',
    primaryMuted: 'rgba(106,43,217,0.12)',
    primaryBorder: 'rgba(106,43,217,0.28)',
    divider: AUTH_LIGHT.divider,
    icon: AUTH_LIGHT.textPrimary,
    iconMuted: AUTH_LIGHT.textSecondary,
    headerBorder: 'rgba(36,16,78,0.06)',
    logoPillBg: 'rgba(106,43,217,0.08)',
    logoPillBorder: 'rgba(106,43,217,0.18)',
    searchBg: 'rgba(106,43,217,0.1)',
    searchBorder: 'rgba(106,43,217,0.28)',
    glassTint: 'rgba(252,252,252,0.72)',
    sheetBg: '#FFFFFF',
    sheetBorder: 'rgba(106,43,217,0.18)',
    sheetHandle: 'rgba(36,16,78,0.18)',
    modalOverlay: 'rgba(36,16,78,0.35)',
    calendarBg: '#FFFFFF',
    calendarBorder: AUTH_LIGHT.divider,
    calendarNavBg: 'rgba(106,43,217,0.08)',
    calendarNavBorder: 'rgba(106,43,217,0.2)',
    staleBg: 'rgba(245,158,11,0.12)',
    staleBorder: 'rgba(245,158,11,0.35)',
    staleText: '#B45309',
    liveBadgeBg: 'rgba(239,68,68,0.12)',
    scoreDash: 'rgba(36,16,78,0.35)',
    predBtnBorder: 'rgba(36,16,78,0.08)',
    predBtnPct: AUTH_LIGHT.primary,
    predBtnTxt: AUTH_LIGHT.textPrimary,
    predBtnTxtMuted: AUTH_LIGHT.textSecondary,
    logoStubBg: 'rgba(106,43,217,0.08)',
    logoStubBorder: 'rgba(106,43,217,0.2)',
    initialsBg: 'rgba(106,43,217,0.18)',
    initialsTxt: AUTH_LIGHT.primary,
    wcCardBg: '#FFFFFF',
    wcCardBorder: 'rgba(106,43,217,0.22)',
    wcSub: AUTH_LIGHT.primary,
    blurTint: 'light',
    headerGlassTint: 'rgba(252,252,252,0.55)',
  },
  dark: {
    pageBg: '#0A0612',
    cardBg: 'rgba(12,10,20,0.85)',
    cardBorder: 'rgba(255,255,255,0.08)',
    elevatedBg: 'rgba(15,8,28,0.96)',
    chipBg: 'rgba(255,255,255,0.02)',
    chipBorder: 'rgba(255,255,255,0.08)',
    chipBorderActive: 'rgba(167,139,250,0.55)',
    textPrimary: '#FFFFFF',
    textSecondary: 'rgba(255,255,255,0.6)',
    textMuted: 'rgba(255,255,255,0.4)',
    textInverse: '#FFFFFF',
    chipText: 'rgba(255,255,255,0.6)',
    primary: '#7C3AED',
    primarySoft: '#A78BFA',
    primaryMuted: 'rgba(168,85,247,0.15)',
    primaryBorder: 'rgba(168,85,247,0.35)',
    divider: 'rgba(255,255,255,0.07)',
    icon: '#e9d5ff',
    iconMuted: 'rgba(255,255,255,0.8)',
    headerBorder: 'rgba(255,255,255,0.05)',
    logoPillBg: 'rgba(255,255,255,0.07)',
    logoPillBorder: 'rgba(255,255,255,0.1)',
    searchBg: 'rgba(168,85,247,0.15)',
    searchBorder: 'rgba(168,85,247,0.35)',
    glassTint: 'rgba(20,15,30,0.65)',
    sheetBg: 'rgba(15,8,28,0.96)',
    sheetBorder: 'rgba(168,85,247,0.2)',
    sheetHandle: 'rgba(255,255,255,0.25)',
    modalOverlay: 'rgba(0,0,0,0.85)',
    calendarBg: 'rgba(0,0,0,0.2)',
    calendarBorder: 'rgba(255,255,255,0.08)',
    calendarNavBg: 'rgba(219,219,219,0.17)',
    calendarNavBorder: 'rgba(255,255,255,0.14)',
    staleBg: 'rgba(245,158,11,0.15)',
    staleBorder: 'rgba(245,158,11,0.35)',
    staleText: '#fcd34d',
    liveBadgeBg: 'rgba(239,68,68,0.14)',
    scoreDash: 'rgba(255,255,255,0.45)',
    predBtnBorder: 'rgba(255,255,255,0.06)',
    predBtnPct: 'rgba(233,213,255,0.95)',
    predBtnTxt: 'rgba(255,255,255,0.72)',
    predBtnTxtMuted: 'rgba(255,255,255,0.55)',
    logoStubBg: 'rgba(255,255,255,0.09)',
    logoStubBorder: 'rgba(255,255,255,0.16)',
    initialsBg: 'rgba(124,58,237,0.3)',
    initialsTxt: '#A78BFA',
    wcCardBg: '#0A0812',
    wcCardBorder: 'rgba(168,85,247,0.26)',
    wcSub: 'rgba(216,180,254,0.82)',
    blurTint: 'dark',
    headerGlassTint: 'rgba(5,1,13,0.1)',
  },
};

export function useMatchesTheme() {
  const { isDark } = useResolvedAppScheme();
  return useMemo(
    () => ({
      colors: isDark ? MATCHES_THEME.dark : MATCHES_THEME.light,
      isDark,
      blurTint: (isDark ? 'dark' : 'light') as 'light' | 'dark',
    }),
    [isDark],
  );
}
