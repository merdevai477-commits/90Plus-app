/**
 * 365Scores SportRadar Live Match Tracker (LMT).
 * Resolves partnerId via backend; brands GetWidget HTML so 365 marks never show.
 */

import { getApiUrl } from '../config/api.config';

export type Scores365LmtInfo = {
  gameId: number;
  fixtureId: number | null;
  partnerId: string;
  langId: number;
  sportTypeId: number;
  widgetUrl: string;
  widgetType: string;
  widgetRatio: number | null;
  homeName: string | null;
  awayName: string | null;
  statusText: string | null;
  /** Backend HTML shell — preferred URI fallback (never raw GetWidget). */
  embedUrl: string;
};

type LmtJsonResponse = {
  status?: string;
  response?: Omit<Scores365LmtInfo, 'embedUrl'>;
};

/** 1×1 transparent GIF — hideBrand path (DD HIDE_PITCH_BRAND). */
export const LMT_TRANSPARENT_LOGO =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

export const LMT_WIDGET_BASE_ORIGIN = 'https://lmtsrcf.365scores.com';

export const LMT_BALL_TRAIL_COLOR = '#8B5CF6';

/**
 * SportRadar draws the ball trail as `polyline.sr-lmt-bspot__line` with
 * stroke="#fff" presentation attributes — CSS rules override those.
 * Also hard-hide leftover 365 brand assets if SportRadar injects them later.
 */
const LMT_CUSTOM_CSS = `<style id="90plus-lmt">
.sr-lmt-bspot__line{stroke:${LMT_BALL_TRAIL_COLOR}!important;stroke-opacity:.95!important}
img.sr-lmt-1-pitchlogo__wrapper{opacity:.9!important}
img[src*="365-LogoNew"],
img[src*="ALL_SPORT_TYPES_PITCH_LOGO"],
img[src*="Branding/365"],
img[src*="Widgets/Sportradar/365"]{
  opacity:0!important;
  visibility:hidden!important;
}
</style>`;

const THREE_SIX_FIVE_BRAND_URL =
  /https:\/\/(?:imagescache|imagecache)\.365scores\.com\/[^"'\\\s]*(?:365-LogoNew|ALL_SPORT_TYPES_PITCH_LOGO|Widgets\/Sportradar\/365)[^"'\\\s]*/gi;
const THREE_SIX_FIVE_COURT_BANNER =
  /https:\/\/[^"'\\\s]*Branding\/365\/[^"'\\\s]*/gi;

/**
 * Bump when replacing a brand image under public/. Android WebView keeps
 * serving a cached failed response for an unchanged URL.
 */
const LMT_BRAND_ASSET_VERSION = '4';

function backendOrigin(): string {
  return getApiUrl().replace(/\/$/, '').replace(/\/api$/i, '');
}

function brandAssetUrl(file: string): string {
  return `${backendOrigin()}/${file}?v=${LMT_BRAND_ASSET_VERSION}`;
}

function buildEmbedUrl(kind: 'fixture' | 'game', id: number): string {
  const base = getApiUrl().replace(/\/$/, '');
  const path =
    kind === 'fixture'
      ? `football/cached/365/fixture/${id}/lmt`
      : `football/cached/365/game/${id}/lmt`;
  return `${base}/${path}`;
}

/** Transparent "90 PLUS" wordmark shown mid-pitch / VLMT splash. */
export function resolveLmtBrandLogoUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_LMT_PITCH_LOGO_URL?.trim();
  if (fromEnv) return fromEnv;
  return brandAssetUrl('90plus-lmt-pitch-wordmark.png');
}

/** Wide logo tiled along the pitch-side ad boards and goal banners. */
export function resolveLmtBannerUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_LMT_BANNER_URL?.trim();
  if (fromEnv) return fromEnv;
  return brandAssetUrl('90plus-lmt-banner.png');
}

/**
 * Rewrite GetWidget HTML:
 *   pitchLogo / vlmtLoaderImageUrl → 90PLUS wordmark
 *   goalBannerImage / vlmtCourtBannerUrl → 90PLUS banner
 * plus a nuclear URL sweep + CSS hide for any leftover 365 assets.
 */
