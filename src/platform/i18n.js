// Interface texts in the 4 languages My PC supports (info.lang), English as the fallback.
import en from '../i18n/en.js?v=2.5.3';
import fr from '../i18n/fr.js?v=2.5.3';
import es from '../i18n/es.js?v=2.5.3';
import ar from '../i18n/ar.js?v=2.5.3';
import more from '../i18n/more.js?v=2.5.3';

export const UI_LANGS = ['en', 'fr', 'es', 'ar'];
// more.js holds the texts of newer features per language: { en: { ai: {...} }, fr: {...} }.
const DICTS = { en: { ...en, ...more.en }, fr: { ...fr, ...more.fr }, es: { ...es, ...more.es }, ar: { ...ar, ...more.ar } };
let lang = 'en';
let dict = DICTS.en;

export function setUiLang(l) {
  lang = DICTS[l] ? l : 'en';
  dict = DICTS[lang];
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
}

export function uiLang() { return lang; }

// t('unit', { n: 2 }) -> 'Unit 2'; t('prompts.word_bank')
export function t(key, vars) {
  let v = key.split('.').reduce((o, k) => (o ? o[k] : undefined), dict);
  if (v === undefined) v = key.split('.').reduce((o, k) => (o ? o[k] : undefined), DICTS.en);
  if (typeof v !== 'string') return v === undefined ? key : v;
  return vars ? v.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : '')) : v;
}

// Pick the best text out of a { en, fr, es, ar } map.
export function pickLang(map, preferred = lang) {
  if (!map) return '';
  return map[preferred] || map[lang] || map.en || Object.values(map)[0] || '';
}
