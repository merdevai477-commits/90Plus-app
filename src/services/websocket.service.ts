import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { logger } from '../utils/logger';
import { MatchChatGateway } from './match-chat/match-chat.gateway';

/**
 * WebSocket Event Types
 * Requirements: 21.2, 21.3, 21.4, 21.5, 21.8, 21.9
 */
export type WSEventType =
    | 'notification'
    | 'comment'
    | 'reply'
    | 'like'
    | 'follow'
    | 'match_update'
    | 'reel_update'
    // Real-time upload progress for the active client. Used by the avatar
    // upload UI to render a percentage during the multi-stage server-side
    // pipeline (received -> R2 -> DB).
    | 'avatar:progress';

/**
 * WebSocket Message Payload Interface
 */
export interface WSMessage<T = any> {
    type: WSEventType;
    payload: T;
    timestamp: number;
}

/**
 * Notification Payload
 * Requirements: 21.2
 */
export interface NotificationPayload {
    id: string;
    type: string;
    title: string;
    message: string;
    data?: Record<string, any>;
}

/**
 * Comment Payload
 * Requirements: 21.3, 21.9
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
 * Requirements: 21.3
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
 * Requirements: 21.8
 */
export interface LikePayload {
    reelId: string;
    likesCount: number;
    userId: string;
    action: 'like' | 'unlike';
}

/**
 * Follow Payload
 * Requirements: 21.4
 */
export interface FollowPayload {
    followerId: string;
    followingId: string;
    followerUsername: string;
    action: 'follow' | 'unfollow';
}

/**
 * Match Update Payload
 * Requirements: 21.5
 */
export interface MatchUpdatePayload {
    matchId: number;
    homeScore: number;
    awayScore: number;
    status: string;
    minute?: number;
    /** Injury/stoppage minutes; null clears stoppage on FT. */
    extra?: number | null;
}

/**
 * WebSocket Service
 * Handles real-time communication between server and clients
 * Requirements: 21.1
 */
export class WebSocketService {
    private static io: Server | null = null;
    private static userSockets: Map<string, Set<string>> = new Map(); // userId -> Set of socketIds
    private static socketUsers: Map<string, string> = new Map(); // socketId -> userId

    /**
     * Initialize WebSocket server with HTTP server
     * Requirements: 21.1
     */
    static initialize(server: HttpServer): Server {
        if (this.io) {
            logger.warn('WebSocket server already initialized');
            return this.io;
        }

        // Get CORS origins from environment (same as Express CORS)
        const isProduction = process.env.NODE_ENV === 'production';
        const corsOrigins = isProduction
            ? [
                  process.env.CORS_ORIGIN || 'https://90plus.pro',
                  'https://90plus.pro',
                  'https://90plus.app',
                  /^https:\/\/.*\.90plus\.app$/,
                  /^https:\/\/.*\.90plus\.pro$/,
                  /^https:\/\/.*\.railway\.app$/,
                  /^https:\/\/.*\.up\.railway\.app$/,
              ]
            : [
                  process.env.CORS_ORIGIN || 'http://localhost:8081',
                  'http://192.168.1.7:8081',
                  'http://localhost:3000',
                  'exp://192.168.1.7:8081',
                  /^https:\/\/.*\.ngrok-free\.app$/,
                  /^https:\/\/.*\.ngrok\.io$/,
                  /^https:\/\/.*\.ngrok\.app$/,
                  /^https:\/\/.*\.railway\.app$/,
                  /^https:\/\/.*\.up\.railway\.app$/,
                  /^ninetyplusapp:\/\//,
              ];

        this.io = new Server(server, {
            cors: {
                origin: corsOrigins,
                credentials: true,
                methods: ['GET', 'POST'],
            },
            pingTimeout: 60000,
            pingInterval: 25000,
            transports: ['websocket', 'polling'], // Support both transports
        });

        this.setupEventHandlers();
        MatchChatGateway.attach(this.io);
        logger.info('✅ WebSocket server initialized');

        return this.io;
    }

    /**
     * Setup WebSocket event handlers
     */
    private static setupEventHandlers(): void {
        if (!this.io) return;

        this.io.on('connection', (socket: Socket) => {
            logger.info(`WebSocket client connected: ${socket.id}`);

            // Handle user authentication/registration
            socket.on('register', (userId: string) => {
                this.registerUser(socket.id, userId);
                logger.info(`User ${userId} registered with socket ${socket.id}`);
            });

            // Handle room subscriptions (e.g., for match updates)
            socket.on('subscribe', (room: string) => {
                socket.join(room);
                logger.debug(`Socket ${socket.id} joined room: ${room}`);
            });

            socket.on('unsubscribe', (room: string) => {
                socket.leave(room);
                logger.debug(`Socket ${socket.id} left room: ${room}`);
            });

            // Handle disconnection
            socket.on('disconnect', (reason) => {
                this.unregisterSocket(socket.id);
                logger.info(`WebSocket client disconnected: ${socket.id}, reason: ${reason}`);
            });

            // Handle errors
            socket.on('error', (error) => {
                logger.error(`WebSocket error for ${socket.id}:`, error);
            });
        });
    }

