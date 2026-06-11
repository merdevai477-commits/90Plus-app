(function () {
  const API_URL = '/api/news/world-cup';
  let cachedPayload = null;

  function formatDate(iso, locale) {
    try {
      return new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderArticles(container, articles, locale) {
    if (!container) return;
    if (!articles.length) {
      container.innerHTML =
        locale === 'ar-EG'
          ? '<div class="news-status">لا توجد أخبار كأس العالم حالياً.</div>'
          : '<div class="news-status">No World Cup news available right now.</div>';
      return;
    }

    container.innerHTML = articles
      .map(function (article) {
        const thumb = article.imageUrl
          ? '<img class="news-thumb" src="' +
            escapeHtml(article.imageUrl) +
            '" alt="" loading="lazy" />'
          : '<div class="news-thumb placeholder" aria-hidden="true">⚽</div>';

        return (
          '<a class="card news-card reveal" href="' +
          escapeHtml(article.url) +
          '" target="_blank" rel="noopener noreferrer">' +
          thumb +
          '<div><div class="news-meta"><span class="source">' +
          escapeHtml(article.source) +
          '</span><span>' +
          escapeHtml(formatDate(article.publishedAt, locale)) +
          '</span></div><h2>' +
          escapeHtml(article.title) +
          '</h2>' +
          (article.description
            ? '<p>' + escapeHtml(article.description) + '</p>'
            : '') +
          '</div></a>'
        );
      })
      .join('');
  }

  function setMeta(metaEl, payload, locale) {
    const bucket = locale === 'ar-EG' ? payload.data.ar : payload.data.en;
    const count = bucket?.articles?.length ?? 0;
    const updated = payload.fetchedAt
      ? formatDate(payload.fetchedAt, locale)
      : locale === 'ar-EG'
        ? '—'
        : '—';
    const staleLabel = payload.stale
      ? locale === 'ar-EG'
        ? 'نسخة مخزّنة'
        : 'cached snapshot'
      : locale === 'ar-EG'
        ? 'محدّث'
        : 'updated';
    metaEl.textContent =
      locale === 'ar-EG'
        ? count + ' خبر • ' + staleLabel + ' • ' + updated
        : count + ' articles • ' + staleLabel + ' • ' + updated;
  }

  function renderFromPayload(payload) {
    renderArticles(
      document.getElementById('news-list-ar'),
      payload.data.ar?.articles ?? [],
      'ar-EG',
    );
    renderArticles(
      document.getElementById('news-list-en'),
      payload.data.en?.articles ?? [],
      'en-US',
    );
    setMeta(document.getElementById('news-meta-ar'), payload, 'ar-EG');
    setMeta(document.getElementById('news-meta-en'), payload, 'en-US');
  }

  function setLoading() {
    const loadingAr = '<div class="news-status">جاري تحميل الأخبار…</div>';
    const loadingEn = '<div class="news-status">Loading news…</div>';
    var listAr = document.getElementById('news-list-ar');
    var listEn = document.getElementById('news-list-en');
    if (listAr) listAr.innerHTML = loadingAr;
    if (listEn) listEn.innerHTML = loadingEn;
  }

  async function loadNews(forceNetwork) {
    if (cachedPayload && !forceNetwork) {
      renderFromPayload(cachedPayload);
      return;
    }

    setLoading();

    try {
      var url = API_URL + '?lang=all&pageSize=15';
      if (forceNetwork) {
        url += '&_=' + Date.now();
      }

      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        cache: forceNetwork ? 'no-store' : 'default',
      });
      const payload = await response.json();

      if (!response.ok || payload.status !== 'SUCCESS') {
        throw new Error(payload.message || 'Request failed');
      }

      cachedPayload = payload;
      renderFromPayload(payload);
    } catch (error) {
      var errorAr = document.getElementById('news-list-ar');
      var errorEn = document.getElementById('news-list-en');
      var messageAr = 'تعذّر تحميل الأخبار. حاول مرة أخرى.';
      var messageEn = 'Could not load news. Please try again.';
      if (errorAr) {
        errorAr.innerHTML =
          '<div class="news-status error">' + escapeHtml(messageAr) + '</div>';
      }
      if (errorEn) {
        errorEn.innerHTML =
          '<div class="news-status error">' + escapeHtml(messageEn) + '</div>';
      }
      console.error('[news]', error);
    }
  }

  document.getElementById('refresh-btn-ar')?.addEventListener('click', function () {
    loadNews(true);
  });
  document.getElementById('refresh-btn-en')?.addEventListener('click', function () {
    loadNews(true);
  });

  loadNews(false);
})();
