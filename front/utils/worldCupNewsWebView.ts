export const WORLD_CUP_NEWS_URL = 'https://90plus.pro/news';

const NINETY_PLUS_HOSTS = new Set(['90plus.pro', 'www.90plus.pro']);

export function isAllowedWorldCupNewsUrl(url: string): boolean {
  if (!url || url === 'about:blank') return true;

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    if (NINETY_PLUS_HOSTS.has(host)) {
      const path = parsed.pathname;
      return (
        path === '/news' ||
        path.startsWith('/news/') ||
        path.startsWith('/api/news/')
      );
    }

    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

/** Hide site chrome + open article links in the same WebView (not a new tab). */
export const NEWS_WEBVIEW_INJECTED_JS = `
(function () {
  function hideHeader() {
    if (!document.getElementById('90plus-news-hide-header')) {
      var style = document.createElement('style');
      style.id = '90plus-news-hide-header';
      style.textContent = '.site-header{display:none!important;}';
      document.head.appendChild(style);
    }
  }

  function onReady() {
    hideHeader();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }

  if (!window.__90plusNewsClickBound) {
    window.__90plusNewsClickBound = true;
    document.addEventListener('click', function (e) {
      var link = e.target && e.target.closest ? e.target.closest('a') : null;
      if (!link || !link.href) return;
      if (link.target === '_blank') {
        e.preventDefault();
        window.location.href = link.href;
      }
    }, true);
  }
})();
true;
`;
