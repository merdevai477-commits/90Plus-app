import { isPushNotifiableMatchEvent } from '../match-event-delivery.service';
import { diffScoreGoals, diffStatusEvents, normalizeApiEvents } from '../match-event-normalizer';
import type { NormalizedMatchEvent } from '../match-event.types';
import { NotificationType } from '../../notification.service';
import {
    localizeMatchVarDetail,
    normalizeSupportedLanguage,
    renderPushTemplate,
} from '../../push-templates.service';

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
    it('allows goals, cancelled goals, kickoff, red card, VAR, substitutions, and fulltime', () => {
        expect(isPushNotifiableMatchEvent(baseEvent('goal_home'))).toBe(true);
        expect(isPushNotifiableMatchEvent(baseEvent('goal_away'))).toBe(true);
        expect(isPushNotifiableMatchEvent(baseEvent('goal_cancelled'))).toBe(true);
        expect(isPushNotifiableMatchEvent(baseEvent('kickoff'))).toBe(true);
        expect(isPushNotifiableMatchEvent(baseEvent('card_red'))).toBe(true);
        expect(isPushNotifiableMatchEvent(baseEvent('var'))).toBe(true);
        expect(isPushNotifiableMatchEvent(baseEvent('substitution'))).toBe(true);
        expect(isPushNotifiableMatchEvent(baseEvent('fulltime'))).toBe(true);
    });

    it('blocks legacy / non-push event kinds', () => {
        expect(isPushNotifiableMatchEvent(legacyEvent('halftime'))).toBe(false);
        expect(isPushNotifiableMatchEvent(legacyEvent('second_half_start'))).toBe(false);
        expect(isPushNotifiableMatchEvent(legacyEvent('card_yellow'))).toBe(false);
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

describe('normalizeApiEvents substitutions', () => {
    it('emits substitution with player in and out names', () => {
        const events = normalizeApiEvents(
            55,
            [
                {
                    time: { elapsed: 62, extra: null },
                    team: { id: 1, name: 'Home FC' },
                    player: { id: 10, name: 'Player In' },
                    assist: { id: 9, name: 'Player Out' },
                    type: 'subst',
                    detail: 'Substitution 1',
                },
            ],
            { homeTeam: 'Home FC', awayTeam: 'Away FC' },
        );

        expect(events).toHaveLength(1);
        expect(events[0].eventType).toBe('substitution');
        expect(events[0].templateVars.playerIn).toBe('Player In');
        expect(events[0].templateVars.playerOut).toBe('Player Out');
        expect(events[0].prefKey).toBe('matchSubs');
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
        expect(events[0].bodyKey).toBe('goalScoreBody');
        expect(events[0].payload).toMatchObject({ homeScore: 1, awayScore: 0 });
    });

    it('emits goal_cancelled when the scoreboard drops', () => {
        const events = diffScoreGoals(
            7,
            { homeScore: 2, awayScore: 0 },
            { homeScore: 1, awayScore: 0 },
            meta,
        );

        expect(events).toHaveLength(1);
        expect(events[0].eventType).toBe('goal_cancelled');
        expect(events[0].titleKey).toBe('goalCancelledTitle');
        expect(events[0].payload).toMatchObject({
            cancelledTeam: 'home',
            homeScore: 1,
            awayScore: 0,
        });
    });
});

describe('push language helpers', () => {
    it('normalizes locale tags to ar/en', () => {
        expect(normalizeSupportedLanguage('ar')).toBe('ar');
        expect(normalizeSupportedLanguage('ar-EG')).toBe('ar');
        expect(normalizeSupportedLanguage('en-US')).toBe('en');
        expect(normalizeSupportedLanguage('fr')).toBe('en');
    });

    it('localizes common VAR details for Arabic pushes', () => {
        expect(localizeMatchVarDetail('Goal cancelled', 'ar')).toBe('إلغاء هدف');
        expect(localizeMatchVarDetail('Goal Disallowed - Offside', 'ar')).toContain('تسلل');
        expect(localizeMatchVarDetail('Goal cancelled', 'en')).toBe('Goal cancelled');
    });

    it('renders goal and cancel copy in the user language', () => {
        expect(renderPushTemplate('goalTitle', 'ar')).toContain('هدف');
        expect(renderPushTemplate('goalCancelledTitle', 'ar')).toContain('إلغاء');
        expect(
            renderPushTemplate('goalScoreBody', 'ar', {
                scorer: 'الأهلي',
                home: 'الأهلي',
                away: 'الزمالك',
                homeScore: 1,
                awayScore: 0,
            }),
        ).toContain('الأهلي');
        expect(renderPushTemplate('goalTitle', 'en')).toContain('Goal');
    });
});
