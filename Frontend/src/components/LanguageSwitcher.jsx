import { LANGUAGES, useI18n } from '../i18n/I18nContext';

export default function LanguageSwitcher() {
  const { lang, setLang, t } = useI18n();
  return (
    <label className="lang-switch" title={t('Language')}>
      <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{t('Language')}</span>
      <select value={lang} onChange={(e) => setLang(e.target.value)} aria-label={t('Language')}>
        {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
      </select>
    </label>
  );
}
