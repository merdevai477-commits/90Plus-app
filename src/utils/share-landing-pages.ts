import { ANDROID_PACKAGE_NAME } from '../config/androidAppLinks';
import { SHARE_BASE_URL, shareUrl } from '../config/shareLinks';
import { isValidReferralCode, normalizeReferralCode } from '../services/share-win.service';

/** Canonical package from androidAppLinks (same id as front/app.json). */
const ANDROID_PACKAGE = ANDROID_PACKAGE_NAME;

export const PLAY_STORE_URL =
  `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;

export const APP_STORE_URL = 'https://apps.apple.com/us/app/90plus/id6758296989';

/**
 * Play Store listing with an Install Referrer payload for Share & Win.
 * Invalid / unknown codes get the plain store URL (no referrer).
 */
export function buildPlayStoreInviteUrl(code: string): string {
  const normalized = normalizeReferralCode(code);
  if (!isValidReferralCode(normalized)) return PLAY_STORE_URL;
  return `${PLAY_STORE_URL}&referrer=${encodeURIComponent(`invite_${normalized}`)}`;
}

/** How long we wait before assuming the app did not open, then go to the store. */
const STORE_FALLBACK_MS_IOS = 900;
const STORE_FALLBACK_MS_ANDROID = 1_200;

const LANDING_STYLES = `
    body { font-family: system-ui, sans-serif; background: #0a0a0a; color: #fff; min-height: 100vh; display: flex; align-items: center; justify-content: center; margin: 0; padding: 24px; text-align: center; }
    .card { max-width: 360px; }
    h1 { font-size: 1.5rem; margin-bottom: 12px; }
    p { color: rgba(255,255,255,0.7); line-height: 1.5; margin-bottom: 24px; }
    a.btn { display: block; margin: 10px 0; padding: 14px 20px; border-radius: 28px; text-decoration: none; font-weight: 700; }
    .primary { background: #FFD700; color: #000; }
    .secondary { background: rgba(255,255,255,0.12); color: #fff; border: 1px solid rgba(255,255,255,0.2); }
    .loading p { color: rgba(255,255,255,0.55); font-size: 0.95rem; }
    /*
     * Buttons stay visible even when CSP / in-app browsers block the opener
     * script — QR scans and WhatsApp previews often land here without JS.
     */
        .download { display: block; }
    body.opening .download { opacity: 0.85; }
    /* JS hides the wrong-platform store so the user only sees their store. */
    .store-btn { display: block; }
`;

/** Helmet sets script-src 'self'; these pages need an inline opener. Override per response. */
/** Invite signup widget talks to the production Clerk frontend API. */
export const REFERRAL_SIGNUP_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline' https://clerk.90plus.pro https://challenges.cloudflare.com",
  "style-src 'unsafe-inline' https://clerk.90plus.pro",
  "img-src 'self' data: https:",
  "font-src https://clerk.90plus.pro data:",
  "connect-src 'self' https://clerk.90plus.pro https://api.clerk.com",
  "frame-src https://clerk.90plus.pro https://challenges.cloudflare.com",
  "worker-src blob:",
  "form-action https://clerk.90plus.pro",
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
].join('; ');

export const SHARE_LANDING_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "img-src 'self' data: https:",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
].join('; ');

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

/**
 * Inline opener: try the app once, then send the user straight to their
 * platform store. Desktop keeps both store buttons.
 *
 * When `iosInviteClipboardPayload` is set (Share & Win referral on a valid
 * code), iOS does NOT auto-redirect to the App Store — browsers only allow
 * clipboard writes on a real tap, so the primary "تحميل التطبيق" button
 * copies `90plus-invite:CODE` then navigates. Android is unchanged.
 */
function buildStoreRedirectScript(
  intentUrl: string,
  customSchemeUrl: string,
  playStoreUrl: string = PLAY_STORE_URL,
  iosInviteClipboardPayload: string | null = null,
  /**
   * Referral landings. Do not open an Android package intent: when 90Plus is
   * missing, that intent launches the Play Store listing with no referrer and
   * hides the page, so the backup redirect that carries `referrer=invite_CODE`
   * never runs. Go straight to that Play URL instead.
   */
  androidReferrerFirst: boolean = false,
): string {
  return `
    (function() {
      var customScheme = ${JSON.stringify(customSchemeUrl)};
      var intentUrl = ${JSON.stringify(intentUrl)};
      var playStoreUrl = ${JSON.stringify(playStoreUrl)};
      var appStoreUrl = ${JSON.stringify(APP_STORE_URL)};
      var iosInvitePayload = ${JSON.stringify(iosInviteClipboardPayload)};
      var androidReferrerFirst = ${androidReferrerFirst ? 'true' : 'false'};
      var ua = navigator.userAgent || '';
      var isAndroid = /Android/i.test(ua);
      var isIOS = /iPhone|iPad|iPod/i.test(ua) ||
        (/Macintosh/i.test(ua) && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1);
      var storeUrl = isAndroid ? playStoreUrl : (isIOS ? appStoreUrl : null);
      var fallbackMs = isAndroid ? ${STORE_FALLBACK_MS_ANDROID} : ${STORE_FALLBACK_MS_IOS};

      function appLikelyOpened() {
        return document.hidden || document.webkitHidden;
      }

      function goToStore() {
        if (!storeUrl) return;
        window.location.replace(storeUrl);
      }

      function copyInviteThenAppStore() {
        var done = function() { window.location.replace(appStoreUrl); };
        if (!iosInvitePayload) { done(); return; }
        function fallbackCopy() {
          try {
            var ta = document.createElement('textarea');
            ta.value = iosInvitePayload;
            ta.setAttribute('readonly', '');
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
          } catch (e) {}
          done();
        }
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(iosInvitePayload).then(done).catch(fallbackCopy);
            return;
          }
        } catch (e) {}
        fallbackCopy();
      }

      function wireIosInviteDownload(iosBtn) {
        if (!iosBtn || !iosInvitePayload) return;
        iosBtn.textContent = 'تحميل التطبيق';
        iosBtn.className = 'btn primary store-btn';
        iosBtn.setAttribute('href', '#');
        iosBtn.addEventListener('click', function(ev) {
          ev.preventDefault();
          copyInviteThenAppStore();
        });
      }

      function preferPlatformStore() {
        var androidBtn = document.getElementById('store-android');
        var iosBtn = document.getElementById('store-ios');
        var openBtn = document.getElementById('open-app');
        if (isAndroid) {
          if (iosBtn) iosBtn.style.display = 'none';
          if (androidBtn) {
            androidBtn.className = 'btn primary store-btn';
          }
          // Package intents drop the Play Install Referrer. Leave the
          // "open app" button on the custom scheme for referral links.
          if (openBtn && !androidReferrerFirst) openBtn.setAttribute('href', intentUrl);
        } else if (isIOS) {
          if (androidBtn) androidBtn.style.display = 'none';
          if (iosBtn) {
            if (iosInvitePayload) {
              wireIosInviteDownload(iosBtn);
            } else {
              iosBtn.className = 'btn primary store-btn';
            }
          }
        }
      }

      preferPlatformStore();
      document.body.classList.add('opening');

      if (isAndroid) {
        if (androidReferrerFirst) {
          // Custom scheme opens 90Plus when it is already installed and does
          // not launch Play by itself. If the page is still visible, the app
          // is missing: go to the Play URL that carries the invite referrer.
          window.location.href = customScheme;
          setTimeout(function() {
            if (appLikelyOpened()) return;
            window.location.replace(playStoreUrl);
          }, fallbackMs);
          return;
        }
        // Intent fallback is Play Store; JS backup covers WebViews that ignore it.
        window.location.href = intentUrl;
        setTimeout(function() {
          if (appLikelyOpened()) return;
          goToStore();
        }, fallbackMs);
        return;
      }

      if (isIOS) {
        window.location.href = customScheme;
        setTimeout(function() {
          if (appLikelyOpened()) return;
          // Invite clipboard needs a user tap — do not auto-jump to the store.
          if (iosInvitePayload) return;
          goToStore();
        }, fallbackMs);
      }
    })();
  `;
}

function storeButtonsHtml(
  openAppHref: string,
  androidStoreHref: string = PLAY_STORE_URL,
  /**
   * When set (valid iOS invite clipboard flow), the App Store control must not
   * navigate via a real store href before JS wires copy-then-navigate.
   */
  iosStoreHref: string = APP_STORE_URL,
): string {
  const safeHref = openAppHref.replace(/"/g, '&quot;');
  const safeAndroid = androidStoreHref.replace(/"/g, '&quot;');
  const safeIos = iosStoreHref.replace(/"/g, '&quot;');
  const iosLabel = iosStoreHref === '#' ? 'تحميل التطبيق' : 'حمّل من App Store';
  return `
      <a class="btn primary" id="open-app" href="${safeHref}">افتح في التطبيق</a>
      <a class="btn secondary store-btn" id="store-android" href="${safeAndroid}">حمّل من Google Play</a>
      <a class="btn secondary store-btn" id="store-ios" href="${safeIos}">${iosLabel}</a>
  `;
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
  /**
   * Android Play Store URL used for the intent browser_fallback, the JS store
   * redirect, and the visible Play button. Referral landings pass a URL with
   * `referrer=invite_CODE` so a cold install can recover attribution.
   */
  androidStoreUrl?: string;
  /**
   * When set, iOS referral landings copy this exact string on the download
   * tap (`90plus-invite:CODE`) before opening the App Store. Null/omitted =
   * plain App Store redirect (no clipboard).
   */
  iosInviteClipboardPayload?: string | null;
  /**
   * Valid Share & Win codes. Android must land on the Play URL that includes
   * `referrer=invite_CODE`, not on a package intent that strips it.
   */
  androidReferrerFirst?: boolean;
};

function buildSmartLandingPage(options: ContentLandingOptions): string {
  // Fallback is the Play Store, never this page — see buildAndroidIntentUrl.
  const androidStoreUrl = options.androidStoreUrl ?? PLAY_STORE_URL;
  const androidReferrerFirst = options.androidReferrerFirst === true;
  const intentUrl = buildAndroidIntentUrl(options.deepPath, androidStoreUrl);
  const iosInviteClipboardPayload = options.iosInviteClipboardPayload ?? null;
  // Valid invite on iOS: href="#" so a pre-JS tap cannot skip clipboard copy.
  const iosStoreHref = iosInviteClipboardPayload ? '#' : APP_STORE_URL;
  const noscriptAppStore = iosInviteClipboardPayload
    ? `<noscript><p><a class="btn primary" href="${APP_STORE_URL}">حمّل من App Store</a></p></noscript>`
    : '';

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
</head>
<body>
  <div class="card">
    <h1>90Plus</h1>
    <div class="loading">
      <p>${options.loadingText}</p>
    </div>
    <div class="download">
      <p>${options.downloadText}</p>
      ${storeButtonsHtml(options.customSchemeUrl, androidStoreUrl, iosStoreHref)}
      ${noscriptAppStore}
    </div>
  </div>
  <script>
    /*
     * This page is only ever REACHED when the OS did not hand the link to the
     * app itself. Try the app once (keeps the referral / deep path), then send
     * the user to their platform store immediately — never leave them on the site.
     */
    ${buildStoreRedirectScript(
      intentUrl,
      options.customSchemeUrl,
      androidStoreUrl,
      iosInviteClipboardPayload,
      androidReferrerFirst,
    )}
  </script>
</body>
</html>`;
}

