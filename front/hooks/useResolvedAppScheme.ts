import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { useAppSettings } from '@/src/store/useAppSettings';

export type AppScheme = 'light' | 'dark';

/**
 * Resolve app theme preference (light / dark / auto) against the system scheme.
 * Use for gate screens outside AuthThemeProvider (auth-callback, loading, consent).
 */
export function useResolvedAppScheme(): {
  scheme: AppScheme;
  isDark: boolean;
} {
  const preference = useAppSettings((s) => s.theme?.mode);
  const system = useColorScheme();

  return useMemo(() => {
    const scheme: AppScheme =
      preference === 'light' || preference === 'dark'
        ? preference
        : system === 'light'
          ? 'light'
          : 'dark';
    return { scheme, isDark: scheme === 'dark' };
  }, [preference, system]);
}

/** Shared surfaces for post-auth / gate screens. */
export const GATE_THEME = {
  light: {
    bg: '#FCFCFC',
    text: '#24104E',
    textMuted: '#6B7280',
    surface: '#FFFFFF',
    surfaceAlt: '#F3EDFF',
    border: '#E5E7EB',
    primary: '#6A2BD9',
    track: 'rgba(36,16,78,0.08)',
    statusBar: 'dark' as const,
  },
  dark: {
    bg: '#08060F',
    text: 'rgba(255,255,255,0.92)',
    textMuted: 'rgba(255,255,255,0.55)',
    surface: '#120A22',
    surfaceAlt: '#1A0F30',
    border: '#2A2040',
    primary: '#6A2BD9',
    track: 'rgba(255,255,255,0.12)',
    statusBar: 'light' as const,
  },
} as const;
