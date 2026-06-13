import { isBaselinedGoal, isEventBeforeSubscribeMinute } from '../match-subscription.service';

describe('match-subscription.service', () => {
    const kickoff = new Date('2026-06-13T15:00:00.000Z');

    describe('isEventBeforeSubscribeMinute', () => {
        it('returns false when subscribed before kickoff (minute 0 anchor)', () => {
            const sub = {
                subscribedAt: new Date('2026-06-13T14:00:00.000Z'),
                matchDate: kickoff,
            };
            expect(isEventBeforeSubscribeMinute(sub, 10)).toBe(false);
        });

        it('returns true for events at or before subscribe minute', () => {
            const sub = {
                subscribedAt: new Date('2026-06-13T16:00:00.000Z'), // 60' after kickoff
                matchDate: kickoff,
            };
            expect(isEventBeforeSubscribeMinute(sub, 45)).toBe(true);
            expect(isEventBeforeSubscribeMinute(sub, 60)).toBe(true);
            expect(isEventBeforeSubscribeMinute(sub, 70)).toBe(false);
        });
    });

    describe('isBaselinedGoal', () => {
        it('returns true when goal score is within baseline', () => {
            const sub = {
                baselineHomeScore: 2,
                baselineAwayScore: 1,
                subscribedAt: new Date('2026-06-13T16:00:00.000Z'),
            };
            const event = {
                eventType: 'goal_home',
                detectedAt: new Date('2026-06-13T16:05:00.000Z'),
                payload: { homeScore: 2, awayScore: 1 },
            };
            expect(isBaselinedGoal(sub, event)).toBe(true);
        });

        it('returns false for new goals after baseline', () => {
            const sub = {
                baselineHomeScore: 2,
                baselineAwayScore: 1,
                subscribedAt: new Date('2026-06-13T16:00:00.000Z'),
            };
            const event = {
                eventType: 'goal_home',
                detectedAt: new Date('2026-06-13T16:10:00.000Z'),
                payload: { homeScore: 3, awayScore: 1 },
            };
            expect(isBaselinedGoal(sub, event)).toBe(false);
        });
    });
});
