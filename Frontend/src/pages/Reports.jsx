import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import ExportButton from '../components/ExportButton';
import StatusBadge from '../components/StatusBadge';
import { Wordmark, PoweredBy } from '../components/Brand';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';

const EXPORTS = {
  buyer: [['/export/buyer/emissions', 'Emissions'], ['/export/buyer/offsets', 'ACCUs retired'], ['/export/buyer/enquiries', 'Enquiries']],
  seller: [['/export/seller/listings', 'Listings & availability'], ['/export/seller/enquiries', 'Buyer enquiries']],
  admin: [['/export/admin/users', 'Users'], ['/export/admin/claims', 'Claims'], ['/export/admin/enquiries', 'Buyer enquiries'], ['/export/admin/introductions', 'Buyer introductions'], ['/export/admin/site-enquiries', 'Website enquiries'], ['/export/admin/import-runs', 'CER import history']],
  common: [['/export/projects', 'All CER projects'], ['/export/market-prices', 'Market prices']],
};

function formatValue(value, num) {
  if (value == null || value === '') return '—';
  return typeof value === 'number' ? num(value, Number.isInteger(value) ? 0 : 2) : String(value);
}

function ReportView({ id }) {
  const { token } = useAuth();
  const { t, num, dateTime } = useI18n();
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api.get(`/reports/${id}`, token).then(setReport).catch((e) => setError(e.message)); }, [id, token]);
  if (error) return <div className="form-error">{error}</div>;
  if (!report) return <div className="loading-row"><span className="spinner" /></div>;
  return (
    <>
      <div className="page-header no-print">
        <Link to="/reports" className="btn btn-ghost btn-sm">← {t('All reports')}</Link>
        <div className="btn-row">
          <button className="btn btn-primary btn-sm" onClick={() => window.print()}>{t('Print / save as PDF')}</button>
          <ExportButton path={`/reports/${report.id}/export`} />
        </div>
      </div>
      <article className="card report-doc">
        <div className="report-head">
          <div>
            <div className="eyebrow">{t(report.title)}</div>
            <h2>{report.data.prepared_for || t('Your organisation')}</h2>
            <div className="text-soft">{t('Period')}: <strong>{report.data.period_label}</strong></div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <Wordmark />
            <div className="small text-soft" style={{ marginTop: 6 }}>{t('Generated {when}', { when: dateTime(report.created_at) })}</div>
            <div style={{ marginTop: 4 }}><StatusBadge status={report.trigger === 'scheduled' ? 'completed' : 'draft'} label={report.trigger === 'scheduled' ? t('Automated') : t('On demand')} /></div>
          </div>
        </div>
        {report.data.sections.map((section) => (
          <section className="report-section" key={section.heading}>
            <h3>{t(section.heading)}</h3>
            {section.kpis?.length ? (
              <div className="report-kpis">{section.kpis.map((k) => <div key={k.label}><div className="k">{t(k.label)}</div><div className="v">{formatValue(k.value, num)}{k.unit && k.value != null ? <span className="small text-soft"> {k.unit}</span> : null}</div></div>)}</div>
            ) : null}
            {section.table ? (
              section.table.rows.length ? (
                <div className="table-wrap">
                  <table className="ledger-table">
                    <thead><tr>{section.table.columns.map(([key, label]) => <th key={key}>{t(label)}</th>)}</tr></thead>
                    <tbody>{section.table.rows.map((row, i) => <tr key={i}>{section.table.columns.map(([key]) => <td key={key} className={typeof row[key] === 'number' ? 'num' : ''}>{formatValue(row[key], num)}</td>)}</tr>)}</tbody>
                  </table>
                </div>
              ) : <p className="text-soft small">{t('Nothing to report for this period.')}</p>
            ) : null}
            {section.note ? <p className="disclaimer">{t(section.note)}</p> : null}
          </section>
        ))}
        <div style={{ marginTop: 34, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }} className="small text-soft">
          <span>{t('Official project data: Clean Energy Regulator public register. Seller-provided and self-reported figures are labelled as such.')}</span>
          <PoweredBy />
        </div>
      </article>
    </>
  );
}

