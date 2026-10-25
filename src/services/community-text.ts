/**
 * Pure helpers for Community text: normalisation, #hashtag and @mention
 * extraction. Kept dependency-free so they are unit-testable and so the app
 * can mirror the exact same rules when highlighting text.
 */

export const POST_MAX_LENGTH = 2000;
export const COMMENT_MAX_LENGTH = 1000;
export const MAX_HASHTAGS = 10;
export const MAX_MENTIONS = 10;

const HASHTAG_RE = /(^|[^\p{L}\p{N}_&])#([\p{L}\p{N}_]{1,50})/gu;
const MENTION_RE = /(^|[^\p{L}\p{N}_.@])@([A-Za-z0-9_.]{2,30})/gu;

/** Trim, normalise line endings and cap blank-line runs at one empty line. */
export function normalizeCommunityText(raw: unknown): string {
    if (typeof raw !== 'string') return '';
    return raw
        .replace(/\r\n?/g, '\n')
        .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

/** Lowercased, de-duplicated hashtag names (without '#'), in order of appearance. */
export function extractHashtags(text: string, max = MAX_HASHTAGS): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const m of text.matchAll(HASHTAG_RE)) {
        const tag = m[2].replace(/_+$/, '').toLowerCase();
        if (!tag || /^\d+$/.test(tag) || seen.has(tag)) continue;
        seen.add(tag);
        out.push(tag);
        if (out.length >= max) break;
    }
    return out;
}

/** Lowercased, de-duplicated usernames (without '@'), in order of appearance. */
export function extractMentions(text: string, max = MAX_MENTIONS): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const m of text.matchAll(MENTION_RE)) {
        const name = m[2].replace(/\.+$/, '').toLowerCase();
        if (name.length < 2 || seen.has(name)) continue;
        seen.add(name);
        out.push(name);
        if (out.length >= max) break;
    }
    return out;
}

export interface FeedCursor {
    createdAt: Date;
    id: string;
}

export function encodeCursor(c: FeedCursor): string {
    return Buffer.from(`${c.createdAt.toISOString()}|${c.id}`, 'utf8').toString('base64url');
}

export function decodeCursor(raw: unknown): FeedCursor | null {
    if (typeof raw !== 'string' || !raw) return null;
    try {
        const [iso, id] = Buffer.from(raw, 'base64url').toString('utf8').split('|');
        const createdAt = new Date(iso);
        if (!id || Number.isNaN(createdAt.getTime())) return null;
        return { createdAt, id };
    } catch {
        return null;
    }
}
