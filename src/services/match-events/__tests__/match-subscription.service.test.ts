import {
    isBaselinedGoal,
    isEventBeforeSubscribeMinute,
    isStatusEventObsolete,
    isCatchUpReplayEvent,
    statusPhase,
} from '../match-subscription.service';
import { shouldDeliverToSubscription } from '../match-event-delivery.service';
import type { NormalizedMatchEvent } from '../match-event.types';
import { NotificationType } from '../../notification.service';

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

    describe('status phase / obsolete events', () => {
        it('orders status phases', () => {
            expect(statusPhase('NS')).toBeLessThan(statusPhase('1H'));
            expect(statusPhase('1H')).toBeLessThan(statusPhase('HT'));
            expect(statusPhase('HT')).toBeLessThan(statusPhase('2H'));
            expect(statusPhase('2H')).toBeLessThan(statusPhase('FT'));
        });

        it('marks kickoff/HT obsolete when already in second half', () => {
            expect(isStatusEventObsolete('2H', 'kickoff')).toBe(true);
            expect(isStatusEventObsolete('2H', 'halftime')).toBe(true);
            expect(isStatusEventObsolete('2H', 'second_half_start')).toBe(true);
            expect(isStatusEventObsolete('2H', 'fulltime')).toBe(false);
        });
    });

    describe('isCatchUpReplayEvent', () => {
        it('blocks timed events in the first seconds after mid-match follow', () => {
            const subscribedAt = new Date('2026-06-13T16:00:00.000Z');
            const sub = {
                subscribedAt,
                baselineStatus: '2H',
                matchDate: kickoff,
            };
            expect(
                isCatchUpReplayEvent(sub, {
                    detectedAt: new Date(subscribedAt.getTime() + 3_000),
                    minute: 45,
                }),
            ).toBe(true);
            expect(
                isCatchUpReplayEvent(sub, {
                    detectedAt: new Date(subscribedAt.getTime() + 60_000),
                    minute: 70,
                }),
            ).toBe(false);
        });
    });
});

describe('shouldDeliverToSubscription mid-match follow', () => {
    const kickoff = new Date('2026-06-13T15:00:00.000Z');
    const subscribedAt = new Date('2026-06-13T16:00:00.000Z'); // minute 60

    const sub = {
        id: 's1',
        userId: 'u1',
        apiMatchId: 1,
        subscribedAt,
        matchDate: kickoff,
        homeTeam: 'Home',
        awayTeam: 'Away',
        homeTeamLogo: null,
        awayTeamLogo: null,
        leagueName: null,
        baselineHomeScore: 2,
        baselineAwayScore: 1,
        baselineStatus: '2H',
        notifiedStart: true,
        notifiedEnd: false,
    };

    function event(
        partial: Partial<NormalizedMatchEvent> & Pick<NormalizedMatchEvent, 'eventType'>,
    ): NormalizedMatchEvent {
        return {
            fixtureId: 1,
            eventKey: 'k',
            minute: null,
            extraMinute: null,
            teamId: null,
            playerId: null,
            detectedAt: new Date(subscribedAt.getTime() + 2_000),
            payload: {},
            templateVars: {},
            notificationType: NotificationType.MATCH_UPDATE,
            titleKey: 'goalTitle',
            bodyKey: 'goalTitle',
            prefKey: 'matchGoals',
            data: {},
            ...partial,
        };
    }

    it('does not replay baselined goals after follow at 60’', () => {
        expect(
            shouldDeliverToSubscription(
                sub,
                event({
                    eventType: 'goal_home',
                    payload: { homeScore: 1, awayScore: 0 },
                }),
            ),
        ).toBe(false);
        expect(
            shouldDeliverToSubscription(
                sub,
                event({
                    eventType: 'goal_home',
                    payload: { homeScore: 2, awayScore: 1 },
                }),
            ),
        ).toBe(false);
    });

    it('allows a new goal after the baseline', () => {
        expect(
            shouldDeliverToSubscription(
                sub,
                event({
                    eventType: 'goal_home',
                    detectedAt: new Date(subscribedAt.getTime() + 120_000),
                    payload: { homeScore: 3, awayScore: 1 },
                }),
            ),
        ).toBe(true);
    });

    it('does not replay kickoff/halftime when already in 2H', () => {
        expect(shouldDeliverToSubscription(sub, event({ eventType: 'kickoff' }))).toBe(false);
        expect(shouldDeliverToSubscription(sub, event({ eventType: 'halftime' }))).toBe(false);
        expect(
            shouldDeliverToSubscription(sub, event({ eventType: 'second_half_start' })),
        ).toBe(false);
    });

    it('does not replay an old red card minute during catch-up', () => {
        expect(
            shouldDeliverToSubscription(
                sub,
                event({
                    eventType: 'card_red',
                    minute: 22,
                    prefKey: 'matchCards',
                }),
            ),
        ).toBe(false);
    });
});
