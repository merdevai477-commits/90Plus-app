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
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { getWsUrl } from '../config/api.config';
import { logger } from './logger';
import { WSPayload } from '@/types/websocket';

// Re-export WSPayload for convenience
export type { WSPayload } from '@/types/websocket';

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
  | 'reel_update'
  | 'avatar:progress';

/**
 * WebSocket Message structure (matching backend)
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
  extra?: number | null;
  /** Newly detected timeline events pushed over WS (primary live delivery). */
  newEvents?: import('../services/apiFootball').FixtureEvent[];
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
type EventCallback<T extends WSPayload = WSPayload> = (data: WSMessage<T>) => void;

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
  private isDestroyed = false; // ✅ DRAGON FIX: Track destruction state
  private isManualDisconnect = false;
  private eventListeners: Map<WSEventType, Set<EventCallback>> = new Map();
  private reconnectionConfig: ReconnectionConfig = DEFAULT_RECONNECTION_CONFIG;
  private subscribedRooms: Set<string> = new Set();
  private currentWsUrl: string | null = null;

  // ── Network awareness ───────────────────────────────────────────────
  // When the device loses connectivity we don't want to keep firing
  // socket.io reconnect attempts every second — that floods the console
  // with "xhr poll error" noise and wastes battery. We watch NetInfo;
  // while offline reconnects are paused, and we kick a fresh reconnect as
  // soon as connectivity comes back.
  private isOnline = true;
  private netInfoUnsubscribe: (() => void) | null = null;
  private connectionStateListeners = new Set<(connected: boolean) => void>();

  constructor() {
    this.setupNetInfoListener();
  }

  private setupNetInfoListener(): void {
    if (this.netInfoUnsubscribe) return;
    try {
      // Seed the initial state asynchronously so connect() called before
      // the first NetInfo event still works (we default to online above).
      NetInfo.fetch()
        .then((state) => {
          this.isOnline = !!(state.isConnected && state.isInternetReachable !== false);
        })
        .catch(() => {});

      this.netInfoUnsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
        const next = !!(state.isConnected && state.isInternetReachable !== false);
        const wasOffline = !this.isOnline;
        this.isOnline = next;
        if (next && wasOffline && !this.isDestroyed && !this.isManualDisconnect) {
          // We just came back online — reset the backoff and reconnect now.
          logger.info('[WebSocket] Network restored — reconnecting');
          this.reconnectAttempts = 0;
          if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
          }
          if (this.socket && !this.socket.connected) {
            this.socket.connect();
          } else if (!this.socket) {
            this.connect(this.userId || undefined);
          }
        }
      });
    } catch (err) {
      logger.debug('[WebSocket] NetInfo listener setup failed:', err);
    }
  }

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
      timeout: 30000,
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

      this.notifyConnectionState(true);
    });

    this.socket.on('disconnect', (reason) => {
      logger.debug(`[WebSocket] Disconnected: ${reason}`);
      this.notifyConnectionState(false);

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

      // ✅ Silent when device is offline — DNS/xhr-poll errors are expected
      // and would otherwise flood the console with stack traces every retry.
      if (!this.isOnline) {
        logger.debug('[WebSocket] Connection error (device offline) — waiting for network');
        return;
      }

      // ✅ Check if it's a 502 error (cold start) - reduce noise
      const is502Error = error.message?.includes('502') ||
                         (error as any).description === 502 ||
                         (error as any).context?.status === 502;

      if (is502Error) {
        logger.debug('[WebSocket] Server cold start detected (502) - will retry automatically');
        if (!this.isManualDisconnect) {
          this.attemptReconnect();
        }
        return;
      }

      // Detect DNS / unreachable host failures (typical when WiFi drops mid-
      // request even if NetInfo hasn't fired yet) and downgrade them to debug.
      const errMsg = String(error?.message || '').toLowerCase();
      const ctxResp = String((error as any)?.context?._response || '').toLowerCase();
      const looksLikeNetwork =
        errMsg.includes('network request failed') ||
        errMsg.includes('xhr poll error') ||
        errMsg.includes('timeout') ||
        ctxResp.includes('unable to resolve host') ||
        ctxResp.includes('no address associated');
      if (looksLikeNetwork) {
        logger.debug('[WebSocket] Transient network/timeout — retrying silently');
        if (!this.isManualDisconnect) {
          this.attemptReconnect();
        }
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
      'avatar:progress',
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
   * ✅ DRAGON FIX: Check destruction state before reconnecting
   */
  private attemptReconnect(): void {
    // ✅ Don't reconnect if destroyed
    if (this.isDestroyed || this.isManualDisconnect) {
      logger.debug('[WebSocket] Skipping reconnect - client destroyed or manual disconnect');
      return;
    }

    // ✅ Don't burn through reconnect budget while the device is offline.
    // The NetInfo listener will fire a fresh reconnect as soon as the
    // network comes back.
    if (!this.isOnline) {
      logger.debug('[WebSocket] Skipping reconnect - device is offline');
      return;
    }

    if (this.reconnectAttempts >= this.reconnectionConfig.maxAttempts) {
      logger.debug('[WebSocket] Max reconnection attempts reached - will retry on next app focus');
      return;
    }

    const delay = calculateBackoffDelay(this.reconnectAttempts, this.reconnectionConfig);
    logger.debug(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.reconnectionConfig.maxAttempts})`);

    // ✅ Clear any existing timer before creating new one
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(() => {
      // ✅ Double-check destruction state before reconnecting
      if (this.isDestroyed || this.isManualDisconnect) {
        logger.debug('[WebSocket] Reconnect cancelled - client destroyed');
        return;
      }

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
   * ✅ DRAGON FIX: Proper cleanup with destruction tracking
   */
  disconnect(): void {
    this.isManualDisconnect = true;
    this.isDestroyed = true; // ✅ Mark as destroyed to prevent reconnection

    // ✅ Clear reconnection timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // ✅ Tear down NetInfo listener
    if (this.netInfoUnsubscribe) {
      try { this.netInfoUnsubscribe(); } catch { /* noop */ }
      this.netInfoUnsubscribe = null;
    }

    // ✅ Disconnect socket
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    // Clear userId to prevent stale registration on reconnect
    this.userId = null;
    this.reconnectAttempts = 0;
    this.subscribedRooms.clear();
    logger.info('[WebSocket] Disconnected and destroyed');
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
  subscribe<T extends WSPayload = WSPayload>(
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
   * Subscribe to socket connect/disconnect. Fires immediately with the current state.
   */
  subscribeConnectionState(listener: (connected: boolean) => void): () => void {
    this.connectionStateListeners.add(listener);
    try {
      listener(this.isConnected());
    } catch {
      /* ignore listener errors */
    }
    return () => {
      this.connectionStateListeners.delete(listener);
    };
  }

  private notifyConnectionState(connected: boolean): void {
    for (const listener of this.connectionStateListeners) {
      try {
        listener(connected);
      } catch {
        /* ignore listener errors */
      }
    }
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
