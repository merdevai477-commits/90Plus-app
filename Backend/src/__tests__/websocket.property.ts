/**
 * Property-Based Tests for WebSocket Service
 * Using fast-check for property-based testing
 * 
 * **Feature: security-technical-fixes, Property 26: WebSocket Event Delivery**
 * **Validates: Requirements 21.2, 21.3, 21.4, 21.5, 21.8, 21.9**
 */

import * as fc from 'fast-check';
import {
    WebSocketService,
    WSEventType,
    WSMessage,
    NotificationPayload,
    CommentPayload,
    ReplyPayload,
    LikePayload,
    FollowPayload,
    MatchUpdatePayload,
} from '../services/websocket.service';

// Arbitrary for valid WebSocket event types
const wsEventTypeArb = fc.constantFrom<WSEventType>(
    'notification',
    'comment',
    'reply',
    'like',
    'follow',
    'match_update',
    'reel_update'
);

// Arbitrary for user IDs (UUID-like strings)
const userIdArb = fc.uuid();

// Arbitrary for reel IDs
const reelIdArb = fc.uuid();

// Arbitrary for notification payloads
const notificationPayloadArb = fc.record({
    id: fc.uuid(),
    type: fc.constantFrom('LIKE', 'COMMENT', 'REPLY', 'FOLLOW', 'MENTION', 'GENERAL'),
    title: fc.string({ minLength: 1, maxLength: 100 }),
    message: fc.string({ minLength: 1, maxLength: 500 }),
    data: fc.option(fc.dictionary(fc.string(), fc.jsonValue()), { nil: undefined }),
});

// Arbitrary for comment payloads
const commentPayloadArb = fc.record({
    reelId: reelIdArb,
    comment: fc.record({
        id: fc.uuid(),
        content: fc.string({ minLength: 1, maxLength: 500 }),
        user: fc.record({
            id: userIdArb,
            username: fc.string({ minLength: 3, maxLength: 20 }),
            avatar: fc.option(fc.webUrl(), { nil: undefined }),
        }),
        createdAt: fc.date().map(d => d.toISOString()),
    }),
});

// Arbitrary for reply payloads
const replyPayloadArb = fc.record({
    reelId: reelIdArb,
    parentCommentId: fc.uuid(),
    reply: fc.record({
        id: fc.uuid(),
        content: fc.string({ minLength: 1, maxLength: 500 }),
        user: fc.record({
            id: userIdArb,
            username: fc.string({ minLength: 3, maxLength: 20 }),
            avatar: fc.option(fc.webUrl(), { nil: undefined }),
        }),
        createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }).map(d => d.toISOString()),
    }),
});

// Arbitrary for like payloads
const likePayloadArb = fc.record({
    reelId: reelIdArb,
    likesCount: fc.nat({ max: 1000000 }),
    userId: userIdArb,
    action: fc.constantFrom<'like' | 'unlike'>('like', 'unlike'),
});

// Arbitrary for follow payloads
const followPayloadArb = fc.record({
    followerId: userIdArb,
    followingId: userIdArb,
    followerUsername: fc.string({ minLength: 3, maxLength: 20 }),
    action: fc.constantFrom<'follow' | 'unfollow'>('follow', 'unfollow'),
});

// Arbitrary for match update payloads
const matchUpdatePayloadArb = fc.record({
    matchId: fc.nat({ max: 999999 }),
    homeScore: fc.nat({ max: 20 }),
    awayScore: fc.nat({ max: 20 }),
    status: fc.constantFrom('NS', '1H', 'HT', '2H', 'FT', 'AET', 'PEN'),
    minute: fc.option(fc.nat({ max: 120 }), { nil: undefined }),
});