/** App invite — try open app; if missing, go straight to the platform store. */
export function buildAppInviteLandingPage(): string {
  const landingUrl = `${SHARE_BASE_URL}/`;
  const intentUrl = buildAndroidIntentUrl('open');
  const customScheme = 'ninetyplus://';

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
</head>
<body>
  <div class="card">
    <h1>90Plus</h1>
    <div class="loading">
      <p>جاري فتح التطبيق أو التحويل للمتجر…</p>
    </div>
    <div class="download">
      <p>أفضل تطبيق لكرة القدم — توقعات، اختبارات، وريلز</p>
      ${storeButtonsHtml(customScheme)}
    </div>
  </div>
  <script>
    ${buildStoreRedirectScript(intentUrl, customScheme)}
  </script>
</body>
</html>`;
}

export function buildReelLandingPage(reelId: string): string {
  return buildSmartLandingPage({
    title: '90Plus — فيديو',
    ogTitle: '90Plus — شاهد هذا الفيديو',
    ogDescription: 'افتح الفيديو في تطبيق 90Plus',
    ogUrl: shareUrl(`/reels/${reelId}`),
    loadingText: 'جاري فتح الفيديو أو التحويل للمتجر…',
    downloadText: 'حمّل 90Plus لمشاهدة هذا الفيديو',
    deepPath: `reel/${reelId}`,
    customSchemeUrl: `ninetyplus://reel/${reelId}`,
  });
}

