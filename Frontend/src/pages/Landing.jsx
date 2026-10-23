import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Navbar, { dashboardPathFor } from '../components/Navbar';
import Footer from '../components/Footer';
import MarketTicker from '../components/MarketTicker';
import Icon from '../components/Icons';
import { COMPANY } from '../components/Brand';
import useMarketStream from '../hooks/useMarketStream';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { api } from '../api/client';

function HeroArt() {
  // Monochrome "3D render" abstraction in the spirit of the reference site, carrying the logo's arc and dot.
  return (
    <svg viewBox="0 0 520 520" role="img" aria-label="">
      <defs>
        <radialGradient id="sphere" cx="38%" cy="32%" r="70%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".45" stopColor="#dfe5ee" />
          <stop offset="1" stopColor="#9aa6b8" />
        </radialGradient>
        <radialGradient id="shadow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#131b29" stopOpacity=".22" />
          <stop offset="1" stopColor="#131b29" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ribbon" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#85edd0" />
          <stop offset=".5" stopColor="#7fe8de" />
          <stop offset="1" stopColor="#87f0c7" />
        </linearGradient>
        <linearGradient id="ring" x1="0" x2="1">
          <stop offset="0" stopColor="#131b29" stopOpacity=".05" />
          <stop offset=".5" stopColor="#131b29" stopOpacity=".28" />
          <stop offset="1" stopColor="#131b29" stopOpacity=".05" />
        </linearGradient>
      </defs>
      <ellipse cx="260" cy="452" rx="170" ry="26" fill="url(#shadow)" />
      <g fill="none" stroke="url(#ring)">
        <ellipse cx="260" cy="250" rx="236" ry="86" strokeWidth="1.2" transform="rotate(-14 260 250)" />
        <ellipse cx="260" cy="250" rx="206" ry="206" strokeWidth="1" strokeDasharray="2 7" />
        <ellipse cx="260" cy="250" rx="250" ry="120" strokeWidth="1" transform="rotate(22 260 250)" />
      </g>
      <circle cx="260" cy="250" r="150" fill="url(#sphere)" />
      <g stroke="#131b29" strokeOpacity=".08" fill="none">
        <ellipse cx="260" cy="250" rx="150" ry="52" />
        <ellipse cx="260" cy="250" rx="150" ry="104" />
        <ellipse cx="260" cy="250" rx="52" ry="150" />
        <ellipse cx="260" cy="250" rx="104" ry="150" />
      </g>
      <path d="M64 402C104 290 214 196 380 186C414 184 446 188 468 198L466 236C436 226 402 222 366 224C238 232 150 304 118 416Z" fill="url(#ribbon)" />
      <ellipse cx="420" cy="172" rx="26" ry="15" fill="#131b29" />
      <g fontFamily="JetBrains Mono, monospace" fontSize="11" fill="#5b6678">
        <text x="20" y="90">ACCU</text><circle cx="62" cy="86" r="3" fill="#2bb39a" />
        <text x="430" y="330">CER</text><circle cx="422" cy="326" r="3" fill="#131b29" />
        <text x="150" y="40">DATA · AI</text>
      </g>
    </svg>
  );
}

function ContactForm({ preset }) {
  const { t } = useI18n();
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', company: '', location: '', interest: preset || 'buy', message: '', website: '' });
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (preset) setForm((f) => ({ ...f, interest: preset })); }, [preset]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setStatus(null);
    try {
      await api.post('/site-enquiries', form);
      setStatus({ ok: true, text: t('Thanks — the renewCo. team will be in touch shortly.') });
      setForm((f) => ({ ...f, message: '' }));
    } catch (err) { setStatus({ ok: false, text: err.message }); }
    finally { setBusy(false); }
  }

  return (
    <form className="card panel" onSubmit={submit}>
      {status ? <div className={status.ok ? 'form-success' : 'form-error'}>{status.text}</div> : null}
      <div className="field-row">
        <div className="field"><label htmlFor="c-first">{t('First name')} *</label><input id="c-first" required value={form.first_name} onChange={set('first_name')} /></div>
        <div className="field"><label htmlFor="c-last">{t('Last name')} *</label><input id="c-last" required value={form.last_name} onChange={set('last_name')} /></div>
      </div>
      <div className="field-row">
        <div className="field"><label htmlFor="c-email">{t('Email')} *</label><input id="c-email" type="email" required value={form.email} onChange={set('email')} /></div>
        <div className="field"><label htmlFor="c-phone">{t('Phone')}</label><input id="c-phone" value={form.phone} onChange={set('phone')} /></div>
      </div>
      <div className="field-row">
        <div className="field"><label htmlFor="c-co">{t('Company / organisation name')}</label><input id="c-co" value={form.company} onChange={set('company')} /></div>
        <div className="field"><label htmlFor="c-loc">{t('Location')}</label><input id="c-loc" value={form.location} onChange={set('location')} /></div>
      </div>
      <div className="field">
        <label htmlFor="c-int">{t('I am interested in')}</label>
        <select id="c-int" value={form.interest} onChange={set('interest')}>
          <option value="buy">{t('Buying carbon credits')}</option>
          <option value="sell">{t('Selling carbon credits')}</option>
          <option value="partner">{t('Becoming a partner')}</option>
          <option value="intelligence">{t('Market intelligence')}</option>
          <option value="other">{t('Something else')}</option>
        </select>
      </div>
      <div className="field"><label htmlFor="c-msg">{t('How can we help?')}</label><textarea id="c-msg" rows="4" value={form.message} onChange={set('message')} /></div>
      <input type="text" name="website" value={form.website} onChange={set('website')} tabIndex={-1} autoComplete="off" style={{ position: 'absolute', left: -9999 }} aria-hidden="true" />
      <button className="btn btn-primary btn-arrow" disabled={busy}>{busy ? t('Sending…') : t('Contact us')}</button>
    </form>
  );
}

