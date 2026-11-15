/**
 * Rewrite 365Scores SportRadar GetWidget HTML so every visible brand mark
 * is 90PLUS (loader splash, mid-pitch logo, goal banner, court boards).
 */

const BALL_TRAIL = '#8B5CF6';

const BRAND_HIDE_CSS = `<style id="90plus-lmt">
.sr-lmt-bspot__line{stroke:${BALL_TRAIL}!important;stroke-opacity:.95!important}
img.sr-lmt-1-pitchlogo__wrapper{opacity:.9!important}
/* Hard hide any leftover 365 brand assets if SportRadar injects them later. */
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
    // Nuclear pass: any remaining known 365 brand asset URLs → 90PLUS.
    .replace(THREE_SIX_FIVE_BRAND_URL, logoUrl)
    .replace(THREE_SIX_FIVE_COURT_BANNER, bannerUrl)
    .replace(
      /window\.location\.href\s*=\s*["']widgetrender:\/\/[^"']*["']/g,
      '/* 90plus: blocked widgetrender:// for WKWebView */ void 0',
    );

  assertNo365BrandAssets(branded);

  return /<\/head>/i.test(branded)
    ? branded.replace(/<\/head>/i, `${BRAND_HIDE_CSS}</head>`)
    : `${BRAND_HIDE_CSS}${branded}`;
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
