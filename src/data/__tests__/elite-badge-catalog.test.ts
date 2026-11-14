import { activeSlotFor, expiresAtFor, isAwardActive, isMentorAward, takeTop } from '../elite-badge-catalog';

describe('elite badge catalog', () => {
    it('keeps permanent awards open and expires timed ones', () => {
        const now = new Date('2026-11-13T12:00:00Z');
        expect(expiresAtFor('permanent', now)).toBeNull();
        expect(expiresAtFor('7', now)?.toISOString()).toBe('2026-11-20T12:00:00.000Z');
        expect(isAwardActive({ revokedAt: null, expiresAt: null, activeSlot: 'slot' }, now)).toBe(true);
        expect(isAwardActive({ revokedAt: now, expiresAt: null, activeSlot: 'slot' }, now)).toBe(false);
        expect(isAwardActive({ revokedAt: null, expiresAt: new Date('2026-11-01T00:00:00Z'), activeSlot: 'slot' }, now)).toBe(false);
    });

    it('shows a badge only when a mentor chose the recipient', () => {
        expect(isMentorAward('ass')).toBe(true);
        expect(isMentorAward('system')).toBe(false);
        expect(isMentorAward(null)).toBe(false);
        expect(isMentorAward('')).toBe(false);
    });

    it('does not invent candidates beyond the rows that exist', () => {
        expect(takeTop([{ id: 'a' }, { id: 'b' }], 10)).toEqual([{ id: 'a' }, { id: 'b' }]);
        expect(activeSlotFor('user', 'badge', null)).toBe('user:badge:global');
        expect(activeSlotFor('user', 'badge', 'comp')).toBe('user:badge:comp');
    });
});
