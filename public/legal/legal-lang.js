(function () {
  const STORAGE_KEY = '90plus-legal-lang';

  function apply(lang) {
    const isAr = lang === 'ar';
    document.documentElement.lang = isAr ? 'ar' : 'en';
    document.documentElement.dir = isAr ? 'rtl' : 'ltr';

    document.querySelectorAll('.locale-ar').forEach((el) => {
      el.hidden = !isAr;
    });
    document.querySelectorAll('.locale-en').forEach((el) => {
      el.hidden = isAr;
    });

    document.querySelectorAll('[data-lang-btn]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-lang-btn') === lang);
    });

    const titleAr = document.querySelector('meta[name="title-ar"]');
    const titleEn = document.querySelector('meta[name="title-en"]');
    if (titleAr && titleEn) {
      document.title = isAr ? titleAr.content : titleEn.content;
    }

    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (_) {
      /* ignore */
    }
  }

  const params = new URLSearchParams(window.location.search);
  let initial = params.get('lang');
  if (initial !== 'ar' && initial !== 'en') {
    try {
      initial = localStorage.getItem(STORAGE_KEY);
    } catch (_) {
      initial = null;
    }
  }
  apply(initial === 'en' ? 'en' : 'ar');

  document.querySelectorAll('[data-lang-btn]').forEach((btn) => {
    btn.addEventListener('click', () => {
      apply(btn.getAttribute('data-lang-btn') === 'en' ? 'en' : 'ar');
    });
  });
})();

(function () {
  document.querySelectorAll('.faq-q').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      if (!item) return;
      const open = item.classList.toggle('open');
      const icon = btn.querySelector('[data-faq-icon]');
      if (icon) icon.textContent = open ? '−' : '+';
    });
  });
})();
