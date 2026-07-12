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

/** High-contrast 90PLUS-app mark (SVG data URI) — last-resort if hosted PNG unavailable. */
export const LMT_DEFAULT_BRAND_LOGO_DATA_URI =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="84" viewBox="0 0 280 84"><text x="140" y="54" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="900" font-size="34" fill="rgba(0,0,0,0.45)" letter-spacing="0.8">90PLUS-app</text><text x="140" y="52" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="900" font-size="34" fill="#FFFFFF" letter-spacing="0.8">90PLUS-app</text></svg>`,
  );

export const LMT_WIDGET_BASE_ORIGIN = 'https://lmtsrcf.365scores.com';

/** Known 365 / SportRadar brand asset patterns still present after a failed rewrite. */
const LMT_365_ASSET_RE =
  /ALL_SPORT_TYPES_PITCH|T_B_365|365-LogoNew|Branding\/365|Widgets\/Sportradar\/365/i;

/**
 * Injected on every LMT WebView load (HTML + URI, iOS + Android).
 * Swaps 365 brand images and injects CSS so residual marks stay hidden.
 */
export function buildLmtBrandInjectScript(logoUrl: string): string {
  const logo = JSON.stringify(logoUrl);
  return `
(function () {
  var LOGO = ${logo};
  var RE = /365|scores365|sportradar\\/|ALL_SPORT_TYPES_PITCH|T_B_365|365-LogoNew|Branding\\/365|pitch.?logo|goal.?banner|Widgets\\/Sportradar/i;

  function isBrandSrc(s) {
    return !!s && s !== LOGO && RE.test(String(s));
  }

  function swapImg(img) {
    try {
      var s = img.getAttribute('src') || img.src || '';
      if (!isBrandSrc(s)) return;
      img.setAttribute('src', LOGO);
      try { img.src = LOGO; } catch (e) {}
      img.style.opacity = '1';
      img.style.visibility = 'visible';
    } catch (e) {}
  }

  function applyCss() {
    try {
      if (document.getElementById('np-lmt-brand-css')) return;
      var style = document.createElement('style');
      style.id = 'np-lmt-brand-css';
      style.textContent = [
        'img[src*="365"],',
        'img[src*="ALL_SPORT_TYPES_PITCH"],',
        'img[src*="T_B_365"],',
        'img[src*="365-LogoNew"],',
        'img[src*="Branding/365"],',
        'img[src*="Widgets/Sportradar"] {',
        '  content: url(' + JSON.stringify(LOGO) + ') !important;',
        '}'
      ].join('\\n');
      (document.head || document.documentElement).appendChild(style);
    } catch (e) {}
  }

  function patchConfig() {
    try {
      if (window.widgetProps && typeof window.widgetProps === 'object') {
        window.widgetProps.vlmtCourtBannerUrl = LOGO;
      }
    } catch (e) {}
    try {
      // Some SIR builds keep a global options bag.
      var keys = ['pitchLogo', 'goalBannerImage', 'onPitchLogo'];
      keys.forEach(function (k) {
        try {
          if (window[k] && isBrandSrc(window[k])) window[k] = LOGO;
        } catch (e) {}
      });
    } catch (e) {}
  }

  function patch() {
    applyCss();
    patchConfig();
    try {
      document.querySelectorAll('img').forEach(swapImg);
    } catch (e) {}
  }

  patch();
  try {
    new MutationObserver(patch).observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src'],
    });
  } catch (e) {}
  try {
    setInterval(patch, 1500);
  } catch (e) {}
  true;
})();
`.trim();
}

function buildEmbedUrl(kind: 'fixture' | 'game', id: number): string {
  const base = getApiUrl().replace(/\/$/, '');
  const path =
    kind === 'fixture'
      ? `football/cached/365/fixture/${id}/lmt`
      : `football/cached/365/game/${id}/lmt`;
  return `${base}/${path}`;
}

/** Absolute URL to hosted PNG (SportRadar pitchLogo expects a raster image). */
export function resolveLmtBrandLogoUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_LMT_PITCH_LOGO_URL?.trim();
  if (fromEnv) return fromEnv;
  const api = getApiUrl().replace(/\/$/, '');
  const origin = api.replace(/\/api$/i, '');
  return `${origin}/90plus-pitch-logo.png`;
}

/**
 * Same replacements as DD `customizeWidgetHtml`, plus URL-level wipe of known
 * 365 Sportradar brand assets so nothing 365-branded remains in the HTML.
 */
export function customizeScores365LmtWidgetHtml(html: string, logoUrl: string): string {
  const logo = logoUrl.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  let out = html
    .replace(/pitchLogo:\s*"[^"]*"/g, `pitchLogo: "${logo}"`)
    .replace(/goalBannerImage:\s*"[^"]*"/g, `goalBannerImage: "${logo}"`)
    .replace(
      /widgetProps\.vlmtCourtBannerUrl\s*=\s*"[^"]*";/g,
      `widgetProps.vlmtCourtBannerUrl = "${logo}";`,
    );

  // Nuclear pass: any leftover Sportradar/365 brand image URLs → our logo.
  out = out
    .replace(
      /https?:\/\/imagescache\.365scores\.com\/image\/upload\/[^"'\s]*Widgets\/Sportradar\/[^"'\s]*/gi,
      logoUrl,
    )
    .replace(
      /https?:\/\/[^"'\s]*\/Images\/Branding\/365\/[^"'\s]*/gi,
      logoUrl,
    );

  return out;
}

export function resolveLmtBrandLogoForHtml(options?: {
  hideBrand?: boolean;
  brandLogoUrl?: string | null;
}): string {
  if (options?.hideBrand) return LMT_TRANSPARENT_LOGO;
  const custom = options?.brandLogoUrl?.trim();
  if (custom) return custom;
  // Prefer hosted PNG — SVG data URIs often fail inside SportRadar on iOS WKWebView.
  return resolveLmtBrandLogoUrl();
}

export function htmlStillContains365Brand(html: string): boolean {
  return LMT_365_ASSET_RE.test(html);
}

/** Fetch official GetWidget HTML and rewrite pitch branding (DD flow). */
export async function fetchBrandedLmtHtml(
  widgetUrl: string,
  options?: { hideBrand?: boolean; brandLogoUrl?: string | null },
): Promise<string> {
  const res = await fetch(widgetUrl, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'Cache-Control': 'no-cache',
    },
  });
  if (!res.ok) {
    throw new Error(`GetWidget HTTP ${res.status}`);
  }
  const html = await res.text();
  if (!html || !/pitchLogo\s*:/.test(html)) {
    throw new Error('GetWidget HTML missing pitchLogo');
  }
  const logo = resolveLmtBrandLogoForHtml(options);
  const branded = customizeScores365LmtWidgetHtml(html, logo);
  if (htmlStillContains365Brand(branded)) {
    throw new Error('GetWidget branding replace incomplete');
  }
  return branded;
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
