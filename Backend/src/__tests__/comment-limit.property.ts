/**
 * Property-Based Tests for Comment Rate Limiting
 * **Feature: security-technical-fixes, Property 17: Comment Limit Per User Per Reel**
 * **Validates: Requirements 15.1, 15.2, 15.3**
 * 
 * Using fast-check for property-based testing
 */

import * as fc from 'fast-check';
import { COMMENT_LIMITS } from '../config/app.config';

// Simulated comment system for testing the logic
interface Comment {
    id: string;
    userId: string;
    reelId: string;
    parentId: string | null;
    content: string;
}

interface CommentStore {
    comments: Comment[];
}

/**
 * Counts top-level comments by a user on a specific reel
 */
function countUserCommentsOnReel(store: CommentStore, userId: string, reelId: string): number {
    return store.comments.filter(c => c.userId === userId && c.reelId === reelId && c.parentId === null).length;
}

/**
 * Counts replies by a user on a specific reel
 */
function countUserRepliesOnReel(store: CommentStore, userId: string, reelId: string): number {
    return store.comments.filter(c => c.userId === userId && c.reelId === reelId && c.parentId !== null).length;
}

/**
 * Attempts to add a comment or reply, returns success/failure
 * Requirements 15.1, 15.2: Separate limits for comments (5) and replies (5)
 */
function tryAddComment(
    store: CommentStore,
    userId: string,
    reelId: string,
    content: string,
    parentId: string | null = null
): { success: boolean; errorCode?: string } {
    const isReply = parentId !== null;
    
    if (isReply) {
        const currentReplies = countUserRepliesOnReel(store, userId, reelId);
        if (currentReplies >= COMMENT_LIMITS.MAX_REPLIES_PER_USER_PER_REEL) {
            return { success: false, errorCode: 'REPLY_LIMIT_REACHED' };
        }
    } else {
        const currentComments = countUserCommentsOnReel(store, userId, reelId);
        if (currentComments >= COMMENT_LIMITS.MAX_COMMENTS_PER_USER_PER_REEL) {
            return { success: false, errorCode: 'COMMENT_LIMIT_REACHED' };
        }
    }
    
    store.comments.push({
        id: `comment-${Date.now()}-${Math.random()}`,
        userId,
        reelId,
        parentId,
        content,
    });
    
    return { success: true };
}


