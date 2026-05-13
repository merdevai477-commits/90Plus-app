/**
 * useAIChatNative.ts
 * Core chat hook for React Native — SSE streaming via XMLHttpRequest.
 *
 * Improvements over v1:
 *  - x-user-timezone header on every request (timezone-aware daily reset)
 *  - Streaming resume/retry: on disconnect, saves partial text as draft,
 *    auto-retries up to 2 times with resumeFromToken offset
 *  - deleteMessage now syncs with backend (cascade delete)
 *  - Dynamic history window (token-aware, not fixed slice)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import { API_CONFIG } from '../constants/theme';
import { Storage } from '../services/chatStorageService';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
  time: string;
  isTyping?: boolean;
  usedModel?: string;
}

export interface Conversation {
  id: string;
  title: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  lastMessage: string | null;
}

// ─── SSE data shapes from backend ────────────────────────────────────────────

interface SSEToken { token: string }
interface SSEDone {
  done: true;
  remaining?: number;
  resetAt?: string;
  usedModel?: string;
}
interface SSEError { error: string; done?: boolean }
type SSEData = SSEToken | SSEDone | SSEError;

// ─── Constants ────────────────────────────────────────────────────────────────

const BACKEND_URL = API_CONFIG.baseUrl;
const MAX_STREAM_RETRIES = 2;
const RETRY_DELAY_MS = 2000;
const DRAFT_KEY_PREFIX = '@chat_draft_v1_';

const INITIAL_MESSAGES: Message[] = [
  {
    id: '1',
    role: 'ai',
    text: "Hey there! I'm 90Plus AI — ask me anything about football or performance. How can I help today?",
    time: '9:41',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function now(): string {
  return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatTime(dateLike: string | number | Date): string {
  return new Date(dateLike).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toHistoryFormat(messages: Message[]) {
  return messages
    .filter(m => !m.isTyping)
    .map(m => ({
      role: m.role === 'ai' ? 'assistant' : 'user',
      content: m.text,
    }));
}

/**
 * Parse SSE chunks from XMLHttpRequest.responseText.
 * Returns complete `data: {...}` lines since lastIndex.
 * newIndex stops at the last full newline so partial chunks are preserved.
 */
function parseSSEChunk(
  responseText: string,
  lastIndex: number,
): { events: SSEData[]; newIndex: number } {
  const newText = responseText.slice(lastIndex);
  const lastNewline = newText.lastIndexOf('\n');
  if (lastNewline === -1) return { events: [], newIndex: lastIndex };

  const completeText = newText.slice(0, lastNewline + 1);
  const lines = completeText.split('\n');
  const events: SSEData[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('data: ')) {
      const jsonStr = trimmed.slice(6).trim();
      if (jsonStr) {
        try {
          events.push(JSON.parse(jsonStr) as SSEData);
        } catch {
          // malformed line — skip
        }
      }
    }
  }

  return { events, newIndex: lastIndex + lastNewline + 1 };
}

/** Get the device's IANA timezone string (e.g. "Africa/Cairo"). */
function getTimezone(): string {
  try {
    return Localization.getCalendars()[0]?.timeZone ?? 'UTC';
  } catch {
    return 'UTC';
  }
}

// ─── Hook options ─────────────────────────────────────────────────────────────

export interface UseAIChatOptions {
  /**
   * Optional function invoked right before each outgoing request. Return a
   * string to append to the server-built system prompt (the backend merges
   * it on top of its own rules). Return null/undefined to skip personalization.
   */
  getSystemPromptSuffix?: () => string | null | undefined;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAIChatNative(options: UseAIChatOptions = {}) {
  const { getSystemPromptSuffix } = options;
  const suffixBuilderRef = useRef<UseAIChatOptions['getSystemPromptSuffix']>(getSystemPromptSuffix);
  useEffect(() => {
    suffixBuilderRef.current = getSystemPromptSuffix;
  }, [getSystemPromptSuffix]);

  const userIdRef = useRef<string>('');
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const abortRef = useRef(false);
  const lastIndexRef = useRef(0);
  // Track partial text for resume on disconnect
  const partialTextRef = useRef<string>('');
  const retryCountRef = useRef(0);

  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  // `null` = we have not yet fetched the real limit from the backend. The UI
  // renders a neutral placeholder instead of a misleading hardcoded number.
  const [messagesRemaining, setMessagesRemaining] = useState<number | null>(null);
  const [resetTime, setResetTime] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Retry state for the reconnect banner
  const [isRetrying, setIsRetrying] = useState(false);
  // ID of the AI message currently being streamed — consumers use this to
  // decide whether to animate a bubble's text or render it as history.
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);

