export const MATCH_CHAT_REJECT_CODES = [
  'RATE_LIMITED',
  'FROZEN',
  'INVALID_MESSAGE',
  'MODERATION_BLOCKED',
  'UNAUTHORIZED',
  'MATCH_NOT_AVAILABLE',
  'DUPLICATE',
] as const;

export type MatchChatRejectCode = (typeof MATCH_CHAT_REJECT_CODES)[number];

export type MatchChatModerationCategory =
  | 'CLEAN'
  | 'INSULT'
  | 'PROFANITY'
  | 'HARASSMENT'
  | 'THREAT'
  | 'HATE'
  | 'SEXUAL'
  | 'SPAM'
  | 'ADVERTISEMENT'
  | 'SUSPICIOUS_LINK';

export type MatchChatModerationAction = 'allow' | 'warn' | 'block' | 'freeze';

export type MatchChatReportReason =
  | 'PROFANITY'
  | 'ABUSE'
  | 'HARASSMENT'
  | 'SPAM'
  | 'ADVERTISEMENT'
  | 'SUSPICIOUS_LINK'
  | 'OTHER';

export interface MatchChatAuthor {
  id: string;
  username: string;
  displayName: string | null;
  avatar: string | null;
  favoriteTeam: string | null;
}

export interface MatchChatReplyTo {
  messageId: string;
  text: string;
  user: {
    username: string;
    displayName: string | null;
  };
}

export interface MatchChatPublicMessage {
  id: string;
  matchId: number;
  clientMessageId: string;
  text: string;
  createdAt: string;
  user: MatchChatAuthor;
  replyTo?: MatchChatReplyTo;
}

export interface MatchChatJoinPayload {
  matchId: number;
  lastMessageId?: string;
}

export interface MatchChatSendPayload {
  clientMessageId: string;
  text: string;
  matchId: number;
  replyToMessageId?: string;
}

export interface MatchChatRejectedPayload {
  clientMessageId?: string;
  code: MatchChatRejectCode;
  retryAfterMs?: number;
  reason?: string;
}

export interface MatchChatHistoryPayload {
  matchId: number;
  messages: MatchChatPublicMessage[];
  missed: MatchChatPublicMessage[];
  hasMore: boolean;
}

export interface MatchChatWarnedPayload {
  remainingStrikesUntilFreeze: number;
  category: MatchChatModerationCategory;
}

export interface MatchChatFrozenPayload {
  frozenUntil: string;
  remainingMs: number;
}

export interface MatchChatDeletedPayload {
  id: string;
  matchId: number;
}

export interface MatchChatSocketUser {
  userId: string;
  clerkUserId: string;
  username: string;
  displayName: string | null;
  avatar: string | null;
  favoriteTeam: string | null;
}

export interface MatchChatIdempotencyRecord {
  kind: 'accepted' | 'rejected';
  message?: MatchChatPublicMessage;
  code?: MatchChatRejectCode;
  reason?: string;
}

export const MATCH_CHAT_EVENTS = {
  join: 'chat:join',
  leave: 'chat:leave',
  send: 'message:send',
  accepted: 'message:accepted',
  rejected: 'message:rejected',
  deleted: 'message:deleted',
  history: 'message:history',
  warned: 'user:warned',
  frozen: 'user:frozen',
  unfrozen: 'user:unfrozen',
  error: 'error',
} as const;
