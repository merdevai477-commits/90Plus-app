import { useMemo } from 'react';
import { useResolvedAppScheme } from './useResolvedAppScheme';
import { getProfileColors, type ProfileColors } from '../constants/ProfileTheme';

export function useProfileTheme(): {
  colors: ProfileColors;
  isDark: boolean;
} {
  const { isDark } = useResolvedAppScheme();
  return useMemo(
    () => ({
      colors: getProfileColors(isDark),
      isDark,
    }),
    [isDark],
  );
}
