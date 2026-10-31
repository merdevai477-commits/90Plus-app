import {
    decodeCursor,
    decodeRankedCursor,
    encodeCursor,
    encodeRankedCursor,
    extractHashtags,
    extractMentions,
    normalizeCommunityText,
    parseFeedSort,
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

    describe('feed sort', () => {
        it('accepts the known sorts', () => {
            expect(parseFeedSort('top')).toBe('top');
            expect(parseFeedSort('likes')).toBe('likes');
            expect(parseFeedSort('comments')).toBe('comments');
            expect(parseFeedSort('latest')).toBe('latest');
        });

        it('defaults to latest for anything else', () => {
            expect(parseFeedSort(undefined)).toBe('latest');
            expect(parseFeedSort('TOP')).toBe('latest');
            expect(parseFeedSort(['top'])).toBe('latest');
            expect(parseFeedSort('random')).toBe('latest');
        });
    });

    describe('ranked feed cursor', () => {
        const c = { score: 42, createdAt: new Date('2026-10-25T12:00:00.123Z'), id: '11111111-2222-3333-4444-555555555555' };

        it('round-trips for the sort it was minted for', () => {
            expect(decodeRankedCursor('top', encodeRankedCursor('top', c))).toEqual(c);
            expect(decodeRankedCursor('likes', encodeRankedCursor('likes', { ...c, score: 0 }))).toEqual({ ...c, score: 0 });
        });

        it('rejects a cursor from another sort or the chronological feed', () => {
            expect(decodeRankedCursor('likes', encodeRankedCursor('top', c))).toBeNull();
            expect(decodeRankedCursor('top', encodeCursor(c))).toBeNull();
        });

        it('rejects garbage', () => {
            expect(decodeRankedCursor('top', 'not-a-cursor')).toBeNull();
            expect(decodeRankedCursor('top', Buffer.from(`top||${c.createdAt.toISOString()}|x`).toString('base64url'))).toBeNull();
            expect(decodeRankedCursor('top', Buffer.from('top|1.5|2026-10-25T12:00:00.000Z|x').toString('base64url'))).toBeNull();
            expect(decodeRankedCursor('top', '')).toBeNull();
            expect(decodeRankedCursor('top', null)).toBeNull();
        });
    });
});
