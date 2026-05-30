import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import {
  TextInput,
  Keyboard,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as ExpoClipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import type { FlashListRef } from '@shopify/flash-list';

import type { Message } from './useAIChatNative';
import {
  NUDGE_FLAG_PREFIX,
  SCROLL_NEAR_BOTTOM_THRESHOLD,
} from '../components/chat/chatTheme';

type ConnToast = { message: string; type: 'success' | 'error' | 'info' } | null;

type UseChatScreenStateParams = {
  messages: Message[];
  streamingMessageId: string | null;
  inputValue: string;
  setInputValue: (v: string) => void;
  sendMessage: (textOverride?: string) => void;
  editMessage: (id: string, text: string) => void;
  deleteMessage: (id: string) => void;
  retryLastMessage: () => void;
  dismissError: () => void;
  isOnline: boolean;
  profile: { displayName?: string | null } | null;
  isFifaCardComplete: boolean;
  tChat: {
    backOnline: string;
    offline: string;
    profileNudge: string;
    connectionLost: string;
    retryButton: string;
  };
};

export function useChatScreenState({
  messages,
  streamingMessageId,
  inputValue,
  setInputValue,
  sendMessage,
  editMessage,
  deleteMessage,
  retryLastMessage,
  dismissError,
  isOnline,
  profile,
  isFifaCardComplete,
  tChat,
}: UseChatScreenStateParams) {
  const router = useRouter();
  const listRef = useRef<FlashListRef<Message>>(null);
  const inputRef = useRef<TextInput>(null);
  const isNearBottomRef = useRef(true);
  const lastMessageCountRef = useRef(0);
  const prevOnlineRef = useRef<boolean | null>(null);

  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editingMessage, setEditingMessage] = useState<{ id: string; text: string } | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [nudgeText, setNudgeText] = useState<string | null>(null);
  const [connToast, setConnToast] = useState<ConnToast>(null);

  const hasMessages = messages.length > 1;
  const displayMessages = useMemo(() => messages.slice(1), [messages]);

  const listContentStyle = useMemo(
    () => ({
      paddingHorizontal: 12,
      paddingTop: 16,
      paddingBottom: 12,
      gap: 4,
    }),
    [],
  );

  useEffect(() => {
    if (prevOnlineRef.current === null) {
      prevOnlineRef.current = isOnline;
      return;
    }
    if (prevOnlineRef.current === isOnline) return;
    prevOnlineRef.current = isOnline;
    if (isOnline) {
      setConnToast({ message: tChat.backOnline, type: 'success' });
    } else {
      setConnToast({ message: tChat.offline, type: 'error' });
    }
  }, [isOnline, tChat.backOnline, tChat.offline]);

  useEffect(() => {
    if (!profile) return;
    if (isFifaCardComplete) return;
    const userKey = profile.displayName ?? 'anon';
    const storageKey = `${NUDGE_FLAG_PREFIX}${userKey}`;
    let cancelled = false;

    (async () => {
      try {
        const seen = await AsyncStorage.getItem(storageKey);
        if (seen || cancelled) return;
        setNudgeText(tChat.profileNudge);
        AsyncStorage.setItem(storageKey, '1').catch(() => {});
        setTimeout(() => {
          if (!cancelled) setNudgeText(null);
        }, 6000);
      } catch {
        // silent
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profile, isFifaCardComplete, tChat.profileNudge]);

  useEffect(() => {
    const newCount = messages.length;
    const prevCount = lastMessageCountRef.current;

    if (newCount > prevCount) {
      if (isNearBottomRef.current) {
        requestAnimationFrame(() => {
          listRef.current?.scrollToEnd({ animated: false });
        });
      } else {
        const added = messages.slice(prevCount, newCount);
        const aiAdded = added.filter((m) => m.role === 'ai').length;
        if (aiAdded > 0) setUnreadCount((c) => c + aiAdded);
      }
    }
    lastMessageCountRef.current = newCount;
  }, [messages.length, messages]);

  useEffect(() => {
    if (!streamingMessageId) return;
    if (isNearBottomRef.current) return;
    setUnreadCount((c) => (c < 1 ? 1 : c));
  }, [streamingMessageId, messages]);

  useEffect(() => {
    if (!hasMessages) return;
    isNearBottomRef.current = true;
    const scroll = () => listRef.current?.scrollToEnd({ animated: false });
    requestAnimationFrame(scroll);
    const t = setTimeout(scroll, 200);
    return () => clearTimeout(t);
  }, [hasMessages]);

  const handleSend = useCallback(
    (textOverride?: string) => {
      const textToSend = textOverride ?? inputValue;
      if (!textToSend.trim()) return;

      if (editingMessage) {
        editMessage(editingMessage.id, textToSend.trim());
        setEditingMessage(null);
        setInputValue('');
        inputRef.current?.blur();
        Keyboard.dismiss();
        return;
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      sendMessage(textOverride);
      setInputValue('');
      inputRef.current?.blur();
      Keyboard.dismiss();
      isNearBottomRef.current = true;
      setUnreadCount(0);
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: true });
      });
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 150);
    },
    [editingMessage, inputValue, editMessage, sendMessage, setInputValue],
  );

  const handleStartEdit = useCallback(
    (id: string, text: string) => {
      setEditingMessage({ id, text });
      setInputValue(text);
      setTimeout(() => inputRef.current?.focus(), 100);
    },
    [setInputValue],
  );

  const handleCancelEdit = useCallback(() => {
    setEditingMessage(null);
    setInputValue('');
  }, [setInputValue]);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
      const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
      const near = distanceFromBottom < SCROLL_NEAR_BOTTOM_THRESHOLD;

      isNearBottomRef.current = near;

      if (near) {
        if (unreadCount > 0) setUnreadCount(0);
        if (showScrollButton) setShowScrollButton(false);
      } else if (!showScrollButton) {
        setShowScrollButton(true);
      }
    },
    [showScrollButton, unreadCount],
  );

  const handleScrollToBottom = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    isNearBottomRef.current = true;
    setUnreadCount(0);
    listRef.current?.scrollToEnd({ animated: false });
  }, []);

  const handleOpenPanel = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    setIsPanelOpen(true);
  }, []);

  const handleBackHome = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    router.push('/');
  }, [router]);

  const scrollToEndAfterConversationChange = useCallback(() => {
    isNearBottomRef.current = true;
    setUnreadCount(0);
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: false });
    });
  }, []);

  const renderMessageHandlers = useMemo(
    () => ({
      onResend: (text: string) => handleSend(text),
      onEdit: handleStartEdit,
      onDelete: deleteMessage,
      onCopy: (text: string) => ExpoClipboard.setStringAsync(text).catch(() => {}),
    }),
    [handleSend, handleStartEdit, deleteMessage],
  );

  return {
    listRef,
    inputRef,
    isNearBottomRef,
    isPanelOpen,
    setIsPanelOpen,
    editingMessage,
    showScrollButton,
    unreadCount,
    nudgeText,
    setNudgeText,
    connToast,
    setConnToast,
    hasMessages,
    displayMessages,
    listContentStyle,
    handleSend,
    handleStartEdit,
    handleCancelEdit,
    handleScroll,
    handleScrollToBottom,
    handleOpenPanel,
    handleBackHome,
    scrollToEndAfterConversationChange,
    renderMessageHandlers,
    retryLastMessage,
    dismissError,
  };
}
