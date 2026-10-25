import { parseNemotronSafety } from '../community-moderation.service';

describe('parseNemotronSafety', () => {
    it('marks safe user content as safe', () => {
        expect(parseNemotronSafety('User Safety: safe')).toEqual({
            safe: true,
            categories: [],
            raw: 'User Safety: safe',
        });
    });

    it('marks unsafe content and extracts categories', () => {
        const raw = `User Safety: unsafe
Safety Categories: Hate, Violence, Sexual`;
        expect(parseNemotronSafety(raw)).toEqual({
            safe: false,
            categories: ['Hate', 'Violence', 'Sexual'],
            raw,
        });
    });

    it('is case-insensitive on labels', () => {
        expect(parseNemotronSafety('user safety: UNSAFE\nsafety categories: Criminal Planning').safe).toBe(false);
    });

    it('fails open when the response is unparseable', () => {
        expect(parseNemotronSafety('sorry I cannot help').safe).toBe(true);
        expect(parseNemotronSafety('').safe).toBe(true);
    });

    it('ignores Response Safety when rating a user post', () => {
        // Posts are user content — only User Safety matters.
        const raw = `User Safety: unsafe
Response Safety: safe
Safety Categories: Harassment`;
        expect(parseNemotronSafety(raw)).toMatchObject({ safe: false, categories: ['Harassment'] });
    });
});
