/**
 * WebSocket Hook
 * 
 * Provides easy access to WebSocket functionality in React components.
 * Handles subscription lifecycle automatically with useEffect cleanup.
 * 
 * Requirements: 21.1, 21.5
 * - 21.1: Access WebSocket connection
 * - 21.5: Subscribe to events and update UI
 */

import { useEffect, useCallback, useState } from 'react';
import {
  websocketClient,
  WSEventType,
  WSMessage,
  NotificationPayload,
  CommentPayload,
  ReplyPayload,
  LikePayload,
  FollowPayload,
  MatchUpdatePayload,
} from '../services/websocketClient';

/**
 * Hook to check WebSocket connection status
 */
export function useWebSocketStatus(): boolean {
  const [isConnected, setIsConnected] = useState(websocketClient.isConnected());

  useEffect(() => {
    // Check connection status periodically
    const interval = setInterval(() => {
      setIsConnected(websocketClient.isConnected());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return isConnected;
}

/**
 * Hook to subscribe to a specific WebSocket event
 * Automatically handles cleanup on unmount
 */
export function useWebSocketEvent<T = unknown>(
  eventType: WSEventType,
  callback: (data: WSMessage<T>) => void
): void {
  useEffect(() => {
    const unsubscribe = websocketClient.subscribe<T>(eventType, callback);
    return unsubscribe;
  }, [eventType, callback]);
}

/**
 * Hook to subscribe to notification events
 */
export function useNotificationEvents(
  callback: (notification: NotificationPayload) => void
): void {
  const handleNotification = useCallback(
    (message: WSMessage<NotificationPayload>) => {
      callback(message.payload);
    },
    [callback]
  );

  useWebSocketEvent('notification', handleNotification);
}

/**
 * Hook to subscribe to comment events
 */
export function useCommentEvents(
  callback: (comment: CommentPayload) => void
): void {
  const handleComment = useCallback(
    (message: WSMessage<CommentPayload>) => {
      callback(message.payload);
    },
    [callback]
  );

  useWebSocketEvent('comment', handleComment);
}

/**
 * Hook to subscribe to reply events
 */
export function useReplyEvents(
  callback: (reply: ReplyPayload) => void
): void {
  const handleReply = useCallback(
    (message: WSMessage<ReplyPayload>) => {
      callback(message.payload);
    },
    [callback]
  );

  useWebSocketEvent('reply', handleReply);
}

/**
 * Hook to subscribe to like events
 */
export function useLikeEvents(
  callback: (like: LikePayload) => void
): void {
  const handleLike = useCallback(
    (message: WSMessage<LikePayload>) => {
      callback(message.payload);
    },
    [callback]
  );

  useWebSocketEvent('like', handleLike);
}

/**
 * Hook to subscribe to follow events
 */
export function useFollowEvents(
  callback: (follow: FollowPayload) => void
): void {
  const handleFollow = useCallback(
    (message: WSMessage<FollowPayload>) => {
      callback(message.payload);
    },
    [callback]
  );

  useWebSocketEvent('follow', handleFollow);
}

/**
 * Hook to subscribe to match update events
 * Requirement 21.5: Live match score updates
 */
export function useMatchUpdateEvents(
  matchId: number | null,
  callback: (update: MatchUpdatePayload) => void
): void {
  // Subscribe to match room when matchId is provided
  useEffect(() => {
    if (matchId !== null) {
      const room = `match:${matchId}`;
      websocketClient.subscribeToRoom(room);

      return () => {
        websocketClient.unsubscribeFromRoom(room);
      };
    }
  }, [matchId]);

  const handleMatchUpdate = useCallback(
    (message: WSMessage<MatchUpdatePayload>) => {
      // Only call callback if this update is for our match
      if (matchId !== null && message.payload.matchId === matchId) {
        callback(message.payload);
      }
    },
    [matchId, callback]
  );

  useWebSocketEvent('match_update', handleMatchUpdate);
}

/**
 * Hook to subscribe to reel-specific events (likes, comments)
 */
export function useReelEvents(
  reelId: string | null,
  callbacks: {
    onLike?: (like: LikePayload) => void;
    onComment?: (comment: CommentPayload) => void;
    onReply?: (reply: ReplyPayload) => void;
  }
): void {
  // Subscribe to reel room when reelId is provided
  useEffect(() => {
    if (reelId) {
      const room = `reel:${reelId}`;
      websocketClient.subscribeToRoom(room);

      return () => {
        websocketClient.unsubscribeFromRoom(room);
      };
    }
  }, [reelId]);

  // Handle like events
  const handleLike = useCallback(
    (message: WSMessage<LikePayload>) => {
      if (reelId && message.payload.reelId === reelId && callbacks.onLike) {
        callbacks.onLike(message.payload);
      }
    },
    [reelId, callbacks.onLike]
  );

  // Handle comment events
  const handleComment = useCallback(
    (message: WSMessage<CommentPayload>) => {
      if (reelId && message.payload.reelId === reelId && callbacks.onComment) {
        callbacks.onComment(message.payload);
      }
    },
    [reelId, callbacks.onComment]
  );

  // Handle reply events
  const handleReply = useCallback(
    (message: WSMessage<ReplyPayload>) => {
      if (reelId && message.payload.reelId === reelId && callbacks.onReply) {
        callbacks.onReply(message.payload);
      }
    },
    [reelId, callbacks.onReply]
  );

  useWebSocketEvent('like', handleLike);
  useWebSocketEvent('comment', handleComment);
  useWebSocketEvent('reply', handleReply);
}

export default {
  useWebSocketStatus,
  useWebSocketEvent,
  useNotificationEvents,
  useCommentEvents,
  useReplyEvents,
  useLikeEvents,
  useFollowEvents,
  useMatchUpdateEvents,
  useReelEvents,
};
