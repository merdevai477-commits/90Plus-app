import type { MatchChatPublicMessage } from '../types/matchChat';

export type MatchChatUiMessage = MatchChatPublicMessage & {
  pending?: boolean;
  failed?: boolean;
};

export type MatchChatConnection = 'idle' | 'connecting' | 'connected' | 'disconnected';

export type MatchChatState = {
  messages: MatchChatUiMessage[];
  connection: MatchChatConnection;
  warning: boolean;
  frozenUntil: number | null;
  unseenCount: number;
  nearBottom: boolean;
  hasMore: boolean;
};

export const initialMatchChatState: MatchChatState = {
  messages: [],
  connection: 'idle',
  warning: false,
  frozenUntil: null,
  unseenCount: 0,
  nearBottom: true,
  hasMore: false,
};

export type MatchChatAction =
  | { type: 'connecting' }
  | { type: 'connected' }
  | { type: 'disconnected' }
  | { type: 'history'; messages: MatchChatPublicMessage[]; missed: MatchChatPublicMessage[]; hasMore: boolean }
  | { type: 'older'; messages: MatchChatPublicMessage[]; hasMore: boolean }
  | { type: 'accepted'; message: MatchChatPublicMessage; ownUserId?: string }
  | { type: 'optimistic'; message: MatchChatUiMessage }
  | { type: 'rejected'; clientMessageId: string }
  | { type: 'deleted'; id: string }
  | { type: 'warned' }
  | { type: 'frozen'; until: number }
  | { type: 'unfrozen' }
  | { type: 'nearBottom'; value: boolean }
  | { type: 'clearUnseen' }
  | { type: 'clearWarning' }
  | { type: 'reset' };

function mergeById(base: MatchChatUiMessage[], incoming: MatchChatPublicMessage[]): MatchChatUiMessage[] {
  const seen = new Set(base.map((m) => m.id));
  const clientSeen = new Set(base.map((m) => m.clientMessageId));
  const next = [...base];
  for (const msg of incoming) {
    if (seen.has(msg.id) || clientSeen.has(msg.clientMessageId)) {
      const idx = next.findIndex((m) => m.id === msg.id || m.clientMessageId === msg.clientMessageId);
      if (idx >= 0) next[idx] = { ...msg, pending: false, failed: false };
      continue;
    }
    next.push(msg);
  }
  next.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  return next;
}

export function matchChatReducer(state: MatchChatState, action: MatchChatAction): MatchChatState {
  switch (action.type) {
    case 'connecting':
      return { ...state, connection: 'connecting' };
    case 'connected':
      return { ...state, connection: 'connected' };
    case 'disconnected':
      return { ...state, connection: 'disconnected' };
    case 'history': {
      const combined = mergeById([], [...action.messages, ...action.missed]);
      return { ...state, messages: combined, hasMore: action.hasMore, unseenCount: 0 };
    }
    case 'older':
      return {
        ...state,
        messages: mergeById(action.messages, state.messages),
        hasMore: action.hasMore,
      };
    case 'optimistic':
      return { ...state, messages: mergeById(state.messages, [action.message]) };
    case 'accepted': {
      const already = state.messages.some(
        (m) => m.id === action.message.id || m.clientMessageId === action.message.clientMessageId,
      );
      const isOwn = Boolean(action.ownUserId && action.message.user.id === action.ownUserId);
      const bumpUnseen = !already && !isOwn && !state.nearBottom;
      return {
        ...state,
        messages: mergeById(state.messages, [action.message]),
        unseenCount: bumpUnseen ? state.unseenCount + 1 : state.unseenCount,
      };
    }
    case 'rejected':
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.clientMessageId === action.clientMessageId ? { ...m, pending: false, failed: true } : m,
        ),
      };
    case 'deleted':
      return { ...state, messages: state.messages.filter((m) => m.id !== action.id) };
    case 'warned':
      return { ...state, warning: true };
    case 'frozen':
      return { ...state, frozenUntil: action.until };
    case 'unfrozen':
      return { ...state, frozenUntil: null };
    case 'nearBottom':
      return {
        ...state,
        nearBottom: action.value,
        unseenCount: action.value ? 0 : state.unseenCount,
      };
    case 'clearUnseen':
      return { ...state, unseenCount: 0, nearBottom: true };
    case 'clearWarning':
      return { ...state, warning: false };
    case 'reset':
      return { ...initialMatchChatState };
    default:
      return state;
  }
}
