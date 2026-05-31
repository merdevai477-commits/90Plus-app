import { Conversation } from '../../hooks/useAIChatNative';
import { captureException } from '../../services/sentry.service';
import { logger } from '../../services/logger';

const FALLBACK_TITLE = 'محادثة';

/** True when conversation has a non-empty string id. */
export function isValidConversation(
  conversation: Conversation | null | undefined,
): conversation is Conversation {
  return Boolean(
    conversation &&
      typeof conversation.id === 'string' &&
      conversation.id.trim().length > 0,
  );
}

export function safeConversationTitle(conversation: Conversation | null | undefined): string {
  const title = conversation?.title;
  if (typeof title === 'string' && title.trim().length > 0) {
    return title.trim();
  }
  return FALLBACK_TITLE;
}

export function safeConversationDate(iso: string | undefined | null): string {
  if (!iso || typeof iso !== 'string') return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : iso;
}

export function logLongPress(conversation: Conversation | null | undefined): void {
  if (__DEV__) {
    console.log('[LONG_PRESS]', {
      id: conversation?.id,
      title: conversation?.title,
    });
  }
}

export function reportConversationActionError(
  action: string,
  error: unknown,
  conversation: Conversation | null | undefined,
): void {
  const err = error instanceof Error ? error : new Error(String(error));
  logger.error(`[AIChat] ${action} failed:`, err.message, err.stack);
  captureException(err, {
    tags: { screen: 'AIChat', action },
    extra: {
      conversationId: conversation?.id,
      conversationTitle: conversation?.title,
    },
  });
}

/**
 * Wraps long-press open of context menu — never throws.
 */
export function handleConversationLongPress(
  conversation: Conversation | null | undefined,
  openMenu: (c: Conversation) => void,
): void {
  try {
    logLongPress(conversation);
    if (!isValidConversation(conversation)) {
      logger.warn('[AIChat] Long press ignored — invalid conversation object');
      return;
    }
    openMenu(conversation);
  } catch (error) {
    reportConversationActionError('LongPressConversation', error, conversation);
  }
}
