import { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import StatusBadge from '../components/StatusBadge';
import ExportButton from '../components/ExportButton';
import { api, fileToDataUrl, fileToText } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';

function ImportResult({ run }) {
  const { t, num } = useI18n();
  if (!run) return null;
  return (
    <div className={run.status === 'failed' ? 'form-error' : 'form-success'}>
      <strong>{t('Import')} #{run.id}: </strong>
      {run.status === 'failed' ? (run.error || run.error_details?.[0]?.error || t('Import failed.'))
        : t('{received} rows · {inserted} new · {updated} updated · {unchanged} unchanged · {failed} failed', {
          received: num(run.records_received), inserted: num(run.records_inserted), updated: num(run.records_updated), unchanged: num(run.records_unchanged), failed: num(run.records_failed),
        })}
    </div>
  );
}

export default function AdminIntegrations() {
  const { token } = useAuth();
  const { t, num, dateTime, money, date } = useI18n();
  const [data, setData] = useState(null);
  const [runs, setRuns] = useState([]);
  const [prices, setPrices] = useState([]);
  const [settings, setSettings] = useState({ cer_source_url: '', auto_sync_enabled: false, auto_sync_interval_hours: 24 });
  const [lastRun, setLastRun] = useState(null);
  const [newKey, setNewKey] = useState(null);
  const [keyForm, setKeyForm] = useState({ name: '', scopes: ['projects:write', 'projects:read'] });
  const [priceForm, setPriceForm] = useState({ instrument: 'Generic ACCU', price: '', price_date: new Date().toISOString().slice(0, 10), source: '' });
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    try {
      const [d, r, p] = await Promise.all([api.get('/admin/integrations', token), api.get('/admin/import-runs', token), api.get('/admin/market-prices', token)]);
      setData(d); setRuns(r); setPrices(p); setSettings(d.settings);
    } catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, [token]);

  async function upload(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy('upload'); setError(''); setLastRun(null);
    try {
      if (!file.name.toLowerCase().endsWith('.csv')) throw new Error(t('Select a project CSV file.'));
      const run = await api.post('/admin/projects/csv', { file_name: file.name, file_data: await fileToDataUrl(file) }, token);
      setLastRun(run);
    } catch (err) { setError(err.message); }
    finally { setBusy(''); load(); }
  }

  async function pull() {
    setBusy('pull'); setError(''); setLastRun(null);
    try { setLastRun(await api.post('/admin/integrations/pull', { url: settings.cer_source_url }, token)); } catch (err) { setError(err.message); }
    finally { setBusy(''); load(); }
  }

  async function saveSettings(e) {
    e.preventDefault(); setError('');
    try { await api.put('/admin/integrations/settings', settings, token); setMessage(t('Integration settings saved.')); load(); } catch (err) { setError(err.message); }
  }

  async function createKey(e) {
    e.preventDefault(); setError('');
    try { setNewKey(await api.post('/admin/api-keys', keyForm, token)); setKeyForm({ ...keyForm, name: '' }); load(); } catch (err) { setError(err.message); }
  }

  async function revoke(id) {
    try { await api.del(`/admin/api-keys/${id}`, token); load(); } catch (err) { setError(err.message); }
  }

  async function addPrice(e) {
    e.preventDefault(); setError('');
    try { await api.post('/admin/market-prices', priceForm, token); setPriceForm({ ...priceForm, price: '' }); setMessage(t('Price published to the live market feed.')); load(); } catch (err) { setError(err.message); }
  }

  async function uploadPrices(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await fileToText(file);
      const res = await fetch('/api/v1/market/prices', { method: 'POST', headers: { 'Content-Type': 'text/csv', Authorization: `Bearer ${token}` }, body: text });
      const body = await res.json();
      if (!res.ok && !body.saved) throw new Error(body.error || body.errors?.[0]?.error || t('Upload failed.'));
      setMessage(t('{saved} prices saved, {failed} skipped.', { saved: body.saved, failed: body.errors?.length || 0 }));
      load();
    } catch (err) { setError(err.message); }
  }

  async function deletePrice(id) {
    try { await api.del(`/admin/market-prices/${id}`, token); load(); } catch (err) { setError(err.message); }
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://your-domain';

  return (
    <DashboardLayout>
      <div className="page-header">
        <div>
          <div className="eyebrow">{t('Administrator')}</div>
          <h1>{t('Data & integrations')}</h1>
          <p className="text-soft">{t('Keep the CER project register current by upload, API or scheduled pull, publish reference prices to the live market feed, and manage API access.')}</p>
        </div>
        <ExportButton path="/export/admin/import-runs" label={t('Export import history')} />
      </div>
      {error ? <div className="form-error">{error}</div> : null}
      {message ? <div className="form-success">{message}</div> : null}
      <ImportResult run={lastRun} />

      <div className="grid-2">
        <div className="card panel">
          <div className="section-title" style={{ marginTop: 0 }}>{t('1. Upload the CER project register')}</div>
          <p className="small text-soft">{t('Download the ACCU Scheme project register CSV from the Clean Energy Regulator and upload it here. Projects are matched on Project ID — new projects are added, changed ones updated and unchanged ones skipped. Seller listings, claims, evidence and enquiries are never overwritten.')}</p>
          <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
            {busy === 'upload' ? t('Importing…') : t('Choose CSV file')}
            <input type="file" accept=".csv,text/csv" hidden disabled={!!busy} onChange={upload} />
          </label>
        </div>
        <form className="card panel" onSubmit={saveSettings}>
          <div className="section-title" style={{ marginTop: 0 }}>{t('2. Pull from a URL / schedule')}</div>
          <div className="field"><label>{t('CSV source URL')}</label><input type="url" placeholder="https://…/accu-project-register.csv" value={settings.cer_source_url || ''} onChange={(e) => setSettings({ ...settings, cer_source_url: e.target.value })} /></div>
          <div className="field-row">
            <label className="check"><input type="checkbox" checked={!!settings.auto_sync_enabled} onChange={(e) => setSettings({ ...settings, auto_sync_enabled: e.target.checked })} /> {t('Sync automatically')}</label>
            <div className="field"><label>{t('Every (hours)')}</label><input type="number" min="1" max="744" value={settings.auto_sync_interval_hours} onChange={(e) => setSettings({ ...settings, auto_sync_interval_hours: e.target.value })} /></div>
          </div>
          <div className="btn-row">
            <button className="btn btn-outline">{t('Save settings')}</button>
            <button type="button" className="btn btn-primary" disabled={!settings.cer_source_url || !!busy} onClick={pull}>{busy === 'pull' ? t('Pulling…') : t('Pull now')}</button>
          </div>
          {data?.settings.last_auto_sync_at ? <p className="field-hint" style={{ marginTop: 10 }}>{t('Last automatic sync')}: {dateTime(data.settings.last_auto_sync_at)}</p> : null}
        </form>
      </div>

      <div className="section-title">{t('Import history')}</div>
      <div className="card table-wrap">
        <table className="ledger-table">
          <thead><tr><th>#</th><th>{t('Started')}</th><th>{t('Source')}</th><th>{t('File')}</th><th>{t('Status')}</th><th className="num">{t('Rows')}</th><th className="num">{t('New')}</th><th className="num">{t('Updated')}</th><th className="num">{t('Unchanged')}</th><th className="num">{t('Failed')}</th></tr></thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id} title={r.error_details?.map((x) => (x.row_number ? `Row ${x.row_number}: ` : '') + x.error).join('\n')}>
                <td className="mono">{r.id}</td><td className="small">{dateTime(r.started_at)}</td>
                <td className="small">{t({ admin_upload: 'Admin upload', api: 'API', url_pull: 'URL pull', scheduled_pull: 'Scheduled pull' }[r.source_type] || r.source_type)}</td>
                <td className="small text-soft" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.file_name || r.source_url || '—'}</td>
                <td><StatusBadge status={r.status} /></td>
                <td className="num">{num(r.records_received)}</td><td className="num">{num(r.records_inserted)}</td><td className="num">{num(r.records_updated)}</td><td className="num">{num(r.records_unchanged)}</td><td className="num">{num(r.records_failed)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!runs.length ? <div className="empty-state">{t('No imports yet.')}</div> : null}
      </div>

      <div className="section-title">{t('Reference market prices')}</div>
      <div className="grid-2">
        <form className="card panel" onSubmit={addPrice}>
          <div className="field-row">
            <div className="field"><label>{t('Instrument')}</label><input list="instruments" required value={priceForm.instrument} onChange={(e) => setPriceForm({ ...priceForm, instrument: e.target.value })} /><datalist id="instruments"><option value="Generic ACCU" /><option value="HIR ACCU" /><option value="Savanna ACCU" /><option value="Safeguard Mechanism Credit" /></datalist></div>
            <div className="field"><label>{t('Price (AUD)')}</label><input type="number" min="0" step="0.01" required value={priceForm.price} onChange={(e) => setPriceForm({ ...priceForm, price: e.target.value })} /></div>
          </div>
          <div className="field-row">
            <div className="field"><label>{t('Date')}</label><input type="date" required value={priceForm.price_date} onChange={(e) => setPriceForm({ ...priceForm, price_date: e.target.value })} /></div>
            <div className="field"><label>{t('Source')}</label><input value={priceForm.source} onChange={(e) => setPriceForm({ ...priceForm, source: e.target.value })} placeholder={t('e.g. broker close')} /></div>
          </div>
          <div className="btn-row">
            <button className="btn btn-primary">{t('Publish price')}</button>
            <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}>{t('Upload prices CSV')}<input type="file" accept=".csv,text/csv" hidden onChange={uploadPrices} /></label>
          </div>
          <p className="field-hint" style={{ marginTop: 10 }}>{t('CSV columns')}: <code className="inline">instrument, price, price_date, source</code></p>
        </form>
        <div className="card table-wrap" style={{ maxHeight: 330, overflowY: 'auto' }}>
          <table className="ledger-table">
            <thead><tr><th>{t('Date')}</th><th>{t('Instrument')}</th><th className="num">{t('Price')}</th><th>{t('Source')}</th><th /></tr></thead>
            <tbody>{prices.map((p) => <tr key={p.id}><td className="small">{date(p.price_date)}</td><td>{p.instrument}</td><td className="num">{money(p.price)}</td><td className="small text-soft">{p.source} · {p.created_via}</td><td><button className="btn btn-ghost btn-sm" onClick={() => deletePrice(p.id)}>✕</button></td></tr>)}</tbody>
          </table>
          {!prices.length ? <div className="empty-state">{t('No prices published yet.')}</div> : null}
        </div>
      </div>

      <div className="section-title">{t('API access')}</div>
      <div className="grid-2">
        <div className="card panel">
          {newKey ? (
            <div className="form-success">
              <strong>{t('Copy this key now — it will not be shown again.')}</strong>
              <pre className="code-block" style={{ marginTop: 8, marginBottom: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{newKey.key}</pre>
            </div>
          ) : null}
          <form onSubmit={createKey}>
            <div className="field"><label>{t('Key name')}</label><input required value={keyForm.name} onChange={(e) => setKeyForm({ ...keyForm, name: e.target.value })} placeholder={t('e.g. Data warehouse sync')} /></div>
            <div className="field"><label>{t('Scopes')}</label><div className="tag-list">{(data?.scopes || []).map((s) => (
              <label key={s} className="check chip" style={{ cursor: 'pointer' }}><input type="checkbox" checked={keyForm.scopes.includes(s)} onChange={() => setKeyForm({ ...keyForm, scopes: keyForm.scopes.includes(s) ? keyForm.scopes.filter((x) => x !== s) : [...keyForm.scopes, s] })} />{s}</label>
            ))}</div></div>
            <button className="btn btn-primary">{t('Create API key')}</button>
          </form>
          <hr className="hairline" />
          {(data?.api_keys || []).map((k) => (
            <div className="doc-row" key={k.id} style={{ justifyContent: 'space-between' }}>
              <div><strong>{k.name}</strong> <code className="inline">{k.key_prefix}…</code><div className="small text-soft">{k.scopes.join(', ')} · {k.last_used_at ? t('last used {when}', { when: dateTime(k.last_used_at) }) : t('never used')}</div></div>
              {k.revoked_at ? <StatusBadge status="revoked" /> : <button className="btn btn-danger btn-sm" onClick={() => revoke(k.id)}>{t('Revoke')}</button>}
            </div>
          ))}
        </div>
        <div className="card panel">
          <div className="section-title" style={{ marginTop: 0 }}>{t('Quick start')}</div>
          <p className="small text-soft">{t('Upload a CER project register CSV:')}</p>
          <pre className="code-block">{`curl -X POST ${origin}/api/v1/projects/import \\
  -H "X-API-Key: rc_live_…" \\
  -H "Content-Type: text/csv" \\
  --data-binary @accu-project-register.csv`}</pre>
          <p className="small text-soft">{t('Or ask the server to pull it from a URL:')}</p>
          <pre className="code-block">{`curl -X POST ${origin}/api/v1/projects/import \\
  -H "X-API-Key: rc_live_…" -H "Content-Type: application/json" \\
  -d '{"url":"https://…/register.csv"}'`}</pre>
          <p className="small text-soft">{t('Push reference prices and read market data:')}</p>
          <pre className="code-block">{`curl -X POST ${origin}/api/v1/market/prices \\
  -H "X-API-Key: rc_live_…" -H "Content-Type: application/json" \\
  -d '[{"instrument":"Generic ACCU","price":35.10,"price_date":"2026-10-14","source":"Broker"}]'

curl ${origin}/api/v1/market/summary -H "X-API-Key: rc_live_…"
curl "${origin}/api/v1/projects?state=Victoria&page_size=100" -H "X-API-Key: rc_live_…"`}</pre>
          <p className="small text-soft" style={{ marginBottom: 0 }}>{t('Full endpoint list')}: <code className="inline">GET /api/v1</code></p>
        </div>
      </div>
    </DashboardLayout>
  );
}
