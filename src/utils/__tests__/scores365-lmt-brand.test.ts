import { customizeScores365LmtWidgetHtml } from '../scores365-lmt-brand';

const SAMPLE = `<!DOCTYPE html>
<html><head><title>LMT</title></head><body><script>
const widgetProps = {
  vlmtLoaderImageUrl: "https://imagescache.365scores.com/image/upload/w_150,q_auto:eco/Widgets/Sportradar/365-LogoNew",
  goalBannerImage: "https://imagescache.365scores.com/image/upload/w_150,q_auto:eco/Widgets/Sportradar/365-LogoNew",
  pitchLogo: "https://imagescache.365scores.com/image/upload/w_150,q_auto:eco/Widgets/Sportradar/ALL_SPORT_TYPES_PITCH_LOGO",
  matchId: "68932524"
};
widgetProps.vlmtCourtBannerUrl = "https://interactiveapps-soccer-live-vs001.akamaized.net/Images/Branding/365/T_B_365.png";
</script></body></html>`;

describe('customizeScores365LmtWidgetHtml (server)', () => {
  const logo = 'https://90plus.pro/90plus-lmt-pitch-wordmark.png?v=4';
  const banner = 'https://90plus.pro/90plus-lmt-banner.png?v=4';

  it('strips every 365 brand asset from GetWidget HTML', () => {
    const out = customizeScores365LmtWidgetHtml(SAMPLE, logo, banner);
    expect(out).toContain(`vlmtLoaderImageUrl: "${logo}"`);
    expect(out).toContain(`pitchLogo: "${logo}"`);
    expect(out).toContain(`goalBannerImage: "${banner}"`);
    expect(out).toContain(`widgetProps.vlmtCourtBannerUrl = "${banner}";`);
    expect(out).not.toMatch(
      /https?:\/\/[^"'\\\s]*(?:365-LogoNew|ALL_SPORT_TYPES_PITCH_LOGO|Branding\/365)/i,
    );
    expect(out).toContain('90plus-lmt');
  });

  it('nuclear-replaces brand URLs even without property keys', () => {
    const loose = `<img src="https://imagescache.365scores.com/image/upload/Widgets/Sportradar/365-LogoNew">
<img src="https://cdn.example/Images/Branding/365/T_B_365.png">`;
    const out = customizeScores365LmtWidgetHtml(loose, logo, banner);
    expect(out).toContain(logo);
    expect(out).toContain(banner);
    expect(out).not.toMatch(
      /https?:\/\/[^"'\\\s]*(?:365-LogoNew|Branding\/365)/i,
    );
  });
});
