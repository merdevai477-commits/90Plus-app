import { StyleSheet, Platform } from 'react-native';
import { chatColors, chatSpacing, chatRadii, chatTypography } from './chatTheme';

export const chatScreenStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#08070F',
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
    color: chatColors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    ...chatTypography.welcomeSubtitle,
    color: chatColors.textSecondary,
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
    borderColor: chatColors.nudgeBorder,
  },
  nudgeText: {
    flex: 1,
    color: chatColors.textPrimary,
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
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  nudgeDismissText: {
    color: chatColors.textSecondary,
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
    color: 'rgba(255,255,255,0.5)',
    fontSize: 18,
    lineHeight: 20,
  },
});
