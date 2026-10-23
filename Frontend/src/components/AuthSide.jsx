import { useI18n } from '../i18n/I18nContext';
import { PoweredBy } from './Brand';
import markLight from '../assets/brand/renewco-mark-light.svg';

export default function AuthSide() {
  const { t } = useI18n();
  return (
    <aside className="auth-side on-ink">
      <img src={markLight} alt="" style={{ position: 'absolute', right: -120, bottom: 40, width: 520, opacity: 0.18 }} />
      <div>
        <div className="eyebrow">renewCo.</div>
        <h2>{t('The intelligence layer connecting carbon credits, data, and transactions.')}</h2>
        <p>{t('Verified Australian carbon credit supply, live market data, emissions tracking and automated reporting in one place.')}</p>
      </div>
      <PoweredBy />
    </aside>
  );
}
