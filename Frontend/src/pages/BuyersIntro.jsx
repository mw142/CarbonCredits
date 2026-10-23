import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import Icon from '../components/Icons';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';

export default function BuyersIntro() {
  const { user } = useAuth();
  const { t } = useI18n();
  const steps = [
    { icon: 'users', title: t('Create a buyer account'), text: t('Register your organisation and set an annual offset goal.') },
    { icon: 'handshake', title: t('Share your requirements'), text: t('Volume, budget, project types, locations, vintage and timeframe — in one short brief.') },
    { icon: 'check', title: t('Get matched instantly'), text: t('We rank verified listings with live availability against your brief and explain every match.') },
    { icon: 'spark', title: t('Meet the representative'), text: t('Request an introduction and the verified project representative receives your enquiry directly.') },
    { icon: 'leaf', title: t('Track and report'), text: t('Log the ACCUs you retire against your emissions and receive automated reports.') },
  ];
  const cta = user?.role === 'buyer' ? '/buyer/introductions' : user ? '/marketplace' : '/register?role=buyer';

  return (
    <>
      <Navbar />
      <section className="hero" style={{ paddingBottom: 60 }}>
        <div className="container" style={{ maxWidth: 980 }}>
          <div className="eyebrow">{t('Buyer introductions')}</div>
          <h1 style={{ fontSize: 'clamp(34px, 5vw, 60px)' }}>{t('Tell us what you need. We will introduce you to verified supply.')}</h1>
          <p className="hero-lede">{t('Sourcing ACCUs still relies on broker networks and phone calls. renewCo. matches your requirements with verified project representatives on the platform, so you can start a conversation in minutes.')}</p>
          <div className="hero-actions">
            <Link to={cta} className="btn btn-primary btn-arrow">{user?.role === 'buyer' ? t('Start a buyer brief') : t('Create a buyer account')}</Link>
            <Link to="/marketplace" className="btn btn-outline">{t('Browse the marketplace')}</Link>
          </div>
        </div>
      </section>

      <section className="l-section white tight">
        <div className="container">
          <div className="l-head">
            <div className="num">{t('How it works')}</div>
            <h2>{t('From brief to introduction in five steps.')}</h2>
          </div>
          <div className="feature-band" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            {steps.map((s, i) => (
              <div className="card" key={s.title}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--mint-tint)', color: 'var(--mint-ink)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={s.icon} size={20} /></span>
                  <span className="mono text-faint">0{i + 1}</span>
                </div>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="l-section tight">
        <div className="container grid-2" style={{ alignItems: 'center' }}>
          <div>
            <div className="eyebrow">{t('What we check')}</div>
            <h2 style={{ fontSize: 32 }}>{t('Every introduction is to a verified representative.')}</h2>
            <p className="text-soft">{t('Listings only go live after an administrator approves the seller’s relationship to the official CER project. ACCU holdings are verified separately from project ownership, and availability expires unless the seller reconfirms it.')}</p>
          </div>
          <div className="card panel">
            <div className="doc-row"><span className="badge badge-ink">CER</span>{t('Official project data from the public register')}</div>
            <div className="doc-row"><span className="badge badge-verified">{t('Verified')}</span>{t('Project representative approved by renewCo.')}</div>
            <div className="doc-row"><span className="badge badge-verified">ACCU</span>{t('Holdings evidence reviewed separately')}</div>
            <div className="doc-row"><span className="badge badge-neutral">{t('Seller')}</span>{t('Pricing and availability supplied by the representative')}</div>
            <p className="disclaimer" style={{ marginBottom: 0 }}>{t('Purchases, payments and ACCU transfers occur outside this platform.')}</p>
          </div>
        </div>
      </section>
      <Footer />
    </>
  );
}
