import { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import StatusBadge from '../components/StatusBadge';
import ExportButton from '../components/ExportButton';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { PROJECT_TYPES, STATES } from '../constants';

const EMPTY = { requested_quantity: '', max_price: '', project_types: [], states: [], preferred_vintage: '', preferred_category: '', timeframe: '', purpose: '', message: '' };

function Matches({ intro, onRequested }) {
  const { token } = useAuth();
  const { t, num, money } = useI18n();
  const [matches, setMatches] = useState(intro.matches || null);
  const [busy, setBusy] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!intro.matches) api.get(`/buyer/introductions/${intro.id}/matches`, token).then(setMatches).catch((e) => setMessage(e.message));
  }, [intro.id, intro.matches, token]);

  async function request(listingId) {
    setBusy(listingId); setMessage('');
    try {
      await api.post(`/buyer/introductions/${intro.id}/request`, { listing_id: listingId }, token);
      setMessage(t('Introduction sent. The project representative will see your enquiry in their workspace.'));
      onRequested();
    } catch (e) { setMessage(e.message); }
    finally { setBusy(null); }
  }

  const introduced = new Set((intro.introductions || []).map((i) => i.listing_id));
  if (!matches) return <div className="loading-row"><span className="spinner" /></div>;
  return (
    <div>
      {message ? <div className="form-note" style={{ marginBottom: 12 }}>{message}</div> : null}
      {!matches.length ? <p className="text-soft">{t('No verified listings match yet. We will keep your brief open and an administrator may introduce you directly as new supply is listed.')}</p> : (
        <div className="table-wrap">
          <table className="ledger-table">
            <thead><tr><th>{t('Match')}</th><th>{t('Listing')}</th><th>{t('Location')}</th><th className="num">{t('Available')}</th><th className="num">{t('Indicative price')}</th><th>{t('Why')}</th><th /></tr></thead>
            <tbody>
              {matches.map((m) => (
                <tr key={m.listing_id}>
                  <td><span className="badge badge-ink">{m.score}%</span></td>
                  <td><strong>{m.listing_title}</strong><div className="small text-soft">{m.project_reference} · {m.project_type || '—'} · {m.seller_organisation || m.seller_name}</div></td>
                  <td className="small">{m.state || '—'}</td>
                  <td className="num">{num(m.quantity_available)}<div className="small text-soft">{[m.vintage, m.category].filter(Boolean).join(' · ')}</div></td>
                  <td className="num">{money(m.indicative_price)}</td>
                  <td><div className="tag-list">{m.reasons.map((r) => <span key={r} className="chip chip-mint">{t(r)}</span>)}</div></td>
                  <td>{introduced.has(m.listing_id) ? <StatusBadge status="introduced" /> : (
                    <button className="btn btn-primary btn-sm" disabled={busy === m.listing_id || ['closed', 'withdrawn'].includes(intro.status)} onClick={() => request(m.listing_id)}>{t('Request introduction')}</button>
                  )}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function BuyerIntroductions() {
  const { token } = useAuth();
  const { t, num, money, date } = useI18n();
  const [form, setForm] = useState(EMPTY);
  const [intros, setIntros] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try { setIntros(await api.get('/buyer/introductions', token)); } catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, [token]);

  const toggle = (key, value) => setForm((f) => ({ ...f, [key]: f[key].includes(value) ? f[key].filter((v) => v !== value) : [...f[key], value] }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const created = await api.post('/buyer/introductions', form, token);
      setForm(EMPTY);
      setIntros((list) => [created, ...list]);
      setOpenId(created.id);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function withdraw(id) {
    try { await api.patch(`/buyer/introductions/${id}`, { status: 'withdrawn' }, token); await load(); } catch (e) { setError(e.message); }
  }

  return (
    <DashboardLayout>
      <div className="page-header">
        <div>
          <div className="eyebrow">{t('Buyer introductions')}</div>
          <h1>{t('Find the right supply')}</h1>
          <p className="text-soft">{t('Describe what you need. We rank verified listings with live availability against your brief, and you choose who to be introduced to.')}</p>
        </div>
        <ExportButton path="/export/buyer/enquiries" label={t('Export enquiries')} />
      </div>
      {error ? <div className="form-error">{error}</div> : null}

      <form className="card panel" onSubmit={submit}>
        <div className="section-title" style={{ marginTop: 0 }}>{t('New buyer brief')}</div>
        <div className="field-row field-row-4">
          <div className="field"><label>{t('ACCUs needed')}</label><input type="number" min="1" value={form.requested_quantity} onChange={(e) => setForm({ ...form, requested_quantity: e.target.value })} /></div>
          <div className="field"><label>{t('Max price per ACCU (AUD)')}</label><input type="number" min="0" step="0.01" value={form.max_price} onChange={(e) => setForm({ ...form, max_price: e.target.value })} /></div>
          <div className="field"><label>{t('Preferred vintage')}</label><input placeholder="2025" value={form.preferred_vintage} onChange={(e) => setForm({ ...form, preferred_vintage: e.target.value })} /></div>
          <div className="field"><label>{t('Category')}</label><select value={form.preferred_category} onChange={(e) => setForm({ ...form, preferred_category: e.target.value })}><option value="">{t('Any')}</option><option>KACCU</option><option>NKACCU</option></select></div>
        </div>
        <div className="field"><label>{t('Project types')}</label><div className="tag-list">{PROJECT_TYPES.map((v) => <button type="button" key={v} className={`chip ${form.project_types.includes(v) ? 'chip-mint' : ''}`} style={{ cursor: 'pointer' }} onClick={() => toggle('project_types', v)}>{t(v)}</button>)}</div></div>
        <div className="field"><label>{t('Locations')}</label><div className="tag-list">{STATES.map((v) => <button type="button" key={v} className={`chip ${form.states.includes(v) ? 'chip-mint' : ''}`} style={{ cursor: 'pointer' }} onClick={() => toggle('states', v)}>{t(v)}</button>)}</div></div>
        <div className="field-row">
          <div className="field"><label>{t('Timeframe')}</label><input placeholder={t('e.g. before 30 June')} value={form.timeframe} onChange={(e) => setForm({ ...form, timeframe: e.target.value })} /></div>
          <div className="field"><label>{t('Purpose')}</label><select value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })}><option value="">{t('Select…')}</option><option value="Voluntary offsetting">{t('Voluntary offsetting')}</option><option value="Climate Active certification">{t('Climate Active certification')}</option><option value="Safeguard Mechanism compliance">{t('Safeguard Mechanism compliance')}</option><option value="Investment">{t('Investment')}</option></select></div>
        </div>
        <div className="field"><label>{t('Anything else the representative should know')}</label><textarea rows="3" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></div>
        <button className="btn btn-primary btn-arrow" disabled={busy}>{busy ? t('Matching…') : t('Find matches')}</button>
      </form>

      <div className="section-title">{t('Your briefs')}</div>
      {!intros.length ? <div className="card empty-state">{t('No briefs yet.')}</div> : intros.map((intro) => (
        <div className="card panel" key={intro.id} style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <strong>{intro.requested_quantity ? t('{n} ACCUs', { n: num(intro.requested_quantity) }) : t('Any quantity')}</strong>
              {intro.max_price != null ? <span className="text-soft"> · {t('up to {price}', { price: money(intro.max_price) })}</span> : null}
              <span className="text-soft"> · {date(intro.created_at)}</span>
              <div className="tag-list" style={{ marginTop: 6 }}>{[...intro.project_types, ...intro.states, intro.timeframe, intro.purpose].filter(Boolean).map((x) => <span key={x} className="chip">{t(x)}</span>)}</div>
            </div>
            <div className="btn-row">
              <StatusBadge status={intro.status} />
              <button className="btn btn-outline btn-sm" onClick={() => setOpenId(openId === intro.id ? null : intro.id)}>{openId === intro.id ? t('Hide matches') : t('View matches')}</button>
              {!['withdrawn', 'closed'].includes(intro.status) ? <button className="btn btn-ghost btn-sm" onClick={() => withdraw(intro.id)}>{t('Withdraw')}</button> : null}
            </div>
          </div>
          {intro.introductions?.length ? (
            <div style={{ marginTop: 12 }}>{intro.introductions.map((i) => <div className="doc-row" key={i.id}><StatusBadge status={i.enquiry_status || 'new'} /> {i.listing_title} <span className="text-soft small">· {i.introduced_by === 'admin' ? t('introduced by renewCo.') : t('requested by you')} · {date(i.created_at)}</span></div>)}</div>
          ) : null}
          {openId === intro.id ? <div style={{ marginTop: 16 }}><Matches intro={intro} onRequested={load} /></div> : null}
        </div>
      ))}
      <p className="disclaimer">{t('Purchases, payments and ACCU transfers occur outside this platform.')}</p>
    </DashboardLayout>
  );
}
