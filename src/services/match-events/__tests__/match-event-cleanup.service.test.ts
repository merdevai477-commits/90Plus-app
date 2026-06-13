import { getMatchEventRetentionDays } from '../match-event-cleanup.service';

describe('match-event-cleanup.service', () => {
    const original = process.env.MATCH_EVENT_RETENTION_DAYS;

    afterEach(() => {
        if (original === undefined) delete process.env.MATCH_EVENT_RETENTION_DAYS;
        else process.env.MATCH_EVENT_RETENTION_DAYS = original;
    });

    it('defaults to 14 days', () => {
        delete process.env.MATCH_EVENT_RETENTION_DAYS;
        expect(getMatchEventRetentionDays()).toBe(14);
    });

    it('respects MATCH_EVENT_RETENTION_DAYS env', () => {
        process.env.MATCH_EVENT_RETENTION_DAYS = '7';
        expect(getMatchEventRetentionDays()).toBe(7);
    });

    it('clamps invalid values to minimum 1', () => {
        process.env.MATCH_EVENT_RETENTION_DAYS = '0';
        expect(getMatchEventRetentionDays()).toBe(1);
    });
});
