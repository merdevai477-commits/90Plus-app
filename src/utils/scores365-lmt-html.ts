/**
 * HTML page for SportRadar LMT (live pitch tracker) with 90PLUS branding.
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
  /** iframe = licensed lmtsrcf only; sir = direct embed; auto = sir then iframe fallback */
  mode?: 'iframe' | 'sir' | 'auto';
  widgetloaderUrl?: string;
};

const DEFAULT_LOADER =
  'https://widgets.sir.sportradar.com/f0c087409e8b510632407044a316885a/widgetloader';

const TRANSPARENT_PIXEL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildIframeHtml(info: LmtHtmlInfo, brandLogo: string, hideBrand: boolean): string {
  const ratio = info.widgetRatio && info.widgetRatio > 0 ? info.widgetRatio : 16 / 9;
  const paddingPct = ((1 / ratio) * 100).toFixed(4);
  const widgetUrl = escapeHtml(info.widgetUrl);
  const brand = escapeHtml(brandLogo);
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>90PLUS Tracking</title>
  <style>
    body { margin: 0; background: #0b1220; }
    .frame-wrap { position: relative; width: 100%; padding-top: ${paddingPct}%; background: #000; overflow: hidden; min-height: 56vw; }
    .frame-wrap iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
    .brand-cover {
      position: absolute; left: 50%; bottom: 3.8%; transform: translateX(-50%);
      width: min(42%, 320px); height: auto; z-index: 6; pointer-events: none;
    }
  </style>
</head>
<body>
  <div class="frame-wrap">
    <iframe src="${widgetUrl}" title="90PLUS Tracking" allow="fullscreen; autoplay" referrerpolicy="no-referrer-when-downgrade"></iframe>
    ${hideBrand ? '' : `<img class="brand-cover" src="${brand}" alt="90PLUS-app" />`}
  </div>
</body>
</html>`;
}

/**
 * Exact 90PLUS Tracking template (SIR direct) with optional auto-fallback to iframe
 * when SportRadar license blocks the current host (blank black screen).
 */
export function buildScores365LmtHtml(info: LmtHtmlInfo, options: LmtHtmlOptions): string {
  const hideBrand = options.hidePitchBrand === true;
  const brandLogo = hideBrand ? TRANSPARENT_PIXEL : options.brandLogoUrl;
  const mode = options.mode ?? 'auto';

  if (mode === 'iframe') {
    return buildIframeHtml(info, brandLogo, hideBrand);
  }

  const loader = options.widgetloaderUrl || DEFAULT_LOADER;
  const titleBits = [info.homeName, info.awayName].filter(Boolean).join(' vs ');
  const title = titleBits ? `90PLUS Tracking — ${escapeHtml(titleBits)}` : '90PLUS Tracking';

  // Direct SIR path only (no auto fallback)
  if (mode === 'sir') {
    return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <link rel="stylesheet" href="https://statics3.365scores.com/SRWidget/theme.css" />
  <style>
    body { margin: 0; background: #0b1220; }
    #widgetHost { width: 100%; min-height: 100vh; }
    .sr-bb .sr-lmt-clock-v2,
    .sr-lmt-plus__footer-wrapper,
    .sr-bb .sr-lmt-clock__wrap { display: none; }
  </style>
</head>
<body>
  <div id="widgetHost" class="sr-widget"></div>
  <script>
    const partnerId = ${JSON.stringify(String(info.partnerId))};
    const brandLogo = ${JSON.stringify(brandLogo)};

    (function (a, b, c, d, e, f, g, h, i) {
      a[e] || (i = a[e] = function () {
        (a[e].q = a[e].q || []).push(arguments);
      }, i.l = 1 * new Date, i.o = f,
      g = b.createElement(c), h = b.getElementsByTagName(c)[0],
      g.async = 1, g.src = d, g.setAttribute("n", e),
      h.parentNode.insertBefore(g, h));
    })(window, document, "script",
      ${JSON.stringify(loader)},
      "SIR", {
        theme: false,
        language: "aa"
      });

    SIR("addWidget", "#widgetHost", "match.lmtPlus", {
      matchId: partnerId,
      pitchCustomBgColor: "#257A37",
      disableOverlayPanels: true,
      scoreboard: "disable",
      detailedScoreboard: "disable",
      tabsPosition: "disable",
      disablePitchClock: true,
      pitchLogo: brandLogo,
      goalBannerImage: brandLogo,
      vlmtCourtBannerUrl: brandLogo
    });
  </script>
</body>
</html>`;
  }

  // auto: try SIR first, then iframe + logo cover if pitch never appears
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <link rel="stylesheet" href="https://statics3.365scores.com/SRWidget/theme.css" />
  <style>
    body { margin: 0; background: #0b1220; }
    #widgetHost { width: 100%; min-height: 100vh; }
    .frame-wrap { position: relative; width: 100%; min-height: 100vh; background: #000; overflow: hidden; }
    .frame-wrap iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
    .brand-cover {
      position: absolute; left: 50%; bottom: 3.8%; transform: translateX(-50%);
      width: min(42%, 320px); height: auto; z-index: 6; pointer-events: none;
    }
    .sr-bb .sr-lmt-clock-v2,
    .sr-lmt-plus__footer-wrapper,
    .sr-bb .sr-lmt-clock__wrap { display: none; }
  </style>
</head>
<body>
  <div id="widgetHost" class="sr-widget"></div>

  <script>
    const partnerId = ${JSON.stringify(String(info.partnerId))};
    const brandLogo = ${JSON.stringify(brandLogo)};
    const fallbackWidgetUrl = ${JSON.stringify(info.widgetUrl)};
    const hideBrand = ${hideBrand ? 'true' : 'false'};
    let rendered = false;
    let fellBack = false;

    function mountIframeFallback() {
      if (fellBack) return;
      fellBack = true;
      var host = document.getElementById('widgetHost');
      if (!host) return;
      host.className = 'frame-wrap';
      host.innerHTML = '';
      var iframe = document.createElement('iframe');
      iframe.src = fallbackWidgetUrl;
      iframe.title = '90PLUS Tracking';
      iframe.allow = 'fullscreen; autoplay';
      iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
      host.appendChild(iframe);
      if (!hideBrand) {
        var img = document.createElement('img');
        img.className = 'brand-cover';
        img.src = brandLogo;
        img.alt = '90PLUS-app';
        host.appendChild(img);
      }
    }

    (function (a, b, c, d, e, f, g, h, i) {
      a[e] || (i = a[e] = function () {
        (a[e].q = a[e].q || []).push(arguments);
      }, i.l = 1 * new Date, i.o = f,
      g = b.createElement(c), h = b.getElementsByTagName(c)[0],
      g.async = 1, g.src = d, g.setAttribute("n", e),
      h.parentNode.insertBefore(g, h));
    })(window, document, "script",
      ${JSON.stringify(loader)},
      "SIR", {
        theme: false,
        language: "aa"
      });

    SIR("addWidget", "#widgetHost", "match.lmtPlus", {
      matchId: partnerId,
      pitchCustomBgColor: "#257A37",
      disableOverlayPanels: true,
      scoreboard: "disable",
      detailedScoreboard: "disable",
      tabsPosition: "disable",
      disablePitchClock: true,
      pitchLogo: brandLogo,
      goalBannerImage: brandLogo,
      vlmtCourtBannerUrl: brandLogo
    }, function () {
      rendered = true;
    });

    setTimeout(function () {
      if (rendered || fellBack) return;
      var host = document.getElementById('widgetHost');
      var hasPitch = !!(host && (
        host.querySelector('canvas, iframe, svg, .sr-lmt-plus, .sr-bb, .sr-widget-content') ||
        host.children.length > 0
      ));
      // License-blocked hosts stay empty / only show "License has expired" text node.
      var expired = !!(host && /license has expired/i.test(host.textContent || ''));
      if (!hasPitch || expired) mountIframeFallback();
    }, 2800);
  </script>
</body>
</html>`;
}
