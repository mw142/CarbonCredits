import { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import StatusBadge from '../components/StatusBadge';
import ExportButton from '../components/ExportButton';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';

function IntroMatches({ intro, onDone }) {
  const { token } = useAuth();
  const { t, num, money } = useI18n();
  const [matches, setMatches] = useState(null);
  const [msg, setMsg] = useState('');
  useEffect(() => { api.get(`/admin/introductions/${intro.id}/matches`, token).then(setMatches).catch((e) => setMsg(e.message)); }, [intro.id, token]);

  async function introduce(listingId) {
    try { await api.post(`/admin/introductions/${intro.id}/introduce`, { listing_id: listingId }, token); setMsg(t('Introduction made — the seller has received the enquiry.')); onDone(); } catch (e) { setMsg(e.message); }
  }
  if (!matches) return <div className="loading-row"><span className="spinner" /></div>;
  return (
    <div style={{ marginTop: 12 }}>
      {msg ? <div className="form-note" style={{ marginBottom: 10 }}>{msg}</div> : null}
      {!matches.length ? <p className="small text-soft">{t('No verified listings with live availability yet.')}</p> : matches.map((m) => (
        <div className="doc-row" key={m.listing_id} style={{ justifyContent: 'space-between' }}>
          <div><span className="badge badge-ink">{m.score}%</span> <strong>{m.listing_title}</strong> <span className="small text-soft">· {m.state || '—'} · {num(m.quantity_available)} ACCUs · {money(m.indicative_price)}</span></div>
          <button className="btn btn-outline btn-sm" onClick={() => introduce(m.listing_id)}>{t('Introduce')}</button>
        </div>
      ))}
    </div>
  );
}

export default function AdminInbox() {
  const { token } = useAuth();
  const { t, num, money, dateTime } = useI18n();
  const [tab, setTab] = useState('intros');
  const [intros, setIntros] = useState([]);
  const [site, setSite] = useState([]);
  const [open, setOpen] = useState(null);
  const [error, setError] = useState('');

  async function load() {
    try {
      const [i, s] = await Promise.all([api.get('/admin/introductions', token), api.get('/admin/site-enquiries', token)]);
      setIntros(i); setSite(s);
    } catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, [token]);

  async function setIntroStatus(id, status) { try { await api.patch(`/admin/introductions/${id}`, { status }, token); load(); } catch (e) { setError(e.message); } }
  async function setSiteStatus(id, status) { try { await api.patch(`/admin/site-enquiries/${id}`, { status }, token); load(); } catch (e) { setError(e.message); } }

  return (
    <DashboardLayout>
      <div className="page-header">
        <div>
          <div className="eyebrow">{t('Administrator')}</div>
          <h1>{t('Introductions & enquiries')}</h1>
          <p className="text-soft">{t('Buyer briefs waiting for an introduction, and messages from the website contact form.')}</p>
        </div>
        <ExportButton path={tab === 'intros' ? '/export/admin/introductions' : '/export/admin/site-enquiries'} />
      </div>
      {error ? <div className="form-error">{error}</div> : null}
      <div className="tabs">
        <button className={tab === 'intros' ? 'active' : ''} onClick={() => setTab('intros')}>{t('Buyer introductions')} ({intros.filter((i) => ['new', 'matching'].includes(i.status)).length})</button>
        <button className={tab === 'site' ? 'active' : ''} onClick={() => setTab('site')}>{t('Website enquiries')} ({site.filter((s) => s.status === 'new').length})</button>
      </div>

      {tab === 'intros' ? (intros.length ? intros.map((i) => (
        <div className="card panel" key={i.id} style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <strong>{i.organisation_name || i.buyer_name}</strong> <span className="small text-soft">· {i.buyer_email} · {dateTime(i.created_at)}</span>
              <div style={{ marginTop: 4 }}>{i.requested_quantity ? `${num(i.requested_quantity)} ACCUs` : t('Any quantity')}{i.max_price != null ? ` · ${t('up to {price}', { price: money(i.max_price) })}` : ''}{i.timeframe ? ` · ${i.timeframe}` : ''}{i.purpose ? ` · ${t(i.purpose)}` : ''}</div>
              <div className="tag-list" style={{ marginTop: 6 }}>{[...i.project_types, ...i.states].map((x) => <span key={x} className="chip">{t(x)}</span>)}</div>
              {i.message ? <p className="small text-soft" style={{ marginTop: 8, marginBottom: 0 }}>“{i.message}”</p> : null}
            </div>
            <div className="btn-row" style={{ alignItems: 'flex-start' }}>
              <StatusBadge status={i.status} />
              <span className="small text-soft">{t('{n} introductions', { n: i.introductions_made })}</span>
              <button className="btn btn-outline btn-sm" onClick={() => setOpen(open === i.id ? null : i.id)}>{open === i.id ? t('Hide matches') : t('View matches')}</button>
              {i.status === 'new' ? <button className="btn btn-ghost btn-sm" onClick={() => setIntroStatus(i.id, 'matching')}>{t('Mark as matching')}</button> : null}
              {!['closed', 'withdrawn'].includes(i.status) ? <button className="btn btn-ghost btn-sm" onClick={() => setIntroStatus(i.id, 'closed')}>{t('Close')}</button> : null}
            </div>
          </div>
          {open === i.id ? <IntroMatches intro={i} onDone={load} /> : null}
        </div>
      )) : <div className="card empty-state">{t('No buyer briefs yet.')}</div>) : null}

      {tab === 'site' ? (
        <div className="card table-wrap">
          <table className="ledger-table">
            <thead><tr><th>{t('Received')}</th><th>{t('Name')}</th><th>{t('Company')}</th><th>{t('Interest')}</th><th>{t('Message')}</th><th>{t('Status')}</th></tr></thead>
            <tbody>
              {site.map((s) => (
                <tr key={s.id}>
                  <td className="small">{dateTime(s.created_at)}</td>
                  <td>{s.first_name} {s.last_name}<div className="small"><a href={`mailto:${s.email}`}>{s.email}</a>{s.phone ? ` · ${s.phone}` : ''}</div></td>
                  <td className="small">{s.company || '—'}<div className="text-soft">{s.location}</div></td>
                  <td className="small">{s.interest || '—'}</td>
                  <td className="small" style={{ maxWidth: 320, whiteSpace: 'pre-wrap' }}>{s.message || '—'}</td>
                  <td><select className="input" style={{ padding: '5px 10px', width: 'auto' }} value={s.status} onChange={(e) => setSiteStatus(s.id, e.target.value)}><option value="new">{t('New')}</option><option value="contacted">{t('Contacted')}</option><option value="closed">{t('Closed')}</option></select></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!site.length ? <div className="empty-state">{t('No website enquiries yet.')}</div> : null}
        </div>
      ) : null}
    </DashboardLayout>
  );
}
