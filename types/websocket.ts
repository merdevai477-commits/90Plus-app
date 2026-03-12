/**
 * WebSocket Type Definitions
 * 
 * Defines all WebSocket event types and payloads for type safety
 */

/**
 * Base WebSocket payload types
 */
export type WSPayload = 
  | NotificationPayload
  | CommentPayload
  | ReplyPayload
  | LikePayload
  | FollowPayload
  | MatchUpdatePayload
  | ReelUpdatePayload;

/**
 * WebSocket Event Types
 */
export type WSEventType =
  | 'notification'
  | 'comment'
  | 'reply'
  | 'like'
  | 'follow'
  | 'match_update'
  | 'reel_update';

/**
 * WebSocket Message structure
 */
export interface WSMessage<T extends WSPayload = WSPayload> {
  type: WSEventType;
  payload: T;
  timestamp: number;
}

/**
 * Notification Payload
 */
export interface NotificationPayload {
  id: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

/**
 * Comment Payload
 */
export interface CommentPayload {
  reelId: string;
  comment: {
    id: string;
    content: string;
    user: {
      id: string;
      username: string;
      avatar?: string;
    };
    createdAt: string;
  };
}

/**
 * Reply Payload
 */
export interface ReplyPayload {
  reelId: string;
  parentCommentId: string;
  reply: {
    id: string;
    content: string;
    user: {
      id: string;
      username: string;
      avatar?: string;
    };
    createdAt: string;
  };
}

/**
 * Like Payload
 */
export interface LikePayload {
  reelId: string;
  likesCount: number;
  userId: string;
  action: 'like' | 'unlike';
}

/**
 * Follow Payload
 */
export interface FollowPayload {
  followerId: string;
  followingId: string;
  followerUsername: string;
  action: 'follow' | 'unfollow';
}

/**
 * Match Update Payload
 */
export interface MatchUpdatePayload {
  matchId: number;
  homeScore: number;
  awayScore: number;
  status: string;
  minute?: number;
}

/**
 * Reel Update Payload
 */
export interface ReelUpdatePayload {
  reelId: string;
  action: 'created' | 'updated' | 'deleted';
  userId: string;
}
