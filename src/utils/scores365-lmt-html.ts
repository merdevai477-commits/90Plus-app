/**
 * HTML shell that embeds official 365scores SportRadar LMT (GetWidget).
 * Optional brandLogoUrl covers the mid-pitch 365 mark (cross-origin can't rewrite logos).
 */

export function buildScores365LmtEmbedHtml(opts: {
  widgetUrl: string;
  partnerId: string;
  homeName?: string | null;
  awayName?: string | null;
  brandLogoUrl?: string | null;
}): string {
  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const titleBits = [opts.homeName, opts.awayName].filter(Boolean).join(' × ');
  const title = titleBits ? escape(titleBits) : 'Live Tracking';
  const widgetUrl = escape(opts.widgetUrl);
  const partnerId = escape(String(opts.partnerId));
  const brand = opts.brandLogoUrl ? escape(opts.brandLogoUrl) : '';

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
  <meta name="partnerid" content="${partnerId}" />
  <title>${title} — Tracking</title>
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      background: #0b1220;
      overflow: hidden;
    }
    .wrap {
      position: relative;
      width: 100%;
      height: 100%;
      min-height: 100vh;
      background: #000;
    }
    iframe {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      border: 0;
      display: block;
      background: #000;
    }
    .brand-cover {
      position: absolute;
      left: 50%;
      top: 42%;
      transform: translate(-50%, -50%);
      width: min(34%, 160px);
      height: auto;
      z-index: 6;
      pointer-events: none;
      background: #257A37;
      border-radius: 4px;
      padding: 4px 8px;
      box-sizing: border-box;
    }
    .brand-cover img {
      display: block;
      width: 100%;
      height: auto;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <iframe
      src="${widgetUrl}"
      title="Live Match Tracker"
      allow="fullscreen; autoplay"
      referrerpolicy="no-referrer-when-downgrade"
      loading="eager"
    ></iframe>
    ${
      brand
        ? `<div class="brand-cover"><img src="${brand}" alt="90PLUS" /></div>`
        : ''
    }
  </div>
</body>
</html>`;
}
