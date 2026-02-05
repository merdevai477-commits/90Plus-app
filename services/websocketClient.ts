/**
 * WebSocket Client Service
 * 
 * Provides real-time communication with the backend WebSocket server.
 * Implements connect, disconnect, subscribe, send with automatic reconnection.
 * 
 * Requirements: 21.1, 21.6
 * - 21.1: Establish WebSocket connection on app start
 * - 21.6: Automatically reconnect with exponential backoff
 */

import { io, Socket } from 'socket.io-client';
import { getWsUrl } from '../config/api.config';
import { logger } from './logger';

/**
 * WebSocket Event Types (matching backend)
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
 * WebSocket Message structure (matching backend)
 */
export interface WSMessage<T = unknown> {
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
    user: { id: string; username: string; avatar?: string };
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
    user: { id: string; username: string; avatar?: string };
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
 * Reconnection configuration
 * Requirement 21.6: Exponential backoff for reconnection
 */
export interface ReconnectionConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

/**
 * Default reconnection configuration
 */
const DEFAULT_RECONNECTION_CONFIG: ReconnectionConfig = {
  maxAttempts: 10,
  baseDelay: 1000,      // 1 second
  maxDelay: 30000,      // 30 seconds max
  backoffMultiplier: 2,
};

/**
 * Event callback type
 */
type EventCallback<T = unknown> = (data: WSMessage<T>) => void;

/**
 * Calculate delay with exponential backoff
 * Requirement 21.6: Exponential backoff
 */
export function calculateBackoffDelay(
  attempt: number,
  config: ReconnectionConfig
): number {
  const delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt);
  return Math.min(delay, config.maxDelay);
}

/**
 * WebSocket Client Class
 * Manages WebSocket connection with automatic reconnection
 */
class WebSocketClient {
  private socket: Socket | null = null;
  private userId: string | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isManualDisconnect = false;
  private eventListeners: Map<WSEventType, Set<EventCallback>> = new Map();
  private reconnectionConfig: ReconnectionConfig = DEFAULT_RECONNECTION_CONFIG;
  private subscribedRooms: Set<string> = new Set();
  private currentWsUrl: string | null = null;

  /**
   * Connect to the WebSocket server
   * Requirement 21.1: Establish WebSocket connection
   */
  connect(userId?: string): void {
    if (this.socket?.connected) {
      logger.debug('[WebSocket] Already connected');
      return;
    }

    this.isManualDisconnect = false;
    this.userId = userId || null;

    const wsUrl = getWsUrl();
    this.currentWsUrl = wsUrl;
    
    // ✅ Skip WebSocket connection if using localhost (development without backend)
    if (wsUrl.includes('localhost') || wsUrl.includes('127.0.0.1')) {
      logger.info('[WebSocket] Skipping connection - localhost detected (backend not running)');
      return;
    }
    
    logger.info(`[WebSocket] Connecting to ${wsUrl}`);

    this.socket = io(wsUrl, {
      transports: ['polling', 'websocket'], // Try polling first, then upgrade to websocket
      autoConnect: true,
      reconnection: false, // We handle reconnection manually for exponential backoff
      timeout: 20000,
      forceNew: true, // Force new connection
      upgrade: true, // Allow transport upgrades
      rememberUpgrade: false, // Don't remember upgrade preference
      path: '/socket.io/', // Socket.IO default path
      withCredentials: true, // Include credentials for CORS
    });

    this.setupEventHandlers();
  }

