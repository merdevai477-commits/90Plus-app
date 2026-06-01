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
    .loading p { color: rgba(255,255,255,0.55); font-size: 0.95rem; }
    .download { display: none; }
    body.ready .loading { display: none; }
    body.ready .download { display: block; }
`;

/** Intent opens the app; fallback reloads this landing page (not the store). */
function buildAndroidIntentUrl(deepPath: string, landingFallbackUrl: string): string {
  const fallback = encodeURIComponent(landingFallbackUrl);
  return `intent://${deepPath}#Intent;scheme=ninetyplus;package=${ANDROID_PACKAGE};S.browser_fallback_url=${fallback};end`;
}

type ContentLandingOptions = {
  title: string;
  ogTitle: string;
  ogDescription: string;
  ogUrl: string;
  loadingText: string;
  downloadText: string;
  deepPath: string;
  customSchemeUrl: string;
};

function buildSmartLandingPage(options: ContentLandingOptions): string {
  const intentUrl = buildAndroidIntentUrl(options.deepPath, options.ogUrl);
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
      var customScheme = ${JSON.stringify(options.customSchemeUrl)};
      var intentUrl = ${JSON.stringify(intentUrl)};
      var ua = navigator.userAgent || '';
      var isAndroid = /Android/i.test(ua);
      var isIOS = /iPhone|iPad|iPod/i.test(ua);

      function showDownloadLanding() {
        document.body.classList.add('ready');
      }

      function appLikelyOpened() {
        return document.hidden || document.webkitHidden;
      }

      function tryOpenApp() {
        if (isAndroid) {
          window.location.href = intentUrl;
          setTimeout(function() {
            if (!appLikelyOpened()) showDownloadLanding();
          }, 2200);
          return;
        }
        if (isIOS) {
          var start = Date.now();
          window.location.href = customScheme;
          setTimeout(function() {
            if (!appLikelyOpened() && Date.now() - start < 3000) {
              showDownloadLanding();
            }
          }, 1600);
          return;
        }
        showDownloadLanding();
      }

      document.addEventListener('visibilitychange', function() {
        if (document.hidden) return;
      });

      tryOpenApp();
    })();
  </script>
</head>
<body>
  <div class="card">
    <h1>90Plus</h1>
    <div class="loading">
      <p>${options.loadingText}</p>
    </div>
    <div class="download">
      <p>${options.downloadText}</p>
      <a class="btn primary" href="${intentHref}">افتح في التطبيق</a>
      <a class="btn secondary" href="${PLAY_STORE_URL}">حمّل من Google Play</a>
      <a class="btn secondary" href="${APP_STORE_URL}">حمّل من App Store</a>
    </div>
  </div>
</body>
</html>`;
}

/** App invite — try open app; if missing, stay on landing page with store links */
export function buildAppInviteLandingPage(): string {
  const landingUrl = `${SHARE_BASE_URL}/`;
  const intentUrl = buildAndroidIntentUrl('open', landingUrl);
  const intentHref = intentUrl.replace(/"/g, '&quot;');

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>90Plus — تطبيق كرة القدم</title>
  <meta property="og:title" content="90Plus">
  <meta property="og:description" content="توقعات، اختبارات، وريلز كروية">
  <meta property="og:url" content="${landingUrl}">
  <style>${LANDING_STYLES}</style>
  <script>
    (function() {
      var intentUrl = ${JSON.stringify(intentUrl)};
      var customScheme = 'ninetyplus://';
      var ua = navigator.userAgent || '';
      var isAndroid = /Android/i.test(ua);
      var isIOS = /iPhone|iPad|iPod/i.test(ua);

      function showDownloadLanding() {
        document.body.classList.add('ready');
      }

      function appLikelyOpened() {
        return document.hidden || document.webkitHidden;
      }

      function tryOpenApp() {
        if (isAndroid) {
          window.location.href = intentUrl;
          setTimeout(function() {
            if (!appLikelyOpened()) showDownloadLanding();
          }, 2200);
          return;
        }
        if (isIOS) {
          var start = Date.now();
          window.location.href = customScheme;
          setTimeout(function() {
            if (!appLikelyOpened() && Date.now() - start < 3000) {
              showDownloadLanding();
            }
          }, 1600);
          return;
        }
        showDownloadLanding();
      }

      tryOpenApp();
    })();
  </script>
</head>
<body>
  <div class="card">
    <h1>90Plus</h1>
    <div class="loading">
      <p>جاري فتح التطبيق…</p>
    </div>
    <div class="download">
      <p>أفضل تطبيق لكرة القدم — توقعات، اختبارات، وريلز</p>
      <a class="btn primary" href="${intentHref}">افتح في التطبيق</a>
      <a class="btn secondary" href="${PLAY_STORE_URL}">Google Play</a>
      <a class="btn secondary" href="${APP_STORE_URL}">App Store</a>
    </div>
  </div>
</body>
</html>`;
}

export function buildReelLandingPage(reelId: string): string {
  return buildSmartLandingPage({
    title: '90Plus — فيديو',
    ogTitle: '90Plus — شاهد هذا الفيديو',
    ogDescription: 'افتح الفيديو في تطبيق 90Plus',
    ogUrl: shareUrl(`/reels/${reelId}`),
    loadingText: 'جاري فتح الفيديو في التطبيق…',
    downloadText: 'حمّل 90Plus لمشاهدة هذا الفيديو',
    deepPath: `reel/${reelId}`,
    customSchemeUrl: `ninetyplus://reel/${reelId}`,
  });
}

export function buildProfileLandingPage(username: string): string {
  return buildSmartLandingPage({
    title: `90Plus — @${username}`,
    ogTitle: `90Plus — @${username}`,
    ogDescription: 'افتح البروفايل في تطبيق 90Plus',
    ogUrl: shareUrl(`/@${username}`),
    loadingText: `جاري فتح بروفايل @${username}…`,
    downloadText: `حمّل 90Plus لمتابعة @${username}`,
    deepPath: `user/${username}`,
    customSchemeUrl: `ninetyplus://user/${username}`,
  });
}
