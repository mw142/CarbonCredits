import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import StatCard from '../components/StatCard';
import ProjectCard from '../components/ProjectCard';
import ProjectModal from '../components/ProjectModal';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function BuyerDashboard() {
  const { user, token } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    try {
      const d = await api.get('/buyer/dashboard', token);
      setData(d);
    } catch (err) {
      setError(err.message);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function handleOpen(project) {
    setSelected(project);
    try {
      const full = await api.get(`/projects/${project.id}`, token);
      setSelected(full);
    } catch { /* keep summary */ }
  }

  async function toggleSave(project) {
    try {
      const isSaved = data.saved_projects.some((p) => p.id === project.id);
      if (isSaved) await api.del(`/buyer/save/${project.id}`, token);
      else await api.post(`/buyer/save/${project.id}`, {}, token);
      load();
    } catch { /* no-op */ }
  }

  function handlePurchased() {
    load();
    setSelected(null);
  }

  if (error) return <DashboardLayout><div className="form-error">{error}</div></DashboardLayout>;
  if (!data) return <DashboardLayout><div className="loading-row"><span className="spinner" /> Loading dashboard…</div></DashboardLayout>;

  const goalProgress = data.profile?.annual_offset_goal
    ? Math.min(100, Math.round((data.total_credits_purchased / data.profile.annual_offset_goal) * 100))
    : null;

  return (
    <DashboardLayout>
      <div className="page-header">
        <div>
          <div className="eyebrow">Buyer dashboard</div>
          <h1>Welcome back, {user.name.split(' ')[0]}</h1>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard label="Carbon credit balance" value={Math.round(data.profile?.carbon_credit_balance || 0).toLocaleString()} sub="ACCUs held" />
        <StatCard label="Total emissions" value={Math.round(data.profile?.total_emissions || 0).toLocaleString()} sub="tCO₂-e reported" />
        <StatCard
          label="Emissions offset"
          value={Math.round(data.emissions_reduced).toLocaleString()}
          sub={goalProgress != null ? `${goalProgress}% of annual goal` : 'No annual goal set'}
        />
        <StatCard label="Active projects" value={data.active_projects} sub={`${data.purchase_count} purchases total`} />
      </div>

      <div className="section-title">Recent activity</div>
      <div className="card" style={{ marginBottom: 30, overflowX: 'auto' }}>
        {data.recent_activity.length === 0 ? (
          <div className="empty-state">No purchases yet — browse the marketplace to get started.</div>
        ) : (
          <table className="ledger-table">
            <thead>
              <tr><th>Project</th><th>Location</th><th>Credits</th><th>Price</th><th>Total</th><th>Date</th></tr>
            </thead>
            <tbody>
              {data.recent_activity.map((a) => (
                <tr key={a.id}>
                  <td>{a.project_name}</td>
                  <td className="text-soft">{a.location}</td>
                  <td className="mono">{a.credits_purchased.toLocaleString()}</td>
                  <td className="mono">${a.price_per_credit.toFixed(2)}</td>
                  <td className="mono">${a.total_price.toFixed(2)}</td>
                  <td className="text-soft mono">{a.created_at.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {data.saved_projects.length > 0 ? (
        <>
          <div className="section-title">Saved projects</div>
          <div className="project-grid" style={{ marginBottom: 30 }}>
            {data.saved_projects.map((p) => <ProjectCard key={p.id} project={p} onOpen={handleOpen} />)}
          </div>
        </>
      ) : null}

      {data.suggested_projects.length > 0 ? (
        <>
          <div className="section-title">Suggested for you</div>
          <div className="project-grid">
            {data.suggested_projects.map((p) => <ProjectCard key={p.id} project={p} onOpen={handleOpen} />)}
          </div>
        </>
      ) : null}

      {selected ? (
        <ProjectModal
          project={selected}
          onClose={() => setSelected(null)}
          onPurchased={handlePurchased}
          onToggleSave={toggleSave}
          saved={data.saved_projects.some((p) => p.id === selected.id)}
        />
      ) : null}
    </DashboardLayout>
  );
}