export default function Reports() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const { t, date, dateTime } = useI18n();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [form, setForm] = useState({ report_type: '', period_start: '', period_end: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const d = await api.get('/reports', token);
      setData(d);
      setForm((f) => ({ report_type: f.report_type || d.types[0]?.type, period_start: f.period_start || d.default_period.start, period_end: f.period_end || d.default_period.end }));
    } catch (e) { setError(e.message); }
  }
  useEffect(() => { if (!id) load(); }, [id, token]);

  async function generate(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const report = await api.post('/reports/generate', form, token);
      navigate(`/reports/${report.id}`);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function schedule(type, frequency) {
    try { await api.put('/reports/schedules', { report_type: type, frequency }, token); load(); } catch (e) { setError(e.message); }
  }

  async function remove(reportId) {
    try { await api.del(`/reports/${reportId}`, token); load(); } catch (e) { setError(e.message); }
  }

  if (id) return <DashboardLayout><ReportView id={id} /></DashboardLayout>;

  const typeLabel = (type) => t(data?.types.find((x) => x.type === type)?.label || type);
  const freqLabel = { weekly: t('Weekly'), monthly: t('Monthly'), quarterly: t('Quarterly'), off: t('Off') };

  return (
    <DashboardLayout>
      <div className="page-header">
        <div>
          <div className="eyebrow">{t('Automated reporting')}</div>
          <h1>{t('Reports & data export')}</h1>
          <p className="text-soft">{t('Reports are generated automatically on your schedule and kept here. You can also run one for any period, print it to PDF, or export the data.')}</p>
        </div>
      </div>
      {error ? <div className="form-error">{error}</div> : null}
      {!data ? <div className="loading-row"><span className="spinner" /></div> : (
        <>
          <div className="grid-2">
            <div className="card panel">
              <div className="section-title" style={{ marginTop: 0 }}>{t('Automatic schedule')}</div>
              {data.types.map((type) => {
                const s = data.schedules.find((x) => x.report_type === type.type);
                return (
                  <div className="doc-row" key={type.type} style={{ justifyContent: 'space-between' }}>
                    <div><strong>{t(type.label)}</strong><div className="small text-soft">{s?.frequency && s.frequency !== 'off' ? t('Next run {when}', { when: dateTime(s.next_run_at) }) : t('Not scheduled')}</div></div>
                    <select className="input" style={{ width: 'auto', borderRadius: 999, padding: '6px 12px' }} value={s?.frequency || 'off'} onChange={(e) => schedule(type.type, e.target.value)}>
                      {data.frequencies.map((f) => <option key={f} value={f}>{freqLabel[f]}</option>)}
                    </select>
                  </div>
                );
              })}
            </div>
            <form className="card panel" onSubmit={generate}>
              <div className="section-title" style={{ marginTop: 0 }}>{t('Run a report now')}</div>
              <div className="field"><label>{t('Report')}</label><select value={form.report_type} onChange={(e) => setForm({ ...form, report_type: e.target.value })}>{data.types.map((type) => <option key={type.type} value={type.type}>{t(type.label)}</option>)}</select></div>
              <div className="field-row">
                <div className="field"><label>{t('From')}</label><input type="date" required value={form.period_start} onChange={(e) => setForm({ ...form, period_start: e.target.value })} /></div>
                <div className="field"><label>{t('To (exclusive)')}</label><input type="date" required value={form.period_end} onChange={(e) => setForm({ ...form, period_end: e.target.value })} /></div>
              </div>
              <button className="btn btn-primary" disabled={busy}>{busy ? t('Generating…') : t('Generate report')}</button>
            </form>
          </div>

          <div className="section-title">{t('Report archive')}</div>
          <div className="card table-wrap">
            <table className="ledger-table">
              <thead><tr><th>{t('Report')}</th><th>{t('Period')}</th><th>{t('Created')}</th><th>{t('Type')}</th><th /></tr></thead>
              <tbody>
                {data.reports.map((r) => (
                  <tr key={r.id}>
                    <td><Link to={`/reports/${r.id}`} style={{ fontWeight: 700 }}>{typeLabel(r.report_type)}</Link></td>
                    <td className="small">{date(r.period_start)} – {date(new Date(new Date(`${r.period_end}T00:00:00Z`).getTime() - 86400000).toISOString().slice(0, 10))}</td>
                    <td className="small text-soft">{dateTime(r.created_at)}</td>
                    <td><StatusBadge status={r.trigger === 'scheduled' ? 'completed' : 'draft'} label={r.trigger === 'scheduled' ? t('Automated') : t('On demand')} /></td>
                    <td><div className="btn-row"><Link className="btn btn-outline btn-sm" to={`/reports/${r.id}`}>{t('Open')}</Link><button className="btn btn-ghost btn-sm" onClick={() => remove(r.id)}>{t('Delete')}</button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.reports.length ? <div className="empty-state">{t('No reports yet. Your first automated report will appear after the current period ends — or run one now.')}</div> : null}
          </div>

          <div className="section-title">{t('Data export')}</div>
          <div className="card panel">
            <p className="text-soft small">{t('Download your data at any time as CSV (opens in Excel) or JSON.')}</p>
            {[...(EXPORTS[user.role] || []), ...EXPORTS.common].map(([path, label]) => (
              <div className="doc-row" key={path} style={{ justifyContent: 'space-between' }}>
                <strong>{t(label)}</strong>
                <ExportButton path={path} />
              </div>
            ))}
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
