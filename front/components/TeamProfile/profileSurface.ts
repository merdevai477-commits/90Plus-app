/**
 * Light/dark surface tokens for club + competition profile screens.
 */

import React, { createContext, useContext } from 'react';
import { AUTH_LIGHT } from '../../src/components/auth/AuthTokens';
import { Colors } from '../../constants/theme';

export type ProfileSurface = {
  isDark: boolean;
  screen: string;
  text: string;
  textStrong: string;
  muted: string;
  secondary: string;
  card: string;
  cardAlt: string;
  border: string;
  chipBg: string;
  chipBgActive: string;
  chipText: string;
  chipTextActive: string;
  rowBg: string;
  tabBar: string;
  backBg: string;
  statusBar: 'light' | 'dark';
  headerGradient: readonly [string, string];
  accent: string;
  accentSoft: string;
};

export function getProfileSurface(isDark: boolean): ProfileSurface {
  if (isDark) {
    return {
      isDark: true,
      screen: Colors.bgBase,
      text: Colors.textPrimary,
      textStrong: Colors.white,
      muted: Colors.textMuted,
      secondary: Colors.textSecondary,
      card: Colors.surfaceGlass,
      cardAlt: Colors.white04,
      border: Colors.borderSubtle,
      chipBg: Colors.white04,
      chipBgActive: Colors.purpleSoft,
      chipText: Colors.textSecondary,
      chipTextActive: Colors.white,
      rowBg: Colors.white04,
      tabBar: Colors.bgBase,
      backBg: Colors.white08,
      statusBar: 'light',
      headerGradient: [Colors.purpleDeep, 'transparent'],
      accent: Colors.purpleSoft,
      accentSoft: Colors.purpleMuted,
    };
  }

  return {
    isDark: false,
    screen: '#F7F4FC',
    text: AUTH_LIGHT.textPrimary,
    textStrong: '#1A0B3C',
    muted: '#6B7280',
    secondary: '#4B5563',
    card: '#FFFFFF',
    cardAlt: '#F3EDFF',
    border: 'rgba(106,43,217,0.22)',
    chipBg: '#FFFFFF',
    chipBgActive: AUTH_LIGHT.primary,
    chipText: AUTH_LIGHT.primaryDark,
    chipTextActive: '#FFFFFF',
    rowBg: '#FFFFFF',
    tabBar: '#FFFFFF',
    backBg: '#FFFFFF',
    statusBar: 'dark',
    headerGradient: ['#EDE4FF', '#F7F4FC'],
    accent: AUTH_LIGHT.primary,
    accentSoft: 'rgba(106,43,217,0.12)',
  };
}

const ProfileSurfaceContext = createContext<ProfileSurface>(getProfileSurface(true));

export function ProfileSurfaceProvider({
  value,
  children,
}: {
  value: ProfileSurface;
  children: React.ReactNode;
}) {
  return React.createElement(ProfileSurfaceContext.Provider, { value }, children);
}

export function useProfileSurface(): ProfileSurface {
  return useContext(ProfileSurfaceContext);
}
