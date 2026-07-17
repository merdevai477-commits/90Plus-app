/**
 * 365Scores SportRadar Live Match Tracker (LMT).
 * Resolves partnerId via backend; brands GetWidget HTML like c:\DD\js\app.js.
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
  /** Backend HTML shell (optional). Prefer widgetUrl / branded html in WebView. */
  embedUrl: string;
};

type LmtJsonResponse = {
  status?: string;
  response?: Omit<Scores365LmtInfo, 'embedUrl'>;
};

/** 1×1 transparent GIF — hideBrand path (DD HIDE_PITCH_BRAND). */
export const LMT_TRANSPARENT_LOGO =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/** High-contrast 90PLUS-app mark for SportRadar pitchLogo / banners. */
export const LMT_DEFAULT_BRAND_LOGO_DATA_URI =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="84" viewBox="0 0 280 84"><text x="140" y="54" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="900" font-size="34" fill="rgba(0,0,0,0.45)" letter-spacing="0.8">90PLUS-app</text><text x="140" y="52" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="900" font-size="34" fill="#FFFFFF" letter-spacing="0.8">90PLUS-app</text></svg>`,
  );

export const LMT_WIDGET_BASE_ORIGIN = 'https://lmtsrcf.365scores.com';

function buildEmbedUrl(kind: 'fixture' | 'game', id: number): string {
  const base = getApiUrl().replace(/\/$/, '');
  const path =
    kind === 'fixture'
      ? `football/cached/365/fixture/${id}/lmt`
      : `football/cached/365/game/${id}/lmt`;
  return `${base}/${path}`;
}

/** Absolute URL to hosted SVG (when data URI not preferred). */
export function resolveLmtBrandLogoUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_LMT_PITCH_LOGO_URL?.trim();
  if (fromEnv) return fromEnv;
  const api = getApiUrl().replace(/\/$/, '');
  const origin = api.replace(/\/api$/i, '');
  return `${origin}/90plus-pitch-logo.svg`;
}

/**
 * Same replacements as DD `customizeWidgetHtml`.
 * Matches GetWidget shape:
 *   pitchLogo: "..."
 *   goalBannerImage: "..."
 *   widgetProps.vlmtCourtBannerUrl = "...";
 *
 * Also neutralize 365's iOS callback:
 *   window.location.href = "widgetrender://postrender"
 * WKWebView treats that custom scheme as NSURLErrorUnsupportedURL (-1002).
 */
export function customizeScores365LmtWidgetHtml(html: string, logoUrl: string): string {
  const logo = logoUrl.replace(/"/g, '\\"');
  return html
    .replace(/pitchLogo:\s*"[^"]*"/, `pitchLogo: "${logo}"`)
    .replace(/goalBannerImage:\s*"[^"]*"/, `goalBannerImage: "${logo}"`)
    .replace(
      /widgetProps\.vlmtCourtBannerUrl\s*=\s*"[^"]*";/,
      `widgetProps.vlmtCourtBannerUrl = "${logo}";`,
    )
    .replace(
      /window\.location\.href\s*=\s*["']widgetrender:\/\/[^"']*["']/g,
      '/* 90plus: blocked widgetrender:// for WKWebView */ void 0',
    );
}

export function resolveLmtBrandLogoForHtml(options?: {
  hideBrand?: boolean;
  brandLogoUrl?: string | null;
}): string {
  if (options?.hideBrand) return LMT_TRANSPARENT_LOGO;
  const custom = options?.brandLogoUrl?.trim();
  if (custom) return custom;
  // Prefer https host over data: SVG — safer for SportRadar/WKWebView asset loads.
  return resolveLmtBrandLogoUrl();
}

/** Fetch official GetWidget HTML and rewrite pitch branding (DD flow). */
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
  return customizeScores365LmtWidgetHtml(html, logo);
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
  // Backend resolveAppLanguage() reads `language` (not `lang`).
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
