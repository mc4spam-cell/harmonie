// Compléments de traduction communs à toutes les langues.
// Fusionnés via __i18nAdd ; seuls les textes très courts et universels sont centralisés ici.
(() => {
  const map = {
    en: { 'toast.partRegen': '%1: new version' },
    fr: { 'toast.partRegen': '%1 : nouvelle version' },
    es: { 'toast.partRegen': '%1: nueva versión' },
    pt: { 'toast.partRegen': '%1: nova versão' },
    ru: { 'toast.partRegen': '%1: новая версия' },
    zh: { 'toast.partRegen': '%1:新版本' },
    hi: { 'toast.partRegen': '%1: नया संस्करण' },
    ar: { 'toast.partRegen': '%1: نسخة جديدة' },
    bn: { 'toast.partRegen': '%1: নতুন সংস্করণ' },
    ur: { 'toast.partRegen': '%1: نیا نسخہ' },
  };
  for (const [code, obj] of Object.entries(map)) window.__i18nAdd(code, obj);
})();
