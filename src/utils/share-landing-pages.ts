import { SHARE_BASE_URL, shareUrl } from '../config/shareLinks';

export const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.mhmdsh1892.ninetyplusapp';

export const APP_STORE_URL = 'https://apps.apple.com/app/90plus/id6744076498';

const ANDROID_PACKAGE = 'com.mhmdsh1892.ninetyplusapp';

const LANDING_STYLES = `
    body { font-family: system-ui, sans-serif; background: #0a0a0a; color: #fff; min-height: 100vh; display: flex; align-items: center; justify-content: center; margin: 0; padding: 24px; text-align: center; }
    .card { max-width: 360px; }
    h1 { font-size: 1.5rem; margin-bottom: 12px; }
    p { color: rgba(255,255,255,0.7); line-height: 1.5; margin-bottom: 24px; }
    a.btn { display: block; margin: 10px 0; padding: 14px 20px; border-radius: 28px; text-decoration: none; font-weight: 700; }
    .primary { background: #FFD700; color: #000; }
    .secondary { background: rgba(255,255,255,0.12); color: #fff; border: 1px solid rgba(255,255,255,0.2); }
`;

function buildAndroidIntentUrl(deepPath: string): string {
  const playStore = encodeURIComponent(PLAY_STORE_URL);
  return `intent://${deepPath}#Intent;scheme=ninetyplus;package=${ANDROID_PACKAGE};S.browser_fallback_url=${playStore};end`;
}

type ContentLandingOptions = {
  title: string;
  ogTitle: string;
  ogDescription: string;
  ogUrl: string;
  subtitle: string;
  deepPath: string;
  customSchemeUrl: string;
};

function buildContentLandingPage(options: ContentLandingOptions): string {
  const intentUrl = buildAndroidIntentUrl(options.deepPath);
  const intentHref = intentUrl.replace(/"/g, '&quot;');

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${options.title}</title>
  <meta property="og:title" content="${options.ogTitle}">
  <meta property="og:description" content="${options.ogDescription}">
  <meta property="og:url" content="${options.ogUrl}">
  <style>${LANDING_STYLES}</style>
  <script>
    (function() {
      var ua = navigator.userAgent || '';
      var isAndroid = /Android/i.test(ua);
      var isIOS = /iPhone|iPad|iPod/i.test(ua);
      if (isAndroid) {
        window.location.href = ${JSON.stringify(intentUrl)};
      } else if (isIOS) {
        window.location.href = ${JSON.stringify(options.customSchemeUrl)};
        setTimeout(function() { window.location.href = ${JSON.stringify(APP_STORE_URL)}; }, 1500);
      } else {
        window.location.href = ${JSON.stringify(PLAY_STORE_URL)};
      }
    })();
  </script>
</head>
<body>
  <div class="card">
    <h1>90Plus</h1>
    <p>${options.subtitle}</p>
    <a class="btn primary" href="${intentHref}">افتح في التطبيق</a>
    <a class="btn secondary" href="${PLAY_STORE_URL}">حمّل من Google Play</a>
    <a class="btn secondary" href="${APP_STORE_URL}">حمّل من App Store</a>
  </div>
</body>
</html>`;
}

/** App invite: Android → Play Store, iOS → App Store */
export function buildAppInviteLandingPage(): string {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>90Plus — تطبيق كرة القدم</title>
  <meta property="og:title" content="90Plus">
  <meta property="og:description" content="توقعات، اختبارات، وريلز كروية">
  <meta property="og:url" content="${SHARE_BASE_URL}/">
  <style>${LANDING_STYLES}</style>
  <script>
    (function() {
      var ua = navigator.userAgent || '';
      var isAndroid = /Android/i.test(ua);
      var isIOS = /iPhone|iPad|iPod/i.test(ua);
      if (isAndroid) {
        window.location.href = ${JSON.stringify(PLAY_STORE_URL)};
      } else if (isIOS) {
        window.location.href = ${JSON.stringify(APP_STORE_URL)};
      }
    })();
  </script>
</head>
<body>
  <div class="card">
    <h1>90Plus</h1>
    <p>أفضل تطبيق لكرة القدم — توقعات، اختبارات، وريلز</p>
    <a class="btn primary" href="${PLAY_STORE_URL}">Google Play</a>
    <a class="btn secondary" href="${APP_STORE_URL}">App Store</a>
  </div>
</body>
</html>`;
}

export function buildReelLandingPage(reelId: string): string {
  return buildContentLandingPage({
    title: '90Plus — فيديو',
    ogTitle: '90Plus — شاهد هذا الفيديو',
    ogDescription: 'افتح الفيديو في تطبيق 90Plus',
    ogUrl: shareUrl(`/reels/${reelId}`),
    subtitle: 'جاري فتح الفيديو في التطبيق…',
    deepPath: `reel/${reelId}`,
    customSchemeUrl: `ninetyplus://reel/${reelId}`,
  });
}

export function buildProfileLandingPage(username: string): string {
  return buildContentLandingPage({
    title: `90Plus — @${username}`,
    ogTitle: `90Plus — @${username}`,
    ogDescription: 'افتح البروفايل في تطبيق 90Plus',
    ogUrl: shareUrl(`/@${username}`),
    subtitle: `جاري فتح بروفايل @${username} في التطبيق…`,
    deepPath: `user/${username}`,
    customSchemeUrl: `ninetyplus://user/${username}`,
  });
}
