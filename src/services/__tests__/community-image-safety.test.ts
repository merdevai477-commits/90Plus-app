import { parseGeminiImageSafety } from '../community-image-safety';

const reply = (text: string, extra: Record<string, unknown> = {}) => ({
    candidates: [{ finishReason: 'STOP', content: { parts: [{ text }] }, ...extra }],
});

describe('parseGeminiImageSafety', () => {
    it('returns null (retry another model) for empty, truncated or malformed replies', () => {
        expect(parseGeminiImageSafety(null)).toBeNull();
        expect(parseGeminiImageSafety({})).toBeNull();
        expect(parseGeminiImageSafety(reply('looks fine'))).toBeNull();
        expect(parseGeminiImageSafety({ candidates: [{ finishReason: 'MAX_TOKENS' }] })).toBeNull();
        expect(parseGeminiImageSafety(reply('{"verdict":"maybe"}'))).toBeNull();
    });

    it('ignores thought parts when reading the verdict', () => {
        const v = parseGeminiImageSafety({
            candidates: [
                {
                    content: {
                        parts: [
                            { text: '{"verdict":"block","category":"sexual"}', thought: true },
                            { text: '{"verdict":"allow","category":"none"}' },
                        ],
                    },
                },
            ],
        });
        expect(v?.safe).toBe(true);
    });

    it('blocks when promptFeedback.blockReason is set', () => {
        const v = parseGeminiImageSafety({
            promptFeedback: {
                blockReason: 'SAFETY',
                safetyRatings: [{ category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', probability: 'HIGH' }],
            },
        });
        expect(v?.safe).toBe(false);
        if (!v || v.safe) return;
        expect(v.categories).toEqual(['SEXUAL']);
    });

    it('blocks finishReason SAFETY', () => {
        expect(parseGeminiImageSafety({ candidates: [{ finishReason: 'SAFETY' }] })?.safe).toBe(false);
    });

    it('blocks MEDIUM+ sexual ratings even when the text says allow', () => {
        const v = parseGeminiImageSafety(
            reply('{"verdict":"allow","category":"none"}', {
                safetyRatings: [{ category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', probability: 'MEDIUM' }],
            }),
        );
        expect(v?.safe).toBe(false);
    });

    it('does not block on LOW / NEGLIGIBLE ratings', () => {
        const v = parseGeminiImageSafety(
            reply('{"verdict":"allow","category":"none"}', {
                safetyRatings: [
                    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', probability: 'LOW' },
                    { category: 'HARM_CATEGORY_HARASSMENT', probability: 'MEDIUM' },
                ],
            }),
        );
        expect(v?.safe).toBe(true);
    });

    it.each([
        ['sexual', 'SEXUAL'],
        ['profanity', 'PROFANITY'],
        ['gore', 'GORE'],
        ['hate', 'HATE'],
        ['off_topic', 'OFF_TOPIC'],
    ])('maps a %s block to %s', (category, expected) => {
        const v = parseGeminiImageSafety(reply(`{"verdict":"block","category":"${category}","reason":"x"}`));
        expect(v?.safe).toBe(false);
        if (!v || v.safe) return;
        expect(v.categories).toEqual([expected]);
    });

    it('allows a block verdict without a recognised category', () => {
        expect(parseGeminiImageSafety(reply('{"verdict":"block","category":"none"}'))?.safe).toBe(true);
    });

    it('allows a clean sports photo verdict', () => {
        expect(parseGeminiImageSafety(reply('{"verdict":"allow","category":"none","reason":"football match"}'))?.safe).toBe(
            true,
        );
    });
});
