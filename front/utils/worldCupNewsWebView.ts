export const WORLD_CUP_NEWS_URL = 'https://90plus.pro/news';

const NINETY_PLUS_HOSTS = new Set(['90plus.pro', 'www.90plus.pro']);

export function isNinetyPlusNewsUrl(url: string): boolean {
  if (!url || url === 'about:blank') return false;

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (!NINETY_PLUS_HOSTS.has(host)) return false;

    const path = parsed.pathname;
    return (
      path === '/news' ||
      path.startsWith('/news/') ||
      path.startsWith('/api/news/')
    );
  } catch {
    return false;
  }
}

/** Only 90plus.pro news pages may load inside the in-app WebView. */
export function isAllowedWorldCupNewsUrl(url: string): boolean {
  if (!url || url === 'about:blank') return true;
  return isNinetyPlusNewsUrl(url);
}

export type NewsWebViewMessage =
  | { type: 'OPEN_EXTERNAL'; url: string };

export function parseNewsWebViewMessage(raw: string): NewsWebViewMessage | null {
  try {
    const data = JSON.parse(raw) as NewsWebViewMessage;
    if (data?.type === 'OPEN_EXTERNAL' && typeof data.url === 'string' && data.url.length > 0) {
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

/** Hide site chrome; open external article URLs in the system browser (not WebView). */
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

  function isOurNewsHost(href) {
    try {
      var u = new URL(href);
      var h = u.hostname.toLowerCase();
      if (h !== '90plus.pro' && h !== 'www.90plus.pro') return false;
      var p = u.pathname;
      return p === '/news' || p.indexOf('/news/') === 0 || p.indexOf('/api/news/') === 0;
    } catch (e) {
      return false;
    }
  }

  function openExternal(url) {
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'OPEN_EXTERNAL', url: url }));
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
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
      if (!isOurNewsHost(link.href)) {
        e.preventDefault();
        e.stopPropagation();
        openExternal(link.href);
      }
    }, true);
  }
})();
true;
`;
