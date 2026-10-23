import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
import { COMPANY, Logo, PoweredBy } from './Brand';

export default function Footer() {
  const { t } = useI18n();
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <Logo onInk />
            <p className="footer-tag">{t('Infrastructure for carbon & environmental markets — connecting carbon credits, data and transactions.')}</p>
            <PoweredBy className="footer-powered" />
          </div>
          <div>
            <h4>{t('Platform')}</h4>
            <Link to="/marketplace">{t('Marketplace')}</Link>
            <Link to="/market">{t('Market data')}</Link>
            <Link to="/buyers">{t('Buyer introductions')}</Link>
            <Link to="/register">{t('Create an account')}</Link>
          </div>
          <div>
            <h4>{t('Company')}</h4>
            <Link to="/#about">{t('About renewCo.')}</Link>
            <Link to="/#what-we-do">{t('What we do')}</Link>
            <Link to="/#contact">{t('Contact')}</Link>
            <a href={COMPANY.website} target="_blank" rel="noreferrer">renew-co.com.au</a>
          </div>
          <div>
            <h4>{t('Contact')}</h4>
            <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
            <a href={COMPANY.phoneHref}>{COMPANY.phone}</a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} renewCo. {t('All rights reserved.')}</span>
          <span>{t('Official project data from the Clean Energy Regulator public register. Purchases, payments and ACCU transfers occur outside this platform.')}</span>
          <a href={COMPANY.privacy} target="_blank" rel="noreferrer" style={{ display: 'inline' }}>{t('Privacy policy')}</a>
        </div>
      </div>
    </footer>
  );
}
