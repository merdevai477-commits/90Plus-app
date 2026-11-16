import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { useAppSettings } from '@/src/store/useAppSettings';
import {
  AUTH_PALETTES,
  type AuthPalette,
  type AuthScheme,
} from './AuthTokens';

type AuthThemeValue = {
  scheme: AuthScheme;
  colors: AuthPalette;
  isDark: boolean;
};

const AuthThemeContext = createContext<AuthThemeValue | null>(null);

function resolveScheme(
  preference: 'light' | 'dark' | 'auto' | undefined,
  system: string | null | undefined,
): AuthScheme {
  if (preference === 'light' || preference === 'dark') return preference;
  return system === 'light' ? 'light' : 'dark';
}

export function AuthThemeProvider({
  children,
  forceScheme,
}: {
  children: React.ReactNode;
  /** Pin palette regardless of app/system theme (e.g. Figma light-only landing). */
  forceScheme?: AuthScheme;
}) {
  const preference = useAppSettings((s) => s.theme?.mode);
  const system = useColorScheme();

  const value = useMemo<AuthThemeValue>(() => {
    const scheme = forceScheme ?? resolveScheme(preference, system);
    return {
      scheme,
      colors: AUTH_PALETTES[scheme],
      isDark: scheme === 'dark',
    };
  }, [forceScheme, preference, system]);

  return (
    <AuthThemeContext.Provider value={value}>{children}</AuthThemeContext.Provider>
  );
}

/**
 * Theme for pre-login screens. Falls back to system (or dark) when used
 * outside AuthScreenShell so primitives stay usable in tests/modals.
 */
export function useAuthTheme(): AuthThemeValue {
  const fromShell = useContext(AuthThemeContext);
  const preference = useAppSettings((s) => s.theme?.mode);
  const system = useColorScheme();

  return useMemo(() => {
    if (fromShell) return fromShell;
    const scheme = resolveScheme(preference, system);
    return {
      scheme,
      colors: AUTH_PALETTES[scheme],
      isDark: scheme === 'dark',
    };
  }, [fromShell, preference, system]);
}
