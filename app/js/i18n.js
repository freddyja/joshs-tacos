// English / Spanish only.
export const LANGS = ['en', 'es'];
export const LANG_KEY = 'jt-lang';

export function detectLang(languages = []) {
  for (const l of languages) {
    const code = String(l || '').toLowerCase().slice(0, 2);
    if (code === 'es') return 'es';
    if (code === 'en') return 'en';
  }
  return 'en';
}

export function getSavedLang(storage) {
  try {
    const v = storage.getItem(LANG_KEY);
    return LANGS.includes(v) ? v : null;
  } catch {
    return null;
  }
}

export function saveLang(storage, lang) {
  if (!LANGS.includes(lang)) throw new Error(`Unsupported language: ${lang}`);
  try {
    storage.setItem(LANG_KEY, lang);
  } catch {
    /* storage unavailable: the toggle still works for this session */
  }
}

/** Returns t(key, vars). Missing keys return the key itself (tests guarantee none are missing). */
export function createT(dict) {
  return function t(key, vars) {
    let s = Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
    }
    return s;
  };
}
