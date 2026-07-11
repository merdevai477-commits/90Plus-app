/**
 * LMT HTML builders — mirrors c:\DD\js\app.js branding flow on the original
 * 365scores GetWidget URL (partnerid, not gameId).
 */

export type LmtHtmlInfo = {
  partnerId: string;
  widgetUrl: string;
  widgetRatio?: number | null;
  homeName?: string | null;
  awayName?: string | null;
};

export type LmtHtmlOptions = {
  brandLogoUrl: string;
  hidePitchBrand?: boolean;
  /**
   * iframe  = embed original lmtsrcf GetWidget (licensed) + 90PLUS overlay
   * branded = serve GetWidget HTML after logo rewrite (DD customizeWidgetHtml)
   * sir     = direct SIR("addWidget") like DD renderBrandedWidget
   */
  mode?: 'iframe' | 'branded' | 'sir';
};

const TRANSPARENT_PIXEL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

const DEFAULT_LOADER =
  'https://widgets.sir.sportradar.com/f0c087409e8b510632407044a316885a/widgetloader';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Same replacements as DD `customizeWidgetHtml` — swap 365 pitch marks for 90PLUS.
 */
export function customizeScores365LmtWidgetHtml(html: string, brandLogoUrl: string): string {
  const logo = brandLogoUrl.replace(/"/g, '\\"');
  return html
    .replace(/pitchLogo:\s*"[^"]*"/, `pitchLogo: "${logo}"`)
    .replace(/goalBannerImage:\s*"[^"]*"/, `goalBannerImage: "${logo}"`)
    .replace(
      /widgetProps\.vlmtCourtBannerUrl\s*=\s*"[^"]*";/,
      `widgetProps.vlmtCourtBannerUrl = "${logo}";`,
    );
}

/** Widget props from DD `buildWidgetProps`. */
export function buildScores365LmtWidgetProps(partnerId: string, brandLogoUrl: string) {
  return {
    pitchCustomBgColor: '#257A37',
    disableOverlayPanels: true,
    scoreboard: 'disable',
    detailedScoreboard: 'disable',
    tabsPosition: 'disable',
    vlmtEnableMilestones: false,
    goalBannerImage: brandLogoUrl,
    onPitchLogoPosition: 'true',
    disablePitchClock: true,
    pitchLogo: brandLogoUrl,
    vlmtCourtBannerUrl: brandLogoUrl,
    matchId: String(partnerId),
  };
}

/**
 * Default (works on Railway): iframe the licensed GetWidget URL + cover 365 logo.
 * Matches DD intent (original 365 URL + 90PLUS brand) without breaking SportRadar license.
 */
function buildIframeOnOriginalUrl(info: LmtHtmlInfo, brandLogo: string, hideBrand: boolean): string {
  const ratio = info.widgetRatio && info.widgetRatio > 0 ? info.widgetRatio : 16 / 9;
  const paddingPct = ((1 / ratio) * 100).toFixed(4);
  const widgetUrl = escapeHtml(info.widgetUrl);
  const brand = escapeHtml(brandLogo);
  const titleBits = [info.homeName, info.awayName].filter(Boolean).join(' × ');
  const title = titleBits ? escapeHtml(titleBits) : '90PLUS Tracking';

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — 90PLUS</title>
  <link rel="stylesheet" href="https://statics3.365scores.com/SRWidget/theme.css" />
  <style>
    body { margin: 0; background: #0b1220; }
    .widget-frame-wrap {
      position: relative; width: 100%; padding-top: ${paddingPct}%;
      background: #000; overflow: hidden; min-height: 56vw;
    }
    .widget-frame-wrap iframe {
      position: absolute; inset: 0; width: 100%; height: 100%; border: 0;
    }
    .brand-cover {
      position: absolute; left: 50%; bottom: 3.8%; transform: translateX(-50%);
      width: min(42%, 320px); height: auto; z-index: 6; pointer-events: none;
    }
  </style>
</head>
<body>
  <div class="widget-frame-wrap">
    <iframe
      src="${widgetUrl}"
      title="تشكيلة الملعب المباشرة"
      allow="fullscreen; autoplay"
      referrerpolicy="no-referrer-when-downgrade"
      loading="lazy"
    ></iframe>
    ${hideBrand ? '' : `<img class="brand-cover" src="${brand}" alt="90PLUS-app" />`}
  </div>
</body>
</html>`;
}

/** DD `renderBrandedWidget` — SIR direct with branded props (needs licensed origin). */
function buildSirHtml(info: LmtHtmlInfo, brandLogo: string, widgetloaderUrl?: string): string {
  const loader = widgetloaderUrl || DEFAULT_LOADER;
  const props = buildScores365LmtWidgetProps(info.partnerId, brandLogo);
  const titleBits = [info.homeName, info.awayName].filter(Boolean).join(' × ');
  const title = titleBits ? escapeHtml(titleBits) : '90PLUS Tracking';

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — 90PLUS</title>
  <link rel="stylesheet" href="https://statics3.365scores.com/SRWidget/theme.css" />
  <style>
    body { margin: 0; background: #0b1220; }
    #widgetHost, .sr-widget { width: 100%; min-height: 100vh; }
    .sr-bb .sr-lmt-clock-v2,
    .sr-lmt-plus__footer-wrapper,
    .sr-bb .sr-lmt-clock__wrap { display: none; }
  </style>
</head>
<body>
  <div id="widgetHost" class="sr-widget"></div>
  <script>
    (function (a, b, c, d, e, f, g, h, i) {
      a[e] || (i = a[e] = function () {
        (a[e].q = a[e].q || []).push(arguments);
      }, i.l = 1 * new Date, i.o = f,
      g = b.createElement(c), h = b.getElementsByTagName(c)[0],
      g.async = 1, g.src = d, g.setAttribute("n", e),
      h.parentNode.insertBefore(g, h));
    })(window, document, "script",
      ${JSON.stringify(loader)},
      "SIR", { theme: false, language: "aa" });

    SIR("addWidget", "#widgetHost", "match.lmtPlus", ${JSON.stringify(props)});
  </script>
</body>
</html>`;
}

/**
 * Build preview HTML.
 * - iframe (default): original GetWidget URL in iframe + 90PLUS cover
 * - branded: pass already-customized GetWidget HTML through as full document
 * - sir: DD direct SIR path
 */
export function buildScores365LmtHtml(
  info: LmtHtmlInfo,
  options: LmtHtmlOptions & { brandedHtml?: string | null },
): string {
  const hideBrand = options.hidePitchBrand === true;
  const brandLogo = hideBrand ? TRANSPARENT_PIXEL : options.brandLogoUrl;
  const mode = options.mode ?? 'iframe';

  if (mode === 'branded' && options.brandedHtml) {
    return hideBrand
      ? options.brandedHtml
      : customizeScores365LmtWidgetHtml(options.brandedHtml, brandLogo);
  }

  if (mode === 'sir') {
    return buildSirHtml(info, brandLogo);
  }

  return buildIframeOnOriginalUrl(info, brandLogo, hideBrand);
}
