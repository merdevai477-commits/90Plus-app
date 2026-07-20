import { isPushNotifiableMatchEvent } from '../match-event-delivery.service';
import { diffScoreGoals, diffStatusEvents } from '../match-event-normalizer';
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

    it('emits synthetic kickoff when score advances while status stays NS', () => {
        const events = diffStatusEvents(99, 'NS', 'NS', { homeScore: 1, awayScore: 0 }, meta);

        expect(events).toHaveLength(1);
        expect(events[0].eventType).toBe('kickoff');
        expect(events[0].payload.status).toBe('1H');
    });

    it('uses a stable kickoff eventKey across status and synthetic paths', () => {
        const fromStatus = diffStatusEvents(42, 'NS', '1H', { homeScore: 0, awayScore: 0 }, meta);
        const fromScore = diffStatusEvents(42, 'NS', 'NS', { homeScore: 1, awayScore: 0 }, meta);

        expect(fromStatus[0].eventKey).toBe(fromScore[0].eventKey);
    });

    it('does not emit halftime or second-half events', () => {
        expect(diffStatusEvents(99, '1H', 'HT', scores, meta)).toHaveLength(0);
        expect(diffStatusEvents(99, 'HT', '2H', scores, meta)).toHaveLength(0);
    });

    it('emits fulltime when status moves to FT', () => {
        const events = diffStatusEvents(99, '2H', 'FT', scores, meta);
        expect(events).toHaveLength(1);
        expect(events[0].eventType).toBe('fulltime');
    });
});

describe('diffScoreGoals', () => {
    const meta = { homeTeam: 'Home FC', awayTeam: 'Away FC' };

    it('emits a goal when home score increases (no events feed required)', () => {
        const events = diffScoreGoals(
            7,
            { homeScore: 0, awayScore: 0 },
            { homeScore: 1, awayScore: 0 },
            meta,
        );

        expect(events).toHaveLength(1);
        expect(events[0].eventType).toBe('goal_home');
        expect(events[0].payload).toMatchObject({ homeScore: 1, awayScore: 0 });
    });
});
