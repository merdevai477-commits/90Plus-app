/**
 * Shared light/dark surfaces for AdvancedSearchBar + football search screen.
 */

import { AUTH_DARK, AUTH_LIGHT } from '../../src/components/auth/AuthTokens';

export type SearchUiTheme = {
  isDark: boolean;
  blurTint: 'dark' | 'light';
  overlay: readonly [string, string];
  fieldBg: string;
  fieldBorder: string;
  fieldText: string;
  placeholder: string;
  closeBg: string;
  closeIcon: string;
  muted: string;
  title: string;
  cardBg: string;
  cardBorder: string;
  chipBg: string;
  chipText: string;
  chipCount: string;
  screen: string;
  iconMuted: string;
  statusBar: 'light' | 'dark';
  backBg: string;
  accent: string;
};

export function getSearchUiTheme(isDark: boolean): SearchUiTheme {
  if (isDark) {
    return {
      isDark: true,
      blurTint: 'dark',
      overlay: ['rgba(8,4,18,0.98)', 'rgba(5,1,13,0.98)'],
      fieldBg: 'rgba(255,255,255,0.08)',
      fieldBorder: 'rgba(168,85,247,0.35)',
      fieldText: '#FFFFFF',
      placeholder: '#666666',
      closeBg: 'rgba(255,255,255,0.08)',
      closeIcon: '#FFFFFF',
      muted: '#888888',
      title: '#FFFFFF',
      cardBg: 'rgba(255,255,255,0.05)',
      cardBorder: 'rgba(255,255,255,0.08)',
      chipBg: 'rgba(168,85,247,0.12)',
      chipText: AUTH_DARK.primary,
      chipCount: '#888888',
      screen: AUTH_DARK.pageBg,
      iconMuted: '#666666',
      statusBar: 'light',
      backBg: 'rgba(255,255,255,0.08)',
      accent: AUTH_DARK.primary,
    };
  }

  return {
    isDark: false,
    blurTint: 'light',
    overlay: ['#FCFCFC', '#F3EDFF'],
    fieldBg: '#FFFFFF',
    fieldBorder: 'rgba(106,43,217,0.28)',
    fieldText: AUTH_LIGHT.textPrimary,
    placeholder: AUTH_LIGHT.textMuted,
    closeBg: '#FFFFFF',
    closeIcon: AUTH_LIGHT.textPrimary,
    muted: AUTH_LIGHT.textSecondary,
    title: AUTH_LIGHT.textPrimary,
    cardBg: '#FFFFFF',
    cardBorder: 'rgba(75,31,163,0.16)',
    chipBg: 'rgba(106,43,217,0.08)',
    chipText: AUTH_LIGHT.primary,
    chipCount: AUTH_LIGHT.textSecondary,
    screen: AUTH_LIGHT.pageBg,
    iconMuted: AUTH_LIGHT.textMuted,
    statusBar: 'dark',
    backBg: '#FFFFFF',
    accent: AUTH_LIGHT.primary,
  };
}
