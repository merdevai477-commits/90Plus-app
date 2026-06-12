(function () {
  var API_URL = '/api/news/world-cup';
  var LANG_KEY = '90plus-news-lang';
  var PAYLOAD_CACHE_KEY = '90plus-news-payload';
  var PAYLOAD_CACHE_TTL_MS = 10 * 60 * 1000;
  var PLACEHOLDER_IMG = '/90Plus.png';

  var I18N = {
    ar: {
      brandSub: 'أخبار كأس العالم',
      latestNews: 'أحدث الأخبار',
      moreStories: 'المزيد من الأخبار',
      footer: '© 2026 90Plus أخبار كأس العالم — جميع الحقوق محفوظة',
      loading: 'جاري تحميل الأخبار…',
      empty: 'لا توجد أخبار كأس العالم حالياً.',
      error: 'تعذّر تحميل الأخبار. حاول مرة أخرى.',
      updated: 'آخر تحديث',
      articles: 'خبر',
      stale: 'نسخة مخزّنة',
      fresh: 'محدّث',
      wcTag: 'كأس العالم 2026',
      langBtn: 'EN',
      langAria: 'التبديل للإنجليزية',
    },
    en: {
      brandSub: 'WORLD CUP NEWS',
      latestNews: 'Latest News',
      moreStories: 'More Stories',
      footer: '© 2026 90Plus World Cup News — All rights reserved',
      loading: 'Loading news…',
      empty: 'No World Cup news available right now.',
      error: 'Could not load news. Please try again.',
      updated: 'Updated',
      articles: 'articles',
      stale: 'cached snapshot',
      fresh: 'updated',
      wcTag: 'World Cup 2026',
      langBtn: 'ع',
      langAria: 'Switch to Arabic',
    },
  };

  var state = {
    lang: 'ar',
    payload: null,
    articles: [],
  };

  function t(key) {
    return I18N[state.lang][key] || key;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function readStoredLang() {
    try {
      var stored = localStorage.getItem(LANG_KEY);
      return stored === 'en' ? 'en' : 'ar';
    } catch (_e) {
      return 'ar';
    }
  }

  function storeLang(lang) {
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch (_e) {
      /* ignore */
    }
  }

  function applyLanguage(lang) {
    state.lang = lang;
    storeLang(lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.body.classList.remove('lang-ar', 'lang-en');
    document.body.classList.add(lang === 'ar' ? 'lang-ar' : 'lang-en');

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      if (key && I18N[lang][key]) el.textContent = I18N[lang][key];
    });

    var toggle = document.getElementById('lang-toggle');
    var label = document.getElementById('lang-toggle-label');
    if (label) label.textContent = I18N[lang].langBtn;
    if (toggle) toggle.setAttribute('aria-label', I18N[lang].langAria);
  }

  function formatRelativeTime(iso) {
    var date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';

    var diffMs = Date.now() - date.getTime();
    var minutes = Math.floor(diffMs / 60000);
    var hours = Math.floor(minutes / 60);
    var days = Math.floor(hours / 24);

    if (state.lang === 'ar') {
      if (minutes < 1) return 'الآن';
      if (minutes < 60) return 'منذ ' + minutes + ' د';
      if (hours < 24) return 'منذ ' + hours + ' س';
      if (days === 1) return 'منذ يوم';
      return 'منذ ' + days + ' أيام';
    }

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return minutes + 'm ago';
    if (hours < 24) return hours + 'h ago';
    if (days === 1) return '1 day ago';
    return days + ' days ago';
  }

  function formatUpdatedAt(iso) {
    if (!iso) return '—';
    try {
      return new Intl.DateTimeFormat(state.lang === 'ar' ? 'ar-EG' : 'en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(iso));
    } catch (_e) {
      return iso;
    }
  }

  function articlesForLang(payload, lang) {
    var bucket = payload && payload.data ? payload.data[lang] : null;
    return bucket && bucket.articles ? bucket.articles : [];
  }

  function mediaHtml(imageUrl, priority) {
    if (imageUrl) {
      return (
        '<img src="' +
        escapeHtml(imageUrl) +
        '" alt="" loading="' +
        (priority ? 'eager' : 'lazy') +
        '" decoding="async"' +
        (priority ? ' fetchpriority="high"' : '') +
        ' onerror="this.onerror=null;this.src=\'' +
        PLACEHOLDER_IMG +
        '\';this.classList.add(\'img-fallback\');" />'
      );
    }
    return '<div class="card-fallback" aria-hidden="true">⚽</div>';
  }

  function clockIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>';
  }

  function renderLarge(article) {
    var summary = article.description || '';
    return (
      '<a class="card-large" href="' +
      escapeHtml(article.url) +
      '" target="_blank" rel="noopener noreferrer">' +
      mediaHtml(article.imageUrl, true) +
      '<div class="content">' +
      '<span class="badge">' +
      escapeHtml(t('wcTag')) +
      '</span>' +
      '<h2>' +
      escapeHtml(article.title) +
      '</h2>' +
      (summary ? '<p>' + escapeHtml(summary) + '</p>' : '') +
      '<div class="meta-row"><span>' +
      clockIcon() +
      escapeHtml(formatRelativeTime(article.publishedAt)) +
      '</span><span>' +
      escapeHtml(article.source) +
      '</span></div>' +
      '</div></a>'
    );
  }

  function renderSmall(article) {
    return (
      '<a class="card-small" href="' +
      escapeHtml(article.url) +
      '" target="_blank" rel="noopener noreferrer">' +
      '<div class="thumb">' +
      mediaHtml(article.imageUrl, false) +
      '</div>' +
      '<div><span class="source">' +
      escapeHtml(article.source) +
      '</span><h4>' +
      escapeHtml(article.title) +
      '</h4><span class="meta-row">' +
      clockIcon() +
      escapeHtml(formatRelativeTime(article.publishedAt)) +
      '</span></div></a>'
    );
  }

  function bindNativeExternalLinks() {
    if (window.__90plusNewsPageClickBound) return;
    window.__90plusNewsPageClickBound = true;
    document.addEventListener(
      'click',
      function (e) {
        var link = e.target && e.target.closest ? e.target.closest('a') : null;
        if (!link || !link.href) return;
        try {
          var host = new URL(link.href).hostname.toLowerCase();
          if (host === '90plus.pro' || host === 'www.90plus.pro') return;
        } catch (_err) {
          return;
        }
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          e.preventDefault();
          e.stopPropagation();
          window.ReactNativeWebView.postMessage(
            JSON.stringify({ type: 'OPEN_EXTERNAL', url: link.href }),
          );
        }
      },
      true,
    );
  }

  function renderMedium(article) {
    var summary = article.description || '';
    return (
      '<a class="card-medium" href="' +
      escapeHtml(article.url) +
      '" target="_blank" rel="noopener noreferrer">' +
      '<div class="media">' +
      mediaHtml(article.imageUrl, false) +
      '</div>' +
      '<div class="body">' +
      '<span class="badge">' +
      escapeHtml(article.source) +
      '</span>' +
      '<h3>' +
      escapeHtml(article.title) +
      '</h3>' +
      (summary ? '<p>' + escapeHtml(summary) + '</p>' : '') +
      '<div class="meta-row"><span>' +
      clockIcon() +
      escapeHtml(formatRelativeTime(article.publishedAt)) +
      '</span></div>' +
      '</div></a>'
    );
  }

  function setMeta(payload) {
    var meta = document.getElementById('news-meta');
    if (!meta) return;

    var count = state.articles.length;
    var status = payload && payload.stale ? t('stale') : t('fresh');
    var updated = payload && payload.fetchedAt ? formatUpdatedAt(payload.fetchedAt) : '—';

    meta.innerHTML =
      '<strong>' +
      count +
      '</strong> ' +
      t('articles') +
      ' • ' +
      status +
      ' • ' +
      t('updated') +
      ' ' +
      escapeHtml(updated);
  }

  function showStatus(message, isError) {
    var statusEl = document.getElementById('news-status');
    var contentEl = document.getElementById('news-content');
    if (!statusEl || !contentEl) return;

    statusEl.textContent = message;
    statusEl.classList.remove('hidden');
    statusEl.classList.toggle('error', Boolean(isError));
    contentEl.classList.add('hidden');
  }

  function renderNews() {
    var articles = state.articles;
    var statusEl = document.getElementById('news-status');
    var contentEl = document.getElementById('news-content');
    var featuredSlot = document.getElementById('featured-slot');
    var sidebarList = document.getElementById('sidebar-list');
    var newsGrid = document.getElementById('news-grid');

    if (!statusEl || !contentEl || !featuredSlot || !sidebarList || !newsGrid) return;

    if (!articles.length) {
      showStatus(t('empty'), false);
      return;
    }

    statusEl.classList.add('hidden');
    contentEl.classList.remove('hidden');

    featuredSlot.innerHTML = renderLarge(articles[0]);
    sidebarList.innerHTML = articles.slice(1, 5).map(renderSmall).join('');
    newsGrid.innerHTML = articles.slice(5).map(renderMedium).join('');

    setMeta(state.payload);
  }

  function readPayloadCache() {
    try {
      var raw = sessionStorage.getItem(PAYLOAD_CACHE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.savedAt || !parsed.payload) return null;
      if (Date.now() - parsed.savedAt > PAYLOAD_CACHE_TTL_MS) return null;
      return parsed.payload;
    } catch (_e) {
      return null;
    }
  }

  function writePayloadCache(payload) {
    try {
      sessionStorage.setItem(
        PAYLOAD_CACHE_KEY,
        JSON.stringify({ savedAt: Date.now(), payload: payload }),
      );
    } catch (_e) {
      /* ignore quota errors */
    }
  }

  function applyPayload(payload) {
    state.payload = payload;
    state.articles = articlesForLang(payload, state.lang);
    renderNews();
  }

  async function loadNews() {
    var cachedPayload = readPayloadCache();
    if (cachedPayload) {
      applyPayload(cachedPayload);
    } else {
      showStatus(t('loading'), false);
    }

    try {
      var response = await fetch(API_URL + '?lang=all&pageSize=15', {
        headers: { Accept: 'application/json' },
      });
      var payload = await response.json();

      if (!response.ok || payload.status !== 'SUCCESS') {
        throw new Error((payload && payload.message) || 'Request failed');
      }

      writePayloadCache(payload);
      applyPayload(payload);
    } catch (error) {
      if (!cachedPayload) {
        console.error('[news]', error);
        showStatus(t('error'), true);
      }
    }
  }

  document.getElementById('lang-toggle')?.addEventListener('click', function () {
    var next = state.lang === 'ar' ? 'en' : 'ar';
    applyLanguage(next);

    if (state.payload) {
      state.articles = articlesForLang(state.payload, next);
      renderNews();
    }
  });

  applyLanguage(readStoredLang());
  bindNativeExternalLinks();
  loadNews();
})();
