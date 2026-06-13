import {
    buildMatchEventKey,
    buildScoreGoalEventKey,
    buildStatusEventKey,
} from '../match-event-key.util';

describe('match-event-key.util', () => {
    it('buildMatchEventKey is stable for the same inputs', () => {
        const a = buildMatchEventKey(12345, {
            eventType: 'card_yellow',
            minute: 63,
            teamId: 1,
            playerId: 99,
            detail: 'Yellow Card',
        });
        const b = buildMatchEventKey(12345, {
            eventType: 'card_yellow',
            minute: 63,
            teamId: 1,
            playerId: 99,
            detail: 'Yellow Card',
        });
        expect(a).toBe(b);
        expect(a).toHaveLength(32);
    });

    it('buildMatchEventKey differs when minute changes', () => {
        const a = buildMatchEventKey(1, { eventType: 'card_yellow', minute: 10 });
        const b = buildMatchEventKey(1, { eventType: 'card_yellow', minute: 11 });
        expect(a).not.toBe(b);
    });

    it('buildScoreGoalEventKey encodes scoreline', () => {
        const home = buildScoreGoalEventKey(99, 'home', 2, 1);
        const away = buildScoreGoalEventKey(99, 'away', 2, 2);
        expect(home).not.toBe(away);
    });

    it('buildStatusEventKey encodes status', () => {
        const ht = buildStatusEventKey(5, 'halftime', 'HT');
        const ft = buildStatusEventKey(5, 'fulltime', 'FT');
        expect(ht).not.toBe(ft);
    });

    it('uses playerName when playerId is null to avoid same-minute collisions', () => {
        const a = buildMatchEventKey(1, {
            eventType: 'card_yellow',
            minute: 63,
            teamId: 10,
            playerId: null,
            playerName: 'Player A',
            detail: 'Yellow Card',
        });
        const b = buildMatchEventKey(1, {
            eventType: 'card_yellow',
            minute: 63,
            teamId: 10,
            playerId: null,
            playerName: 'Player B',
            detail: 'Yellow Card',
        });
        expect(a).not.toBe(b);
    });
});
