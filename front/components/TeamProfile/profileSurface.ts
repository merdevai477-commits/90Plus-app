/**
 * Light/dark surface tokens for club + competition profile screens.
 */

import { AUTH_LIGHT } from '../../src/components/auth/AuthTokens';
import { Colors } from '../../constants/theme';

export type ProfileSurface = {
  isDark: boolean;
  screen: string;
  text: string;
  muted: string;
  card: string;
  border: string;
  backBg: string;
  statusBar: 'light' | 'dark';
  headerGradient: readonly [string, string];
};

export function getProfileSurface(isDark: boolean): ProfileSurface {
  if (isDark) {
    return {
      isDark: true,
      screen: Colors.bgBase,
      text: Colors.textPrimary,
      muted: Colors.textMuted,
      card: Colors.surfaceGlass,
      border: Colors.borderSubtle,
      backBg: Colors.white08,
      statusBar: 'light',
      headerGradient: [Colors.purpleDeep, 'transparent'],
    };
  }

  return {
    isDark: false,
    screen: AUTH_LIGHT.pageBg,
    text: AUTH_LIGHT.textPrimary,
    muted: AUTH_LIGHT.textSecondary,
    card: AUTH_LIGHT.cardBg,
    border: 'rgba(106,43,217,0.22)',
    backBg: '#FFFFFF',
    statusBar: 'dark',
    headerGradient: ['#E9D5FF', AUTH_LIGHT.pageBg],
  };
}
