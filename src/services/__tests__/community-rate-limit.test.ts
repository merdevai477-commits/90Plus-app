jest.mock('../../lib/redis', () => ({
    isRedisConnected: () => false,
    getRedisClient: () => null,
}));

import {
    COMMUNITY_RATE_RULES,
    __resetCommunityRateMemory,
    consumeCommunityRate,
    peekCommunityRate,
    refundCommunityRate,
} from '../community-rate-limit.service';

describe('community rate limits (memory fallback)', () => {
    beforeEach(() => {
        __resetCommunityRateMemory();
        jest.useRealTimers();
    });

    it('enforces the cooldown between two posts', async () => {
        expect(await consumeCommunityRate('post', 'u1')).toEqual({ allowed: true });
        const second = await consumeCommunityRate('post', 'u1');
        expect(second.allowed).toBe(false);
        if (!second.allowed) {
            expect(second.reason).toBe('cooldown');
            expect(second.retryAfterSec).toBeGreaterThan(0);
            expect(second.retryAfterSec).toBeLessThanOrEqual(COMMUNITY_RATE_RULES.post.cooldownSec);
        }
    });

    it('keeps users independent', async () => {
        expect((await consumeCommunityRate('comment', 'a')).allowed).toBe(true);
        expect((await consumeCommunityRate('comment', 'b')).allowed).toBe(true);
    });

    it('peek reports the cooldown without consuming', async () => {
        expect(await peekCommunityRate('comment', 'u2')).toEqual({ allowed: true });
        expect(await peekCommunityRate('comment', 'u2')).toEqual({ allowed: true });
        await consumeCommunityRate('comment', 'u2');
        const peek = await peekCommunityRate('comment', 'u2');
        expect(peek.allowed).toBe(false);
    });

    it('refund gives the slot back after a rejected write', async () => {
        await consumeCommunityRate('post', 'u3');
        await refundCommunityRate('post', 'u3');
        expect((await consumeCommunityRate('post', 'u3')).allowed).toBe(true);
    });

    it('blocks once the rolling window is full', async () => {
        jest.useFakeTimers({ now: new Date('2026-10-25T10:00:00Z') });
        const { max } = COMMUNITY_RATE_RULES.comment.windows[0];
        const cooldownMs = COMMUNITY_RATE_RULES.comment.cooldownSec * 1000;
        for (let i = 0; i < max; i++) {
            expect((await consumeCommunityRate('comment', 'spammer')).allowed).toBe(true);
            jest.advanceTimersByTime(cooldownMs + 1);
        }
        const blocked = await consumeCommunityRate('comment', 'spammer');
        expect(blocked.allowed).toBe(false);
        if (!blocked.allowed) expect(blocked.reason).toBe('window');
        jest.useRealTimers();
    });
});
