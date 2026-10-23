import { Link } from 'react-router-dom';
import mark from '../assets/brand/renewco-mark.svg';
import markLight from '../assets/brand/renewco-mark-light.svg';
import irongateIcon from '../assets/brand/irongate-icon.png';
import { useI18n } from '../i18n/I18nContext';

export const COMPANY = {
  name: 'renewCo.',
  email: 'office@renew-co.com.au',
  phone: '0482 447 397',
  phoneHref: 'tel:+61482447397',
  website: 'https://www.renew-co.com.au',
  privacy: 'https://www.renew-co.com.au/pprivacy-policy',
};

export function Wordmark() {
  return <span className="brand-word">renewCo<span className="dot">.</span></span>;
}

export function Logo({ to = '/', onInk = false, height = 26 }) {
  return (
    <Link to={to} className={`brand${onInk ? ' on-ink' : ''}`} aria-label="renewCo. home">
      <img src={onInk ? markLight : mark} alt="" className="brand-mark" style={{ height }} />
      <Wordmark />
    </Link>
  );
}

export function PoweredBy({ className = 'powered-by' }) {
  const { t } = useI18n();
  return (
    <span className={className}>
      <img src={irongateIcon} alt="" />
      <span>{t('Powered by')} <strong>IrongateIT</strong></span>
    </span>
  );
}
