import { parseGeminiImageSafety } from '../community-image-safety';

describe('parseGeminiImageSafety', () => {
    it('treats an empty payload as skip/safe', () => {
        expect(parseGeminiImageSafety(null)).toMatchObject({ safe: true });
        expect(parseGeminiImageSafety({})).toMatchObject({ safe: true });
    });

    it('blocks when promptFeedback.blockReason is set', () => {
        const v = parseGeminiImageSafety({
            promptFeedback: {
                blockReason: 'SAFETY',
                safetyRatings: [{ category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', probability: 'HIGH' }],
            },
        });
        expect(v.safe).toBe(false);
        if (v.safe) return;
        expect(v.categories.join(' ')).toMatch(/SEXUALLY_EXPLICIT|SAFETY/);
    });

    it('blocks finishReason SAFETY', () => {
        expect(parseGeminiImageSafety({ candidates: [{ finishReason: 'SAFETY' }] }).safe).toBe(false);
    });

    it('blocks HIGH sexual ratings even without a text verdict', () => {
        const v = parseGeminiImageSafety({
            candidates: [
                {
                    finishReason: 'STOP',
                    safetyRatings: [{ category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', probability: 'HIGH' }],
                    content: { parts: [{ text: 'User Safety: safe' }] },
                },
            ],
        });
        expect(v.safe).toBe(false);
    });

    it('honours User Safety: unsafe in the model text', () => {
        const v = parseGeminiImageSafety({
            candidates: [
                {
                    content: { parts: [{ text: 'User Safety: unsafe\nSafety Categories: Sexual, Violence' }] },
                },
            ],
        });
        expect(v.safe).toBe(false);
        if (v.safe) return;
        expect(v.categories).toEqual(['Sexual', 'Violence']);
    });

    it('allows a clean sports photo verdict', () => {
        expect(
            parseGeminiImageSafety({
                candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'User Safety: safe' }] } }],
            }).safe,
        ).toBe(true);
    });
});