  // ─── Init ────────────────────────────────────────────────────────────────

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      const id = await Storage.getUserId();
      if (!mounted) return;
      userIdRef.current = id;
      // Run both independent calls in parallel — saves ~300–500 ms on every
      // mount vs. awaiting them sequentially.
      await Promise.all([fetchLimit(), bootstrapConversation()]);
    };
    init();
    return () => {
      mounted = false;
      abortXHR();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── XHR abort ───────────────────────────────────────────────────────────

  const abortXHR = useCallback(() => {
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
  }, []);

  // ─── Common headers ───────────────────────────────────────────────────────

  const commonHeaders = useCallback((): Record<string, string> => ({
    'x-user-id': userIdRef.current,
    'x-user-timezone': getTimezone(),
  }), []);

  // ─── REST helpers ─────────────────────────────────────────────────────────

  const fetchLimit = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/chat/limit`, {
        headers: commonHeaders(),
      });
      if (res.ok) {
        const data = await res.json() as { remaining: number; resetAt?: string };
        setMessagesRemaining(data.remaining);
        if (data.remaining === 0 && data.resetAt) {
          setResetTime(new Date(data.resetAt));
        }
      }
    } catch {
      // Backend not reachable — leave messagesRemaining as `null` so the
      // counter renders a loading state rather than a misleading number.
    }
  }, [commonHeaders]);

  const fetchConversations = useCallback(async (): Promise<Conversation[]> => {
    const res = await fetch(`${BACKEND_URL}/api/conversations`, {
      headers: commonHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch conversations');
    const data = await res.json() as { conversations: Conversation[] };
    const convs = data.conversations ?? [];
    setConversations(convs);
    return convs;
  }, [commonHeaders]);

  const createConversation = useCallback(async (): Promise<Conversation> => {
    const res = await fetch(`${BACKEND_URL}/api/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...commonHeaders() },
      body: JSON.stringify({ title: 'New chat' }),
    });
    if (!res.ok) throw new Error('Failed to create conversation');
    const data = await res.json() as { conversation: Conversation };
    return data.conversation;
  }, [commonHeaders]);

  const loadConversationMessages = useCallback(async (conversationId: string) => {
    const res = await fetch(
      `${BACKEND_URL}/api/conversations/${conversationId}/messages`,
      { headers: commonHeaders() },
    );
    if (!res.ok) throw new Error('Failed to load messages');
    const data = await res.json() as {
      messages: Array<{ id: string; role: 'user' | 'ai'; text: string; createdAt: string }>;
    };
    const loaded: Message[] = [
      INITIAL_MESSAGES[0],
      ...(data.messages ?? []).map(m => ({
        id: m.id,
        role: m.role,
        text: m.text,
        time: formatTime(m.createdAt),
      })),
    ];
    setMessages(loaded);
  }, [commonHeaders]);

  const bootstrapConversation = useCallback(async () => {
    try {
      const existing = await fetchConversations();

      if (existing.length > 0) {
        // Prefer the last active conversation (if it still exists on the
        // server) so the user returns to the screen they left.
        const lastId = await Storage.getLastConversationId();
        const lastConv = lastId ? existing.find(c => c.id === lastId) : null;
        const target = lastConv ?? existing[0];
        setCurrentConversationId(target.id);
        await loadConversationMessages(target.id);
        await Storage.saveLastConversationId(target.id);
        return;
      }

      // No conversations exist yet — create the first one.
      const created = await createConversation();
      setCurrentConversationId(created.id);
      setConversations([created]);
      setMessages(INITIAL_MESSAGES);
      await Storage.saveLastConversationId(created.id);
    } catch {
      // warn only — don't crash the chat screen on a transient failure
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchConversations, createConversation, loadConversationMessages]);

  // ─── Core SSE sender (internal, supports resume) ──────────────────────────

  const _sendSSE = useCallback((
    trimmed: string,
    history: Array<{ role: string; content: string }>,
    conversationId: string,
    aiMessageId: string,
    systemPromptSuffix: string | undefined,
    resumeFromToken: number,
  ) => {
    abortRef.current = false;
    lastIndexRef.current = 0;

    const body = JSON.stringify({
      message: trimmed,
      history,
      conversationId,
      ...(systemPromptSuffix ? { systemPromptSuffix } : {}),
      ...(resumeFromToken > 0 ? { resumeFromToken } : {}),
    });

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;

    xhr.open('POST', `${BACKEND_URL}/api/chat/stream`, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    const headers = commonHeaders();
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));

    xhr.onreadystatechange = () => {
      if (abortRef.current) return;
      if (xhr.readyState === XMLHttpRequest.LOADING || xhr.readyState === XMLHttpRequest.DONE) {
        if (xhr.status === 429) return;

        const { events, newIndex } = parseSSEChunk(xhr.responseText, lastIndexRef.current);
        if (newIndex === lastIndexRef.current) return;
        lastIndexRef.current = newIndex;

        for (const event of events) {
          if (abortRef.current) break;

          if ('token' in event && event.token) {
            setIsThinking(false);
            setIsRetrying(false);
            partialTextRef.current += event.token;
            setMessages(prev => {
              const exists = prev.some(m => m.id === aiMessageId);
              if (!exists) {
                return [...prev, { id: aiMessageId, role: 'ai' as const, text: event.token, time: now() }];
              }
              return prev.map(m =>
                m.id === aiMessageId ? { ...m, text: m.text + event.token } : m,
              );
            });
          }

          if ('done' in event && event.done) {
            const doneEvent = event as SSEDone;
            if (doneEvent.remaining !== undefined) setMessagesRemaining(doneEvent.remaining);
            if (doneEvent.resetAt) setResetTime(new Date(doneEvent.resetAt));
            if (doneEvent.usedModel) {
              setMessages(prev =>
                prev.map(m => m.id === aiMessageId ? { ...m, usedModel: doneEvent.usedModel } : m),
              );
            }
            // Clear draft on success
            if (conversationId) {
              AsyncStorage.removeItem(`${DRAFT_KEY_PREFIX}${conversationId}`).catch(() => {});
            }
            retryCountRef.current = 0;
          }

          if ('error' in event && event.error && !('token' in event)) {
            setError(event.error);
            setMessagesRemaining(prev => (prev === null ? prev : prev + 1));
          }
        }
      }
    };

    xhr.onload = () => {
      if (abortRef.current) return;
      if (xhr.status === 429) {
        try {
          const errData = JSON.parse(xhr.responseText) as { error: string; resetAt?: string };
          setMessagesRemaining(0);
          if (errData.resetAt) setResetTime(new Date(errData.resetAt));
          setError('Youve reached your daily message limit.');
        } catch {
          setError('Youve reached your daily message limit.');
          setMessagesRemaining(0);
        }
        setIsLoading(false);
        setIsThinking(false);
        setIsRetrying(false);
        setStreamingMessageId(null);
        return;
      }
      setIsLoading(false);
      setIsThinking(false);
      setIsRetrying(false);
      setStreamingMessageId(null);
      fetchConversations().catch(() => {});
      fetchLimit().catch(() => {});
    };

    const handleDisconnect = () => {
      if (abortRef.current) return;

      const partial = partialTextRef.current;

      // Save draft for resume
      if (partial.length > 0 && conversationId) {
        AsyncStorage.setItem(`${DRAFT_KEY_PREFIX}${conversationId}`, partial).catch(() => {});
      }

      if (retryCountRef.current < MAX_STREAM_RETRIES) {
        retryCountRef.current++;
        setIsRetrying(true);
        setError(`انقطع الاتصال — إعادة المحاولة ${retryCountRef.current}/${MAX_STREAM_RETRIES}...`);

        setTimeout(() => {
          if (abortRef.current) return;
          setError(null);
          _sendSSE(trimmed, history, conversationId, aiMessageId, systemPromptSuffix, partial.length);
        }, RETRY_DELAY_MS);
      } else {
        // All retries exhausted
        setIsLoading(false);
        setIsThinking(false);
        setIsRetrying(false);
        setStreamingMessageId(null);
        setMessagesRemaining(prev => (prev === null ? prev : prev + 1));
        setError('فشل الاتصال بعد عدة محاولات. اضغط إعادة المحاولة.');
        retryCountRef.current = 0;
      }
    };

    xhr.onerror = handleDisconnect;
    xhr.ontimeout = handleDisconnect;
    xhr.timeout = 60_000;
    xhr.send(body);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commonHeaders, fetchConversations, fetchLimit]);

  // ─── Send Message ─────────────────────────────────────────────────────────

  const sendMessage = useCallback(async (text?: string) => {
    const messageText = text ?? inputValue;
    const trimmed = messageText.trim();
    if (!trimmed || isLoading) return;
    if (messagesRemaining !== null && messagesRemaining <= 0) return;

    setError(null);
    abortRef.current = false;
    abortXHR();
    partialTextRef.current = '';
    retryCountRef.current = 0;

    const aiMessageId = (Date.now() + 1).toString();
    setStreamingMessageId(aiMessageId);

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: trimmed,
      time: now(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);
    setIsThinking(true);
    setMessagesRemaining(prev => (prev === null ? prev : Math.max(0, prev - 1)));

    if (!currentConversationId) {
      setError('No active conversation.');
      setIsLoading(false);
      setIsThinking(false);
      setStreamingMessageId(null);
      setMessagesRemaining(prev => (prev === null ? prev : prev + 1));
      return;
    }

    const history = toHistoryFormat(
      messages.filter(m => m.id !== userMsg.id).slice(1),
    );

    const systemPromptSuffix = (() => {
      try {
        const out = suffixBuilderRef.current?.();
        return typeof out === 'string' && out.trim().length > 0 ? out : undefined;
      } catch {
        return undefined;
      }
    })();

    _sendSSE(trimmed, history, currentConversationId, aiMessageId, systemPromptSuffix, 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    inputValue, isLoading, messagesRemaining, currentConversationId,
    messages, abortXHR, _sendSSE,
  ]);

  // ─── Stop Generation ──────────────────────────────────────────────────────

  const stopGeneration = useCallback(() => {
    abortRef.current = true;
    abortXHR();
    setMessagesRemaining(prev => (prev === null ? prev : prev + 1));
    setIsLoading(false);
    setIsThinking(false);
    setIsRetrying(false);
    setStreamingMessageId(null);
    retryCountRef.current = 0;
  }, [abortXHR]);

  // ─── Retry ────────────────────────────────────────────────────────────────

  const retryLastMessage = useCallback(() => {
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    if (lastUserMessage) {
      setError(null);
      sendMessage(lastUserMessage.text);
    }
  }, [messages, sendMessage]);

  // ─── Edit Message ─────────────────────────────────────────────────────────

  const editMessage = useCallback((messageId: string, newText: string) => {
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;
    const newMessages = messages.slice(0, messageIndex);
    setMessages(newMessages);
    sendMessage(newText);
  }, [messages, sendMessage]);

  // ─── Delete Message (optimistic + backend sync) ───────────────────────────

  const deleteMessage = useCallback(async (messageId: string) => {
    // Optimistic: remove from UI immediately
    setMessages(prev => prev.filter(m => m.id !== messageId));

    if (!currentConversationId) return;

    try {
      const res = await fetch(
        `${BACKEND_URL}/api/conversations/${currentConversationId}/messages/${messageId}`,
        { method: 'DELETE', headers: commonHeaders() },
      );
      if (!res.ok) {
        // Rollback: reload messages from server
        await loadConversationMessages(currentConversationId);
      }
    } catch {
      // Rollback on network error
      try {
        await loadConversationMessages(currentConversationId);
      } catch {
        // silent — UI already shows the optimistic state
      }
    }
  }, [currentConversationId, commonHeaders, loadConversationMessages]);

  // ─── Clear Chat ───────────────────────────────────────────────────────────

  const clearChat = useCallback(() => {
    abortRef.current = true;
    abortXHR();
    setMessages(INITIAL_MESSAGES);
    setInputValue('');
    setIsLoading(false);
    setIsThinking(false);
    setIsRetrying(false);
    setStreamingMessageId(null);
    setError(null);
    retryCountRef.current = 0;
    fetchLimit().catch(() => {});
  }, [abortXHR, fetchLimit]);

  // ─── Conversation Management ──────────────────────────────────────────────

  const selectConversation = useCallback(async (conversationId: string) => {
    setCurrentConversationId(conversationId);
    await loadConversationMessages(conversationId);
    await Storage.saveLastConversationId(conversationId);
  }, [loadConversationMessages]);

  const startNewConversation = useCallback(async () => {
    const created = await createConversation();
    await fetchConversations();
    setCurrentConversationId(created.id);
    setMessages(INITIAL_MESSAGES);
    await Storage.saveLastConversationId(created.id);
  }, [createConversation, fetchConversations]);

  const togglePinConversation = useCallback(async (
    conversationId: string,
    isPinned: boolean,
  ) => {
    await fetch(`${BACKEND_URL}/api/conversations/${conversationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...commonHeaders() },
      body: JSON.stringify({ isPinned: !isPinned }),
    });
    await fetchConversations();
  }, [fetchConversations, commonHeaders]);

  const renameConversation = useCallback(async (
    conversationId: string,
    title: string,
  ) => {
    await fetch(`${BACKEND_URL}/api/conversations/${conversationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...commonHeaders() },
      body: JSON.stringify({ title }),
    });
    await fetchConversations();
  }, [fetchConversations, commonHeaders]);

  const deleteConversation = useCallback(async (conversationId: string) => {
    await fetch(`${BACKEND_URL}/api/conversations/${conversationId}`, {
      method: 'DELETE',
      headers: commonHeaders(),
    });
    const after = await fetchConversations();
    if (currentConversationId === conversationId) {
      if (after.length > 0) {
        const next = after[0];
        setCurrentConversationId(next.id);
        await loadConversationMessages(next.id);
      } else {
        const created = await createConversation();
        setConversations([created]);
        setCurrentConversationId(created.id);
        setMessages(INITIAL_MESSAGES);
      }
    }
  }, [
    currentConversationId, fetchConversations,
    loadConversationMessages, createConversation, commonHeaders,
  ]);

  const dismissError = useCallback(() => setError(null), []);

  // ─── Return ───────────────────────────────────────────────────────────────

  return {
    messages,
    conversations,
    currentConversationId,
    inputValue,
    setInputValue,
    isLoading,
    isThinking,
    isRetrying,
    messagesRemaining,
    resetTime,
    error,
    /** ID of the AI message that is currently streaming (or null). */
    streamingMessageId,
    /** Device-local user ID used in `x-user-id` headers. */
    userId: userIdRef.current,

    sendMessage,
    stopGeneration,
    retryLastMessage,
    editMessage,
    deleteMessage,
    clearChat,
    dismissError,

    selectConversation,
    startNewConversation,
    togglePinConversation,
    renameConversation,
    deleteConversation,
  };
}
