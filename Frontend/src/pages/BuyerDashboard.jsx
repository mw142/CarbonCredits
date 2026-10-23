import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import ExportButton from '../components/ExportButton';
import Icon from '../components/Icons';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';

export default function BuyerDashboard() {
  const { token, user } = useAuth();
  const { t, num, date } = useI18n();
  const [data, setData] = useState(null);
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.get('/buyer/dashboard', token), api.get('/buyer/contact-requests', token)])
      .then(([dashboard, contactRequests]) => { setData(dashboard); setRequests(contactRequests); })
      .catch((err) => setError(err.message));
  }, [token]);

  if (error) return <DashboardLayout><div className="form-error">{error}</div></DashboardLayout>;
  if (!data) return <DashboardLayout><div className="loading-row"><span className="spinner" /> {t('Loading dashboard…')}</div></DashboardLayout>;
  const e = data.emissions;
  const actions = [
    { to: '/buyer/introductions', icon: 'handshake', title: t('Request an introduction'), text: t('Share your requirements and get matched with verified supply.') },
    { to: '/buyer/emissions', icon: 'leaf', title: t('Track emissions'), text: t('Record Scope 1–3 emissions and the ACCUs you retire.') },
    { to: '/market', icon: 'market', title: t('Check the market'), text: t('Live prices, supply and demand.') },
  ];

  return (
    <DashboardLayout>
      <div className="page-header">
        <div>
          <div className="eyebrow">{t('Buyer workspace')}</div>
          <h1>{t('Welcome, {name}', { name: user.name.split(' ')[0] })}</h1>
          <p className="text-soft">{t('Source verified carbon credits, track your emissions and keep your reporting up to date.')}</p>
        </div>
        <Link to="/marketplace" className="btn btn-primary btn-arrow">{t('Browse projects')}</Link>
      </div>
      <div className="stat-grid">
        <StatCard label={t('Emissions {year}', { year: e.year })} value={num(e.total_tco2e, 1)} sub="t CO2-e" />
        <StatCard label={t('ACCUs retired {year}', { year: e.year })} value={num(e.offsets_retired)} sub={e.goal_progress_pct != null ? t('{pct}% of goal', { pct: num(e.goal_progress_pct, 0) }) : t('No goal set')}>
          {e.goal_progress_pct != null ? <div className="progress" style={{ marginTop: 10 }}><span style={{ width: `${Math.min(100, e.goal_progress_pct)}%` }} /></div> : null}
        </StatCard>
        <StatCard label={t('Enquiries')} value={num(data.contact_requests.total)} sub={t('{n} awaiting reply', { n: num(data.contact_requests.new) })} />
        <StatCard label={t('Open introduction briefs')} value={num(data.introductions_open)} />
      </div>
      <div className="grid-3">
        {actions.map((a) => (
          <Link key={a.to} to={a.to} className="card start-card" style={{ minHeight: 0, padding: 22 }}>
            <span className="icon"><Icon name={a.icon} size={20} /></span>
            <h3 style={{ fontSize: 17 }}>{a.title}</h3>
            <p className="small">{a.text}</p>
          </Link>
        ))}
      </div>
      <div className="section-title"><span>{t('Your enquiries')}</span><ExportButton path="/export/buyer/enquiries" /></div>
      <div className="card table-wrap">
        <table className="ledger-table">
          <thead><tr><th>{t('Project')}</th><th>{t('Representative')}</th><th className="num">{t('Quantity')}</th><th>{t('Message')}</th><th>{t('Status')}</th><th>{t('Date')}</th></tr></thead>
          <tbody>{requests.map((request) => (
            <tr key={request.id}>
              <td>{request.project_name}<div className="small text-soft">{request.project_reference}</div></td>
              <td>{request.organisation_name || request.seller_name}</td>
              <td className="num">{request.requested_quantity ? num(request.requested_quantity) : '—'}</td>
              <td className="small" style={{ maxWidth: 320, whiteSpace: 'pre-wrap' }}>{request.message || '—'}</td>
              <td><StatusBadge status={request.status} /></td>
              <td className="small">{date(request.created_at)}</td>
            </tr>
          ))}</tbody>
        </table>
        {!requests.length ? <div className="empty-state">{t('No enquiries yet. Browse the marketplace or request an introduction.')}</div> : null}
      </div>
    </DashboardLayout>
  );
}
