import { Platform } from 'react-native';

/** Public HTTPS links for reel sharing (Android App Links + web fallback) */
export const REEL_SHARE_BASE_URL = 'https://90plus.app/reels';
export const PROFILE_SHARE_BASE_URL = 'https://90plus.app';

export const ANDROID_PACKAGE = 'com.mhmdsh1892.ninetyplusapp';

export const PLAY_STORE_URL =
  `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;

export const APP_STORE_URL = 'https://apps.apple.com/app/90plus/id6744076498';

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{1,64}$/;

export function normalizeShareUsername(username: string): string {
  return username.replace(/^@/, '').trim();
}

export function isValidShareUsername(username: string): boolean {
  return USERNAME_PATTERN.test(normalizeShareUsername(username));
}

export function buildReelShareUrl(reelId: string): string {
  return `${REEL_SHARE_BASE_URL}/${reelId}`;
}

export function buildReelDeepLink(reelId: string): string {
  return `ninetyplus://reel/${reelId}`;
}

/** HTTPS profile link — Android App Links open the app when installed */
export function buildProfileShareUrl(username: string): string {
  const clean = normalizeShareUsername(username);
  return `${PROFILE_SHARE_BASE_URL}/@${clean}`;
}

export function buildProfileDeepLink(username: string): string {
  const clean = normalizeShareUsername(username);
  return `ninetyplus://user/${clean}`;
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

/** Parse username from custom scheme or https profile share URLs */
export function parseProfileUsernameFromUrl(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();

  if (trimmed.startsWith('ninetyplus://user/')) {
    const username = normalizeShareUsername(
      trimmed.replace('ninetyplus://user/', '').split(/[?#]/)[0],
    );
    return isValidShareUsername(username) ? username : null;
  }

  if (trimmed.startsWith('ninetyplus://profile/')) {
    const username = normalizeShareUsername(
      trimmed.replace('ninetyplus://profile/', '').split(/[?#]/)[0],
    );
    return isValidShareUsername(username) ? username : null;
  }

  return null;
}

/** Play Store / App Store URL for the current platform */
export function getStoreUrl(): string {
  if (Platform.OS === 'ios') {
    return APP_STORE_URL || PLAY_STORE_URL;
  }
  return PLAY_STORE_URL;
}

/** Opens the store review screen on Android; falls back to listing URL elsewhere */
export function getStoreReviewUrl(): string {
  if (Platform.OS === 'android') {
    return `market://details?id=${ANDROID_PACKAGE}&showAllReviews=true`;
  }
  return getStoreUrl();
}

/** Share message with store link for Rank / Settings */
export function buildAppShareMessage(lang: 'ar' | 'en'): string {
  const url = getStoreUrl();
  if (lang === 'ar') {
    return `جرّب 90Plus — أفضل تطبيق لكرة القدم! توقعات، اختبارات، وأهداف مباشرة!\n${url}`;
  }
  return `Try 90Plus — the ultimate football app! Predictions, quizzes, and live highlights!\n${url}`;
}
