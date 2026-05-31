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
  /** True while the assistant message is actively receiving SSE tokens. */
  isStreaming?: boolean;
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
  limit?: number;
  resetAt?: string;
  usedModel?: string;
  /** Set when the server auto-titles the conversation from the first message. */
  conversationTitle?: string;
}
interface SSEError { error: string; done?: boolean }
type SSEData = SSEToken | SSEDone | SSEError;

// ─── Constants ────────────────────────────────────────────────────────────────

const BACKEND_URL = API_CONFIG.baseUrl;
const MAX_STREAM_RETRIES = 2;
const RETRY_DELAY_MS = 2000;
const DRAFT_KEY_PREFIX = '@chat_draft_v1_';
/** Fallback when API omits `limit` — must match production CHAT_DAILY_MESSAGE_LIMIT. */
const DEFAULT_DAILY_MESSAGE_LIMIT = 10;

/**
 * Typing renderer cadence — independent from network speed.
 *
 * The model can dump multiple paragraphs in a single SSE event. Rendering
 * them straight to React state produces "block dumps" instead of typing.
 * We split chunks into words, queue them, and reveal a few per tick. This
 * mirrors ChatGPT's progressive feel.
 *
 * Adaptive speed:
 *   - Small backlog  → 1 word per tick (slow, deliberate typing)
 *   - Medium backlog → 2-3 words per tick (normal speed)
 *   - Large backlog  → 4-8 words per tick (catch up so we don't fall behind)
 *   - Network done   → 6-12 words per tick (drain remaining queue smoothly)
 */
