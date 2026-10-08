const APPLE_WEB = 'https://apps.apple.com/app/id6758296989';
const APPLE_NATIVE = 'itms-apps://apps.apple.com/app/id6758296989';

function isIOS() {
  const ua = navigator.userAgent || '';
  return /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function openAppleStore(ios) {
  if (!ios) {
    window.location.assign(APPLE_WEB);
    return;
  }
  const started = Date.now();
  window.location.href = APPLE_NATIVE;
  // Fall back to the web listing when the native App Store scheme is blocked (in-app browsers).
  setTimeout(() => {
    if (document.visibilityState === 'visible' && Date.now() - started < 1800) {
      window.location.href = APPLE_WEB;
    }
  }, 700);
}

/** iOS Safari drops taps on nested SVG/spans in store badges, so bind touchend explicitly. */
export function bindAppleStoreLinks() {
  const ios = isIOS();
  document.querySelectorAll('a[data-store="apple"]').forEach((a) => {
    if (a.dataset.appleBound === '1') return;
    a.dataset.appleBound = '1';
    a.setAttribute('href', APPLE_WEB);

    let lastOpen = 0;
    const onActivate = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const now = Date.now();
      if (now - lastOpen < 900) return;
      lastOpen = now;
      openAppleStore(ios);
    };

    if (ios) a.addEventListener('touchend', onActivate, { passive: false });
    a.addEventListener('click', onActivate, { passive: false });
  });
}
