/** Public HTTPS links for reel sharing (Android App Links + web fallback) */
export const REEL_SHARE_BASE_URL = 'https://90plus.app/reels';

export const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.mhmdsh1892.ninetyplusapp';

/** Reserved for future iOS App Store listing */
export const APP_STORE_URL = '';

export function buildReelShareUrl(reelId: string): string {
  return `${REEL_SHARE_BASE_URL}/${reelId}`;
}

export function buildReelDeepLink(reelId: string): string {
  return `ninetyplus://reel/${reelId}`;
}

/** Parse reel id from custom scheme or https share URLs */
export function parseReelIdFromUrl(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (trimmed.startsWith('ninetyplus://reel/')) {
    const id = trimmed.replace('ninetyplus://reel/', '').split(/[?#]/)[0];
    return id || null;
  }
  const httpsMatch = trimmed.match(/90plus\.app\/reels\/([a-f0-9-]+)/i);
  if (httpsMatch?.[1]) return httpsMatch[1];
  return null;
}
