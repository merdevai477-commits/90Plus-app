/**
 * Light/dark palette for match-details — same identity as auth + matches light theme.
 */

import { createContext, createElement, useContext, useMemo, type ReactNode } from 'react';
import { AUTH_LIGHT } from '@/src/components/auth/AuthTokens';
import { useResolvedAppScheme } from '@/hooks/useResolvedAppScheme';

export type MatchDetailsThemeColors = {
  pageBg: string;
  heroBg: string;
  heroGradient: readonly [string, string];
  cardBg: string;
  cardBorder: string;
  elevatedBg: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  primary: string;
  primarySoft: string;
  primaryMuted: string;
  primaryBorder: string;
  divider: string;
  icon: string;
  iconMuted: string;
  tabBarBg: string;
  tabActive: string;
  tabIdle: string;
  tabIndicator: string;
  islandFill: readonly [string, string];
  islandFillAndroid: readonly [string, string];
  skeleton: string;
  pitchBg: string;
  pitchStripe: string;
  blurTint: 'light' | 'dark';
  statusBar: 'light-content' | 'dark-content';
  glassCard: string;
};

export const MATCH_DETAILS_THEME: { light: MatchDetailsThemeColors; dark: MatchDetailsThemeColors } = {
  light: {
    pageBg: '#F4F1FA',
    heroBg: '#F4F1FA',
    heroGradient: ['#F4F1FA', '#EDE6FA'] as const,
    cardBg: '#FFFFFF',
    cardBorder: 'rgba(106,43,217,0.2)',
    elevatedBg: '#FFFFFF',
    textPrimary: AUTH_LIGHT.textPrimary,
    textSecondary: AUTH_LIGHT.textSecondary,
    textMuted: AUTH_LIGHT.textMuted,
    textInverse: '#FFFFFF',
    primary: AUTH_LIGHT.primary,
    primarySoft: '#A78BFA',
    primaryMuted: 'rgba(106,43,217,0.12)',
    primaryBorder: 'rgba(106,43,217,0.28)',
    divider: 'rgba(106,43,217,0.14)',
    icon: AUTH_LIGHT.textPrimary,
    iconMuted: AUTH_LIGHT.textSecondary,
    tabBarBg: '#FFFFFF',
    tabActive: AUTH_LIGHT.primary,
    tabIdle: AUTH_LIGHT.textSecondary,
    tabIndicator: AUTH_LIGHT.primary,
    islandFill: ['rgba(243,237,255,0.92)', 'rgba(255,255,255,0.92)'] as const,
    islandFillAndroid: ['#F3EDFF', '#FFFFFF'] as const,
    skeleton: '#E8E0F5',
    pitchBg: '#0F6B3C',
    pitchStripe: '#0C5A32',
    blurTint: 'light',
    statusBar: 'dark-content',
    glassCard: 'rgba(106,43,217,0.06)',
  },
  dark: {
    pageBg: '#0c051a',
    heroBg: '#0c051a',
    heroGradient: ['#0c051a', '#07040d'] as const,
    cardBg: 'rgba(255,255,255,0.06)',
    cardBorder: 'rgba(255,255,255,0.08)',
    elevatedBg: '#1a1a1a',
    textPrimary: '#FFFFFF',
    textSecondary: 'rgba(255,255,255,0.7)',
    textMuted: 'rgba(255,255,255,0.45)',
    textInverse: '#FFFFFF',
    primary: '#7C3AED',
    primarySoft: '#A78BFA',
    primaryMuted: 'rgba(168,85,247,0.15)',
    primaryBorder: 'rgba(168,85,247,0.35)',
    divider: 'rgba(255,255,255,0.08)',
    icon: '#FFFFFF',
    iconMuted: 'rgba(255,255,255,0.7)',
    tabBarBg: '#0c051a',
    tabActive: '#810af2',
    tabIdle: '#b57cff',
    tabIndicator: '#810af2',
    islandFill: ['rgba(70,36,128,0.62)', 'rgba(26,14,48,0.62)'] as const,
    islandFillAndroid: ['rgba(64,32,118,0.96)', 'rgba(24,13,46,0.96)'] as const,
    skeleton: '#1e1b4b',
    pitchBg: '#0B0518',
    pitchStripe: '#1C1240',
    blurTint: 'dark',
    statusBar: 'light-content',
    glassCard: 'rgba(255,255,255,0.06)',
  },
};

type MatchDetailsThemeValue = {
  colors: MatchDetailsThemeColors;
  isDark: boolean;
  blurTint: 'light' | 'dark';
};

const MatchDetailsThemeContext = createContext<MatchDetailsThemeValue | null>(null);

export function useMatchDetailsTheme(): MatchDetailsThemeValue {
  const ctx = useContext(MatchDetailsThemeContext);
  const { isDark } = useResolvedAppScheme();
  return useMemo(() => {
    if (ctx) return ctx;
    const colors = isDark ? MATCH_DETAILS_THEME.dark : MATCH_DETAILS_THEME.light;
    return { colors, isDark, blurTint: colors.blurTint };
  }, [ctx, isDark]);
}

export function MatchDetailsThemeProvider({ children }: { children: ReactNode }) {
  const { isDark } = useResolvedAppScheme();
  const value = useMemo<MatchDetailsThemeValue>(() => {
    const colors = isDark ? MATCH_DETAILS_THEME.dark : MATCH_DETAILS_THEME.light;
    return { colors, isDark, blurTint: colors.blurTint };
  }, [isDark]);

  return createElement(MatchDetailsThemeContext.Provider, { value }, children);
}
