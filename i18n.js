// Système multilingue d'Harmonie. Charge les traductions, expose window.i18n :
//   .lang : code de langue courant ('en' par défaut)
//   .setLang(l) : change de langue, mémorise le choix, applique au DOM, dispatche 'langchange'
//   .t(key)   : traduit une clé (retourne la clé si manquante, après repli sur l'anglais)
//   .LANGS    : tableau [{code, flag, name}] des langues reconnues
// Les éléments statiques utilisent data-i18n="clé" (textContent) ou data-i18n-attr="attr:clé,…" (attributs).
// Les scripts applicatifs écoutent window.addEventListener('langchange', …) pour re-rendre.

(() => {
  'use strict';

  const LANGS = [
    { code: 'en', flag: '🇬🇧', name: 'English' },
    { code: 'zh', flag: '🇨🇳', name: '中文' },
    { code: 'hi', flag: '🇮🇳', name: 'हिन्दी' },
    { code: 'es', flag: '🇪🇸', name: 'Español' },
    { code: 'fr', flag: '🇫🇷', name: 'Français' },
    { code: 'ar', flag: '🇸🇦', name: 'العربية' },
    { code: 'bn', flag: '🇧🇩', name: 'বাংলা' },
    { code: 'pt', flag: '🇧🇷', name: 'Português' },
    { code: 'ru', flag: '🇷🇺', name: 'Русский' },
    { code: 'ur', flag: '🇵🇰', name: 'اردو' },
  ];
  const RTL = new Set(['ar', 'ur']);
  const STORE = 'harmonie.lang';
  const FALLBACK = 'en';

  // Les tables de traduction sont injectées plus bas par langue (window.__i18nAdd).
  const DICT = {};
  const add = (code, obj) => { DICT[code] = Object.assign(DICT[code] || {}, obj); };
  window.__i18nAdd = add;

  let current = FALLBACK;
  try {
    const saved = localStorage.getItem(STORE);
    if (saved && LANGS.find(l => l.code === saved)) current = saved;
  } catch (e) { /* stockage indisponible */ }

  function t(key, ...args) {
    let s = (DICT[current] && DICT[current][key])
         || (DICT[FALLBACK] && DICT[FALLBACK][key])
         || key;
    for (let i = 0; i < args.length; i++) s = s.replace('%' + (i + 1), args[i]);
    return s;
  }

  // Applique data-i18n* à l'arbre du DOM.
  function apply(root) {
    (root || document).querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    (root || document).querySelectorAll('[data-i18n-attr]').forEach(el => {
      for (const pair of el.getAttribute('data-i18n-attr').split(',')) {
        const [attr, key] = pair.split(':').map(s => s.trim());
        if (attr && key) el.setAttribute(attr, t(key));
      }
    });
  }

  function setLang(code) {
    if (!LANGS.find(l => l.code === code)) return;
    current = code;
    try { localStorage.setItem(STORE, code); } catch (e) { /* stockage indisponible */ }
    document.documentElement.lang = code;
    document.documentElement.dir = RTL.has(code) ? 'rtl' : 'ltr';
    apply();
    window.dispatchEvent(new Event('langchange'));
  }

  window.i18n = {
    LANGS,
    get lang() { return current; },
    setLang,
    t,
    apply,
    isRTL: () => RTL.has(current),
  };

  // Applique dès que le DOM est prêt.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      document.documentElement.lang = current;
      document.documentElement.dir = RTL.has(current) ? 'rtl' : 'ltr';
      apply();
    });
  } else {
    document.documentElement.lang = current;
    document.documentElement.dir = RTL.has(current) ? 'rtl' : 'ltr';
    apply();
  }
})();
