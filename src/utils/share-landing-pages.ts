import { SHARE_BASE_URL, shareUrl } from '../config/shareLinks';

export const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.mhmdsh1892.ninetyplusapp';

export const APP_STORE_URL = 'https://apps.apple.com/us/app/90plus/id6758296989';

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

/**
 * Android App Link intent.
 *
 * `S.browser_fallback_url` is where Chrome sends the user when the package is
 * NOT installed. It used to be this same landing page, which meant a phone
 * without 90Plus bounced: page → intent → page → intent … The share never
 * reached the Play Store and the user never left the website. It is the store
 * listing now, so "app missing" resolves in one hop to somewhere they can
 * actually install from.
 */
function buildAndroidIntentUrl(deepPath: string, storeFallbackUrl: string = PLAY_STORE_URL): string {
  const fallback = encodeURIComponent(storeFallbackUrl);
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
  // Fallback is the Play Store, never this page — see buildAndroidIntentUrl.
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
    /*
     * This page is only ever REACHED when the OS did not hand the link to the
     * app itself. On iOS that means the universal link was not claimed (app not
     * installed, or an in-app browser such as Instagram/Facebook that strips
     * universal links); on Android, that the App Link was not verified.
     *
     * So: try the custom scheme once — which still works from in-app browsers
     * and is what carries the referral code — and if we are still on this page
     * a moment later, send the user to their platform's STORE. Sitting on the
     * website is the one outcome a share must never end in.
     */
    (function() {
      var customScheme = ${JSON.stringify(options.customSchemeUrl)};
      var intentUrl = ${JSON.stringify(intentUrl)};
      var appStoreUrl = ${JSON.stringify(APP_STORE_URL)};
      var ua = navigator.userAgent || '';
      var isAndroid = /Android/i.test(ua);
      var isIOS = /iPhone|iPad|iPod/i.test(ua) ||
        // iPadOS 13+ reports itself as a Mac; the touch points give it away.
        (/Macintosh/i.test(ua) && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1);

      function showDownloadLanding() {
        document.body.classList.add('ready');
      }

      function appLikelyOpened() {
        return document.hidden || document.webkitHidden;
      }

      function tryOpenApp() {
        if (isAndroid) {
          // The intent's own browser_fallback_url is the Play Store, so a
          // missing app resolves in one hop without coming back here.
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
            if (appLikelyOpened() || Date.now() - start >= 3000) return;
            // Still here: the app is not installed. Reveal the card (so the
            // back button lands somewhere sensible) and go to the App Store.
            showDownloadLanding();
            window.location.replace(appStoreUrl);
          }, 1600);
          return;
        }
        // Desktop: there is no store to send them to, so offer both.
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
  const intentUrl = buildAndroidIntentUrl('open');
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
      var appStoreUrl = ${JSON.stringify(APP_STORE_URL)};
      var ua = navigator.userAgent || '';
      var isAndroid = /Android/i.test(ua);
      var isIOS = /iPhone|iPad|iPod/i.test(ua) ||
        (/Macintosh/i.test(ua) && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1);

      function showDownloadLanding() {
        document.body.classList.add('ready');
      }

      function appLikelyOpened() {
        return document.hidden || document.webkitHidden;
      }

      function tryOpenApp() {
        if (isAndroid) {
          // Intent fallback is the Play Store — see buildAndroidIntentUrl.
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
            if (appLikelyOpened() || Date.now() - start >= 3000) return;
            showDownloadLanding();
            window.location.replace(appStoreUrl);
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

/** Share & Win referral invite — carries the code into the app on first open. */
export function buildReferralLandingPage(code: string): string {
  const normalized = code.trim().toUpperCase();
  return buildSmartLandingPage({
    title: '90Plus — دعوة صديق',
    ogTitle: '90Plus — شارك واربح',
    ogDescription: 'سجّل في 90Plus من هذا الرابط وساعد صديقك على الفوز بالجائزة الأسبوعية',
    ogUrl: shareUrl(`/invite/${normalized}`),
    loadingText: 'جاري فتح الدعوة في التطبيق…',
    downloadText: 'حمّل 90Plus وانضم عبر دعوة صديقك',
    deepPath: `invite/${normalized}`,
    customSchemeUrl: `ninetyplus://invite/${normalized}`,
  });
}

export function buildGroupJoinLandingPage(code: string): string {
  const normalized = code.trim().toUpperCase();
  return buildSmartLandingPage({
    title: '90Plus — انضم للمجموعة',
    ogTitle: '90Plus — دعوة مجموعة توقعات',
    ogDescription: 'افتح الدعوة وانضم لمجموعة التوقعات في تطبيق 90Plus',
    ogUrl: shareUrl(`/groups/join/${normalized}`),
    loadingText: 'جاري فتح دعوة المجموعة في التطبيق…',
    downloadText: 'حمّل 90Plus للانضمام لمجموعة التوقعات',
    deepPath: `group/join/${normalized}`,
    customSchemeUrl: `ninetyplus://group/join/${normalized}`,
  });
}
