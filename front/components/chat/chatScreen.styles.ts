import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useChatTheme } from '../../hooks/useChatTheme';
import { CHAT_THEME, chatSpacing, chatRadii, chatTypography, type ChatColors } from './chatTheme';

export function createChatScreenStyles(colors: ChatColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.pageBg,
      overflow: 'hidden',
    },
    screen: {
      flex: 1,
      minHeight: 0,
      zIndex: 1,
    },
    body: {
      flex: 1,
      minHeight: 0,
      position: 'relative',
      overflow: 'visible',
    },
    listRegion: {
      flex: 1,
      minHeight: 0,
    },
    messagesPane: {
      flex: 1,
      minHeight: 0,
    },
    header: {
      flexShrink: 0,
      zIndex: 100,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: chatSpacing.screenHorizontal,
      paddingTop: 8,
      paddingBottom: 12,
    },
    welcomeScroll: {
      flex: 1,
      minHeight: 0,
    },
    welcomeContent: {
      flexGrow: 1,
      paddingHorizontal: chatSpacing.welcomeHorizontal,
      paddingTop: 8,
      paddingBottom: chatSpacing.welcomeBottom,
      alignItems: 'stretch',
      justifyContent: 'center',
    },
    welcomeHero: {
      alignItems: 'center',
    },
    welcomeBubble: {
      marginBottom: 28,
    },
    welcomeText: {
      alignSelf: 'stretch',
    },
    welcomeTitle: {
      ...chatTypography.welcomeTitle,
      color: colors.textPrimary,
      textAlign: 'center',
      marginBottom: 8,
    },
    welcomeSubtitle: {
      ...chatTypography.welcomeSubtitle,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    messagesList: { flex: 1, minHeight: 0 },
    streamingPlaceholder: {
      minHeight: 4,
    },
    scrollFab: {
      position: 'absolute',
      left: 0,
      right: 0,
      alignItems: 'center',
      zIndex: 30,
    },
    nudgeFab: {
      position: 'absolute',
      left: 16,
      right: 16,
      zIndex: 35,
    },
    nudgeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderRadius: chatRadii.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.nudgeBorder,
    },
    nudgeText: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: '500',
      textAlign: 'left',
    },
    nudgeDismiss: {
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 8,
      borderRadius: 14,
      backgroundColor: colors.nudgeDismissBg,
    },
    nudgeDismissText: {
      color: colors.textSecondary,
      fontSize: 18,
      lineHeight: 18,
    },
    retryFab: {
      position: 'absolute',
      left: 16,
      right: 16,
      zIndex: 38,
    },
    retryBannerInner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(239,68,68,0.15)',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(239,68,68,0.35)',
      borderRadius: chatRadii.md,
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 8,
    },
    retryBannerText: {
      flex: 1,
      color: '#FCA5A5',
      fontSize: 12,
      fontWeight: '500',
      textAlign: 'left',
    },
    retryBannerBtn: {
      backgroundColor: 'rgba(239,68,68,0.35)',
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    retryBannerBtnText: {
      color: '#FCA5A5',
      fontSize: 12,
      fontWeight: '700',
    },
    retryBannerDismiss: {
      width: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    retryBannerDismissText: {
      color: colors.textMuted,
      fontSize: 18,
      lineHeight: 20,
    },
  });
}

export type ChatScreenStyles = ReturnType<typeof createChatScreenStyles>;

/** Hook: themed chat screen styles that follow the app appearance switch. */
export function useChatScreenStyles() {
  const theme = useChatTheme();
  const styles = useMemo(() => createChatScreenStyles(theme.colors), [theme.colors]);
  return { ...theme, styles };
}

/** @deprecated Prefer `useChatScreenStyles()` — static dark snapshot for non-hook call sites. */
export const chatScreenStyles = createChatScreenStyles(CHAT_THEME.dark);
