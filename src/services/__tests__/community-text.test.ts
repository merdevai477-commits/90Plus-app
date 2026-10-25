import {
    decodeCursor,
    encodeCursor,
    extractHashtags,
    extractMentions,
    normalizeCommunityText,
} from '../community-text';

describe('community text helpers', () => {
    describe('extractHashtags', () => {
        it('finds Arabic and Latin tags, lowercased and de-duplicated', () => {
            expect(extractHashtags('#الأهلي فاز 🔥 #Ahly #ahly #UCL_Final')).toEqual(['الأهلي', 'ahly', 'ucl_final']);
        });

        it('ignores pure numbers, HTML entities and mid-word hashes', () => {
            expect(extractHashtags('score #1 &#39; abc#def #2026')).toEqual([]);
        });

        it('caps the number of tags', () => {
            const text = Array.from({ length: 15 }, (_, i) => `#tag${i}`).join(' ');
            expect(extractHashtags(text)).toHaveLength(10);
        });
    });

    describe('extractMentions', () => {
        it('finds usernames and strips trailing dots', () => {
            expect(extractMentions('@mo_salah شوف ده يا @Ahmed.Ali.')).toEqual(['mo_salah', 'ahmed.ali']);
        });

        it('does not treat emails as mentions', () => {
            expect(extractMentions('mail me at fan@example.com')).toEqual([]);
        });

        it('requires at least two characters', () => {
            expect(extractMentions('@a @bb')).toEqual(['bb']);
        });
    });

    describe('normalizeCommunityText', () => {
        it('trims, unifies newlines, drops bidi controls and collapses blank lines', () => {
            expect(normalizeCommunityText('  hi\r\n\r\n\r\n\u202Ethere \u200B ')).toBe('hi\n\nthere');
        });

        it('returns empty string for non-strings', () => {
            expect(normalizeCommunityText(undefined)).toBe('');
            expect(normalizeCommunityText(42)).toBe('');
        });
    });

    describe('feed cursor', () => {
        it('round-trips', () => {
            const c = { createdAt: new Date('2026-10-25T12:00:00.000Z'), id: 'post_1' };
            expect(decodeCursor(encodeCursor(c))).toEqual(c);
        });

        it('rejects garbage', () => {
            expect(decodeCursor('not-a-cursor')).toBeNull();
            expect(decodeCursor('')).toBeNull();
            expect(decodeCursor(null)).toBeNull();
        });
    });
});
