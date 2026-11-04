(function () {
  var STORAGE_KEY = '90plus-legal-lang';

  function chosen() {
    var q = new URLSearchParams(window.location.search).get('lang');
    if (q === 'ar' || q === 'en') return q;
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'ar' || stored === 'en') return stored;
    } catch (e) {}
    var nav = (navigator.language || '').toLowerCase();
    return nav.indexOf('ar') === 0 ? 'ar' : 'en';
  }

  var lang = chosen();
  document.documentElement.lang = lang === 'ar' ? 'ar' : 'en';
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.setAttribute('data-lang', lang);
})();
