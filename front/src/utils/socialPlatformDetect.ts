export type SocialPlatformId =
    | 'instagram'
    | 'twitter'
    | 'facebook'
    | 'youtube'
    | 'tiktok'
    | 'website'
    | 'linkedin'
    | 'snapchat'
    | 'whatsapp';

const HOST_RULES: Array<{ match: (host: string) => boolean; platform: SocialPlatformId }> = [
    { match: (h) => h.includes('instagram.com') || h === 'instagr.am', platform: 'instagram' },
    { match: (h) => h.includes('twitter.com') || h === 'x.com' || h.endsWith('.x.com'), platform: 'twitter' },
    {
        match: (h) =>
            h.includes('facebook.com') ||
            h === 'fb.com' ||
            h === 'fb.me' ||
            h.endsWith('.facebook.com') ||
            h.includes('messenger.com'),
        platform: 'facebook',
    },
    { match: (h) => h.includes('youtube.com') || h === 'youtu.be' || h.endsWith('.youtu.be'), platform: 'youtube' },
    { match: (h) => h.includes('tiktok.com'), platform: 'tiktok' },
    { match: (h) => h.includes('linkedin.com') || h === 'lnkd.in', platform: 'linkedin' },
    { match: (h) => h.includes('snapchat.com'), platform: 'snapchat' },
    { match: (h) => h === 'wa.me' || h.endsWith('.wa.me') || h.includes('whatsapp.com'), platform: 'whatsapp' },
];

const PHONE_RE = /^\+?\d{8,15}$/;

/**
 * Infer social platform from a pasted URL, handle, or phone number.
 * Returns null when the input is empty or not a recognizable link.
 */
export function detectSocialPlatformFromUrl(url: string): SocialPlatformId | null {
    const trimmed = url.trim();
    if (!trimmed) return null;

    const compact = trimmed.replace(/[\s()-]/g, '');
    if (PHONE_RE.test(compact)) return 'whatsapp';

    let host = '';
    try {
        const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
        host = new URL(withProto).hostname.toLowerCase().replace(/^www\./, '');
    } catch {
        return null;
    }

    for (const { match, platform } of HOST_RULES) {
        if (match(host)) return platform;
    }

    if (host.includes('.')) return 'website';
    return null;
}

/** Prefix https:// when the pasted value has no scheme. Empty input returns null. */
export function normalizePastedUrl(raw: string): string | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;

    const compact = trimmed.replace(/[\s()-]/g, '');
    if (PHONE_RE.test(compact)) {
        const digits = compact.replace(/^\+/, '');
        return `https://wa.me/${digits}`;
    }

    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
}
