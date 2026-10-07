/**
 * Friendly first name for push copy ("فينك يا محمد؟" / "Where are you, Mohamed?").
 *
 * Sources, in order:
 *   1. `displayName` (Clerk first + last name, or a user-chosen name) → first word.
 *   2. `username` with the auto-generated `_<clerkShortId>` suffix stripped
 *      (see ClerkUserService.findOrCreateUser), so `mohamed_ab12cd34` → `Mohamed`.
 *
 * Returns null when nothing human-looking is available (e.g. `user_2xY…`
 * placeholders), so callers can fall back to a generic vocative.
 */

const MAX_NAME_LENGTH = 20;
const ARABIC_CHAR = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;
const LETTER = /\p{L}/u;

function clerkShortId(clerkUserId: string | null | undefined): string {
    if (!clerkUserId) return '';
    return clerkUserId.replace('user_', '').slice(-8);
}

function isPlaceholderName(value: string, clerkUserId?: string | null): boolean {
    const lower = value.toLowerCase();
    if (/^user_[a-z0-9]{6,}$/i.test(value)) return true;
    if (lower === 'user' || lower === 'player' || lower === 'guest') return true;
    if (clerkUserId && lower.includes(clerkUserId.toLowerCase())) return true;
    return false;
}

function firstWord(raw: string): string {
    const cleaned = raw
        .replace(/@.*$/, '')
        .replace(/[_.\-]+/g, ' ')
        .replace(/[^\p{L}\p{M}\p{N}\s']/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const word = cleaned.split(' ').find((w) => LETTER.test(w)) ?? '';
    return word.replace(/\d+$/, '');
}

function prettify(word: string): string | null {
    if (!word || !LETTER.test(word)) return null;
    let out = word.length > MAX_NAME_LENGTH ? word.slice(0, MAX_NAME_LENGTH) : word;
    if (!ARABIC_CHAR.test(out) && out.length > 1) {
        out = out.charAt(0).toUpperCase() + out.slice(1).toLowerCase();
    }
    return out.length >= 2 ? out : null;
}

export function resolvePushFirstName(user: {
    displayName?: string | null;
    username?: string | null;
    clerkUserId?: string | null;
}): string | null {
    const shortId = clerkShortId(user.clerkUserId);
    let username = (user.username ?? '').trim();
    if (shortId && username.toLowerCase().endsWith(`_${shortId.toLowerCase()}`)) {
        username = username.slice(0, -(shortId.length + 1));
    }

    const display = (user.displayName ?? '').trim();
    const displayIsUsername = !!display && display === (user.username ?? '').trim();

    if (display && !displayIsUsername && !isPlaceholderName(display, user.clerkUserId)) {
        const name = prettify(firstWord(display));
        if (name) return name;
    }

    if (username && !isPlaceholderName(username, user.clerkUserId)) {
        const name = prettify(firstWord(username));
        if (name) return name;
    }

    return null;
}

/**
 * Keep punctuation on the correct side when a Latin name sits inside Arabic
 * copy (or vice versa): append an RLM / LRM mark after the name.
 */
export function bidiSafeName(name: string, language: 'ar' | 'en'): string {
    const hasArabic = ARABIC_CHAR.test(name);
    if (language === 'ar' && !hasArabic) return `${name}\u200F`;
    if (language === 'en' && hasArabic) return `${name}\u200E`;
    return name;
}
