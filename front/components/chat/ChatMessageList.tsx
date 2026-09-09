import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

import type { Message } from '../../hooks/useAIChatNative';
import { AIMessageBubble, UserMessageBubble } from './MessageBubble';
import { ThinkingIndicator } from './ThinkingIndicator';
import { ScrollToBottomButton } from './ScrollToBottomButton';
import { ChatGlassSurface } from './ChatGlassSurface';
import ChatScrollView from './ChatScrollView';
import {
  CHAT_BANNER_BOTTOM,
  CHAT_DRAW_DISTANCE,
  CHAT_OVERLAY_BOTTOM,
  chatSpacing,
} from './chatTheme';
import { chatScreenStyles as styles } from './chatScreen.styles';
import { safeFlashListScrollToEnd } from './safeFlashListScroll';

export type ChatMessageListProps = {
  listRef: React.RefObject<FlashListRef<Message> | null>;
  displayMessages: Message[];
  messages: Message[];
  streamingMessageId: string | null;
  isThinking: boolean;
  isRetrying: boolean;
  isLoading: boolean;
  error: string | null;
  showScrollButton: boolean;
  unreadCount: number;
  nudgeText: string | null;
  onDismissNudge: () => void;
  onScroll: (e: Parameters<NonNullable<React.ComponentProps<typeof FlashList>['onScroll']>>[0]) => void;
  onScrollToBottom: () => void;
  onRetry: () => void;
  onDismissError: () => void;
  retryLabel: string;
  connectionLostLabel: string;
  extraContentPadding?: SharedValue<number>;
  renderMessageHandlers: {
    onResend: (text: string) => void;
    onEdit: (id: string, text: string) => void;
    onDelete: (id: string) => void;
    onCopy: (text: string) => void;
    onNavChoice?: (text: string) => void;
  };
  isNearBottomRef: React.MutableRefObject<boolean>;
  useNativeKeyboardScroll?: boolean;
  listBottomInset?: number;
};

