import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function SellerDashboard() {
  const { user, token } = useAuth();
  const [stats, setStats] = useState(null);
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const [s, p] = await Promise.all([
        api.get('/seller/stats', token),
        api.get('/seller/projects', token),
      ]);
      setStats(s);
      setProjects(p);
    } catch (err) {
      setError(err.message);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function toggleListing(project) {
    setBusyId(project.id);
    try {
      if (project.is_listed) await api.post(`/projects/${project.id}/unlist`, {}, token);
      else await api.post(`/projects/${project.id}/list`, {}, token);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  if (error) return <DashboardLayout><div className="form-error">{error}</div></DashboardLayout>;
  if (!stats) return <DashboardLayout><div className="loading-row"><span className="spinner" /> Loading dashboard…</div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="page-header">
        <div>
          <div className="eyebrow">Seller dashboard</div>
          <h1>Welcome back, {user.name.split(' ')[0]}</h1>
        </div>
        <Link to="/sell" className="btn btn-verified">Sell carbon credits</Link>
      </div>

      <div className="stat-grid">
        <StatCard label="Credits generated" value={Math.round(stats.total_credits_generated).toLocaleString()} />
        <StatCard label="Credits sold" value={Math.round(stats.total_credits_sold).toLocaleString()} />
        <StatCard label="Unsold credits" value={Math.round(stats.total_credits_unsold).toLocaleString()} />
        <StatCard label="Estimated earnings" value={`$${stats.estimated_earnings.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
      </div>

      <div className="section-title">Your projects</div>
      <div className="card" style={{ overflowX: 'auto' }}>
        {projects.length === 0 ? (
          <div className="empty-state">
            You haven&rsquo;t submitted any projects yet. <Link to="/sell" style={{ color: 'var(--verified)', fontWeight: 600 }}>Submit your first project.</Link>
          </div>
        ) : (
          <table className="ledger-table">
            <thead>
              <tr>
                <th>Project</th><th>Type</th><th>Credits sold / total</th><th>Price</th>
                <th>Verification</th><th>Listing</th><th></th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}<div className="text-soft" style={{ fontSize: 12 }}>{p.location}</div></td>
                  <td className="text-soft">{p.project_type}</td>
                  <td className="mono">{Math.round(p.total_credits - p.available_credits).toLocaleString()} / {Math.round(p.total_credits).toLocaleString()}</td>
                  <td className="mono">${p.price_per_credit.toFixed(2)}</td>
                  <td><StatusBadge status={p.review_status} /></td>
                  <td><span className={`badge ${p.is_listed ? 'badge-verified' : 'badge-neutral'}`}>{p.is_listed ? 'Listed' : 'Unlisted'}</span></td>
                  <td>
                    {p.is_verified ? (
                      <button
                        className="btn btn-outline btn-sm"
                        disabled={busyId === p.id}
                        onClick={() => toggleListing(p)}
                      >
                        {busyId === p.id ? 'Updating…' : p.is_listed ? 'Unlist' : 'Publish listing'}
                      </button>
                    ) : (
                      <span className="text-soft" style={{ fontSize: 12.5 }}>Awaiting verification</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </DashboardLayout>
  );
}
