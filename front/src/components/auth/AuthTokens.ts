/**
 * Auth design tokens from Figma 90plus
 * Light: Authentication page Login (1613:5666) + Color Palette (1590:3576)
 * Dark: same layout structure adapted for dark surfaces (no dedicated dark Login
 * frame in the auth page yet).
 */

export type AuthScheme = 'light' | 'dark';

export type AuthPalette = {
  pageBg: string;
  headerGradient: readonly [string, string];
  headerTagline: string;
  goldAccent: string;
  cardBg: string;
  cardBorder: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  primaryDark: string;
  buttonGradient: readonly [string, string];
  inputBg: string;
  inputBorder: string;
  inputPlaceholder: string;
  inputIcon: string;
  socialBg: string;
  socialBorder: string;
  divider: string;
  checkboxBg: string;
  checkboxBorder: string;
  statusBar: 'light' | 'dark';
  closeBg: string;
  closeBorder: string;
  closeIcon: string;
};

/** Figma Color Palette + Login light frame */
export const AUTH_LIGHT: AuthPalette = {
  pageBg: '#FCFCFC',
  headerGradient: ['#4B1FA3', '#100729'],
  headerTagline: '#E9D5FF',
  goldAccent: '#F5B301',
  cardBg: '#FFFFFF',
  cardBorder: 'transparent',
  textPrimary: '#24104E',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  primary: '#6A2BD9',
  primaryDark: '#4B1FA3',
  buttonGradient: ['#6A2BD9', '#4B1FA3'],
  inputBg: '#FFFFFF',
  inputBorder: '#E5E7EB',
  inputPlaceholder: '#9CA3AF',
  inputIcon: '#6B7280',
  socialBg: '#FFFFFF',
  socialBorder: '#E5E7EB',
  divider: '#E5E7EB',
  checkboxBg: '#FFFFFF',
  checkboxBorder: '#6A2BD9',
  statusBar: 'light',
  closeBg: 'rgba(16, 7, 41, 0.45)',
  closeBorder: 'rgba(255,255,255,0.22)',
  closeIcon: '#FFFFFF',
};

/** Dark adaptation of the same Login structure */
export const AUTH_DARK: AuthPalette = {
  pageBg: '#08060F',
  headerGradient: ['#4B1FA3', '#100729'],
  headerTagline: '#E9D5FF',
  goldAccent: '#F5B301',
  cardBg: '#120A22',
  cardBorder: 'rgba(168, 85, 247, 0.22)',
  textPrimary: 'rgba(255,255,255,0.92)',
  textSecondary: 'rgba(255,255,255,0.55)',
  textMuted: 'rgba(255,255,255,0.38)',
  primary: '#6A2BD9',
  primaryDark: '#4B1FA3',
  buttonGradient: ['#6A2BD9', '#4B1FA3'],
  inputBg: 'rgba(0,0,0,0.35)',
  inputBorder: '#2A2040',
  inputPlaceholder: '#696571',
  inputIcon: 'rgba(255,255,255,0.45)',
  socialBg: 'rgba(56,54,54,0.2)',
  socialBorder: '#170E2E',
  divider: 'rgba(87,87,87,0.5)',
  checkboxBg: '#0A0618',
  checkboxBorder: '#868686',
  statusBar: 'light',
  closeBg: 'rgba(10, 6, 24, 0.62)',
  closeBorder: 'rgba(255,255,255,0.18)',
  closeIcon: '#FFFFFF',
};

export const AUTH_PALETTES: Record<AuthScheme, AuthPalette> = {
  light: AUTH_LIGHT,
  dark: AUTH_DARK,
};

// ── Back-compat exports (dark-era constants; prefer useAuthTheme) ─────────────
export const AUTH_PANEL_BG = 'rgba(255, 255, 255, 00)';
export const AUTH_PANEL_DARK = AUTH_DARK.cardBg;
export const AUTH_PANEL_BORDER = '#a855f7';
export const AUTH_INPUT_BG = AUTH_DARK.inputBg;
export const AUTH_INPUT_BG_FILLED = '#04020c';
export const AUTH_INPUT_BORDER = AUTH_DARK.inputBorder;
export const AUTH_INPUT_BORDER_ALT = AUTH_DARK.inputBorder;
export const AUTH_INPUT_PLACEHOLDER = AUTH_DARK.inputPlaceholder;
export const AUTH_TEXT_MUTED = '#868686';
export const AUTH_TEXT_SUBTITLE = '#a1a1a1';
export const AUTH_SOCIAL_BG = AUTH_DARK.socialBg;
export const AUTH_SOCIAL_BORDER = AUTH_DARK.socialBorder;
export const AUTH_CHECKBOX_BG = AUTH_DARK.checkboxBg;
export const AUTH_CHECKBOX_BORDER = AUTH_DARK.checkboxBorder;
export const AUTH_ACCENT = AUTH_LIGHT.primary;
export const AUTH_BUTTON_SOLID = AUTH_LIGHT.primary;
export const AUTH_BUTTON_GRADIENT_START = AUTH_LIGHT.primary;
export const AUTH_BUTTON_GRADIENT_END = AUTH_LIGHT.primaryDark;
export const AUTH_DIVIDER_LINE = AUTH_DARK.divider;
export const AUTH_DIVIDER_TEXT = '#848484';
