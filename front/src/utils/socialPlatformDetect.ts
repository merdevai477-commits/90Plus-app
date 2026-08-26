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
    { match: (h) => h.includes('instagram.com'), platform: 'instagram' },
    { match: (h) => h.includes('twitter.com') || h === 'x.com' || h.endsWith('.x.com'), platform: 'twitter' },
    { match: (h) => h.includes('facebook.com') || h === 'fb.com' || h.endsWith('.facebook.com'), platform: 'facebook' },
    { match: (h) => h.includes('youtube.com') || h === 'youtu.be', platform: 'youtube' },
    { match: (h) => h.includes('tiktok.com'), platform: 'tiktok' },
    { match: (h) => h.includes('linkedin.com'), platform: 'linkedin' },
    { match: (h) => h.includes('snapchat.com'), platform: 'snapchat' },
    { match: (h) => h === 'wa.me' || h.endsWith('.wa.me') || h.includes('whatsapp.com'), platform: 'whatsapp' },
];

/**
 * Infer social platform from a pasted or typed URL (hostname).
 * Returns null when the input is empty or not a recognizable URL.
 */
export function detectSocialPlatformFromUrl(url: string): SocialPlatformId | null {
    const trimmed = url.trim();
    if (!trimmed) return null;

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
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
}