export function ChatMessageList({
  listRef,
  displayMessages,
  messages,
  streamingMessageId,
  isThinking,
  isRetrying,
  isLoading,
  error,
  showScrollButton,
  unreadCount,
  nudgeText,
  onDismissNudge,
  onScroll,
  onScrollToBottom,
  onRetry,
  onDismissError,
  retryLabel,
  connectionLostLabel,
  extraContentPadding,
  renderMessageHandlers,
  isNearBottomRef,
  useNativeKeyboardScroll = false,
  listBottomInset = chatSpacing.listBottom,
}: ChatMessageListProps) {
  const mountedRef = useRef(true);
  const contentSizeRafRef = useRef<number | null>(null);
  const pendingContentHeightRef = useRef<number | null>(null);
  const viewportHeightRef = useRef(0);
  const itemCountRef = useRef(displayMessages.length);
  itemCountRef.current = displayMessages.length;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (contentSizeRafRef.current != null) {
        cancelAnimationFrame(contentSizeRafRef.current);
        contentSizeRafRef.current = null;
      }
    };
  }, []);
  const listContentStyle = useMemo(
    () => ({
      paddingHorizontal: chatSpacing.listHorizontal,
      paddingTop: chatSpacing.listTop,
      paddingBottom: listBottomInset,
      gap: chatSpacing.listGap,
    }),
    [listBottomInset],
  );

  const renderScrollComponent = useCallback(
    (props: React.ComponentProps<typeof ChatScrollView>) => (
      <ChatScrollView {...props} extraContentPadding={extraContentPadding} />
    ),
    [extraContentPadding],
  );

  const renderMessage = useCallback(
    ({ item: msg, index: i }: { item: Message; index: number }) => {
      if (msg.role === 'ai') {
        const text = (msg.text ?? '').toString();
        if (msg.isStreaming && text.trim().length === 0) {
          return <View style={styles.streamingPlaceholder} />;
        }
        const isHistory = msg.id !== streamingMessageId;
        return <AIMessageBubble message={msg} index={i} isHistory={isHistory} onNavChoice={renderMessageHandlers.onNavChoice} />;
      }
      return (
        <UserMessageBubble
          message={msg}
          index={i}
          onResend={() => renderMessageHandlers.onResend(msg.text)}
          onEdit={() => renderMessageHandlers.onEdit(msg.id, msg.text)}
          onDelete={() => renderMessageHandlers.onDelete(msg.id)}
          onCopy={() => renderMessageHandlers.onCopy(msg.text)}
        />
      );
    },
    [renderMessageHandlers, streamingMessageId],
  );

  const keyExtractor = useCallback((item: Message) => item.id, []);

  const stickToBottom = useCallback(() => {
    if (!mountedRef.current || itemCountRef.current === 0) return;
    if (!isNearBottomRef.current) return;
    safeFlashListScrollToEnd(listRef.current, false, {
      itemCount: itemCountRef.current,
      contentHeight: pendingContentHeightRef.current ?? undefined,
      viewportHeight: viewportHeightRef.current || undefined,
    });
  }, [isNearBottomRef, listRef]);

  const onListLayout = useCallback((e: { nativeEvent: { layout: { height: number } } }) => {
    const next = e.nativeEvent.layout.height;
    if (next > 0) viewportHeightRef.current = next;
  }, []);

  const onListContentSizeChange = useCallback((_w: number, h: number) => {
    pendingContentHeightRef.current = h;
    if (!isNearBottomRef.current) return;
    if (!mountedRef.current || itemCountRef.current === 0) return;
    if (contentSizeRafRef.current != null) return;
    contentSizeRafRef.current = requestAnimationFrame(() => {
      contentSizeRafRef.current = null;
      stickToBottom();
    });
  }, [isNearBottomRef, stickToBottom]);

  return (
    <View style={styles.messagesPane}>
      <FlashList
        ref={listRef}
        style={styles.messagesList}
        contentContainerStyle={listContentStyle}
        keyboardShouldPersistTaps="handled"
        data={displayMessages}
        keyExtractor={keyExtractor}
        renderItem={renderMessage}
        {...(useNativeKeyboardScroll
          ? { renderScrollComponent }
          : {})}
        onLayout={onListLayout}
        onScroll={onScroll}
        scrollEventThrottle={16}
        drawDistance={CHAT_DRAW_DISTANCE}
        bounces={false}
        overScrollMode="never"
        removeClippedSubviews={Platform.OS === 'android' ? false : undefined}
        onContentSizeChange={onListContentSizeChange}
        ListFooterComponent={
          isThinking ? (
            <ThinkingIndicator
              isThinking={isThinking}
              lastMessage={
                [...messages]
                  .reverse()
                  .find((m) => m.role === 'user' && m.text.trim())?.text ?? ''
              }
            />
          ) : null
        }
      />

      {showScrollButton && (
        <Animated.View
          entering={FadeIn.duration(200).springify()}
          exiting={FadeOut.duration(150)}
          style={[styles.scrollFab, { bottom: CHAT_OVERLAY_BOTTOM }]}
          pointerEvents="box-none"
        >
          <ScrollToBottomButton
            onPress={onScrollToBottom}
            newMessagesCount={unreadCount}
          />
        </Animated.View>
      )}

      {nudgeText && (
        <Animated.View
          entering={FadeIn.duration(220)}
          exiting={FadeOut.duration(180)}
          style={[styles.nudgeFab, { bottom: CHAT_BANNER_BOTTOM }]}
          pointerEvents="box-none"
        >
          <ChatGlassSurface
            style={styles.nudgeCard}
            tint="rgba(124,58,237,0.22)"
            effect="regular"
            interactive
          >
            <Text style={styles.nudgeText}>{nudgeText}</Text>
            <Pressable onPress={onDismissNudge} hitSlop={8} style={styles.nudgeDismiss}>
              <Text style={styles.nudgeDismissText}>×</Text>
            </Pressable>
          </ChatGlassSurface>
        </Animated.View>
      )}

      {(isRetrying || (error && !isLoading)) && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={[styles.retryFab, { bottom: CHAT_BANNER_BOTTOM }]}
          pointerEvents="box-none"
        >
          <View style={styles.retryBannerInner}>
            <Text style={styles.retryBannerText} numberOfLines={2}>
              {error ?? connectionLostLabel}
            </Text>
            {!isRetrying && (
              <Pressable onPress={onRetry} style={styles.retryBannerBtn} hitSlop={8}>
                <Text style={styles.retryBannerBtnText}>{retryLabel}</Text>
              </Pressable>
            )}
            {!isRetrying && (
              <Pressable onPress={onDismissError} hitSlop={8} style={styles.retryBannerDismiss}>
                <Text style={styles.retryBannerDismissText}>×</Text>
              </Pressable>
            )}
          </View>
        </Animated.View>
      )}
    </View>
  );
}
