/**
 * Community image safety — scans a photo *before* it is stored on R2 so
 * sexual content, obscene text, gore and obviously off-topic photos never
 * get a public URL.
 *
 * Posts are also reviewed by humans, so the classifier only blocks clear
 * violations and allows anything football-related or ambiguous.
 *
 * Fail-closed only when no model could produce a verdict at all (missing key,
 * every model erroring) — that surfaces as SCAN_FAILED ("try again"), never as
 * a guideline violation.
 */

import sharp from 'sharp';
import { logger } from '../utils/logger';

export type CommunityImageViolation = 'SEXUAL' | 'PROFANITY' | 'GORE' | 'HATE' | 'OFF_TOPIC';

export type CommunityImageVerdict =
    | { safe: true; skipped?: boolean; raw?: string }
    | { safe: false; categories: string[]; raw: string };

const SCAN_EDGE = 768;
const TIMEOUT_MS = 15_000;
const SEXUAL = 'HARM_CATEGORY_SEXUALLY_EXPLICIT';

const SAFETY_SETTINGS = [
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
] as const;

const VIOLATIONS: Record<string, CommunityImageViolation> = {
    sexual: 'SEXUAL',
    profanity: 'PROFANITY',
    gore: 'GORE',
    hate: 'HATE',
    off_topic: 'OFF_TOPIC',
};

const PROMPT = `You are the image moderator for a public, all-ages football (soccer) community app.
Users attach this image to a post. Human moderators review posts afterwards, so block ONLY clear, obvious violations. When in doubt, allow.

Block only if one of these is clearly true:
- "sexual": nudity, exposed genitals, female breasts/nipples or buttocks, sexual acts, pornography, or sexually suggestive content (lingerie/underwear posing, erotic or provocative body-focused poses, sexualized close-ups).
- "profanity": clearly readable text, a sign, banner or caption in the image that is obscene, vulgar, a sexual curse or a slur in any language (including Arabic/Egyptian slang and Franco-Arabic), or an obscene hand gesture such as the middle finger.
- "gore": graphic blood, severe open injuries, dead bodies or extreme violence.
- "hate": hate symbols (e.g. swastika) or content attacking people for race, religion or ethnicity.
- "off_topic": the image obviously has nothing to do with football or sport — nothing in it (people's clothing, objects, setting, screen, text or graphics) relates to football. Examples: food, pets, cars, landscapes, product ads, unrelated memes, screenshots of unrelated chats or apps, political or religious propaganda.

Always allow (football-related, not violations):
- matches, players, goal celebrations (including shirtless male players), referees, coaches, fans, ultras, tifos, flares in stadiums, stadiums, pitches, balls, boots, kits, jerseys, scarves, trophies, other sports;
- club or national-team logos, posters, edits, news or transfer graphics, stats, tables, scores, fixtures, lineup/formation or fantasy screenshots, TV broadcasts, football video games, screenshots of football apps (including dark, blurred or partly covered ones);
- football memes and banter without obscene words; people wearing football shirts or posing with a ball; normal fouls and on-pitch injuries without graphic gore;
- low-quality, dark, blurry, cropped or partially loaded images when nothing violating is visible.

Reply with JSON only: {"verdict":"allow"|"block","category":"none"|"sexual"|"profanity"|"gore"|"hate"|"off_topic","reason":"<max 12 words>"}`;

const RESPONSE_SCHEMA = {
    type: 'OBJECT',
    properties: {
        verdict: { type: 'STRING', enum: ['allow', 'block'] },
        category: { type: 'STRING', enum: ['none', 'sexual', 'profanity', 'gore', 'hate', 'off_topic'] },
        reason: { type: 'STRING' },
    },
    required: ['verdict', 'category'],
} as const;

export function isCommunityImageSafetyConfigured(): boolean {
    return !!geminiKey();
}

