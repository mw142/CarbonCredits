import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import StatCard from '../components/StatCard';
import ExportButton from '../components/ExportButton';
import { BarChart, HBarList } from '../components/Charts';
import { api, fileToText } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';

const THIS_YEAR = new Date().getFullYear();
const BLANK = { preset: '', period_year: THIS_YEAR, period_month: '', scope: 2, category: '', facility: '', activity_value: '', activity_unit: '', emission_factor: '', tco2e: '', notes: '' };

/** Minimal CSV parser (handles quoted fields) for bulk emissions upload. */
function parseCsv(text) {
  const rows = [];
  let row = [''];
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { row[row.length - 1] += '"'; i += 1; } else if (ch === '"') quoted = false; else row[row.length - 1] += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') row.push('');
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i += 1; rows.push(row); row = ['']; }
    else row[row.length - 1] += ch;
  }
  if (row.length > 1 || row[0]) rows.push(row);
  const [header, ...body] = rows.filter((r) => r.some((c) => c.trim()));
  const keys = (header || []).map((h) => h.replace(/^﻿/, '').trim().toLowerCase());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])));
}

export default function Emissions() {
  const { token } = useAuth();
  const { t, num, date, locale } = useI18n();
  const [year, setYear] = useState(THIS_YEAR);
  const [factors, setFactors] = useState([]);
  const [summary, setSummary] = useState(null);
  const [allYears, setAllYears] = useState(null);
  const [records, setRecords] = useState([]);
  const [offsets, setOffsets] = useState([]);
  const [form, setForm] = useState(BLANK);
  const [offsetForm, setOffsetForm] = useState({ retired_on: new Date().toISOString().slice(0, 10), quantity: '', project_reference: '', vintage: '', category: '', masked_registry_reference: '' });
  const [goal, setGoal] = useState('');
  const [tab, setTab] = useState('emissions');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load(y = year) {
    try {
      const [s, all, r, o, d] = await Promise.all([
        api.get(`/buyer/emissions/summary?year=${y}`, token),
        api.get('/buyer/emissions/summary', token),
        api.get(`/buyer/emissions?year=${y}`, token),
        api.get('/buyer/offsets', token),
        api.get('/buyer/dashboard', token),
      ]);
      setSummary(s); setAllYears(all); setRecords(r); setOffsets(o);
      setGoal(d.profile.annual_offset_goal ?? '');
    } catch (err) { setError(err.message); }
  }
  useEffect(() => { api.get('/buyer/emission-factors', token).then(setFactors).catch(() => {}); }, [token]);
  useEffect(() => { load(year); }, [year, token]);

  const preview = useMemo(() => {
    const a = Number(form.activity_value); const f = Number(form.emission_factor);
    return form.activity_value !== '' && form.emission_factor !== '' && Number.isFinite(a) && Number.isFinite(f) ? (a * f) / 1000 : null;
  }, [form.activity_value, form.emission_factor]);

  function pickPreset(id) {
    const p = factors.find((f) => f.id === id);
    if (!p) return setForm({ ...form, preset: '' });
    if (p.id === 'custom') return setForm({ ...form, preset: id, scope: p.scope, category: '', activity_unit: '', emission_factor: '', activity_value: '' });
    return setForm({ ...form, preset: id, scope: p.scope, category: p.category, activity_unit: p.unit, emission_factor: p.factor });
  }

  async function addRecord(e) {
    e.preventDefault(); setError(''); setMessage('');
    try {
      const body = { ...form };
      if (form.preset === 'custom' || form.emission_factor === '') { body.activity_value = ''; body.emission_factor = ''; }
      await api.post('/buyer/emissions', body, token);
      setForm({ ...BLANK, period_year: form.period_year, period_month: form.period_month });
      setMessage(t('Emission entry saved.'));
      load();
    } catch (err) { setError(err.message); }
  }

  async function bulkUpload(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(''); setMessage('');
    try {
      const rows = parseCsv(await fileToText(file));
      const res = await api.post('/buyer/emissions/bulk', { rows }, token);
      setMessage(t('{saved} rows imported, {failed} skipped.', { saved: res.saved, failed: res.errors.length }));
      load();
    } catch (err) { setError(err.message); }
  }

  async function remove(path) {
    try { await api.del(path, token); load(); } catch (err) { setError(err.message); }
  }

  async function addOffset(e) {
    e.preventDefault(); setError(''); setMessage('');
    try {
      await api.post('/buyer/offsets', offsetForm, token);
      setOffsetForm({ ...offsetForm, quantity: '', project_reference: '', vintage: '', masked_registry_reference: '' });
      setMessage(t('Retirement recorded.'));
      load();
    } catch (err) { setError(err.message); }
  }

  async function saveGoal(e) {
    e.preventDefault();
    try { await api.patch('/buyer/profile', { annual_offset_goal: goal === '' ? null : Number(goal) }, token); setMessage(t('Offset goal updated.')); load(); } catch (err) { setError(err.message); }
  }

  const years = [...new Set([THIS_YEAR, THIS_YEAR - 1, THIS_YEAR - 2, ...(allYears?.by_year || []).map((y) => y.year)])].sort((a, b) => b - a);
  const scopeLabel = (s) => t('Scope {n}', { n: s });

  return (
    <DashboardLayout>
      <div className="page-header">
        <div>
          <div className="eyebrow">{t('Emissions tracking')}</div>
          <h1>{t('Your emissions and offsets')}</h1>
          <p className="text-soft">{t('Record Scope 1, 2 and 3 emissions, log the ACCUs you retire, and track your net position against your annual goal.')}</p>
        </div>
        <div className="btn-row">
          <select className="input" style={{ width: 'auto', borderRadius: 999 }} value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label={t('Year')}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <ExportButton path="/export/buyer/emissions" label={t('Export emissions')} />
        </div>
      </div>
      {error ? <div className="form-error">{error}</div> : null}
      {message ? <div className="form-success">{message}</div> : null}

      {summary ? (
        <div className="stat-grid">
          <StatCard label={t('Emissions {year}', { year })} value={num(summary.total_tco2e, 1)} sub="t CO2-e" />
          <StatCard label={t('ACCUs retired {year}', { year })} value={num(summary.offsets_retired)} sub={t('1 ACCU = 1 t CO2-e')} />
          <StatCard label={t('Net position')} value={num(summary.net_tco2e, 1)} sub={summary.net_tco2e <= 0 ? t('Fully offset') : t('t CO2-e still to address')} />
          <StatCard label={t('Annual offset goal')} value={summary.annual_offset_goal ? `${num(summary.goal_progress_pct, 0)}%` : '—'} sub={summary.annual_offset_goal ? t('{n} of {goal} ACCUs', { n: num(summary.offsets_retired), goal: num(summary.annual_offset_goal) }) : t('Set a goal below')}>
            {summary.annual_offset_goal ? <div className="progress" style={{ marginTop: 10 }}><span style={{ width: `${Math.min(100, summary.goal_progress_pct || 0)}%` }} /></div> : null}
          </StatCard>
        </div>
      ) : <div className="loading-row"><span className="spinner" /></div>}

      <div className="grid-2">
        <div className="card panel">
          <div className="section-title" style={{ marginTop: 0 }}>{t('Emissions vs offsets by year')}</div>
          {allYears?.by_year?.length ? (
            <BarChart data={allYears.by_year} xKey="year" series={[{ key: 'scope1', label: scopeLabel(1) }, { key: 'scope2', label: scopeLabel(2), color: 'var(--series-2)' }, { key: 'scope3', label: scopeLabel(3), color: 'var(--series-3)' }]} format={(v) => num(v, 0)} ariaLabel={t('Emissions vs offsets by year')} />
          ) : <div className="empty-state">{t('Add your first emission entry to see trends.')}</div>}
          {allYears?.by_year?.length ? <div className="small text-soft" style={{ marginTop: 8 }}>{allYears.by_year.map((y) => `${y.year}: ${num(y.offsets)} ACCUs ${t('retired')}`).join(' · ')}</div> : null}
        </div>
        <div className="card panel">
          <div className="section-title" style={{ marginTop: 0 }}>{t('Largest sources in {year}', { year })}</div>
          {summary?.by_category?.length ? <HBarList rows={summary.by_category.slice(0, 8).map((c) => ({ label: `${c.category} (S${c.scope})`, value: c.tco2e }))} format={(v) => `${num(v, 1)} t`} /> : <div className="empty-state">{t('No entries for {year}.', { year })}</div>}
        </div>
      </div>

      <div className="tabs" style={{ marginTop: 30 }}>
        <button className={tab === 'emissions' ? 'active' : ''} onClick={() => setTab('emissions')}>{t('Emission entries')}</button>
        <button className={tab === 'offsets' ? 'active' : ''} onClick={() => setTab('offsets')}>{t('ACCUs retired')}</button>
        <button className={tab === 'goal' ? 'active' : ''} onClick={() => setTab('goal')}>{t('Goal')}</button>
      </div>

      {tab === 'emissions' ? (
        <>
          <form className="card panel" onSubmit={addRecord}>
            <div className="field-row field-row-4">
              <div className="field"><label>{t('Source preset')}</label>
                <select value={form.preset} onChange={(e) => pickPreset(e.target.value)}>
                  <option value="">{t('Choose a source…')}</option>
                  {factors.map((f) => <option key={f.id} value={f.id}>{t(f.category)}{f.id !== 'custom' ? ` — ${f.factor} kg/${f.unit}` : ''}</option>)}
                </select>
              </div>
              <div className="field"><label>{t('Scope')}</label><select value={form.scope} onChange={(e) => setForm({ ...form, scope: Number(e.target.value) })}>{[1, 2, 3].map((s) => <option key={s} value={s}>{scopeLabel(s)}</option>)}</select></div>
              <div className="field"><label>{t('Year')}</label><input type="number" min="1990" max="2100" required value={form.period_year} onChange={(e) => setForm({ ...form, period_year: e.target.value })} /></div>
              <div className="field"><label>{t('Month (optional)')}</label><select value={form.period_month} onChange={(e) => setForm({ ...form, period_month: e.target.value })}><option value="">{t('Whole year')}</option>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(2000, i, 1).toLocaleString(locale, { month: 'long' })}</option>)}</select></div>
            </div>
            <div className="field-row">
              <div className="field"><label>{t('Source / category')}</label><input required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder={t('e.g. Business travel')} /></div>
              <div className="field"><label>{t('Facility or site (optional)')}</label><input value={form.facility} onChange={(e) => setForm({ ...form, facility: e.target.value })} /></div>
            </div>
            {form.preset && form.preset !== 'custom' ? (
              <div className="field-row field-row-3">
                <div className="field"><label>{t('Activity ({unit})', { unit: form.activity_unit })}</label><input type="number" min="0" step="any" required value={form.activity_value} onChange={(e) => setForm({ ...form, activity_value: e.target.value })} /></div>
                <div className="field"><label>{t('Emission factor (kg CO2-e per {unit})', { unit: form.activity_unit })}</label><input type="number" min="0" step="any" required value={form.emission_factor} onChange={(e) => setForm({ ...form, emission_factor: e.target.value })} /></div>
                <div className="field"><label>{t('Calculated')}</label><div className="stat-value" style={{ fontSize: 22, paddingTop: 8 }}>{preview == null ? '—' : `${num(preview, 3)} t`}</div></div>
              </div>
            ) : (
              <div className="field-row"><div className="field"><label>{t('Emissions (t CO2-e)')}</label><input type="number" min="0" step="any" required value={form.tco2e} onChange={(e) => setForm({ ...form, tco2e: e.target.value })} /></div><div /></div>
            )}
            <p className="field-hint">{t('Preset factors are indicative values based on the Australian National Greenhouse Accounts (NGA) Factors. Check the current NGA Factors and edit the factor if needed.')}</p>
            <div className="btn-row">
              <button className="btn btn-primary">{t('Add entry')}</button>
              <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}>
                {t('Import CSV')}
                <input type="file" accept=".csv,text/csv" hidden onChange={bulkUpload} />
              </label>
              <span className="small text-soft">{t('CSV columns')}: <code className="inline">period_year, period_month, scope, category, activity_value, activity_unit, emission_factor, tco2e</code></span>
            </div>
          </form>
          <div className="card table-wrap" style={{ marginTop: 16 }}>
            <table className="ledger-table">
              <thead><tr><th>{t('Period')}</th><th>{t('Scope')}</th><th>{t('Source')}</th><th className="num">{t('Activity')}</th><th className="num">{t('Factor')}</th><th className="num">t CO2-e</th><th /></tr></thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id}>
                    <td className="mono">{r.period_year}{r.period_month ? `-${String(r.period_month).padStart(2, '0')}` : ''}</td>
                    <td>{scopeLabel(r.scope)}</td>
                    <td>{t(r.category)}{r.facility ? <div className="small text-soft">{r.facility}</div> : null}</td>
                    <td className="num">{r.activity_value != null ? `${num(r.activity_value, 0)} ${r.activity_unit || ''}` : '—'}</td>
                    <td className="num">{r.emission_factor ?? '—'}</td>
                    <td className="num"><strong>{num(r.tco2e, 2)}</strong></td>
                    <td><button className="btn btn-ghost btn-sm" onClick={() => remove(`/buyer/emissions/${r.id}`)}>{t('Delete')}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!records.length ? <div className="empty-state">{t('No entries for {year}.', { year })}</div> : null}
          </div>
        </>
      ) : null}

      {tab === 'offsets' ? (
        <>
          <form className="card panel" onSubmit={addOffset}>
            <div className="field-row field-row-3">
              <div className="field"><label>{t('Retirement date')}</label><input type="date" required value={offsetForm.retired_on} onChange={(e) => setOffsetForm({ ...offsetForm, retired_on: e.target.value })} /></div>
              <div className="field"><label>{t('ACCUs retired')}</label><input type="number" min="1" required value={offsetForm.quantity} onChange={(e) => setOffsetForm({ ...offsetForm, quantity: e.target.value })} /></div>
              <div className="field"><label>{t('CER project ID')}</label><input placeholder="ERF123456" value={offsetForm.project_reference} onChange={(e) => setOffsetForm({ ...offsetForm, project_reference: e.target.value })} /></div>
            </div>
            <div className="field-row field-row-3">
              <div className="field"><label>{t('Vintage')}</label><input value={offsetForm.vintage} onChange={(e) => setOffsetForm({ ...offsetForm, vintage: e.target.value })} /></div>
              <div className="field"><label>{t('Category')}</label><select value={offsetForm.category} onChange={(e) => setOffsetForm({ ...offsetForm, category: e.target.value })}><option value="">—</option><option>KACCU</option><option>NKACCU</option></select></div>
              <div className="field"><label>{t('Registry reference (stored masked)')}</label><input value={offsetForm.masked_registry_reference} onChange={(e) => setOffsetForm({ ...offsetForm, masked_registry_reference: e.target.value })} /></div>
            </div>
            <div className="btn-row"><button className="btn btn-primary">{t('Record retirement')}</button><ExportButton path="/export/buyer/offsets" label={t('Export retirements')} /></div>
          </form>
          <div className="card table-wrap" style={{ marginTop: 16 }}>
            <table className="ledger-table">
              <thead><tr><th>{t('Date')}</th><th className="num">ACCUs</th><th>{t('Project')}</th><th>{t('Vintage')}</th><th>{t('Category')}</th><th>{t('Reference')}</th><th /></tr></thead>
              <tbody>{offsets.map((o) => <tr key={o.id}><td>{date(o.retired_on)}</td><td className="num">{num(o.quantity)}</td><td className="mono">{o.project_reference || '—'}</td><td>{o.vintage || '—'}</td><td>{o.category || '—'}</td><td className="mono">{o.masked_registry_reference || '—'}</td><td><button className="btn btn-ghost btn-sm" onClick={() => remove(`/buyer/offsets/${o.id}`)}>{t('Delete')}</button></td></tr>)}</tbody>
            </table>
            {!offsets.length ? <div className="empty-state">{t('No retirements recorded yet.')}</div> : null}
          </div>
        </>
      ) : null}

      {tab === 'goal' ? (
        <form className="card panel" onSubmit={saveGoal} style={{ maxWidth: 520 }}>
          <div className="field"><label>{t('Annual offset goal (ACCUs)')}</label><input type="number" min="0" value={goal} onChange={(e) => setGoal(e.target.value)} /></div>
          <p className="field-hint">{t('Tip: set this to your expected annual emissions to aim for a net-zero position.')}</p>
          <button className="btn btn-primary">{t('Save goal')}</button>
        </form>
      ) : null}
      <p className="disclaimer">{t('Emissions figures are self-reported by your organisation and are not audited by renewCo. Retirements are recorded for tracking only; surrender ACCUs through the official Unit and Certificate Registry.')}</p>
    </DashboardLayout>
  );
}