    /**
     * Register a user with their socket
     */
    private static registerUser(socketId: string, userId: string): void {
        // Add socket to user's set of sockets
        if (!this.userSockets.has(userId)) {
            this.userSockets.set(userId, new Set());
        }
        this.userSockets.get(userId)!.add(socketId);

        // Map socket to user
        this.socketUsers.set(socketId, userId);
    }

    /**
     * Unregister a socket when disconnected
     */
    private static unregisterSocket(socketId: string): void {
        const userId = this.socketUsers.get(socketId);
        if (userId) {
            const userSocketSet = this.userSockets.get(userId);
            if (userSocketSet) {
                userSocketSet.delete(socketId);
                if (userSocketSet.size === 0) {
                    this.userSockets.delete(userId);
                }
            }
        }
        this.socketUsers.delete(socketId);
    }

    /**
     * Broadcast event to all connected clients
     */
    static broadcast<T>(event: WSEventType, data: T): void {
        if (!this.io) {
            logger.warn('WebSocket server not initialized, cannot broadcast');
            return;
        }

        const message: WSMessage<T> = {
            type: event,
            payload: data,
            timestamp: Date.now(),
        };

        this.io.emit(event, message);
        logger.debug(`Broadcast ${event} to all clients`);
    }

    /**
     * Send event to a specific user (all their connected sockets)
     */
    static sendToUser<T>(userId: string, event: WSEventType, data: T): void {
        if (!this.io) {
            logger.warn('WebSocket server not initialized, cannot send to user');
            return;
        }

        const userSocketIds = this.userSockets.get(userId);
        if (!userSocketIds || userSocketIds.size === 0) {
            logger.debug(`User ${userId} not connected, event ${event} not delivered`);
            return;
        }

        const message: WSMessage<T> = {
            type: event,
            payload: data,
            timestamp: Date.now(),
        };

        for (const socketId of userSocketIds) {
            this.io.to(socketId).emit(event, message);
        }
        logger.debug(`Sent ${event} to user ${userId} (${userSocketIds.size} sockets)`);
    }

    /**
     * Send event to a specific room (e.g., match room for live updates)
     */
    static sendToRoom<T>(room: string, event: WSEventType, data: T): void {
        if (!this.io) {
            logger.warn('WebSocket server not initialized, cannot send to room');
            return;
        }

        const message: WSMessage<T> = {
            type: event,
            payload: data,
            timestamp: Date.now(),
        };

        this.io.to(room).emit(event, message);
        logger.debug(`Sent ${event} to room ${room}`);
    }

    /**
     * Get the Socket.IO server instance
     */
    static getIO(): Server | null {
        return this.io;
    }

    /**
     * Check if a user is connected
     */
    static isUserConnected(userId: string): boolean {
        const sockets = this.userSockets.get(userId);
        return !!sockets && sockets.size > 0;
    }

    /**
     * Get count of connected users
     */
    static getConnectedUsersCount(): number {
        return this.userSockets.size;
    }

    /**
     * Get count of total connections
     */
    static getTotalConnectionsCount(): number {
        return this.socketUsers.size;
    }

    // ============================================
    // CONVENIENCE METHODS FOR SPECIFIC EVENTS
    // ============================================

    /**
     * Send notification to a user
     * Requirements: 21.2
     */
    static sendNotification(userId: string, notification: NotificationPayload): void {
        this.sendToUser(userId, 'notification', notification);
    }

    /**
     * Send comment event to reel owner
     * Requirements: 21.3, 21.9
     */
    static sendComment(reelOwnerId: string, comment: CommentPayload): void {
        this.sendToUser(reelOwnerId, 'comment', comment);
    }

    /**
     * Send reply event to comment owner
     * Requirements: 21.3
     */
    static sendReply(commentOwnerId: string, reply: ReplyPayload): void {
        this.sendToUser(commentOwnerId, 'reply', reply);
    }

    /**
     * Send like update to reel owner and broadcast to viewers
     * Requirements: 21.8
     */
    static sendLikeUpdate(reelOwnerId: string, like: LikePayload): void {
        this.sendToUser(reelOwnerId, 'like', like);
        // Also broadcast to the reel room for real-time like count updates
        this.sendToRoom(`reel:${like.reelId}`, 'like', like);
    }

    /**
     * Send follow event to the followed user
     * Requirements: 21.4
     */
    static sendFollowUpdate(followedUserId: string, follow: FollowPayload): void {
        this.sendToUser(followedUserId, 'follow', follow);
    }

    /**
     * Send match update to subscribed users
     * Requirements: 21.5
     */
    static sendMatchUpdate(matchId: number, update: MatchUpdatePayload): void {
        this.sendToRoom(`match:${matchId}`, 'match_update', update);
    }

    /**
     * Cleanup and shutdown WebSocket server
     */
    static shutdown(): void {
        if (this.io) {
            void import('./match-chat/match-chat.adapter').then(({ closeRedisAdapter }) =>
                closeRedisAdapter(),
            );
            this.io.close();
            this.io = null;
            this.userSockets.clear();
            this.socketUsers.clear();
            logger.info('WebSocket server shut down');
        }
    }
}

export default WebSocketService;
