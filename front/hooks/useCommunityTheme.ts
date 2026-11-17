/**
 * Light/dark palette for the community feed — follows the app appearance switch.
 */

import { createContext, createElement, useContext, useMemo, type ReactNode } from 'react';
import { useResolvedAppScheme } from '@/hooks/useResolvedAppScheme';
import { COMMUNITY_THEME, type CommunityColors } from '@/components/community/theme';

type CommunityThemeValue = {
  colors: CommunityColors;
  isDark: boolean;
};

const CommunityThemeContext = createContext<CommunityThemeValue | null>(null);

export function useCommunityTheme(): CommunityThemeValue {
  const ctx = useContext(CommunityThemeContext);
  const { isDark } = useResolvedAppScheme();
  return useMemo(() => {
    if (ctx) return ctx;
    return {
      colors: isDark ? COMMUNITY_THEME.dark : COMMUNITY_THEME.light,
      isDark,
    };
  }, [ctx, isDark]);
}

export function CommunityThemeProvider({ children }: { children: ReactNode }) {
  const { isDark } = useResolvedAppScheme();
  const value = useMemo<CommunityThemeValue>(
    () => ({
      colors: isDark ? COMMUNITY_THEME.dark : COMMUNITY_THEME.light,
      isDark,
    }),
    [isDark],
  );
  return createElement(CommunityThemeContext.Provider, { value }, children);
}
