import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import zh from './locales/zh';
import ja from './locales/ja';
import vi from './locales/vi';

/*
 * Lightweight i18n. The English text is the key, so every string reads naturally in the
 * code and any missing translation falls back to English rather than showing a key.
 *   t('Browse projects')
 *   t('Welcome, {name}', { name })
 * Add a language by adding a dictionary in ./locales and an entry in LANGUAGES.
 */

export const LANGUAGES = [
  { code: 'en', label: 'English', short: 'EN', locale: 'en-AU' },
  { code: 'zh', label: '简体中文', short: '中文', locale: 'zh-CN' },
  { code: 'ja', label: '日本語', short: '日本語', locale: 'ja-JP' },
  { code: 'vi', label: 'Tiếng Việt', short: 'VI', locale: 'vi-VN' },
];
const DICTS = { en: {}, zh, ja, vi };
const STORAGE_KEY = 'renewco_lang';

function initialLanguage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && DICTS[saved]) return saved;
  } catch { /* storage unavailable */ }
  const nav = (typeof navigator !== 'undefined' && navigator.language) || 'en';
  const code = nav.slice(0, 2).toLowerCase();
  return DICTS[code] ? code : 'en';
}

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(initialLanguage);

  useEffect(() => {
    document.documentElement.lang = LANGUAGES.find((l) => l.code === lang)?.locale || 'en';
  }, [lang]);

  const setLang = useCallback((code) => {
    if (!DICTS[code]) return;
    setLangState(code);
    try { localStorage.setItem(STORAGE_KEY, code); } catch { /* ignore */ }
  }, []);

  const value = useMemo(() => {
    const dict = DICTS[lang] || {};
    const locale = LANGUAGES.find((l) => l.code === lang)?.locale || 'en-AU';
    const t = (text, vars) => {
      let out = dict[text] ?? text;
      if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(v ?? '');
      return out;
    };
    const num = (value, digits = 0) => (value == null || Number.isNaN(Number(value)) ? '—'
      : Number(value).toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }));
    const money = (value, digits = 2) => (value == null ? '—'
      : Number(value).toLocaleString(locale, { style: 'currency', currency: 'AUD', currencyDisplay: 'narrowSymbol', minimumFractionDigits: digits, maximumFractionDigits: digits }));
    const date = (value, opts = { day: 'numeric', month: 'short', year: 'numeric' }) => {
      if (!value) return '—';
      const d = new Date(String(value).length <= 10 ? `${value}T00:00:00` : String(value).replace(' ', 'T') + (String(value).includes('Z') ? '' : 'Z'));
      return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString(locale, opts);
    };
    const dateTime = (value) => date(value, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    return { lang, setLang, t, num, money, date, dateTime, locale };
  }, [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
