/**
 * Community image safety — scans a photo *before* it is stored on R2 so
 * nudity / porn / gore never gets a public URL.
 *
 * Uses Gemini's native safety ratings + a short classifier prompt.
 * Fail-closed if the key is missing or the call errors — a photo that was
 * never scanned must not reach the feed.
 */

import sharp from 'sharp';
import { logger } from '../utils/logger';

export type CommunityImageVerdict =
    | { safe: true; skipped?: boolean; raw?: string }
    | { safe: false; categories: string[]; raw: string };

const SCAN_EDGE = 640;
const TIMEOUT_MS = 12_000;
const SEXUAL = 'HARM_CATEGORY_SEXUALLY_EXPLICIT';

const SAFETY_SETTINGS = [
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_LOW_AND_ABOVE' },
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
] as const;

const PROMPT =
    'You are a content-safety classifier for a public football community (all ages). ' +
    'UNSAFE: pornography, sexual acts, visible genitals, female nipples, full nudity, ' +
    'sexualized close-ups, or graphic gore. Classical art and statues that show nudity are still UNSAFE here. ' +
    'SAFE: football matches, stadiums, kits, crowds, and shirtless male athletes celebrating. ' +
    'Reply with exactly:\nUser Safety: safe\n' +
    'or:\nUser Safety: unsafe\nSafety Categories: ...';

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
    const all = [preferred, 'gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3-flash-preview'].filter(
        (m, i, arr): m is string => !!m && arr.indexOf(m) === i,
    );
    return all;
}

type SafetyRating = { category?: string; probability?: string };

function ratingHits(r: SafetyRating): boolean {
    const p = (r.probability ?? '').toUpperCase();
    if (r.category === SEXUAL) return p === 'LOW' || p === 'MEDIUM' || p === 'HIGH';
    return p === 'HIGH';
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
        const text = (part as { text?: string }).text;
        if (typeof text === 'string') out += text;
    }
    return out.trim();
}

/** Pure — used by unit tests. */
export function parseGeminiImageSafety(payload: unknown): CommunityImageVerdict {
    if (!payload || typeof payload !== 'object') {
        return { safe: true, skipped: true };
    }
    const obj = payload as Record<string, unknown>;
    const prompt = obj.promptFeedback as { blockReason?: string } | undefined;
    if (prompt?.blockReason) {
        const cats = collectRatings(obj)
            .filter(ratingHits)
            .map((r) => r.category || prompt.blockReason || 'SAFETY');
        return { safe: false, categories: cats.length ? cats : [String(prompt.blockReason)], raw: 'blocked' };
    }
    const candidates = obj.candidates as Array<{ finishReason?: string }> | undefined;
    const finish = candidates?.[0]?.finishReason;
    if (finish && /safety/i.test(finish)) {
        return { safe: false, categories: ['SAFETY'], raw: finish };
    }
    const hitRatings = collectRatings(obj).filter(ratingHits);
    if (hitRatings.length) {
        return {
            safe: false,
            categories: hitRatings.map((r) => r.category || r.probability || 'SAFETY'),
            raw: 'ratings',
        };
    }
    const text = extractText(payload);
    const userLine = text.match(/user\s*safety\s*:\s*(safe|unsafe)/i);
    if (userLine && userLine[1].toLowerCase() === 'unsafe') {
        const catLine = text.match(/safety\s*categories\s*:\s*(.+)/i);
        const categories = catLine
            ? catLine[1]
                  .split(/[,;|]/)
                  .map((c) => c.trim())
                  .filter(Boolean)
                  .slice(0, 12)
            : ['UNSAFE'];
        return { safe: false, categories, raw: text.slice(0, 300) };
    }
    return { safe: true, raw: text.slice(0, 300) || undefined };
}

async function toScanJpeg(buffer: Buffer): Promise<Buffer> {
    return sharp(buffer, { failOn: 'error' })
        .rotate()
        .resize(SCAN_EDGE, SCAN_EDGE, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 62, mozjpeg: true })
        .toBuffer();
}

async function callModel(model: string, jpeg: Buffer, apiKey: string): Promise<unknown> {
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
            generationConfig: { temperature: 0, maxOutputTokens: 80 },
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

    const list = models();
    let lastErr: string | undefined;
    for (let i = 0; i < list.length; i++) {
        try {
            const payload = await callModel(list[i], jpeg, apiKey);
            return parseGeminiImageSafety(payload);
        } catch (err: any) {
            lastErr = err?.message || String(err);
            if (i < list.length - 1) continue;
        }
    }
    logger.warn('[community-image-safety] scan failed — blocking upload', { err: lastErr });
    return { safe: false, categories: ['SCAN_FAILED'], raw: lastErr || 'scan-failed' };
}