function geminiKey(): string | null {
    return (
        process.env.GEMINI_API_KEY?.trim() ||
        process.env.GEMINI_QUIZ_API_KEY?.trim() ||
        process.env.GOOGLE_API_KEY?.trim() ||
        null
    );
}

function geminiBase(): string {
    return (process.env.GEMINI_BASE_URL?.trim() || 'https://generativelanguage.googleapis.com/v1beta').replace(
        /\/$/,
        '',
    );
}

function models(): string[] {
    const preferred = process.env.COMMUNITY_IMAGE_SAFETY_MODEL?.trim();
    const all = [preferred, 'gemini-3-flash-preview', 'gemini-flash-lite-latest', 'gemini-3.8-flash'].filter(
        (m, i, arr): m is string => !!m && arr.indexOf(m) === i,
    );
    return all;
}

/** Gemini 3 models count thinking tokens against maxOutputTokens; keep it low so the verdict is never truncated. */
function thinkingConfig(model: string): Record<string, unknown> | undefined {
    return /gemini-3|-latest$/.test(model) ? { thinkingLevel: 'low' } : undefined;
}

type SafetyRating = { category?: string; probability?: string };

function ratingHits(r: SafetyRating): boolean {
    const p = (r.probability ?? '').toUpperCase();
    if (r.category === SEXUAL) return p === 'MEDIUM' || p === 'HIGH';
    return p === 'HIGH';
}

function ratingCategory(category: string | undefined): string {
    if (category === SEXUAL) return 'SEXUAL';
    if (category === 'HARM_CATEGORY_HATE_SPEECH') return 'HATE';
    if (category === 'HARM_CATEGORY_HARASSMENT') return 'PROFANITY';
    if (category === 'HARM_CATEGORY_DANGEROUS_CONTENT') return 'GORE';
    return 'SAFETY';
}

function collectRatings(payload: unknown): SafetyRating[] {
    if (!payload || typeof payload !== 'object') return [];
    const obj = payload as Record<string, unknown>;
    const out: SafetyRating[] = [];
    const prompt = obj.promptFeedback as { safetyRatings?: SafetyRating[] } | undefined;
    if (Array.isArray(prompt?.safetyRatings)) out.push(...prompt.safetyRatings);
    const candidates = obj.candidates as Array<{ safetyRatings?: SafetyRating[] }> | undefined;
    if (Array.isArray(candidates)) {
        for (const c of candidates) {
            if (Array.isArray(c?.safetyRatings)) out.push(...c.safetyRatings);
        }
    }
    return out;
}

function extractText(payload: unknown): string {
    if (!payload || typeof payload !== 'object') return '';
    const candidates = (payload as { candidates?: unknown[] }).candidates;
    if (!Array.isArray(candidates) || !candidates.length) return '';
    const parts = (candidates[0] as { content?: { parts?: unknown[] } })?.content?.parts;
    if (!Array.isArray(parts)) return '';
    let out = '';
    for (const part of parts) {
        if (!part || typeof part !== 'object') continue;
        const { text, thought } = part as { text?: string; thought?: boolean };
        if (typeof text === 'string' && !thought) out += text;
    }
    return out.trim();
}

function parseVerdictJson(text: string): { verdict?: string; category?: string; reason?: string } | null {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
        const parsed = JSON.parse(match[0]);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        return null;
    }
}

/**
 * Pure — used by unit tests. Returns `null` when the model produced no usable
 * verdict (empty / truncated / malformed), so the caller can try another model
 * instead of punishing the user for a model hiccup.
 */