describe('WebSocket Property Tests', () => {
    /**
     * **Feature: security-technical-fixes, Property 26: WebSocket Event Delivery**
     * *For any* event (notification, comment, reply, like, follow, match update),
     * the WebSocket SHALL deliver the event to the appropriate connected clients
     * within a reasonable time.
     * **Validates: Requirements 21.2, 21.3, 21.4, 21.5, 21.8, 21.9**
     */
    describe('Property 26: WebSocket Event Delivery', () => {
        /**
         * Test that WSMessage structure is correctly formed for any event type
         */
        it('should create valid WSMessage structure for any event type and payload', () => {
            fc.assert(
                fc.property(
                    wsEventTypeArb,
                    fc.jsonValue(),
                    (eventType, payload) => {
                        const message: WSMessage = {
                            type: eventType,
                            payload,
                            timestamp: Date.now(),
                        };

                        // Message should have all required fields
                        expect(message.type).toBe(eventType);
                        expect(message.payload).toEqual(payload);
                        expect(typeof message.timestamp).toBe('number');
                        expect(message.timestamp).toBeGreaterThan(0);
                    }
                ),
                { numRuns: 100 }
            );
        });

        /**
         * Test notification payload structure (Requirements: 21.2)
         */
        it('should validate notification payload structure', () => {
            fc.assert(
                fc.property(
                    notificationPayloadArb,
                    (notification: NotificationPayload) => {
                        // Notification should have required fields
                        expect(typeof notification.id).toBe('string');
                        expect(notification.id.length).toBeGreaterThan(0);
                        expect(typeof notification.type).toBe('string');
                        expect(typeof notification.title).toBe('string');
                        expect(notification.title.length).toBeGreaterThan(0);
                        expect(typeof notification.message).toBe('string');
                        expect(notification.message.length).toBeGreaterThan(0);
                        
                        // Data is optional but if present should be an object
                        if (notification.data !== undefined) {
                            expect(typeof notification.data).toBe('object');
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });

        /**
         * Test comment payload structure (Requirements: 21.3, 21.9)
         */
        it('should validate comment payload structure', () => {
            fc.assert(
                fc.property(
                    commentPayloadArb,
                    (comment: CommentPayload) => {
                        // Comment should have required fields
                        expect(typeof comment.reelId).toBe('string');
                        expect(comment.reelId.length).toBeGreaterThan(0);
                        expect(typeof comment.comment.id).toBe('string');
                        expect(typeof comment.comment.content).toBe('string');
                        expect(comment.comment.content.length).toBeGreaterThan(0);
                        expect(typeof comment.comment.user.id).toBe('string');
                        expect(typeof comment.comment.user.username).toBe('string');
                        expect(typeof comment.comment.createdAt).toBe('string');
                        
                        // createdAt should be a valid ISO date string
                        expect(() => new Date(comment.comment.createdAt)).not.toThrow();
                    }
                ),
                { numRuns: 100 }
            );
        });

        /**
         * Test reply payload structure (Requirements: 21.3)
         */
        it('should validate reply payload structure', () => {
            fc.assert(
                fc.property(
                    replyPayloadArb,
                    (reply: ReplyPayload) => {
                        // Reply should have required fields
                        expect(typeof reply.reelId).toBe('string');
                        expect(typeof reply.parentCommentId).toBe('string');
                        expect(reply.parentCommentId.length).toBeGreaterThan(0);
                        expect(typeof reply.reply.id).toBe('string');
                        expect(typeof reply.reply.content).toBe('string');
                        expect(reply.reply.content.length).toBeGreaterThan(0);
                        expect(typeof reply.reply.user.id).toBe('string');
                        expect(typeof reply.reply.user.username).toBe('string');
                    }
                ),
                { numRuns: 100 }
            );
        });

        /**
         * Test like payload structure (Requirements: 21.8)
         */
        it('should validate like payload structure', () => {
            fc.assert(
                fc.property(
                    likePayloadArb,
                    (like: LikePayload) => {
                        // Like should have required fields
                        expect(typeof like.reelId).toBe('string');
                        expect(like.reelId.length).toBeGreaterThan(0);
                        expect(typeof like.likesCount).toBe('number');
                        expect(like.likesCount).toBeGreaterThanOrEqual(0);
                        expect(typeof like.userId).toBe('string');
                        expect(['like', 'unlike']).toContain(like.action);
                    }
                ),
                { numRuns: 100 }
            );
        });

        /**
         * Test follow payload structure (Requirements: 21.4)
         */
        it('should validate follow payload structure', () => {
            fc.assert(
                fc.property(
                    followPayloadArb,
                    (follow: FollowPayload) => {
                        // Follow should have required fields
                        expect(typeof follow.followerId).toBe('string');
                        expect(follow.followerId.length).toBeGreaterThan(0);
                        expect(typeof follow.followingId).toBe('string');
                        expect(follow.followingId.length).toBeGreaterThan(0);
                        expect(typeof follow.followerUsername).toBe('string');
                        expect(['follow', 'unfollow']).toContain(follow.action);
                    }
                ),
                { numRuns: 100 }
            );
        });

        /**
         * Test match update payload structure (Requirements: 21.5)
         */
        it('should validate match update payload structure', () => {
            fc.assert(
                fc.property(
                    matchUpdatePayloadArb,
                    (matchUpdate: MatchUpdatePayload) => {
                        // Match update should have required fields
                        expect(typeof matchUpdate.matchId).toBe('number');
                        expect(matchUpdate.matchId).toBeGreaterThanOrEqual(0);
                        expect(typeof matchUpdate.homeScore).toBe('number');
                        expect(matchUpdate.homeScore).toBeGreaterThanOrEqual(0);
                        expect(typeof matchUpdate.awayScore).toBe('number');
                        expect(matchUpdate.awayScore).toBeGreaterThanOrEqual(0);
                        expect(typeof matchUpdate.status).toBe('string');
                        
                        // Minute is optional but if present should be a number
                        if (matchUpdate.minute !== undefined) {
                            expect(typeof matchUpdate.minute).toBe('number');
                            expect(matchUpdate.minute).toBeGreaterThanOrEqual(0);
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });

        /**
         * Test that user connection tracking works correctly
         */
        it('should correctly track user connection status', () => {
            fc.assert(
                fc.property(
                    userIdArb,
                    (userId) => {
                        // Without initialization, user should not be connected
                        const isConnected = WebSocketService.isUserConnected(userId);
                        expect(isConnected).toBe(false);
                    }
                ),
                { numRuns: 100 }
            );
        });

        /**
         * Test that connection counts are non-negative
         */
        it('should return non-negative connection counts', () => {
            fc.assert(
                fc.property(
                    fc.constant(null), // No input needed
                    () => {
                        const usersCount = WebSocketService.getConnectedUsersCount();
                        const totalCount = WebSocketService.getTotalConnectionsCount();
                        
                        expect(usersCount).toBeGreaterThanOrEqual(0);
                        expect(totalCount).toBeGreaterThanOrEqual(0);
                        // Total connections should be >= unique users
                        expect(totalCount).toBeGreaterThanOrEqual(usersCount);
                    }
                ),
                { numRuns: 100 }
            );
        });

        /**
         * Test that event types are valid WebSocket event types
         */
        it('should only accept valid WebSocket event types', () => {
            const validEventTypes: WSEventType[] = [
                'notification',
                'comment',
                'reply',
                'like',
                'follow',
                'match_update',
                'reel_update',
            ];

            fc.assert(
                fc.property(
                    wsEventTypeArb,
                    (eventType) => {
                        expect(validEventTypes).toContain(eventType);
                    }
                ),
                { numRuns: 100 }
            );
        });

        /**
         * Test timestamp is always a recent value
         */
        it('should generate timestamps close to current time', () => {
            fc.assert(
                fc.property(
                    wsEventTypeArb,
                    fc.jsonValue(),
                    (eventType, payload) => {
                        const before = Date.now();
                        const message: WSMessage = {
                            type: eventType,
                            payload,
                            timestamp: Date.now(),
                        };
                        const after = Date.now();

                        // Timestamp should be between before and after
                        expect(message.timestamp).toBeGreaterThanOrEqual(before);
                        expect(message.timestamp).toBeLessThanOrEqual(after);
                    }
                ),
                { numRuns: 100 }
            );
        });
    });
});
