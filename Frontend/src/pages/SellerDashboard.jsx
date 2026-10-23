import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import ExportButton from '../components/ExportButton';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';

const RELATIONSHIPS = { owner: 'Project owner', proponent: 'Project proponent', authorised_representative: 'Authorised representative', project_manager: 'Project manager', contributor: 'Project contributor' };

export default function SellerDashboard() {
  const { token } = useAuth();
  const { t, num, date } = useI18n();
  const [stats, setStats] = useState(null);
  const [claims, setClaims] = useState([]);
  const [listings, setListings] = useState([]);
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState('');

  async function load() {
    try {
      const [s, c, l, r] = await Promise.all([api.get('/seller/stats', token), api.get('/seller/claims', token), api.get('/seller/listings', token), api.get('/seller/contact-requests', token)]);
      setStats(s); setClaims(c); setListings(l); setRequests(r);
    } catch (err) { setError(err.message); }
  }
  useEffect(() => { load(); }, [token]);

  async function setRequestStatus(id, status) {
    try { await api.patch(`/seller/contact-requests/${id}`, { status }, token); load(); } catch (err) { setError(err.message); }
  }

  if (error && !stats) return <DashboardLayout><div className="form-error">{error}</div></DashboardLayout>;
  if (!stats) return <DashboardLayout><div className="loading-row"><span className="spinner" /> {t('Loading workspace…')}</div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="page-header">
        <div>
          <div className="eyebrow">{t('Seller workspace')}</div>
          <h1>{t('Project representation')}</h1>
          <p className="text-soft">{t('Claim CER projects, publish listings, keep evidence and availability current, and respond to buyers.')}</p>
        </div>
        <Link to="/marketplace" className="btn btn-primary btn-arrow">{t('Find a project to claim')}</Link>
      </div>
      {error ? <div className="form-error">{error}</div> : null}
      <div className="stat-grid">
        <StatCard label={t('Claims')} value={num(stats.claims.total)} sub={t('{n} pending', { n: num(stats.claims.pending) })} />
        <StatCard label={t('Approved claims')} value={num(stats.claims.approved)} />
        <StatCard label={t('Published listings')} value={num(stats.listings.published)} />
        <StatCard label={t('Verified evidence')} value={num(stats.evidence.verified)} />
      </div>

      <div className="section-title"><span>{t('Buyer enquiries')}</span><ExportButton path="/export/seller/enquiries" /></div>
      <div className="card table-wrap">
        <table className="ledger-table">
          <thead><tr><th>{t('Project')}</th><th>{t('Buyer')}</th><th className="num">{t('Quantity')}</th><th>{t('Message')}</th><th>{t('Status')}</th></tr></thead>
          <tbody>{requests.map((request) => (
            <tr key={request.id}>
              <td>{request.project_name}<div className="small text-soft">{date(request.created_at)}</div></td>
              <td>{request.buyer_name}<div className="small text-soft">{request.organisation_name}</div></td>
              <td className="num">{request.requested_quantity ? num(request.requested_quantity) : '—'}</td>
              <td className="small" style={{ maxWidth: 340, whiteSpace: 'pre-wrap' }}>{request.message || '—'}</td>
              <td>
                <select className="input" style={{ padding: '5px 10px', width: 'auto' }} value={request.status} onChange={(e) => setRequestStatus(request.id, e.target.value)}>
                  {['new', 'viewed', 'responded', 'closed'].map((s) => <option key={s} value={s}>{t({ new: 'New', viewed: 'Viewed', responded: 'Responded', closed: 'Closed' }[s])}</option>)}
                </select>
              </td>
            </tr>
          ))}</tbody>
        </table>
        {!requests.length ? <div className="empty-state">{t('No enquiries yet.')}</div> : null}
      </div>

      <div className="section-title"><span>{t('Your listings')}</span><ExportButton path="/export/seller/listings" /></div>
      <div className="card table-wrap">
        <table className="ledger-table">
          <thead><tr><th>{t('Listing')}</th><th>{t('Project')}</th><th>{t('Status')}</th><th /></tr></thead>
          <tbody>{listings.map((listing) => (
            <tr key={listing.id}>
              <td>{listing.listing_title || t('Untitled listing')}</td>
              <td>{listing.project_name}<div className="small text-soft">{listing.project_reference}</div></td>
              <td><StatusBadge status={listing.listing_status} /></td>
              <td><Link className="btn btn-outline btn-sm" to={`/seller/listings/${listing.id}`}>{t('Manage')}</Link></td>
            </tr>
          ))}</tbody>
        </table>
        {!listings.length ? <div className="empty-state">{t('No listings yet.')}</div> : null}
      </div>

      <div className="section-title">{t('Your claims')}</div>
      <div className="card table-wrap">
        <table className="ledger-table">
          <thead><tr><th>{t('Project')}</th><th>{t('Relationship')}</th><th>{t('Status')}</th><th /></tr></thead>
          <tbody>{claims.map((claim) => (
            <tr key={claim.id}>
              <td>{claim.project_name}<div className="small text-soft">{claim.project_reference}</div></td>
              <td>{t(RELATIONSHIPS[claim.relationship_type] || claim.relationship_type)}</td>
              <td><StatusBadge status={claim.status} />{claim.review_notes || claim.rejection_reason ? <div className="small text-soft" style={{ marginTop: 4 }}>{claim.review_notes || claim.rejection_reason}</div> : null}</td>
              <td>{claim.status === 'approved' && !listings.some((l) => l.project_id === claim.project_id) ? <Link className="btn btn-primary btn-sm" to={`/seller/listings/new?project=${claim.project_id}`}>{t('Create listing')}</Link> : null}</td>
            </tr>
          ))}</tbody>
        </table>
        {!claims.length ? <div className="empty-state">{t('No claims yet. Browse the marketplace to find your project.')}</div> : null}
      </div>
    </DashboardLayout>
  );
}
