import {
  customizeScores365LmtWidgetHtml,
  LMT_TRANSPARENT_LOGO,
} from '../lmt.service';

const SAMPLE_GET_WIDGET_HTML = `<!DOCTYPE html>
<html><head><title>LMT</title></head><body><script>
const widgetProps = {
  vlmtLoaderImageUrl: "https://imagescache.365scores.com/image/upload/w_150,q_auto:eco/Widgets/Sportradar/365-LogoNew",
  vlmtLoaderBgColor: "#000000",
  goalBannerImage: "https://imagescache.365scores.com/image/upload/w_150,q_auto:eco/Widgets/Sportradar/365-LogoNew",
  pitchLogo: "https://imagescache.365scores.com/image/upload/w_150,q_auto:eco/Widgets/Sportradar/ALL_SPORT_TYPES_PITCH_LOGO",
  matchId: "68932524"
};
widgetProps.vlmtCourtBannerUrl = "https://interactiveapps-soccer-live-vs001.akamaized.net/Images/Branding/365/T_B_365.png";
window.location.href = "widgetrender://postrender";
</script></body></html>`;

describe('customizeScores365LmtWidgetHtml', () => {
  const logo = 'https://90plus.pro/90plus-lmt-pitch-wordmark.png?v=3';
  const banner = 'https://90plus.pro/90plus-lmt-banner.png?v=3';

  it('replaces VLMT loader splash, pitch logo, and banners with 90PLUS assets', () => {
    const out = customizeScores365LmtWidgetHtml(SAMPLE_GET_WIDGET_HTML, logo, banner);

    expect(out).toContain(`vlmtLoaderImageUrl: "${logo}"`);
    expect(out).toContain(`pitchLogo: "${logo}"`);
    expect(out).toContain(`goalBannerImage: "${banner}"`);
    expect(out).toContain(`widgetProps.vlmtCourtBannerUrl = "${banner}";`);
    expect(out).not.toMatch(/365-LogoNew|ALL_SPORT_TYPES_PITCH_LOGO|T_B_365/);
    expect(out).toContain('/* 90plus: blocked widgetrender:// for WKWebView */');
  });

  it('also rewrites single-quoted GetWidget props', () => {
    const singleQuoted = SAMPLE_GET_WIDGET_HTML
      .replace(
        /vlmtLoaderImageUrl:\s*"[^"]*"/,
        "vlmtLoaderImageUrl: 'https://imagescache.365scores.com/Widgets/365-LogoNew'",
      )
      .replace(
        /pitchLogo:\s*"[^"]*"/,
        "pitchLogo: 'https://imagescache.365scores.com/Widgets/ALL_SPORT_TYPES_PITCH_LOGO'",
      );

    const out = customizeScores365LmtWidgetHtml(singleQuoted, logo, banner);
    expect(out).toContain(`vlmtLoaderImageUrl: "${logo}"`);
    expect(out).toContain(`pitchLogo: "${logo}"`);
    expect(out).not.toMatch(/365-LogoNew|ALL_SPORT_TYPES_PITCH_LOGO/);
  });

  it('accepts transparent hideBrand logo without treating it as 365', () => {
    const out = customizeScores365LmtWidgetHtml(
      SAMPLE_GET_WIDGET_HTML,
      LMT_TRANSPARENT_LOGO,
      LMT_TRANSPARENT_LOGO,
    );
    expect(out).toContain(`vlmtLoaderImageUrl: "${LMT_TRANSPARENT_LOGO}"`);
    expect(out).not.toMatch(/365-LogoNew/);
  });
});
