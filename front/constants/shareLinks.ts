import { Linking, Platform } from 'react-native';

/** Custom production domain */
export const DEFAULT_SHARE_BASE_URL =
  'https://90plus.pro';

function resolveShareBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_SHARE_BASE_URL?.trim().replace(/\/$/, '');
  return fromEnv || DEFAULT_SHARE_BASE_URL;
}

/** Public HTTPS base — share landing pages live on the backend root (not /api) */
export const SHARE_BASE_URL = resolveShareBaseUrl();

export const SHARE_DOMAIN = (() => {
  try {
    return new URL(SHARE_BASE_URL).hostname;
  } catch {
    return '90plus.pro';
  }
})();

/** Public HTTPS links for reel sharing (Android App Links + web fallback) */
export const REEL_SHARE_BASE_URL = `${SHARE_BASE_URL}/reels`;
export const PROFILE_SHARE_BASE_URL = SHARE_BASE_URL;
export const APP_SHARE_BASE_URL = SHARE_BASE_URL;

export const ANDROID_PACKAGE = 'com.mhmdsh1892.ninetyplusapp';

/**
 * Release signing fingerprints — must match Google Play upload key.
 * Server serves SHA-256 via /.well-known/assetlinks.json
 */
export const ANDROID_RELEASE_SHA1 =
  '7D:17:3D:86:F4:B5:95:A3:AC:ED:23:3E:BD:B0:23:B3:CA:4F:F8:29';
export const ANDROID_RELEASE_SHA256 =
  'B9:AF:90:A5:F8:31:6E:B3:67:D2:94:EA:ED:ED:58:99:F6:BE:9C:FE:6A:9B:29:70:72:32:C4:D4:D0:07:C6:E8';

export const PLAY_STORE_URL =
  `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;

/** Google Play listing with reviews section (HTTPS — works in browser + redirects to app) */
export const PLAY_STORE_REVIEW_URL = `${PLAY_STORE_URL}&showAllReviews=true`;

/** Google Play app deep link with reviews section */
export const PLAY_STORE_MARKET_REVIEW_URL =
  `market://details?id=${ANDROID_PACKAGE}&showAllReviews=true`;

// App Store ID must match `ascAppId` in eas.json (App Store Connect app id).
export const APP_STORE_URL = 'https://apps.apple.com/app/90plus/id6758296989';

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{1,64}$/;

export function normalizeShareUsername(username: string): string {
  return username.replace(/^@/, '').trim();
}

export function isValidShareUsername(username: string): boolean {
  return USERNAME_PATTERN.test(normalizeShareUsername(username));
}

export function buildReelShareUrl(reelId: string): string {
  const id = reelId?.trim();
  if (!id) return REEL_SHARE_BASE_URL;
  return `${REEL_SHARE_BASE_URL}/${id}`;
}

export function buildReelDeepLink(reelId: string): string {
  return `ninetyplus://reel/${reelId}`;
}

/**
 * Payload for React Native `Share.share` when sharing a reel.
 * Always includes the public HTTPS link so recipients can open the app / web.
 */
export function buildReelSharePayload(options: {
  reelId: string;
  creatorName?: string;
  description?: string;
  lang?: 'ar' | 'en';
}): { message: string; title: string; url: string } {
  const url = buildReelShareUrl(options.reelId);
  const name = (options.creatorName || '').trim() || '90Plus';
  const desc = (options.description || '').trim();
  const shortDesc =
    desc.length > 120 ? `${desc.slice(0, 117).trimEnd()}…` : desc;
  const lang = options.lang === 'en' ? 'en' : 'ar';

  const message =
    lang === 'en'
      ? shortDesc
        ? `Check out this clip from ${name} on 90Plus!\n${shortDesc}\n\n${url}`
        : `Check out this clip from ${name} on 90Plus!\n${url}`
      : shortDesc
        ? `شاهد هذا المقطع من ${name} على 90Plus!\n${shortDesc}\n\n${url}`
        : `شاهد هذا المقطع من ${name} على 90Plus!\n${url}`;

  return { message, title: '90Plus', url };
}

/**
 * HTTPS profile link — Android App Links / iOS Universal Links open the app.
 * Uses `/u/:username` (not `/@…`) so chat apps do not treat the path as a mention.
 * Legacy `/@username` links still resolve on the server and in {@link parseProfileUsernameFromUrl}.
 */
export function buildProfileShareUrl(username: string): string {
  const clean = normalizeShareUsername(username);
  if (!isValidShareUsername(clean)) return PROFILE_SHARE_BASE_URL;
  return `${PROFILE_SHARE_BASE_URL}/u/${clean}`;
}

export function buildProfileDeepLink(username: string): string {
  const clean = normalizeShareUsername(username);
  return `ninetyplus://user/${clean}`;
}

/**
 * Public link included when inviting friends to install 90Plus.
 * Android → Play Store listing (direct install).
 * iOS → App Store listing (direct install).
 * Other (web) → 90plus.pro landing (smart fallback to either store).
 */
export function buildAppShareUrl(): string {
  if (Platform.OS === 'android') {
    return PLAY_STORE_URL;
  }
  if (Platform.OS === 'ios') {
    return APP_STORE_URL;
  }
  return APP_SHARE_BASE_URL;
}