const TYPING_TICK_MS = 25;
const TYPING_BACKLOG_LARGE = 60;   // queue length above which we accelerate
const TYPING_BACKLOG_HUGE = 200;   // queue length above which we sprint
const TYPING_DRAIN_TICK_MS = 16;   // post-done, slightly faster ticks
const CODE_BLOCK_REGEX = /```|\|/;

export interface ChatLabels {
  initialWelcome: string;
  streamRetry: (current: number, max: number) => string;
  streamRetryFailed: string;
  noActiveConversation: string;
  exportUserLabel: string;
  exportAiLabel: string;
}

const FALLBACK_LABELS: ChatLabels = {
  initialWelcome: "Hey there! I'm 90Plus AI — ask me anything about football or performance. How can I help today?",
  streamRetry: (current, max) => `Connection lost — retrying ${current}/${max}...`,
  streamRetryFailed: 'Connection failed after several attempts. Tap Retry.',
  noActiveConversation: 'No active conversation.',
  exportUserLabel: 'You',
  exportAiLabel: '90Plus AI',
};

function buildInitialMessages(welcome: string): Message[] {
  return [
    {
      id: '1',
      role: 'ai',
      text: welcome,
      time: '9:41',
    },
  ];
}

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

/**
 * Split an incoming text chunk into "typing units" — typically words plus
 * the whitespace/newline that follows them, so we always reveal `word + ` `
 * together (no orphan spaces appearing on screen). Works for Arabic,
 * English, mixed scripts, and preserves markdown structure characters like
 * `\n`, `|`, ` ``` ` because they are kept attached to their token.
 *
 * Examples:
 *   "Hello world"   → ["Hello ", "world"]
 *   "السلام عليكم"  → ["السلام ", "عليكم"]
 *   "line1\nline2"  → ["line1\n", "line2"]
 *   "```\ncode"     → ["```\n", "code"]
 */
function tokenizeForTyping(input: string): string[] {
  if (!input) return [];
  // Match one of:
  //   - run of non-whitespace followed by an optional whitespace burst
  //   - or a run of whitespace alone (covers leading/trailing whitespace)
  const re = /\S+\s*|\s+/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(input)) !== null) {
    if (m[0]) out.push(m[0]);
  }
  return out;
}

/**
 * Monotonically-increasing message-id generator. We were using
 * `Date.now()` and `Date.now() + 1` for the user/AI pair, which collides
 * when the system clock doesn't advance between the two calls (the AI id
 * for one message can equal the user id of the next). FlatList then sees
 * two children with the same key and warns.
 *
 * The counter guarantees uniqueness within a single session; the
 * timestamp prefix keeps ids stable-ish for debugging.
 */
let _msgIdCounter = 0;
function genMessageId(): string {
  _msgIdCounter += 1;
  return `${Date.now().toString(36)}-${_msgIdCounter.toString(36)}`;
}

// ─── Hook options ─────────────────────────────────────────────────────────────

export interface UseAIChatOptions {
  /**
   * Optional function invoked right before each outgoing request. Return a
   * string to append to the server-built system prompt (the backend merges
   * it on top of its own rules). Return null/undefined to skip personalization.
   */
  getSystemPromptSuffix?: () => string | null | undefined;
  /** Localized strings for welcome message, errors, and export labels. */
  getChatLabels?: () => ChatLabels;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAIChatNative(options: UseAIChatOptions = {}) {
  const { getSystemPromptSuffix, getChatLabels } = options;
  const suffixBuilderRef = useRef<UseAIChatOptions['getSystemPromptSuffix']>(getSystemPromptSuffix);
  const labelsBuilderRef = useRef<UseAIChatOptions['getChatLabels']>(getChatLabels);
  useEffect(() => {
    suffixBuilderRef.current = getSystemPromptSuffix;
  }, [getSystemPromptSuffix]);
  useEffect(() => {
    labelsBuilderRef.current = getChatLabels;
  }, [getChatLabels]);

  const getLabels = useCallback((): ChatLabels => {
    try {
      return labelsBuilderRef.current?.() ?? FALLBACK_LABELS;
    } catch {
      return FALLBACK_LABELS;
    }
  }, []);

  const getInitialMessages = useCallback((): Message[] => {
    return buildInitialMessages(getLabels().initialWelcome);
  }, [getLabels]);

  const userIdRef = useRef<string>('');
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const abortRef = useRef(false);
  const lastIndexRef = useRef(0);
  // Track partial text for resume on disconnect
  const partialTextRef = useRef<string>('');
  const retryCountRef = useRef(0);
  // ─── Streaming pipeline (decoupled network ↔ UI) ────────────────────────
  // The network feed (SSE) and the visible typing speed are two separate
  // loops:
  //
  //   SSE chunk → tokenize() → visibleTypingQueueRef → tick() → setMessages
  //
  // rawStreamBufferRef holds the raw SSE text exactly as received (used as
  // the source of truth for resume + draft saving). visibleTypingQueueRef
  // holds tokenized words/whitespace waiting to be revealed on screen.
  const rawStreamBufferRef = useRef<string>('');
  const visibleTypingQueueRef = useRef<string[]>([]);
  const typingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const networkDoneRef = useRef(false);
  const pendingDoneCallbackRef = useRef<(() => void) | null>(null);
  const activeAssistantMessageIdRef = useRef<string | null>(null);

  const [messages, setMessages] = useState<Message[]>(() => buildInitialMessages(FALLBACK_LABELS.initialWelcome));
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  // `null` = we have not yet fetched the real limit from the backend. The UI
  // renders a neutral placeholder instead of a misleading hardcoded number.
  const [messagesRemaining, setMessagesRemaining] = useState<number | null>(null);
  const [dailyMessageLimit, setDailyMessageLimit] = useState<number | null>(null);
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
      if (typingTimerRef.current) {
        clearInterval(typingTimerRef.current);
        typingTimerRef.current = null;
      }
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
        const data = await res.json() as { remaining: number; limit?: number; resetAt?: string };
        setMessagesRemaining(data.remaining);
        setDailyMessageLimit(
          typeof data.limit === 'number' && data.limit > 0
            ? data.limit
            : DEFAULT_DAILY_MESSAGE_LIMIT,
        );
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
      body: JSON.stringify({}),
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
      ...getInitialMessages(),
      ...(data.messages ?? []).map(m => ({
        id: m.id,
        role: m.role,
        text: m.text,
        time: formatTime(m.createdAt),
      })),
    ];
    setMessages(loaded);
  }, [commonHeaders, getInitialMessages]);

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
      setMessages(getInitialMessages());
      await Storage.saveLastConversationId(created.id);
    } catch {
      // warn only — don't crash the chat screen on a transient failure
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchConversations, createConversation, loadConversationMessages]);

  // ─── Streaming pipeline helpers ───────────────────────────────────────────

  /**
   * Choose how many typing units to reveal this tick. Adaptive so that
   * a long response speeds up automatically without feeling frozen, and
   * a short reply still types out at a human pace.
   */
  const computeWordsPerTick = useCallback((queueLen: number): number => {
    if (networkDoneRef.current) {
      // Drain phase — finish smoothly but quickly. Bigger steps for huge
      // tails so a 5000-char essay doesn't take forever after `done`.
      if (queueLen > TYPING_BACKLOG_HUGE) return 12;
      if (queueLen > TYPING_BACKLOG_LARGE) return 8;
      return 6;
    }
    if (queueLen > TYPING_BACKLOG_HUGE) return 8;
    if (queueLen > TYPING_BACKLOG_LARGE) return 4;
    if (queueLen > 20) return 3;
    if (queueLen > 8) return 2;
    return 1;
  }, []);

  /** One typing tick — pull a few tokens off the queue and apply to state. */
  const typingTick = useCallback(() => {
    const queue = visibleTypingQueueRef.current;
    const id = activeAssistantMessageIdRef.current;

    if (!id) {
      // No active assistant message — nothing to do. Stop the timer.
      if (typingTimerRef.current) {
        clearInterval(typingTimerRef.current);
        typingTimerRef.current = null;
      }
      return;
    }

    if (queue.length === 0) {
      // Queue empty — only finish if the network signaled done.
      if (networkDoneRef.current) {
        if (typingTimerRef.current) {
          clearInterval(typingTimerRef.current);
          typingTimerRef.current = null;
        }
        // Mark the message as no longer streaming and run the deferred
        // done callback (which clears UI loading flags etc.).
        setMessages(prev =>
          prev.map(m => (m.id === id ? { ...m, isStreaming: false } : m)),
        );
        activeAssistantMessageIdRef.current = null;
        const cb = pendingDoneCallbackRef.current;
        pendingDoneCallbackRef.current = null;
        cb?.();
      }
      // Otherwise keep the timer alive — more SSE tokens may arrive.
      return;
    }

    let stepCount = computeWordsPerTick(queue.length);
    // If the next tokens contain a code-block fence or table pipe, render
    // them in larger chunks so the UI doesn't feel stuck on structural
    // characters (no point typing a row separator letter-by-letter).
    if (CODE_BLOCK_REGEX.test(queue.slice(0, 3).join(''))) {
      stepCount = Math.max(stepCount, 4);
    }

    const piece = queue.splice(0, stepCount).join('');
    if (!piece) return;

    // First visible word lands now — kill the thinking indicator. We compare
    // against a non-whitespace check so leading newlines/spaces don't count
    // as "first word".
    if (piece.trim().length > 0) {
      setIsThinking(false);
    }

    setMessages(prev =>
      prev.map(m =>
        m.id === id
          ? { ...m, text: m.text + piece, isStreaming: true }
          : m,
      ),
    );
  }, [computeWordsPerTick]);

  const ensureTypingTimer = useCallback(() => {
    if (typingTimerRef.current) return;
    const interval = networkDoneRef.current ? TYPING_DRAIN_TICK_MS : TYPING_TICK_MS;
    typingTimerRef.current = setInterval(typingTick, interval);
  }, [typingTick]);

  /**
   * Push a freshly received SSE chunk into the typing queue. Splits the
   * chunk into words+whitespace so we reveal one word at a time, never
   * mid-word.
   */
  const enqueueStreamChunk = useCallback((chunk: string) => {
    if (!chunk) return;
    rawStreamBufferRef.current += chunk;
    const tokens = tokenizeForTyping(chunk);
    if (tokens.length > 0) {
      visibleTypingQueueRef.current.push(...tokens);
    }
    ensureTypingTimer();
  }, [ensureTypingTimer]);

  /**
   * Network finished sending tokens — switch the typing renderer into
   * drain mode and arrange a callback to fire once the visible queue is
   * fully rendered. This is what keeps `isStreaming` true until the user
   * has actually seen every word.
   */
  const completeStreaming = useCallback((onAllRendered: () => void) => {
    networkDoneRef.current = true;
    pendingDoneCallbackRef.current = onAllRendered;

    // Speed up the renderer for the drain phase.
    if (typingTimerRef.current) {
      clearInterval(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    if (visibleTypingQueueRef.current.length > 0) {
      typingTimerRef.current = setInterval(typingTick, TYPING_DRAIN_TICK_MS);
    } else {
      // Nothing queued — finish immediately.
      const id = activeAssistantMessageIdRef.current;
      if (id) {
        setMessages(prev =>
          prev.map(m => (m.id === id ? { ...m, isStreaming: false } : m)),
        );
      }
      activeAssistantMessageIdRef.current = null;
      pendingDoneCallbackRef.current = null;
      onAllRendered();
    }
  }, [typingTick]);

  /**
   * Hard-stop the typing renderer (used by stopGeneration / clearChat /
   * conversation switch / retry). Keeps whatever's already on screen,
   * drops the unrendered queue, and resets all pipeline refs.
   */
  const stopTypingPipeline = useCallback(() => {
    if (typingTimerRef.current) {
      clearInterval(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    rawStreamBufferRef.current = '';
    visibleTypingQueueRef.current = [];
    networkDoneRef.current = false;
    pendingDoneCallbackRef.current = null;

    const id = activeAssistantMessageIdRef.current;
    if (id) {
      setMessages(prev =>
        prev.map(m => (m.id === id ? { ...m, isStreaming: false } : m)),
      );
    }
    activeAssistantMessageIdRef.current = null;
  }, []);

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
            // We deliberately do NOT flip isThinking off here. The thinking
            // indicator should only disappear once the typing renderer has
            // painted the first visible word — which can happen a tick or
            // two after the first SSE token arrives. typingTick handles
            // that flip via setIsThinking(false) on first paint.
            setIsRetrying(false);
            partialTextRef.current += event.token;
            // Push into the typing queue. The renderer (typingTick) reveals
            // it word-by-word at its own cadence — independent of how fast
            // the network feeds us.
            enqueueStreamChunk(event.token);
          }

          if ('done' in event && event.done) {
            const doneEvent = event as SSEDone;
            if (doneEvent.remaining !== undefined) setMessagesRemaining(doneEvent.remaining);
            if (typeof doneEvent.limit === 'number' && doneEvent.limit > 0) {
              setDailyMessageLimit(doneEvent.limit);
            }
            if (doneEvent.resetAt) setResetTime(new Date(doneEvent.resetAt));
            const usedModel = doneEvent.usedModel;
            const finishedConvId = conversationId;
            const autoTitle = doneEvent.conversationTitle?.trim();
            if (autoTitle && finishedConvId) {
              setConversations(prev =>
                prev.map(c =>
                  c.id === finishedConvId ? { ...c, title: autoTitle } : c,
                ),
              );
            }
            // Tag the model on the message immediately — independent of how
            // long the typing renderer takes to drain.
            if (usedModel && activeAssistantMessageIdRef.current) {
              const targetId = activeAssistantMessageIdRef.current;
              setMessages(prev =>
                prev.map(m => (m.id === targetId ? { ...m, usedModel } : m)),
              );
            }
            // Tell the renderer to drain remaining tokens and call us back
            // once every visible word has been rendered.
            completeStreaming(() => {
              if (finishedConvId) {
                AsyncStorage.removeItem(`${DRAFT_KEY_PREFIX}${finishedConvId}`).catch(() => {});
              }
              retryCountRef.current = 0;
            });
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
        stopTypingPipeline();
        setIsLoading(false);
        setIsThinking(false);
        setIsRetrying(false);
        setStreamingMessageId(null);
        return;
      }
      // Drain remaining queue, then clear UI state. If `done` already fired
      // inside onreadystatechange the renderer will be in drain mode and
      // this just chains another drain callback (idempotent — the queue
      // empties once and the message is finalised once).
      completeStreaming(() => {
        setIsLoading(false);
        setIsThinking(false);
        setIsRetrying(false);
        setStreamingMessageId(null);
        fetchConversations().catch(() => {});
        fetchLimit().catch(() => {});
      });
    };

    const handleDisconnect = () => {
      if (abortRef.current) return;

      // partialTextRef is the source of truth for resume — it tracks the
      // raw network text, not the visible queue. Save the current value
      // before we touch the typing pipeline.
      const partial = partialTextRef.current;

      // Save draft for resume
      if (partial.length > 0 && conversationId) {
        AsyncStorage.setItem(`${DRAFT_KEY_PREFIX}${conversationId}`, partial).catch(() => {});
      }

      if (retryCountRef.current < MAX_STREAM_RETRIES) {
        retryCountRef.current++;
        setIsRetrying(true);
        const labels = getLabels();
        setError(labels.streamRetry(retryCountRef.current, MAX_STREAM_RETRIES));

        // Pause the typing renderer between attempts. The visible queue
        // can keep what's already buffered — when the next chunk arrives
        // the timer is restarted by enqueueStreamChunk.
        if (typingTimerRef.current) {
          clearInterval(typingTimerRef.current);
          typingTimerRef.current = null;
        }
        // The next attempt is a fresh stream, so the network is no longer
        // "done" — clear that flag.
        networkDoneRef.current = false;
        pendingDoneCallbackRef.current = null;

        setTimeout(() => {
          if (abortRef.current) return;
          setError(null);
          _sendSSE(trimmed, history, conversationId, aiMessageId, systemPromptSuffix, partial.length);
        }, RETRY_DELAY_MS);
      } else {
        // All retries exhausted — finalize whatever's already on screen,
        // drop the unrendered queue, and surface the error.
        stopTypingPipeline();
        setIsLoading(false);
        setIsThinking(false);
        setIsRetrying(false);
        setStreamingMessageId(null);
        setMessagesRemaining(prev => (prev === null ? prev : prev + 1));
        setError(getLabels().streamRetryFailed);
        retryCountRef.current = 0;
      }
    };

    xhr.onerror = handleDisconnect;
    xhr.ontimeout = handleDisconnect;
    xhr.timeout = 60_000;
    xhr.send(body);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commonHeaders, fetchConversations, fetchLimit, enqueueStreamChunk, completeStreaming, stopTypingPipeline]);

  // ─── Send Message ─────────────────────────────────────────────────────────

  const sendMessage = useCallback(async (text?: string, historyBase?: Message[]) => {
    const messageText = text ?? inputValue;
    const trimmed = messageText.trim();
    if (!trimmed || isLoading) return;
    if (messagesRemaining !== null && messagesRemaining <= 0) return;

    const base = historyBase ?? messages;

    setError(null);
    abortRef.current = false;
    abortXHR();
    partialTextRef.current = '';
    retryCountRef.current = 0;
    // Reset the streaming pipeline for the new message.
    rawStreamBufferRef.current = '';
    visibleTypingQueueRef.current = [];
    networkDoneRef.current = false;
    pendingDoneCallbackRef.current = null;
    if (typingTimerRef.current) {
      clearInterval(typingTimerRef.current);
      typingTimerRef.current = null;
    }

    const aiMessageId = genMessageId();
    activeAssistantMessageIdRef.current = aiMessageId;
    setStreamingMessageId(aiMessageId);

    const userMsg: Message = {
      id: genMessageId(),
      role: 'user',
      text: trimmed,
      time: now(),
    };
    const assistantPlaceholder: Message = {
      id: aiMessageId,
      role: 'ai',
      text: '',
      time: now(),
      isStreaming: true,
    };
    if (historyBase) {
      setMessages([...historyBase, userMsg, assistantPlaceholder]);
    } else {
      setMessages(prev => [...prev, userMsg, assistantPlaceholder]);
    }
    setInputValue('');
    setIsLoading(true);
    setIsThinking(true);
    setMessagesRemaining(prev => (prev === null ? prev : Math.max(0, prev - 1)));

    if (!currentConversationId) {
      setError(getLabels().noActiveConversation);
      setIsLoading(false);
      setIsThinking(false);
      setStreamingMessageId(null);
      activeAssistantMessageIdRef.current = null;
      setMessagesRemaining(prev => (prev === null ? prev : prev + 1));
      return;
    }

    const history = toHistoryFormat(base.slice(1));

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
    // Hard-stop the typing renderer. Keeps the partial text already on
    // screen, drops the unrendered queue.
    stopTypingPipeline();
    setMessagesRemaining(prev => (prev === null ? prev : prev + 1));
    setIsLoading(false);
    setIsThinking(false);
    setIsRetrying(false);
    setStreamingMessageId(null);
    retryCountRef.current = 0;
  }, [abortXHR, stopTypingPipeline]);

  // ─── Retry ────────────────────────────────────────────────────────────────

  const retryLastMessage = useCallback(() => {
    const lastUserIdx = messages.map((_, i) => i).reverse().find(i => messages[i].role === 'user');
    if (lastUserIdx === undefined) return;
    const text = messages[lastUserIdx].text;
    const base = messages.slice(0, lastUserIdx);

    setError(null);
    abortRef.current = false;
    abortXHR();
    partialTextRef.current = '';
    retryCountRef.current = 0;
    rawStreamBufferRef.current = '';
    visibleTypingQueueRef.current = [];
    networkDoneRef.current = false;
    pendingDoneCallbackRef.current = null;
    if (typingTimerRef.current) {
      clearInterval(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    setStreamingMessageId(null);
    setIsRetrying(false);
    setIsLoading(false);
    setIsThinking(false);

    sendMessage(text, base);
  }, [messages, sendMessage, abortXHR]);

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
    // Tear down the typing pipeline before resetting messages.
    stopTypingPipeline();
    setMessages(getInitialMessages());
    setInputValue('');
    setIsLoading(false);
    setIsThinking(false);
    setIsRetrying(false);
    setStreamingMessageId(null);
    setError(null);
    retryCountRef.current = 0;
    fetchLimit().catch(() => {});
  }, [abortXHR, fetchLimit, stopTypingPipeline]);

  // ─── Conversation Management ──────────────────────────────────────────────

  const selectConversation = useCallback(async (conversationId: string) => {
    // If a stream is currently rendering, stop it before switching context.
    abortRef.current = true;
    abortXHR();
    stopTypingPipeline();
    setIsLoading(false);
    setIsThinking(false);
    setIsRetrying(false);
    setStreamingMessageId(null);
    retryCountRef.current = 0;
    setCurrentConversationId(conversationId);
    await loadConversationMessages(conversationId);
    await Storage.saveLastConversationId(conversationId);
  }, [loadConversationMessages, abortXHR, stopTypingPipeline]);

  const startNewConversation = useCallback(async () => {
    const created = await createConversation();
    await fetchConversations();
    setCurrentConversationId(created.id);
    setMessages(getInitialMessages());
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
        setMessages(getInitialMessages());
      }
    }
  }, [
    currentConversationId, fetchConversations,
    loadConversationMessages, createConversation, commonHeaders,
  ]);

  const dismissError = useCallback(() => setError(null), []);

  const exportConversationText = useCallback(async (conversationId: string): Promise<string> => {
    const labels = getLabels();
    const formatLines = (rows: Array<{ role: 'user' | 'ai'; text: string }>) =>
      rows
        .map(m => `${m.role === 'user' ? labels.exportUserLabel : labels.exportAiLabel}: ${m.text}`)
        .join('\n\n');

    if (conversationId === currentConversationId) {
      return formatLines(messages.slice(1).map(m => ({ role: m.role, text: m.text })));
    }

    const res = await fetch(
      `${BACKEND_URL}/api/conversations/${conversationId}/messages`,
      { headers: commonHeaders() },
    );
    if (!res.ok) throw new Error('Failed to load messages');
    const data = await res.json() as {
      messages: Array<{ role: 'user' | 'ai'; text: string }>;
    };
    return formatLines(data.messages ?? []);
  }, [currentConversationId, messages, commonHeaders, getLabels]);

  // Refresh welcome bubble when locale labels change (before user sends).
  useEffect(() => {
    const welcome = getLabels().initialWelcome;
    setMessages(prev => {
      if (prev.length === 1 && prev[0].id === '1' && prev[0].role === 'ai' && !prev[0].isStreaming) {
        return buildInitialMessages(welcome);
      }
      return prev;
    });
  }, [getLabels]);

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
    dailyMessageLimit,
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
    exportConversationText,
  };
}
