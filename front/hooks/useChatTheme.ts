/**
 * Light/dark palette for the AI chat screen — follows the app appearance switch.
 */

import { createContext, createElement, useContext, useMemo, type ReactNode } from 'react';
import { useResolvedAppScheme } from '@/hooks/useResolvedAppScheme';
import { CHAT_THEME, type ChatColors } from '@/components/chat/chatTheme';

export type ChatThemeValue = {
  colors: ChatColors;
  isDark: boolean;
  blurTint: 'light' | 'dark';
};

const ChatThemeContext = createContext<ChatThemeValue | null>(null);

export function useChatTheme(): ChatThemeValue {
  const ctx = useContext(ChatThemeContext);
  const { isDark } = useResolvedAppScheme();
  return useMemo(() => {
    if (ctx) return ctx;
    const colors = isDark ? CHAT_THEME.dark : CHAT_THEME.light;
    return {
      colors,
      isDark,
      blurTint: colors.blurTint,
    };
  }, [ctx, isDark]);
}

export function ChatThemeProvider({ children }: { children: ReactNode }) {
  const { isDark } = useResolvedAppScheme();
  const value = useMemo<ChatThemeValue>(() => {
    const colors = isDark ? CHAT_THEME.dark : CHAT_THEME.light;
    return {
      colors,
      isDark,
      blurTint: colors.blurTint,
    };
  }, [isDark]);
  return createElement(ChatThemeContext.Provider, { value }, children);
}