export function parseGeminiImageSafety(payload: unknown): CommunityImageVerdict | null {
    if (!payload || typeof payload !== 'object') return null;
    const obj = payload as Record<string, unknown>;
    const prompt = obj.promptFeedback as { blockReason?: string } | undefined;
    const hitRatings = collectRatings(obj).filter(ratingHits);
    const hitCategories = [...new Set(hitRatings.map((r) => ratingCategory(r.category)))];

    if (prompt?.blockReason) {
        return {
            safe: false,
            categories: hitCategories.length ? hitCategories : ['SAFETY'],
            raw: `blocked:${prompt.blockReason}`,
        };
    }
    const candidates = obj.candidates as Array<{ finishReason?: string }> | undefined;
    const finish = candidates?.[0]?.finishReason;
    if (finish && /safety|prohibited|blocklist|image_safety/i.test(finish)) {
        return { safe: false, categories: hitCategories.length ? hitCategories : ['SAFETY'], raw: finish };
    }
    if (hitCategories.length) {
        return { safe: false, categories: hitCategories, raw: 'ratings' };
    }

    const text = extractText(payload);
    const json = parseVerdictJson(text);
    if (!json || (json.verdict !== 'allow' && json.verdict !== 'block')) return null;

    const violation = VIOLATIONS[String(json.category ?? '').toLowerCase()];
    if (json.verdict === 'block' && violation) {
        return { safe: false, categories: [violation], raw: text.slice(0, 300) };
    }
    return { safe: true, raw: text.slice(0, 300) };
}

async function toScanJpeg(buffer: Buffer): Promise<Buffer> {
    return sharp(buffer, { failOn: 'error' })
        .rotate()
        .resize(SCAN_EDGE, SCAN_EDGE, { fit: 'inside', withoutEnlargement: true })
        .flatten({ background: '#ffffff' })
        .jpeg({ quality: 70, mozjpeg: true })
        .toBuffer();
}

async function callModel(model: string, jpeg: Buffer, apiKey: string): Promise<unknown> {
    const thinking = thinkingConfig(model);
    const res = await fetch(`${geminiBase()}/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
            contents: [
                {
                    role: 'user',
                    parts: [
                        { text: PROMPT },
                        { inlineData: { mimeType: 'image/jpeg', data: jpeg.toString('base64') } },
                    ],
                },
            ],
            safetySettings: SAFETY_SETTINGS,
            generationConfig: {
                temperature: 0,
                maxOutputTokens: 1024,
                responseMimeType: 'application/json',
                responseSchema: RESPONSE_SCHEMA,
                ...(thinking ? { thinkingConfig: thinking } : {}),
            },
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = await res.text();
    if (!res.ok) {
        throw new Error(`Gemini HTTP ${res.status}: ${body.slice(0, 240)}`);
    }
    return JSON.parse(body) as unknown;
}

export async function classifyCommunityImage(buffer: Buffer): Promise<CommunityImageVerdict> {
    const apiKey = geminiKey();
    if (!apiKey) {
        logger.warn('[community-image-safety] no Gemini key — blocking upload');
        return { safe: false, categories: ['SCAN_UNAVAILABLE'], raw: 'no-key' };
    }
    let jpeg: Buffer;
    try {
        jpeg = await toScanJpeg(buffer);
    } catch (err: any) {
        logger.warn('[community-image-safety] resize failed:', err?.message);
        return { safe: false, categories: ['SCAN_FAILED'], raw: err?.message || 'resize' };
    }

    const errors: string[] = [];
    for (const model of models()) {
        try {
            const payload = await callModel(model, jpeg, apiKey);
            const verdict = parseGeminiImageSafety(payload);
            if (!verdict) {
                errors.push(`${model}: no verdict (${extractText(payload).slice(0, 80) || 'empty'})`);
                continue;
            }
            if (verdict.safe) {
                logger.info('[community-image-safety] allowed', { model, raw: verdict.raw });
            } else {
                logger.warn('[community-image-safety] blocked', {
                    model,
                    categories: verdict.categories,
                    raw: verdict.raw,
                });
            }
            return verdict;
        } catch (err: any) {
            errors.push(`${model}: ${err?.message || String(err)}`.slice(0, 200));
        }
    }
    logger.warn('[community-image-safety] scan failed — blocking upload', { errors });
    return { safe: false, categories: ['SCAN_FAILED'], raw: errors.join(' | ').slice(0, 300) || 'scan-failed' };
}
