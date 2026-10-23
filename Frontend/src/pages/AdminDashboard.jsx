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

export default function AdminDashboard() {
  const { token } = useAuth();
  const { t, num, dateTime } = useI18n();
  const [stats, setStats] = useState(null);
  const [claims, setClaims] = useState([]);
  const [evidence, setEvidence] = useState([]);
  const [images, setImages] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    try {
      const [s, c, e, i] = await Promise.all([api.get('/admin/stats', token), api.get('/admin/claims?status=pending', token), api.get('/admin/evidence?status=pending', token), api.get('/admin/images?status=pending', token)]);
      setStats(s); setClaims(c); setEvidence(e); setImages(i);
    } catch (err) { setError(err.message); }
  }
  useEffect(() => { load(); }, [token]);

  async function review(path, body, text) {
    try { await api.post(path, body, token); setMessage(text); setError(''); await load(); } catch (err) { setError(err.message); }
  }
  async function verifyEvidence(item) {
    const qty = window.prompt(t('Verified ACCU quantity (leave blank if not stated)'), '');
    if (qty === null) return;
    await review(`/admin/evidence/${item.id}/review`, { decision: 'verified', verified_quantity: qty === '' ? null : Number(qty) }, t('Evidence verified.'));
  }

  if (error && !stats) return <DashboardLayout><div className="form-error">{error}</div></DashboardLayout>;
  if (!stats) return <DashboardLayout><div className="loading-row"><span className="spinner" /> {t('Loading review workspace…')}</div></DashboardLayout>;
  return (
    <DashboardLayout>
      <div className="page-header">
        <div>
          <div className="eyebrow">{t('Administrator workspace')}</div>
          <h1>{t('Review queue')}</h1>
          <p className="text-soft">{t('Review representative claims, ACCU evidence and images. Keep the CER register current from Data & integrations.')}</p>
        </div>
        <div className="btn-row">
          <Link to="/admin/integrations" className="btn btn-outline">{t('Data & integrations')}</Link>
          <Link to="/admin/inbox" className="btn btn-primary">{t('Introductions & enquiries')}</Link>
        </div>
      </div>
      {error ? <div className="form-error">{error}</div> : null}
      {message ? <div className="form-success">{message}</div> : null}
      <div className="stat-grid">
        <StatCard label={t('CER projects')} value={num(stats.projects)} sub={stats.last_import ? t('Last import {when}', { when: dateTime(stats.last_import.completed_at || stats.last_import.started_at) }) : t('Not yet imported')} />
        <StatCard label={t('Pending claims')} value={num(stats.pending_claims)} />
        <StatCard label={t('Pending evidence & images')} value={num(stats.pending_evidence + stats.pending_images)} />
        <StatCard label={t('Published listings')} value={num(stats.published_listings)} />
        <StatCard label={t('Open buyer introductions')} value={num(stats.open_introductions)} />
        <StatCard label={t('New website enquiries')} value={num(stats.new_site_enquiries)} />
      </div>

      <div className="section-title"><span>{t('Project claims')}</span><ExportButton path="/export/admin/claims" /></div>
      <div className="card table-wrap">
        <table className="ledger-table">
          <thead><tr><th>{t('Project')}</th><th>{t('Seller')}</th><th>{t('Relationship')}</th><th>{t('Evidence')}</th><th /></tr></thead>
          <tbody>{claims.map((claim) => (
            <tr key={claim.id}>
              <td>{claim.project_name}<div className="small text-soft">{claim.project_reference}</div></td>
              <td>{claim.organisation_name || claim.seller_name}</td>
              <td>{t(RELATIONSHIPS[claim.relationship_type] || claim.relationship_type)}</td>
              <td className="small">{claim.documents?.length ? claim.documents.map((document) => <div key={document.id}>{document.original_file_name}</div>) : t('None attached')}</td>
              <td><div className="btn-row">
                <button className="btn btn-primary btn-sm" onClick={() => review(`/admin/claims/${claim.id}/review`, { decision: 'approved' }, t('Claim approved.'))}>{t('Approve')}</button>
                <button className="btn btn-outline btn-sm" onClick={() => review(`/admin/claims/${claim.id}/review`, { decision: 'additional_information_required' }, t('More information requested.'))}>{t('More info')}</button>
                <button className="btn btn-danger btn-sm" onClick={() => review(`/admin/claims/${claim.id}/review`, { decision: 'rejected' }, t('Claim rejected.'))}>{t('Reject')}</button>
              </div></td>
            </tr>
          ))}</tbody>
        </table>
        {!claims.length ? <div className="empty-state">{t('No pending claims.')}</div> : null}
      </div>

      <div className="section-title">{t('ACCU evidence')}</div>
      <div className="card table-wrap">
        <table className="ledger-table">
          <thead><tr><th>{t('Project')}</th><th>{t('File')}</th><th>{t('Vintage')}</th><th>{t('Category')}</th><th /></tr></thead>
          <tbody>{evidence.map((item) => (
            <tr key={item.id}>
              <td>{item.project_name}<div className="small text-soft">{item.organisation_name || item.seller_name}</div></td>
              <td><a href="#" onClick={async (e) => { e.preventDefault(); const r = await fetch(`/api/admin/evidence/${item.id}/download`, { headers: { Authorization: `Bearer ${token}` } }); window.open(URL.createObjectURL(await r.blob()), '_blank'); }}>{item.original_file_name}</a></td>
              <td>{item.vintage || '—'}</td><td>{item.category || '—'}</td>
              <td><div className="btn-row"><button className="btn btn-primary btn-sm" onClick={() => verifyEvidence(item)}>{t('Verify')}</button><button className="btn btn-danger btn-sm" onClick={() => review(`/admin/evidence/${item.id}/review`, { decision: 'rejected' }, t('Evidence rejected.'))}>{t('Reject')}</button></div></td>
            </tr>
          ))}</tbody>
        </table>
        {!evidence.length ? <div className="empty-state">{t('No pending evidence.')}</div> : null}
      </div>

      <div className="section-title">{t('Images')}</div>
      <div className="card table-wrap">
        <table className="ledger-table">
          <thead><tr><th>{t('Project')}</th><th>{t('File')}</th><th>{t('Caption')}</th><th /></tr></thead>
          <tbody>{images.map((image) => (
            <tr key={image.id}>
              <td>{image.project_name}</td><td>{image.original_file_name}</td><td>{image.caption || '—'}</td>
              <td><div className="btn-row"><button className="btn btn-primary btn-sm" onClick={() => review(`/admin/images/${image.id}/review`, { decision: 'approved' }, t('Image approved.'))}>{t('Approve')}</button><button className="btn btn-danger btn-sm" onClick={() => review(`/admin/images/${image.id}/review`, { decision: 'rejected' }, t('Image rejected.'))}>{t('Reject')}</button></div></td>
            </tr>
          ))}</tbody>
        </table>
        {!images.length ? <div className="empty-state">{t('No pending images.')}</div> : null}
      </div>
      <p className="small text-soft" style={{ marginTop: 20 }}><StatusBadge status="new" label="CER" /> {t('Imports and API uploads are logged under Data & integrations.')}</p>
    </DashboardLayout>
  );
}