export default function Landing() {
  const { user } = useAuth();
  const { t, num } = useI18n();
  const { snapshot, live } = useMarketStream();
  const location = useLocation();
  const [interest, setInterest] = useState(null);

  useEffect(() => {
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth' });
  }, [location.hash]);

  const what = [
    { n: '01', title: t('Carbon Credits (ACCU)'), items: [t('Access to Australian Carbon Credit Units from the secondary market'), t('Sourcing across nature-based, agriculture and industrial projects'), t('End-to-end support: discovery, pricing and execution'), t('Powered by AI, blockchain and analytics')] },
    { n: '02', title: t('Market Intelligence'), items: [t('Real-time insights into pricing, supply and demand'), t('Data-driven analysis for buying and investment decisions'), t('Market trends and forecasts across carbon and emerging environmental assets')] },
    { n: '03', title: t('Environmental Credits'), items: [t('Next-generation credits including ocean, plastic and biodiversity assets'), t('Verified impact through data, monitoring and reporting'), t('Support for broader environmental impact strategies')] },
  ];
  const serve = [
    { title: t('Corporations'), text: t('Meeting net zero targets with verified, traceable credits and emissions tracking.') },
    { title: t('Wealth managers & advisors'), text: t('Market data and project intelligence for client portfolios.') },
    { title: t('Project developers'), text: t('Claim your CER project, verify ACCU holdings and reach qualified buyers.') },
    { title: t('ESG investors'), text: t('Transparent sourcing with official CER data kept separate from seller claims.') },
  ];
  const why = [
    { title: t('Access to verified supply'), text: t('Every listing is tied to an official CER project and a verified project representative.') },
    { title: t('Focus on nature-based assets'), text: t('Vegetation, savanna, soil carbon and agriculture projects front and centre.') },
    { title: t('Carbon and new environmental markets'), text: t('Built to extend from ACCUs to plastic, ocean and biodiversity credits.') },
    { title: t('Backed by renewCo. infrastructure'), text: t('Live market data, automated reporting and open data exports.') },
  ];
  const features = [
    { icon: 'leaf', title: t('Emissions tracking'), text: t('Record Scope 1, 2 and 3 emissions, log retired ACCUs and track your net position against your goal.') },
    { icon: 'handshake', title: t('Buyer introductions'), text: t('Tell us what you need and get matched with verified listings that fit your volume, budget and project type.') },
    { icon: 'market', title: t('Live market data'), text: t('Streaming CER register statistics, platform supply, indicative pricing and reference price history.') },
    { icon: 'report', title: t('Automated reporting'), text: t('Weekly, monthly or quarterly reports generated for you — print to PDF or export.') },
    { icon: 'download', title: t('Data export'), text: t('Download projects, emissions, enquiries and prices as CSV or JSON at any time.') },
    { icon: 'globe', title: t('Multi-language'), text: t('Use the platform and the AI assistant in English, Chinese, Japanese or Vietnamese.') },
  ];

  return (
    <>
      <Navbar />
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <div className="eyebrow">{t('Carbon & environmental markets')}</div>
            <h1>{t('Infrastructure for')} <span className="grad">{t('Carbon & Environmental Markets')}</span></h1>
            <p className="hero-lede">{t('The intelligence layer connecting carbon credits, data, and transactions — powered by AI and blockchain.')}</p>
            <div className="hero-actions">
              <Link to="/marketplace" className="btn btn-primary btn-arrow">{t('Access carbon credits')}</Link>
              {user ? <Link to={dashboardPathFor(user)} className="btn btn-outline">{t('Open your workspace')}</Link>
                : <a href="#contact" className="btn btn-outline">{t('Contact us')}</a>}
            </div>
            <div className="hero-badges">
              <div><b>{snapshot ? num(snapshot.register.projects) : '—'}</b>{t('CER projects tracked')}</div>
              <div><b>{snapshot ? num(snapshot.listings.total_available) : '—'}</b>{t('ACCUs offered')}</div>
              <div><b>{snapshot ? num(snapshot.listings.published) : '—'}</b>{t('Verified listings')}</div>
            </div>
          </div>
          <div className="hero-art"><HeroArt /></div>
        </div>
      </section>
      <MarketTicker snapshot={snapshot} live={live} />

      <section className="l-section white" id="about">
        <div className="container">
          <div className="l-head">
            <div className="num">01 — {t('About renewCo.')}</div>
            <div>
              <h2>{t('We are building infrastructure for a new generation of environmental assets — starting with carbon and expanding into broader nature and impact markets.')}</h2>
              <p>{t('Carbon markets are growing rapidly, but remain fragmented and opaque. Pricing is inconsistent, project quality is difficult to assess, and access often depends on manual broker networks. renewCo. brings clarity, access and intelligence to these markets.')}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="l-section tight">
        <div className="container">
          <div className="l-head">
            <div className="num">02 — {t('Get started')}</div>
            <h2>{t('How would you like to work with us?')}</h2>
          </div>
          <div className="start-grid">
            <Link to="/marketplace" className="card start-card">
              <span className="icon"><Icon name="grid" size={22} /></span>
              <h3>{t('Carbon credits')}</h3>
              <p>{t('Browse CER projects and verified listings, or ask us to introduce you to the right supply.')}</p>
              <span className="go">{t('Access carbon credits')}</span>
            </Link>
            <a href="#contact" className="card start-card" onClick={() => setInterest('partner')}>
              <span className="icon"><Icon name="handshake" size={22} /></span>
              <h3>{t('Partnership')}</h3>
              <p>{t('Work with renewCo. on data, distribution or next-generation environmental assets.')}</p>
              <span className="go">{t('Become a partner')}</span>
            </a>
            <Link to="/register?role=seller" className="card start-card">
              <span className="icon"><Icon name="sell" size={22} /></span>
              <h3>{t('I want to sell')}</h3>
              <p>{t('Claim your project, verify your ACCUs and reach buyers looking for your credits.')}</p>
              <span className="go">{t('Start selling')}</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="l-section ink on-ink" id="what-we-do">
        <div className="container">
          <div className="l-head">
            <div className="num">03 — {t('What we do')}</div>
            <div>
              <h2>{t('We connect buyers and sellers of carbon credits, provide market intelligence, and build infrastructure for next-generation environmental assets.')}</h2>
            </div>
          </div>
          <div className="what-list">
            {what.map((w) => (
              <div className="what-row" key={w.n}>
                <span className="n">{w.n}</span>
                <h3>{w.title}</h3>
                <ul>{w.items.map((i) => <li key={i}>{i}</li>)}</ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="l-section">
        <div className="container">
          <div className="l-head">
            <div className="num">04 — {t('Who we serve')}</div>
            <h2>{t('Built for every side of the market.')}</h2>
          </div>
          <div className="serve-grid">
            {serve.map((s, i) => <div key={s.title}><span className="k">0{i + 1}</span><h3>{s.title}</h3><p>{s.text}</p></div>)}
          </div>
        </div>
      </section>

      <section className="l-section white">
        <div className="container">
          <div className="l-head">
            <div className="num">05 — {t('Platform')}</div>
            <div>
              <h2>{t('Everything you need to source, track and report on carbon credits.')}</h2>
              <p>{t('Official CER project data, seller-provided listings and platform verification are always shown separately, so you know exactly where every figure comes from.')}</p>
            </div>
          </div>
          <div className="feature-band">
            {features.map((f) => (
              <div className="card" key={f.title}>
                <span className="icon" style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--mint-tint)', color: 'var(--mint-ink)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={f.icon} size={20} /></span>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="l-section">
        <div className="container">
          <div className="l-head">
            <div className="num">06 — {t('Why us')}</div>
            <h2>{t('Clarity, access and intelligence.')}</h2>
          </div>
          <div className="why-grid">
            {why.map((w) => <div className="why-item" key={w.title}><span className="tick">✓</span><div><h3>{w.title}</h3><p>{w.text}</p></div></div>)}
          </div>
        </div>
      </section>

      <section className="l-section white" id="contact">
        <div className="container contact-grid">
          <div>
            <div className="eyebrow">{t('Contact')}</div>
            <h2>{t('Ready to power your future?')}</h2>
            <p className="text-soft">{t('Tell us what you are looking for and the renewCo. team will get back to you.')}</p>
            <div className="contact-lines">
              <a href={`mailto:${COMPANY.email}`}><span className="k">{t('Email')}</span>{COMPANY.email}</a>
              <a href={COMPANY.phoneHref}><span className="k">{t('Phone')}</span>{COMPANY.phone}</a>
            </div>
          </div>
          <ContactForm preset={interest} />
        </div>
      </section>
      <Footer />
    </>
  );
}
