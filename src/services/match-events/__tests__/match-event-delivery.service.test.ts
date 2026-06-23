import { isPushNotifiableMatchEvent } from '../match-event-delivery.service';
import { diffStatusEvents } from '../match-event-normalizer';
import type { NormalizedMatchEvent } from '../match-event.types';
import { NotificationType } from '../../notification.service';

function baseEvent(eventType: NormalizedMatchEvent['eventType']): NormalizedMatchEvent {
    return {
        fixtureId: 1,
        eventKey: 'k',
        eventType,
        minute: null,
        extraMinute: null,
        teamId: null,
        playerId: null,
        detectedAt: new Date(),
        payload: {},
        templateVars: {},
        notificationType: NotificationType.MATCH_UPDATE,
        titleKey: 'goalTitle',
        bodyKey: 'goalTitle',
        prefKey: 'matchGoals',
        data: {},
    };
}

function legacyEvent(eventType: string): NormalizedMatchEvent {
    return { ...baseEvent('goal_home'), eventType: eventType as NormalizedMatchEvent['eventType'] };
}

describe('isPushNotifiableMatchEvent', () => {
    it('allows only goals, kickoff, red card, VAR, and fulltime', () => {
        expect(isPushNotifiableMatchEvent(baseEvent('goal_home'))).toBe(true);
        expect(isPushNotifiableMatchEvent(baseEvent('goal_away'))).toBe(true);
        expect(isPushNotifiableMatchEvent(baseEvent('kickoff'))).toBe(true);
        expect(isPushNotifiableMatchEvent(baseEvent('card_red'))).toBe(true);
        expect(isPushNotifiableMatchEvent(baseEvent('var'))).toBe(true);
        expect(isPushNotifiableMatchEvent(baseEvent('fulltime'))).toBe(true);
    });

    it('blocks legacy / non-push event kinds', () => {
        expect(isPushNotifiableMatchEvent(legacyEvent('halftime'))).toBe(false);
        expect(isPushNotifiableMatchEvent(legacyEvent('second_half_start'))).toBe(false);
        expect(isPushNotifiableMatchEvent(legacyEvent('card_yellow'))).toBe(false);
        expect(isPushNotifiableMatchEvent(legacyEvent('substitution'))).toBe(false);
        expect(isPushNotifiableMatchEvent(legacyEvent('penalty'))).toBe(false);
        expect(isPushNotifiableMatchEvent(legacyEvent('lineup'))).toBe(false);
    });
});

describe('diffStatusEvents', () => {
    const meta = { homeTeam: 'Home FC', awayTeam: 'Away FC' };
    const scores = { homeScore: 1, awayScore: 0 };

    it('emits kickoff when status moves from NS to 1H', () => {
        const events = diffStatusEvents(99, 'NS', '1H', scores, meta);

        expect(events).toHaveLength(1);
        expect(events[0].eventType).toBe('kickoff');
    });

    it('does not emit halftime or second-half events', () => {
        expect(diffStatusEvents(99, '1H', 'HT', scores, meta)).toHaveLength(0);
        expect(diffStatusEvents(99, 'HT', '2H', scores, meta)).toHaveLength(0);
    });
});