describe('Comment Limit Property Tests', () => {
    /**
     * **Feature: security-technical-fixes, Property 17: Comment Limit Per User Per Reel**
     * *For any* user who has posted 5 comments (top-level) on a reel, additional comment attempts 
     * SHALL be rejected with a limit reached message.
     * *For any* user who has posted 5 replies on a reel, additional reply attempts 
     * SHALL be rejected with a limit reached message.
     * **Validates: Requirements 15.1, 15.2, 15.3**
     */
    describe('Property 17: Comment Limit Per User Per Reel', () => {
        it('should allow comments when user has fewer than 5 top-level comments on a reel', () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: 0, max: COMMENT_LIMITS.MAX_COMMENTS_PER_USER_PER_REEL - 1 }),
                    fc.uuid(),
                    fc.uuid(),
                    fc.string({ minLength: 1, maxLength: 100 }),
                    (existingCount, userId, reelId, content) => {
                        const store: CommentStore = { comments: [] };
                        
                        for (let i = 0; i < existingCount; i++) {
                            store.comments.push({
                                id: `existing-${i}`,
                                userId,
                                reelId,
                                parentId: null,
                                content: `existing comment ${i}`,
                            });
                        }
                        
                        const result = tryAddComment(store, userId, reelId, content, null);
                        
                        expect(result.success).toBe(true);
                        expect(result.errorCode).toBeUndefined();
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should reject comments when user has 5 or more top-level comments on a reel', () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: COMMENT_LIMITS.MAX_COMMENTS_PER_USER_PER_REEL, max: 10 }),
                    fc.uuid(),
                    fc.uuid(),
                    fc.string({ minLength: 1, maxLength: 100 }),
                    (existingCount, userId, reelId, content) => {
                        const store: CommentStore = { comments: [] };
                        
                        for (let i = 0; i < existingCount; i++) {
                            store.comments.push({
                                id: `existing-${i}`,
                                userId,
                                reelId,
                                parentId: null,
                                content: `existing comment ${i}`,
                            });
                        }
                        
                        const result = tryAddComment(store, userId, reelId, content, null);
                        
                        expect(result.success).toBe(false);
                        expect(result.errorCode).toBe('COMMENT_LIMIT_REACHED');
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should allow replies when user has fewer than 5 replies on a reel', () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: 0, max: COMMENT_LIMITS.MAX_REPLIES_PER_USER_PER_REEL - 1 }),
                    fc.uuid(),
                    fc.uuid(),
                    fc.string({ minLength: 1, maxLength: 100 }),
                    fc.uuid(),
                    (existingCount, userId, reelId, content, parentId) => {
                        const store: CommentStore = { comments: [] };
                        
                        for (let i = 0; i < existingCount; i++) {
                            store.comments.push({
                                id: `existing-reply-${i}`,
                                userId,
                                reelId,
                                parentId: `parent-${i}`,
                                content: `existing reply ${i}`,
                            });
                        }
                        
                        const result = tryAddComment(store, userId, reelId, content, parentId);
                        
                        expect(result.success).toBe(true);
                        expect(result.errorCode).toBeUndefined();
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should reject replies when user has 5 or more replies on a reel', () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: COMMENT_LIMITS.MAX_REPLIES_PER_USER_PER_REEL, max: 10 }),
                    fc.uuid(),
                    fc.uuid(),
                    fc.string({ minLength: 1, maxLength: 100 }),
                    fc.uuid(),
                    (existingCount, userId, reelId, content, parentId) => {
                        const store: CommentStore = { comments: [] };
                        
                        for (let i = 0; i < existingCount; i++) {
                            store.comments.push({
                                id: `existing-reply-${i}`,
                                userId,
                                reelId,
                                parentId: `parent-${i}`,
                                content: `existing reply ${i}`,
                            });
                        }
                        
                        const result = tryAddComment(store, userId, reelId, content, parentId);
                        
                        expect(result.success).toBe(false);
                        expect(result.errorCode).toBe('REPLY_LIMIT_REACHED');
                    }
                ),
                { numRuns: 100 }
            );
        });


        it('should track comments and replies separately', () => {
            fc.assert(
                fc.property(
                    fc.uuid(),
                    fc.uuid(),
                    (userId, reelId) => {
                        const store: CommentStore = { comments: [] };
                        
                        // User adds 5 top-level comments (reaches comment limit)
                        for (let i = 0; i < COMMENT_LIMITS.MAX_COMMENTS_PER_USER_PER_REEL; i++) {
                            store.comments.push({
                                id: `comment-${i}`,
                                userId,
                                reelId,
                                parentId: null,
                                content: `comment ${i}`,
                            });
                        }
                        
                        // User should be blocked from adding more comments
                        const commentResult = tryAddComment(store, userId, reelId, 'blocked comment', null);
                        expect(commentResult.success).toBe(false);
                        expect(commentResult.errorCode).toBe('COMMENT_LIMIT_REACHED');
                        
                        // But user should still be able to add replies (separate limit)
                        const replyResult = tryAddComment(store, userId, reelId, 'allowed reply', 'some-parent-id');
                        expect(replyResult.success).toBe(true);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should allow different users to comment independently', () => {
            fc.assert(
                fc.property(
                    fc.uuid(),
                    fc.uuid(),
                    fc.uuid(),
                    (userId1, userId2, reelId) => {
                        fc.pre(userId1 !== userId2);
                        
                        const store: CommentStore = { comments: [] };
                        
                        // User 1 adds 5 comments (reaches limit)
                        for (let i = 0; i < COMMENT_LIMITS.MAX_COMMENTS_PER_USER_PER_REEL; i++) {
                            store.comments.push({
                                id: `user1-${i}`,
                                userId: userId1,
                                reelId,
                                parentId: null,
                                content: `user1 comment ${i}`,
                            });
                        }
                        
                        // User 1 should be blocked
                        const result1 = tryAddComment(store, userId1, reelId, 'blocked', null);
                        expect(result1.success).toBe(false);
                        
                        // User 2 should still be able to comment
                        const result2 = tryAddComment(store, userId2, reelId, 'allowed', null);
                        expect(result2.success).toBe(true);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should allow user to have max comments AND max replies on same reel', () => {
            fc.assert(
                fc.property(
                    fc.uuid(),
                    fc.uuid(),
                    (userId, reelId) => {
                        const store: CommentStore = { comments: [] };
                        
                        // User adds 5 top-level comments
                        for (let i = 0; i < COMMENT_LIMITS.MAX_COMMENTS_PER_USER_PER_REEL; i++) {
                            const result = tryAddComment(store, userId, reelId, `comment ${i}`, null);
                            expect(result.success).toBe(true);
                        }
                        
                        // User adds 5 replies
                        for (let i = 0; i < COMMENT_LIMITS.MAX_REPLIES_PER_USER_PER_REEL; i++) {
                            const result = tryAddComment(store, userId, reelId, `reply ${i}`, `parent-${i}`);
                            expect(result.success).toBe(true);
                        }
                        
                        // Total should be 10 (5 comments + 5 replies)
                        expect(store.comments.length).toBe(10);
                        
                        // Both limits should now be reached
                        const commentResult = tryAddComment(store, userId, reelId, 'blocked comment', null);
                        expect(commentResult.success).toBe(false);
                        expect(commentResult.errorCode).toBe('COMMENT_LIMIT_REACHED');
                        
                        const replyResult = tryAddComment(store, userId, reelId, 'blocked reply', 'some-parent');
                        expect(replyResult.success).toBe(false);
                        expect(replyResult.errorCode).toBe('REPLY_LIMIT_REACHED');
                    }
                ),
                { numRuns: 100 }
            );
        });
    });
});
