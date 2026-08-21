import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuth } from '@clerk/clerk-expo';
import { getWsUrl } from '../config/api.config';
import { getClerkBearerToken } from '../utils/clerkAuthToken';
import { fetchMatchChatHistory, reportMatchChatMessage } from '../services/matchChatApi';
import { logger } from '../services/logger';
import {
  MATCH_CHAT_EVENTS,
  MATCH_CHAT_MAX_LENGTH,
  type MatchChatFrozenPayload,
  type MatchChatHistoryPayload,
  type MatchChatPublicMessage,
  type MatchChatRejectedPayload,
  type MatchChatReportReason,
  type MatchChatWarnedPayload,
} from '../types/matchChat';
import {
  initialMatchChatState,
  matchChatReducer,
  type MatchChatUiMessage,
} from './matchLiveChat.reducer';

type UseMatchLiveChatOptions = {
  matchId: number;
  enabled: boolean;
};

/** UUID v4 without relying on `crypto.getRandomValues` (can fail under Metro/Hermes). */
function clientMessageUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function useMatchLiveChat({ matchId, enabled }: UseMatchLiveChatOptions) {
  const { getToken, isSignedIn, isLoaded, userId: clerkUserId } = useAuth();
  const [state, dispatch] = useReducer(matchChatReducer, initialMatchChatState);
  const [lastError, setLastError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const lastConfirmedIdRef = useRef<string | undefined>(undefined);
  const ownBackendIdRef = useRef<string | undefined>(undefined);
  const loadingOlderRef = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  const signedIn = Boolean(isLoaded && isSignedIn);

  useEffect(() => {
    const last = [...state.messages].reverse().find((m) => !m.pending && !m.failed);
    lastConfirmedIdRef.current = last?.id;
    const own = [...state.messages].reverse().find((m) => m.user && clerkUserId && m.pending);
    if (own) ownBackendIdRef.current = own.user.id;
  }, [state.messages, clerkUserId]);

  useEffect(() => {
    if (!enabled || !signedIn || !matchId) {
      dispatch({ type: 'reset' });
      return;
    }

    let cancelled = false;
    dispatch({ type: 'connecting' });
    setLastError(null);

    const wsBase = getWsUrl();
    const socket = io(`${wsBase}/match-chat`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 12_000,
      timeout: 12_000,
      forceNew: true,
      auth: (cb: (data: { token: string }) => void) => {
        void getClerkBearerToken(getToken)
          .then((token) => {
            if (!token) {
              logger.warn('[match-chat] No Clerk token for socket auth');
            }
            cb({ token: token ?? '' });
          })
          .catch((err) => {
            logger.warn('[match-chat] Token fetch failed', err);
            cb({ token: '' });
          });
      },
    });
    socketRef.current = socket;

    const join = () => {
      socket.emit(MATCH_CHAT_EVENTS.join, {
        matchId,
        lastMessageId: lastConfirmedIdRef.current,
      });
    };

    socket.on('connect', () => {
      if (cancelled) return;
      setLastError(null);
      dispatch({ type: 'connected' });
      join();
      logger.info('[match-chat] Connected', { matchId, wsBase });
    });
    socket.on('disconnect', (reason) => {
      if (cancelled) return;
      dispatch({ type: 'disconnected' });
      logger.warn('[match-chat] Disconnected', { reason });
    });
    socket.on('connect_error', (err) => {
      if (cancelled) return;
      const message = err?.message || 'connect_error';
      setLastError(message);
      dispatch({ type: 'disconnected' });
      logger.warn('[match-chat] Connect error', { message, wsBase });
    });
    socket.on(MATCH_CHAT_EVENTS.history, (payload: MatchChatHistoryPayload) => {
      if (cancelled || payload.matchId !== matchId) return;
      dispatch({
        type: 'history',
        messages: payload.messages ?? [],
        missed: payload.missed ?? [],
        hasMore: Boolean(payload.hasMore),
      });
    });
    socket.on(MATCH_CHAT_EVENTS.accepted, (message: MatchChatPublicMessage) => {
      if (cancelled || message.matchId !== matchId) return;
      const pendingOwn = stateRef.current.messages.some(
        (m) => m.pending && m.clientMessageId === message.clientMessageId,
      );
      if (pendingOwn && message.user?.id) {
        ownBackendIdRef.current = message.user.id;
      }
      dispatch({
        type: 'accepted',
        message,
        ownUserId: ownBackendIdRef.current,
      });
    });
    socket.on(MATCH_CHAT_EVENTS.rejected, (payload: MatchChatRejectedPayload) => {
      if (cancelled) return;
      if (payload.clientMessageId) {
        dispatch({ type: 'rejected', clientMessageId: payload.clientMessageId });
      }
    });
    socket.on(MATCH_CHAT_EVENTS.deleted, (payload: { id: string; matchId: number }) => {
      if (cancelled || payload.matchId !== matchId) return;
      dispatch({ type: 'deleted', id: payload.id });
    });
    socket.on(MATCH_CHAT_EVENTS.warned, (_payload: MatchChatWarnedPayload) => {
      if (cancelled) return;
      dispatch({ type: 'warned' });
    });
    socket.on(MATCH_CHAT_EVENTS.frozen, (payload: MatchChatFrozenPayload) => {
      if (cancelled) return;
      const until = Date.parse(payload.frozenUntil);
      dispatch({ type: 'frozen', until: Number.isFinite(until) ? until : Date.now() + (payload.remainingMs ?? 0) });
    });
    socket.on(MATCH_CHAT_EVENTS.unfrozen, () => {
      if (cancelled) return;
      dispatch({ type: 'unfrozen' });
    });

    return () => {
      cancelled = true;
      socket.emit(MATCH_CHAT_EVENTS.leave, { matchId });
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [enabled, signedIn, matchId, getToken]);

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || trimmed.length > MATCH_CHAT_MAX_LENGTH) return false;
      if (stateRef.current.frozenUntil && stateRef.current.frozenUntil > Date.now()) return false;
      const socket = socketRef.current;
      if (!socket?.connected) return false;

      const clientMessageId = clientMessageUuid();
      const optimistic: MatchChatUiMessage = {
        id: clientMessageId,
        matchId,
        clientMessageId,
        text: trimmed,
        createdAt: new Date().toISOString(),
        pending: true,
        user: {
          id: ownBackendIdRef.current ?? 'me',
          username: '',
          displayName: null,
          avatar: null,
          favoriteTeam: null,
        },
      };
      ownBackendIdRef.current = ownBackendIdRef.current ?? 'me';
      dispatch({ type: 'optimistic', message: optimistic });
      socket.emit(MATCH_CHAT_EVENTS.send, { clientMessageId, text: trimmed, matchId });
      return true;
    },
    [matchId],
  );

  const loadOlder = useCallback(async () => {
    if (loadingOlderRef.current || !state.hasMore || state.messages.length === 0) return;
    loadingOlderRef.current = true;
    try {
      const token = await getClerkBearerToken(getToken);
      if (!token) return;
      const oldest = state.messages[0];
      const page = await fetchMatchChatHistory(token, matchId, oldest.id);
      dispatch({ type: 'older', messages: page.messages, hasMore: page.hasMore });
    } catch {
      // ignore — user can retry by scrolling
    } finally {
      loadingOlderRef.current = false;
    }
  }, [getToken, matchId, state.hasMore, state.messages]);

  const setNearBottom = useCallback((value: boolean) => {
    dispatch({ type: 'nearBottom', value });
  }, []);

  const clearUnseen = useCallback(() => {
    dispatch({ type: 'clearUnseen' });
  }, []);

  const clearWarning = useCallback(() => {
    dispatch({ type: 'clearWarning' });
  }, []);

  const report = useCallback(
    async (messageId: string, reason: MatchChatReportReason) => {
      const token = await getClerkBearerToken(getToken);
      if (!token) throw new Error('AUTH_REQUIRED');
      await reportMatchChatMessage(token, messageId, reason);
    },
    [getToken],
  );

  const frozenRemainingMs = useMemo(() => {
    if (!state.frozenUntil) return 0;
    return Math.max(0, state.frozenUntil - Date.now());
  }, [state.frozenUntil]);

  return {
    ...state,
    signedIn,
    authLoaded: isLoaded,
    lastError,
    send,
    loadOlder,
    setNearBottom,
    clearUnseen,
    clearWarning,
    report,
    frozenRemainingMs,
    ownUserId: ownBackendIdRef.current,
    maxLength: MATCH_CHAT_MAX_LENGTH,
  };
}