/** Parse reel id from custom scheme or https share URLs */
export function parseReelIdFromUrl(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (trimmed.startsWith('ninetyplus://reel/')) {
    const id = trimmed.replace('ninetyplus://reel/', '').split(/[?#]/)[0];
    return id || null;
  }
  const httpsMatch = trimmed.match(/\/reels\/([a-f0-9-]+)/i);
  if (httpsMatch?.[1]) return httpsMatch[1];
  return null;
}

/** Parse username from custom scheme or https profile share URLs */
export function parseProfileUsernameFromUrl(url: string): string | null {
  if (!url) return null;
  let trimmed = url.trim();
  try {
    // Chat apps / QR scanners often percent-encode `@` as %40.
    trimmed = decodeURIComponent(trimmed);
  } catch {
    /* keep raw */
  }

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

  // Canonical: https://90plus.pro/u/username
  const pathMatch = trimmed.match(/\/u\/([a-zA-Z0-9_]{1,64})(?:[/?#]|$)/i);
  if (pathMatch?.[1]) {
    const username = normalizeShareUsername(pathMatch[1]);
    return isValidShareUsername(username) ? username : null;
  }

  // Legacy: https://90plus.pro/@username
  const atMatch = trimmed.match(/\/@([a-zA-Z0-9_]{1,64})/i);
  if (atMatch?.[1]) {
    const username = normalizeShareUsername(atMatch[1]);
    return isValidShareUsername(username) ? username : null;
  }

  return null;
}

/* ── Share & Win referrals ─────────────────────────────────────────────── */

/** Codes are 6 chars from an unambiguous alphabet — must match the backend. */
const REFERRAL_CODE_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;

export function normalizeReferralCode(code: string): string {
  return String(code ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export function isValidReferralCode(code: string): boolean {
  return REFERRAL_CODE_PATTERN.test(normalizeReferralCode(code));
}

/** HTTPS invite link — Android App Links / iOS Universal Links open the app. */
export function buildReferralShareUrl(code: string): string {
  return `${SHARE_BASE_URL}/invite/${normalizeReferralCode(code)}`;
}

export function buildReferralDeepLink(code: string): string {
  return `ninetyplus://invite/${normalizeReferralCode(code)}`;
}

/** Parse an invite code from the custom scheme or an https invite/ref URL. */
export function parseReferralCodeFromUrl(url: string): string | null {
  return parseInviteFromUrl(url)?.code ?? null;
}

/** Parse code + optional click_id (?c= / click_id=) from invite URLs. */
export function parseInviteFromUrl(
  url: string,
): { code: string; clickId: string | null } | null {
  if (!url) return null;
  const trimmed = url.trim();

  let code: string | null = null;
  const custom = trimmed.match(/ninetyplus:\/\/(?:invite|ref)\/([A-Za-z0-9]+)/i);
  if (custom?.[1]) code = normalizeReferralCode(custom[1]);
  if (!code) {
    const https = trimmed.match(/\/(?:invite|ref)\/([A-Za-z0-9]+)/i);
    if (https?.[1]) code = normalizeReferralCode(https[1]);
  }
  if (!code || !isValidReferralCode(code)) return null;

  let clickId: string | null = null;
  const m = trimmed.match(/[?&](?:c|click_id)=([A-Za-z0-9_-]{8,64})/i);
  if (m?.[1]) clickId = m[1];

  return { code, clickId };
}

/**
 * Invite message for `Share.share`. The link is the referral URL — the whole
 * point of Share & Win — rather than the plain store listing.
 */
export function buildReferralSharePayload(
  code: string,
  lang: 'ar' | 'en',
): { message: string; title: string } {
  const link = buildReferralShareUrl(code);
  const message =
    lang === 'ar'
      ? `انضم إليّ في 90Plus — أفضل تطبيق لكرة القدم! سجّل من رابطي واربح معي جوائز الأسبوع 🎁\n${link}`
      : `Join me on 90Plus — the ultimate football app! Sign up with my link and help me win this week's prize 🎁\n${link}`;

  return { message, title: '90Plus' };
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
    return PLAY_STORE_MARKET_REVIEW_URL;
  }
  return getStoreUrl();
}

/**
 * Opens the platform store for rating.
 * Android: Play Store app (market://) then HTTPS with showAllReviews=true.
 * iOS: App Store listing.
 */
export async function openAppStoreForRating(): Promise<boolean> {
  if (Platform.OS === 'android') {
    try {
      await Linking.openURL(PLAY_STORE_MARKET_REVIEW_URL);
      return true;
    } catch {
      try {
        await Linking.openURL(PLAY_STORE_REVIEW_URL);
        return true;
      } catch {
        return false;
      }
    }
  }

  try {
    await Linking.openURL(APP_STORE_URL || PLAY_STORE_URL);
    return true;
  } catch {
    return false;
  }
}

/** Share message for inviting friends — link matches {@link buildAppShareUrl}. */
export function buildAppShareMessage(lang: 'ar' | 'en'): string {
  const inviteUrl = buildAppShareUrl();
  if (lang === 'ar') {
    return `جرّب 90Plus — أفضل تطبيق لكرة القدم! توقعات، اختبارات، وأهداف مباشرة!\n${inviteUrl}`;
  }
  return `Try 90Plus — the ultimate football app! Predictions, quizzes, and live highlights!\n${inviteUrl}`;
}

/** Payload for React Native `Share.share` when promoting the app (not reels/profiles). */
export function buildAppSharePayload(lang: 'ar' | 'en'): {
  message: string;
  title: string;
} {
  return {
    message: buildAppShareMessage(lang),
    title: '90Plus',
  };
}