export function buildProfileLandingPage(username: string): string {
  const clean = username.replace(/^@/, '').trim();
  return buildSmartLandingPage({
    title: `90Plus — @${clean}`,
    ogTitle: `90Plus — @${clean}`,
    ogDescription: 'افتح البروفايل في تطبيق 90Plus',
    // Canonical share path is /u/:username (chat apps often mangle /@…).
    ogUrl: shareUrl(`/u/${clean}`),
    loadingText: `جاري فتح بروفايل @${clean} أو التحويل للمتجر…`,
    downloadText: `حمّل 90Plus لمتابعة @${clean}`,
    deepPath: `user/${clean}`,
    customSchemeUrl: `ninetyplus://user/${clean}`,
  });
}

/**
 * The contest count is decided when the account is created, not when a store
 * build later tries to remember the link. The new user signs up on this page
 * with the invite code attached, then downloads the app and signs in.
 */
export function buildReferralContestLandingPage(code: string, clerkPublishableKey: string): string {
  const playUrl = buildPlayStoreInviteUrl(code);
  const payload = JSON.stringify({
    code,
    publishableKey: clerkPublishableKey,
    playUrl,
    appStoreUrl: APP_STORE_URL,
    openUrl: `ninetyplus://invite/${code}`,
  });
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>90Plus — دعوة صديق</title>
  <style>${LANDING_STYLES}
    #download { display: none; }
    #download.visible { display: block; }
  </style>
</head>
<body>
  <div class="card">
    <h1>90Plus</h1>
    <p>صاحبك دعاك. سجّل <b>حساب جديد</b> من هنا عشان الدعوة تتحسب له في المسابقة.</p>
    <p id="claim-status"></p>
    <div id="clerk-slot"></div>
    <div class="download" id="download">
      <p>بعد التسجيل، حمّل التطبيق وادخل بنفس الحساب.</p>
      <a class="btn primary" id="store-android" href="${playUrl.replace(/"/g, '&quot;')}">حمّل من Google Play</a>
      <a class="btn secondary" id="store-ios" href="${APP_STORE_URL}">حمّل من App Store</a>
      <a class="btn secondary" id="open-app" href="ninetyplus://invite/${code}">افتح التطبيق</a>
    </div>
  </div>
  <script>
    (function() {
      var cfg = ${payload};
      var statusEl = document.getElementById('claim-status');
      var slot = document.getElementById('clerk-slot');
      var downloadEl = document.getElementById('download');
      function say(text) { if (statusEl) statusEl.textContent = text; }
      function showStores() { if (downloadEl) downloadEl.className = 'download visible'; }
      function claim() {
        var clerk = window.Clerk;
        if (!clerk || !clerk.session) return Promise.resolve();
        return clerk.session.getToken().then(function(token) {
          return fetch('/api/share-win/referral/claim', {
            method: 'POST',
            headers: {
              Authorization: 'Bearer ' + token,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ code: cfg.code })
          });
        }).then(function(res) { return res.json(); }).then(function(body) {
          var data = body && body.data;
          if (data && data.attributed) {
            say('اتسجل حسابك الجديد، والدعوة اتحسبت لصاحبك. حمّل التطبيق وادخل بنفس الحساب.');
            showStores();
          } else if (data && data.reason === 'already_attributed') {
            say('الدعوة اتحسبت قبل كده. حمّل التطبيق وادخل بنفس الحساب.');
            showStores();
          } else if (data && data.reason === 'not_a_new_user') {
            say('الحساب ده مش جديد. الدعوة بتتحسب لحساب جديد بس.');
            showStores();
          } else {
            say('كمّل تسجيل الحساب الجديد عشان الدعوة تتحسب.');
          }
          if (slot && data && (data.attributed || data.reason === 'already_attributed' || data.reason === 'not_a_new_user')) {
            slot.style.display = 'none';
          }
        }).catch(function() {
          say('التسجيل خلّص. حمّل التطبيق وادخل بنفس الحساب عشان الدعوة تتأكد.');
          showStores();
        });
      }
      var script = document.createElement('script');
      script.async = true;
      script.src = 'https://clerk.90plus.pro/npm/@clerk/clerk-js@5/dist/clerk.browser.js';
      script.setAttribute('data-clerk-publishable-key', cfg.publishableKey);
      script.onerror = function() {
        say('لو التسجيل ما ظهرش، حمّل التطبيق وسجّل حساب جديد من أول ما يفتح.');
        showStores();
      };
      script.onload = function() {
        var clerk = window.Clerk;
        if (!clerk) { script.onerror(); return; }
        clerk.load().then(function() {
          if (clerk.user) { claim(); return; }
          clerk.mountSignUp(slot, { unsafeMetadata: { referralCode: cfg.code } });
          clerk.addListener(function(event) {
            if (event.user) claim();
          });
        }).catch(function() {
          say('سجّل حساب جديد من التطبيق بعد التحميل لو الصفحة ما فتحتش التسجيل.');
          showStores();
        });
      };
      document.body.appendChild(script);
    })();
  </script>