  /**
   * Setup socket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      logger.info('[WebSocket] Connected successfully');
      this.reconnectAttempts = 0;

      // Register user if userId is set
      if (this.userId) {
        this.registerUser(this.userId);
      }

      // Re-subscribe to rooms
      this.subscribedRooms.forEach(room => {
        this.socket?.emit('subscribe', room);
      });
    });

    this.socket.on('disconnect', (reason) => {
      logger.debug(`[WebSocket] Disconnected: ${reason}`);

      if (!this.isManualDisconnect) {
        this.attemptReconnect();
      }
    });

    this.socket.on('connect_error', (error) => {
      // ✅ Silent logging for localhost - don't spam console
      if (this.currentWsUrl?.includes('localhost') || this.currentWsUrl?.includes('127.0.0.1')) {
        logger.debug('[WebSocket] Connection error (localhost - backend not running)');
        return;
      }
      
      // Log detailed error information for debugging (production only)
      const errorDetails: Record<string, unknown> = {
        message: error.message,
        wsUrl: this.currentWsUrl || getWsUrl(),
        error: error.toString(),
      };
      
      // Add optional Socket.IO-specific properties if they exist
      if ('type' in error) errorDetails.type = (error as any).type;
      if ('description' in error) errorDetails.description = (error as any).description;
      if ('context' in error) errorDetails.context = (error as any).context;
      
      logger.error('[WebSocket] Connection error:', errorDetails);

      if (!this.isManualDisconnect) {
        this.attemptReconnect();
      }
    });

    // Suppress generic error events (they're noisy in development)
    this.socket.on('error', (error) => {
      logger.debug('[WebSocket] Socket error:', error);
    });

    // Setup event type handlers
    const eventTypes: WSEventType[] = [
      'notification',
      'comment',
      'reply',
      'like',
      'follow',
      'match_update',
      'reel_update',
    ];

    eventTypes.forEach(eventType => {
      this.socket?.on(eventType, (message: WSMessage) => {
        this.handleEvent(eventType, message);
      });
    });
  }

  /**
   * Handle incoming events and notify subscribers
   */
  private handleEvent(eventType: WSEventType, message: WSMessage): void {
    logger.debug(`[WebSocket] Received ${eventType} event`);
    
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(message);
        } catch (error) {
          logger.error(`[WebSocket] Error in ${eventType} handler:`, error);
        }
      });
    }
  }

  /**
   * Attempt to reconnect with exponential backoff
   * Requirement 21.6: Automatically reconnect with exponential backoff
   */
  private attemptReconnect(): void {
    if (this.isManualDisconnect) {
      return;
    }

    if (this.reconnectAttempts >= this.reconnectionConfig.maxAttempts) {
      logger.debug('[WebSocket] Max reconnection attempts reached - will retry on next app focus');
      return;
    }

    const delay = calculateBackoffDelay(this.reconnectAttempts, this.reconnectionConfig);
    logger.debug(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.reconnectionConfig.maxAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      
      if (this.socket) {
        this.socket.connect();
      } else {
        this.connect(this.userId || undefined);
      }
    }, delay);
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    this.isManualDisconnect = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    // Clear userId to prevent stale registration on reconnect
    this.userId = null;
    this.reconnectAttempts = 0;
    this.subscribedRooms.clear();
    logger.info('[WebSocket] Disconnected');
  }

  /**
   * Register user with the server
   */
  registerUser(userId: string): void {
    this.userId = userId;
    
    if (this.socket?.connected) {
      this.socket.emit('register', userId);
      logger.debug(`[WebSocket] Registered user: ${userId}`);
    }
  }

  /**
   * Subscribe to an event type
   * Returns an unsubscribe function
   */
  subscribe<T = unknown>(
    eventType: WSEventType,
    callback: EventCallback<T>
  ): () => void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }

    const listeners = this.eventListeners.get(eventType)!;
    listeners.add(callback as EventCallback);

    logger.debug(`[WebSocket] Subscribed to ${eventType}`);

    // Return unsubscribe function
    return () => {
      listeners.delete(callback as EventCallback);
      logger.debug(`[WebSocket] Unsubscribed from ${eventType}`);
    };
  }

  /**
   * Subscribe to a room (e.g., for match updates)
   */
  subscribeToRoom(room: string): void {
    this.subscribedRooms.add(room);
    
    if (this.socket?.connected) {
      this.socket.emit('subscribe', room);
      logger.debug(`[WebSocket] Subscribed to room: ${room}`);
    }
  }

  /**
   * Unsubscribe from a room
   */
  unsubscribeFromRoom(room: string): void {
    this.subscribedRooms.delete(room);
    
    if (this.socket?.connected) {
      this.socket.emit('unsubscribe', room);
      logger.debug(`[WebSocket] Unsubscribed from room: ${room}`);
    }
  }

  /**
   * Send a message to the server
   */
  send(event: string, data: unknown): void {
    if (!this.socket?.connected) {
      logger.warn('[WebSocket] Cannot send - not connected');
      return;
    }

    this.socket.emit(event, data);
    logger.debug(`[WebSocket] Sent ${event}`);
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  /**
   * Get current reconnection attempt count
   */
  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  /**
   * Set custom reconnection configuration
   */
  setReconnectionConfig(config: Partial<ReconnectionConfig>): void {
    this.reconnectionConfig = { ...this.reconnectionConfig, ...config };
  }

  /**
   * Get current reconnection configuration
   */
  getReconnectionConfig(): ReconnectionConfig {
    return { ...this.reconnectionConfig };
  }

  /**
   * Reset reconnection attempts (useful after successful connection)
   */
  resetReconnectAttempts(): void {
    this.reconnectAttempts = 0;
  }

  // ============================================
  // CONVENIENCE METHODS FOR MATCH UPDATES
  // Requirement 21.5: Live match score updates
  // ============================================

  /**
   * Subscribe to match score updates for a specific match
   * Requirement 21.5: WHEN a live match score changes THEN the WebSocket SHALL push the update to subscribed users
   * 
   * @param matchId - The match ID to subscribe to
   * @param callback - Callback function to handle match updates
   * @returns Unsubscribe function that removes both room and event subscriptions
   */
  subscribeToMatchUpdates(
    matchId: number,
    callback: (update: MatchUpdatePayload) => void
  ): () => void {
    const room = `match:${matchId}`;
    
    // Subscribe to the match room
    this.subscribeToRoom(room);
    
    // Subscribe to match_update events and filter by matchId
    const unsubscribeEvent = this.subscribe<MatchUpdatePayload>(
      'match_update',
      (message) => {
        if (message.payload.matchId === matchId) {
          callback(message.payload);
        }
      }
    );

    logger.debug(`[WebSocket] Subscribed to match updates for match ${matchId}`);

    // Return combined unsubscribe function
    return () => {
      this.unsubscribeFromRoom(room);
      unsubscribeEvent();
      logger.debug(`[WebSocket] Unsubscribed from match updates for match ${matchId}`);
    };
  }

  /**
   * Subscribe to all match updates (useful for match list views)
   * 
   * @param callback - Callback function to handle any match update
   * @returns Unsubscribe function
   */
  subscribeToAllMatchUpdates(
    callback: (update: MatchUpdatePayload) => void
  ): () => void {
    return this.subscribe<MatchUpdatePayload>(
      'match_update',
      (message) => callback(message.payload)
    );
  }
}

// Export singleton instance
export const websocketClient = new WebSocketClient();

// Export class for testing
export { WebSocketClient };

export default websocketClient;