export function customizeScores365LmtWidgetHtml(
  html: string,
  logoUrl: string,
  bannerUrl: string = logoUrl,
): string {
  const logoProp = logoUrl.replace(/"/g, '\\"');
  const bannerProp = bannerUrl.replace(/"/g, '\\"');
  const branded = html
    .replace(/pitchLogo:\s*(["'])[^"']*\1/g, `pitchLogo: "${logoProp}"`)
    .replace(/goalBannerImage:\s*(["'])[^"']*\1/g, `goalBannerImage: "${bannerProp}"`)
    .replace(/vlmtLoaderImageUrl:\s*(["'])[^"']*\1/g, `vlmtLoaderImageUrl: "${logoProp}"`)
    .replace(
      /widgetProps\.vlmtCourtBannerUrl\s*=\s*(["'])[^"']*\1\s*;/g,
      `widgetProps.vlmtCourtBannerUrl = "${bannerProp}";`,
    )
    .replace(THREE_SIX_FIVE_BRAND_URL, logoUrl)
    .replace(THREE_SIX_FIVE_COURT_BANNER, bannerUrl)
    .replace(
      /window\.location\.href\s*=\s*["']widgetrender:\/\/[^"']*["']/g,
      '/* 90plus: blocked widgetrender:// for WKWebView */ void 0',
    );

  assertNo365BrandAssets(branded);

  return /<\/head>/i.test(branded)
    ? branded.replace(/<\/head>/i, `${LMT_CUSTOM_CSS}</head>`)
    : `${LMT_CUSTOM_CSS}${branded}`;
}

export function assertNo365BrandAssets(html: string): void {
  if (/vlmtLoaderImageUrl:\s*(["'])[^"']*365[^"']*\1/i.test(html)) {
    throw new Error('GetWidget HTML still has 365 vlmtLoaderImageUrl after branding');
  }
  if (
    /pitchLogo:\s*(["'])[^"']*(?:365|ALL_SPORT_TYPES_PITCH_LOGO)[^"']*\1/i.test(html)
  ) {
    throw new Error('GetWidget HTML still has 365 pitchLogo after branding');
  }
  if (/goalBannerImage:\s*(["'])[^"']*365[^"']*\1/i.test(html)) {
    throw new Error('GetWidget HTML still has 365 goalBannerImage after branding');
  }
  if (/vlmtCourtBannerUrl\s*=\s*(["'])[^"']*365[^"']*\1/i.test(html)) {
    throw new Error('GetWidget HTML still has 365 court banner after branding');
  }
  if (
    /https?:\/\/[^"'\\\s]*(?:365-LogoNew|ALL_SPORT_TYPES_PITCH_LOGO|Branding\/365)/i.test(
      html,
    )
  ) {
    throw new Error('GetWidget HTML still contains 365 brand asset URLs');
  }
}

export function resolveLmtBrandLogoForHtml(options?: {
  hideBrand?: boolean;
  brandLogoUrl?: string | null;
}): string {
  if (options?.hideBrand) return LMT_TRANSPARENT_LOGO;
  const custom = options?.brandLogoUrl?.trim();
  if (custom) return custom;
  return resolveLmtBrandLogoUrl();
}

export function resolveLmtBannerForHtml(options?: { hideBrand?: boolean }): string {
  if (options?.hideBrand) return LMT_TRANSPARENT_LOGO;
  return resolveLmtBannerUrl();
}

/** Fetch official GetWidget HTML and rewrite pitch branding. */
async function fetchBrandedLmtHtmlOnce(
  widgetUrl: string,
  options?: { hideBrand?: boolean; brandLogoUrl?: string | null },
): Promise<string> {
  const res = await fetch(widgetUrl);
  if (!res.ok) {
    throw new Error(`GetWidget HTTP ${res.status}`);
  }
  const html = await res.text();
  if (!html || !/pitchLogo\s*:/.test(html)) {
    throw new Error('GetWidget HTML missing pitchLogo');
  }
  const logo = resolveLmtBrandLogoForHtml(options);
  const banner = resolveLmtBannerForHtml(options);
  return customizeScores365LmtWidgetHtml(html, logo, banner);
}

export async function fetchBrandedLmtHtml(
  widgetUrl: string,
  options?: { hideBrand?: boolean; brandLogoUrl?: string | null },
): Promise<string> {
  try {
    return await fetchBrandedLmtHtmlOnce(widgetUrl, options);
  } catch (firstErr) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    try {
      return await fetchBrandedLmtHtmlOnce(widgetUrl, options);
    } catch {
      throw firstErr;
    }
  }
}

async function fetchLmtJson(
  path: string,
  options?: { language?: string; force?: boolean },
): Promise<Omit<Scores365LmtInfo, 'embedUrl'> | null> {
  const params = new URLSearchParams({ format: 'json' });
  if (options?.language) params.set('language', options.language);
  if (options?.force) params.set('fresh', '1');

  try {
    const base = getApiUrl().replace(/\/$/, '');
    const res = await fetch(`${base}${path}?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    });
    if (res.status === 404 || res.status === 503) return null;
    if (!res.ok) return null;
    const data = (await res.json()) as LmtJsonResponse;
    const info = data?.response;
    if (!info?.partnerId || !info?.widgetUrl) return null;
    return info;
  } catch {
    return null;
  }
}

export async function fetchFixtureLmt(
  fixtureId: number,
  options?: { language?: string; force?: boolean },
): Promise<Scores365LmtInfo | null> {
  if (!fixtureId || fixtureId <= 0) return null;
  const info = await fetchLmtJson(
    `/football/cached/365/fixture/${fixtureId}/lmt`,
    options,
  );
  if (!info) return null;
  return { ...info, embedUrl: buildEmbedUrl('fixture', fixtureId) };
}

export async function fetchGameLmt(
  gameId: number,
  options?: { language?: string; force?: boolean },
): Promise<Scores365LmtInfo | null> {
  if (!gameId || gameId <= 0) return null;
  const info = await fetchLmtJson(`/football/cached/365/game/${gameId}/lmt`, options);
  if (!info) return null;
  return { ...info, embedUrl: buildEmbedUrl('game', gameId) };
}
