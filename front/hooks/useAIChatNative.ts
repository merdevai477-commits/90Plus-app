/**
 * useAIChatNative.ts
 * Core chat hook for React Native — SSE streaming via XMLHttpRequest.
 *
 * Talks to chat-backend (simple-server.ts). The backend streams SSE on /api/chat/stream (not WebSockets).
 * XMLHttpRequest exposes incremental responseText on React Native via onreadystatechange.
 *
 * Protocol:
 *   POST /api/chat/stream → SSE
 *   data: {"token": "..."}\n\n
 *   data: {"done": true, "remaining": N, "resetAt": "..."}\n\n
 *   data: {"error": "...", "done": true}\n\n
 *   HTTP 429 → {"error": "...", "code": "LIMIT_REACHED", "resetAt": "..."}
 */

import { useCallback, useEffect, useRef, useState } from 'react';
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

interface SSEToken {
  token: string;
}

interface SSEDone {
  done: true;
  remaining?: number;
  resetAt?: string;
  usedModel?: string;
}

interface SSEError {
  error: string;
  done?: boolean;
}

type SSEData = SSEToken | SSEDone | SSEError;

// ─── Constants ────────────────────────────────────────────────────────────────

const BACKEND_URL = API_CONFIG.baseUrl;

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
  if (lastNewline === -1) {
    return { events: [], newIndex: lastIndex };
  }

  const completeText = newText.slice(0, lastNewline + 1);
  const lines = completeText.split('\n');
  const events: SSEData[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('data: ')) {
      const jsonStr = trimmed.slice(6).trim();
      if (jsonStr) {
        try {
          const parsed = JSON.parse(jsonStr) as SSEData;
          events.push(parsed);
        } catch {
          // malformed line — skip
        }
      }
    }
  }

  return { events, newIndex: lastIndex + lastNewline + 1 };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAIChatNative() {
  const userIdRef = useRef<string>('');
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const abortRef = useRef(false);
  const lastIndexRef = useRef(0);

  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [messagesRemaining, setMessagesRemaining] = useState(5);
  const [resetTime, setResetTime] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ─── Init ────────────────────────────────────────────────────────────────

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const id = await Storage.getUserId();
      if (!mounted) return;
      userIdRef.current = id;
      await fetchLimit();
      await bootstrapConversation();
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

  // ─── REST helpers ─────────────────────────────────────────────────────────

  const fetchLimit = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/chat/limit`, {
        headers: { 'x-user-id': userIdRef.current },
      });
      if (res.ok) {
        const data = await res.json() as { remaining: number; resetAt?: string };
        setMessagesRemaining(data.remaining);
        if (data.remaining === 0 && data.resetAt) {
          setResetTime(new Date(data.resetAt));
        }
      }
    } catch {
      console.warn('[useAIChatNative] Backend not reachable, using local limit');
    }
  }, []);

  const fetchConversations = useCallback(async (): Promise<Conversation[]> => {
    const res = await fetch(`${BACKEND_URL}/api/conversations`, {
      headers: { 'x-user-id': userIdRef.current },
    });
    if (!res.ok) throw new Error('Failed to fetch conversations');
    const data = await res.json() as { conversations: Conversation[] };
    const convs = data.conversations ?? [];
    setConversations(convs);
    return convs;
  }, []);

  const createConversation = useCallback(async (): Promise<Conversation> => {
    const res = await fetch(`${BACKEND_URL}/api/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userIdRef.current,
      },
      body: JSON.stringify({ title: 'New chat' }),
    });
    if (!res.ok) throw new Error('Failed to create conversation');
    const data = await res.json() as { conversation: Conversation };
    return data.conversation;
  }, []);

  const loadConversationMessages = useCallback(async (conversationId: string) => {
    const res = await fetch(
      `${BACKEND_URL}/api/conversations/${conversationId}/messages`,
      { headers: { 'x-user-id': userIdRef.current } },
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
  }, []);

  const bootstrapConversation = useCallback(async () => {
    try {
      const existing = await fetchConversations();
      if (existing.length > 0) {
        const first = existing[0];
        setCurrentConversationId(first.id);
        await loadConversationMessages(first.id);
        await Storage.saveLastConversationId(first.id);
        return;
      }
      const created = await createConversation();
      setCurrentConversationId(created.id);
      setConversations([created]);
      setMessages(INITIAL_MESSAGES);
      await Storage.saveLastConversationId(created.id);
    } catch {
      console.warn('[useAIChatNative] Could not bootstrap conversations');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchConversations, createConversation, loadConversationMessages]);

  // ─── Send Message via SSE (XMLHttpRequest) ────────────────────────────────

  const sendMessage = useCallback(async (text?: string) => {
    const messageText = text ?? inputValue;
    const trimmed = messageText.trim();

    if (!trimmed || isLoading || messagesRemaining <= 0) return;

    setError(null);
    abortRef.current = false;
    abortXHR();

    // Optimistic: add user message immediately
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

    // Optimistic counter decrement
    setMessagesRemaining(prev => Math.max(0, prev - 1));

    if (!currentConversationId) {
      setError('No active conversation.');
      setIsLoading(false);
      setIsThinking(false);
      setMessagesRemaining(prev => prev + 1);
      return;
    }

    const aiMessageId = (Date.now() + 1).toString();
    lastIndexRef.current = 0;

    // ── Build history from current messages (before the new user msg) ──────
    const history = toHistoryFormat(
      messages.filter(m => m.id !== userMsg.id).slice(1),
    );

    const body = JSON.stringify({
      message: trimmed,
      history,
      conversationId: currentConversationId,
    });

    // ── XMLHttpRequest SSE streaming ──────────────────────────────────────
    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;

    xhr.open('POST', `${BACKEND_URL}/api/chat/stream`, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('x-user-id', userIdRef.current);

    // Called repeatedly as data arrives
    xhr.onreadystatechange = () => {
      if (abortRef.current) return;

      // HEADERS_RECEIVED — check for 429
      if (xhr.readyState === XMLHttpRequest.HEADERS_RECEIVED) {
        if (xhr.status === 429) {
          try {
            // Body might not be available yet — will handle in onload
          } catch {
            // ignore
          }
        }
      }

      // LOADING — streaming data is arriving
      if (xhr.readyState === XMLHttpRequest.LOADING || xhr.readyState === XMLHttpRequest.DONE) {
        if (xhr.status === 429) return; // handled in onload

        const { events, newIndex } = parseSSEChunk(
          xhr.responseText,
          lastIndexRef.current,
        );

        if (newIndex === lastIndexRef.current) return;
        lastIndexRef.current = newIndex;

        for (const event of events) {
          if (abortRef.current) break;

          if ('token' in event && event.token) {
            // First token — hide thinking indicator
            setIsThinking(false);
            setMessages(prev => {
              const exists = prev.some(m => m.id === aiMessageId);
              if (!exists) {
                return [
                  ...prev,
                  { id: aiMessageId, role: 'ai' as const, text: event.token, time: now() },
                ];
              }
              return prev.map(m =>
                m.id === aiMessageId ? { ...m, text: m.text + event.token } : m,
              );
            });
          }

          if ('done' in event && event.done) {
            const doneEvent = event as SSEDone;
            if (doneEvent.remaining !== undefined) {
              setMessagesRemaining(doneEvent.remaining);
            }
            if (doneEvent.resetAt) {
              setResetTime(new Date(doneEvent.resetAt));
            }
            if (doneEvent.usedModel) {
              setMessages(prev =>
                prev.map(m =>
                  m.id === aiMessageId ? { ...m, usedModel: doneEvent.usedModel } : m,
                ),
              );
            }
          }

          if ('error' in event && event.error && !('token' in event)) {
            setError(event.error);
            setMessagesRemaining(prev => prev + 1);
          }
        }
      }
    };

    xhr.onload = () => {
      if (abortRef.current) return;

      // Handle 429 limit reached
      if (xhr.status === 429) {
        try {
          const errData = JSON.parse(xhr.responseText) as {
            error: string;
            resetAt?: string;
          };
          setMessagesRemaining(0);
          if (errData.resetAt) setResetTime(new Date(errData.resetAt));
          setError('You’ve reached your daily message limit.');
        } catch {
          setError('You’ve reached your daily message limit.');
          setMessagesRemaining(0);
        }
        setIsLoading(false);
        setIsThinking(false);
        return;
      }

      // Stream complete — refresh data in background
      setIsLoading(false);
      setIsThinking(false);
      fetchConversations().catch(() => {});
      fetchLimit().catch(() => {});
    };

    xhr.onerror = () => {
      if (abortRef.current) return;
      setError('Connection error. Please try again.');
      setMessagesRemaining(prev => prev + 1);
      setIsLoading(false);
      setIsThinking(false);
    };

    xhr.ontimeout = () => {
      if (abortRef.current) return;
      setError('Request timed out. Please try again.');
      setMessagesRemaining(prev => prev + 1);
      setIsLoading(false);
      setIsThinking(false);
    };

    xhr.timeout = 60_000; // 60 seconds max

    xhr.send(body);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    inputValue,
    isLoading,
    messagesRemaining,
    currentConversationId,
    messages,
    abortXHR,
    fetchConversations,
    fetchLimit,
  ]);

  // ─── Stop Generation ──────────────────────────────────────────────────────

  const stopGeneration = useCallback(() => {
    abortRef.current = true;
    abortXHR();
    // Rollback optimistic counter
    setMessagesRemaining(prev => prev + 1);
    setIsLoading(false);
    setIsThinking(false);
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

  // ─── Delete Message ───────────────────────────────────────────────────────

  const deleteMessage = useCallback((messageId: string) => {
    setMessages(prev => prev.filter(m => m.id !== messageId));
  }, []);

  // ─── Clear Chat ───────────────────────────────────────────────────────────

  const clearChat = useCallback(() => {
    abortRef.current = true;
    abortXHR();
    setMessages(INITIAL_MESSAGES);
    setInputValue('');
    setIsLoading(false);
    setIsThinking(false);
    setError(null);
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
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userIdRef.current,
      },
      body: JSON.stringify({ isPinned: !isPinned }),
    });
    await fetchConversations();
  }, [fetchConversations]);

  const renameConversation = useCallback(async (
    conversationId: string,
    title: string,
  ) => {
    await fetch(`${BACKEND_URL}/api/conversations/${conversationId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userIdRef.current,
      },
      body: JSON.stringify({ title }),
    });
    await fetchConversations();
  }, [fetchConversations]);

  const deleteConversation = useCallback(async (conversationId: string) => {
    await fetch(`${BACKEND_URL}/api/conversations/${conversationId}`, {
      method: 'DELETE',
      headers: { 'x-user-id': userIdRef.current },
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
    currentConversationId,
    fetchConversations,
    loadConversationMessages,
    createConversation,
  ]);

  const dismissError = useCallback(() => setError(null), []);

  // ─── Return ───────────────────────────────────────────────────────────────

  return {
    // State
    messages,
    conversations,
    currentConversationId,
    inputValue,
    setInputValue,
    isLoading,
    isThinking,
    messagesRemaining,
    resetTime,
    error,

    // Actions
    sendMessage,
    stopGeneration,
    retryLastMessage,
    editMessage,
    deleteMessage,
    clearChat,
    dismissError,

    // Conversation management
    selectConversation,
    startNewConversation,
    togglePinConversation,
    renameConversation,
    deleteConversation,
  };
}
