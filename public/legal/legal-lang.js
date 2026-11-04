(function () {
  var STORAGE_KEY = '90plus-legal-lang';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var activeKey = null;
  var observer = null;

  function langFromHash() {
    var raw = (window.location.hash || '').replace(/^#/, '');
    var match = raw.match(/^(?:en|ar)-(.+)$/);
    return match ? match[1] : '';
  }

  function sectionKey() {
    if (activeKey) return activeKey;
    return langFromHash();
  }

  function apply(lang, opts) {
    var isAr = lang === 'ar';
    var code = isAr ? 'ar' : 'en';
    var keep = sectionKey();

    document.documentElement.lang = code;
    document.documentElement.dir = isAr ? 'rtl' : 'ltr';
    document.documentElement.setAttribute('data-lang', code);

    document.querySelectorAll('.locale-ar').forEach(function (el) {
      el.hidden = !isAr;
    });
    document.querySelectorAll('.locale-en').forEach(function (el) {
      el.hidden = isAr;
    });

    document.querySelectorAll('[data-lang-btn]').forEach(function (btn) {
      var on = btn.getAttribute('data-lang-btn') === code;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });

    var titleAr = document.querySelector('meta[name="title-ar"]');
    var titleEn = document.querySelector('meta[name="title-en"]');
    if (titleAr && titleEn) {
      document.title = isAr ? titleAr.content : titleEn.content;
    }

    var desc = document.querySelector('meta[name="description"]');
    var descAr = document.querySelector('meta[name="desc-ar"]');
    var descEn = document.querySelector('meta[name="desc-en"]');
    if (desc && descAr && descEn) {
      desc.setAttribute('content', isAr ? descAr.content : descEn.content);
    }

    var skip = document.querySelector('.skip');
    if (skip) {
      skip.setAttribute('href', '#' + code + '-introduction');
      skip.textContent = isAr ? 'تخطي إلى المحتوى' : 'Skip to content';
    }

    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch (e) {}

    if (opts && opts.updateHistory && document.body.classList.contains('legal-doc')) {
      var next = '?lang=' + code;
      if (keep && document.getElementById(code + '-' + keep)) {
        next += '#' + code + '-' + keep;
      }
      history.replaceState(null, '', next);
    }

    if (opts && opts.scroll && keep) {
      var target = document.getElementById(code + '-' + keep);
      if (target) {
        target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      }
    }

    watchSections();
  }

  function initial() {
    var q = new URLSearchParams(window.location.search).get('lang');
    if (q === 'ar' || q === 'en') return q;
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'ar' || stored === 'en') return stored;
    } catch (e) {}
    var preset = document.documentElement.getAttribute('data-lang');
    if (preset === 'ar' || preset === 'en') return preset;
    return 'ar';
  }

  function watchSections() {
    if (observer) observer.disconnect();
    if (!('IntersectionObserver' in window)) return;
    var lang = document.documentElement.getAttribute('data-lang') === 'ar' ? 'ar' : 'en';
    var root = document.querySelector('.locale-' + lang);
    if (!root) return;
    var sections = root.querySelectorAll('section[data-section]');
    var links = root.querySelectorAll('.legal-toc a');
    if (!sections.length || !links.length) return;

    observer = new IntersectionObserver(
      function (entries) {
        var visible = entries
          .filter(function (entry) {
            return entry.isIntersecting;
          })
          .sort(function (a, b) {
            return b.intersectionRatio - a.intersectionRatio;
          })[0];
        if (!visible) return;
        var id = visible.target.id;
        activeKey = id.replace(/^(en|ar)-/, '');
        links.forEach(function (link) {
          var on = link.getAttribute('href') === '#' + id;
          link.classList.toggle('is-active', on);
          if (on) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        });
      },
      { rootMargin: '-12% 0px -68% 0px', threshold: [0.15, 0.4, 0.7] },
    );

    sections.forEach(function (section) {
      observer.observe(section);
    });
  }

  var start = initial();
  activeKey = langFromHash() || null;
  apply(start, { scroll: false, updateHistory: false });

  if (activeKey) {
    var landed = document.getElementById(start + '-' + activeKey);
    if (landed) {
      window.requestAnimationFrame(function () {
        landed.scrollIntoView({ behavior: 'auto', block: 'start' });
      });
    }
  }

  document.querySelectorAll('[data-lang-btn]').forEach(function (btn) {
    btn.addEventListener('click', function (event) {
      if (btn.tagName === 'A') event.preventDefault();
      var next = btn.getAttribute('data-lang-btn') === 'en' ? 'en' : 'ar';
      apply(next, { scroll: true, updateHistory: true });
    });
  });

  document.querySelectorAll('.legal-toc a').forEach(function (link) {
    link.addEventListener('click', function (event) {
      var id = (link.getAttribute('href') || '').replace('#', '');
      var el = document.getElementById(id);
      if (!el) return;
      event.preventDefault();
      el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      activeKey = id.replace(/^(en|ar)-/, '');
      var lang = document.documentElement.getAttribute('data-lang') === 'ar' ? 'ar' : 'en';
      history.replaceState(null, '', '?lang=' + lang + '#' + id);
    });
  });
})();

(function () {
  document.querySelectorAll('.faq-q').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var item = btn.closest('.faq-item');
      if (!item) return;
      var open = item.classList.toggle('open');
      var icon = btn.querySelector('[data-faq-icon]');
      if (icon) icon.textContent = open ? '−' : '+';
    });
  });
})();