</body>
</html>`;
}

/** Share & Win referral invite — carries the code into the app on first open. */
export function buildReferralLandingPage(
  code: string,
  options?: { clerkPublishableKey?: string },
): string {
  const normalized = normalizeReferralCode(code);
  const codeOk = isValidReferralCode(normalized);
  const clerkKey = options?.clerkPublishableKey?.trim() || '';
  if (codeOk && clerkKey) {
    return buildReferralContestLandingPage(normalized, clerkKey);
  }
  return buildSmartLandingPage({
    title: '90Plus — دعوة صديق',
    ogTitle: '90Plus — شارك واربح',
    ogDescription: 'سجّل في 90Plus من هذا الرابط وساعد صديقك على الفوز بالجائزة الأسبوعية',
    ogUrl: shareUrl(`/invite/${normalized}`),
    loadingText: 'جاري فتح الدعوة أو التحويل للمتجر…',
    downloadText: 'حمّل 90Plus وانضم عبر دعوة صديقك',
    deepPath: `invite/${normalized}`,
    customSchemeUrl: `ninetyplus://invite/${normalized}`,
    // Android cold-install: Play Install Referrer carries invite_CODE into the app.
    androidStoreUrl: buildPlayStoreInviteUrl(normalized),
    androidReferrerFirst: codeOk,
    // iOS cold-install safety net: tap "تحميل التطبيق" copies then opens App Store.
    // Invalid codes get a plain store link with no clipboard write.
    iosInviteClipboardPayload: codeOk ? `90plus-invite:${normalized}` : null,
  });
}
