import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import StatusBadge from '../components/StatusBadge';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function SellCredits() {
  const { token } = useAuth();
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    api.get('/seller/projects', token).then(setProjects).catch(() => {});
  }, [token]);

  const verifiedProjects = projects.filter((p) => p.is_verified);

  return (
    <DashboardLayout>
      <div className="page-header">
        <div>
          <div className="eyebrow">Sell carbon credits</div>
          <h1>How would you like to sell?</h1>
          <p className="text-soft" style={{ maxWidth: 560 }}>
            Submit a brand new project for ACCU verification, or manage credits on a project you&rsquo;ve
            already had verified.
          </p>
        </div>
      </div>

      <div className="project-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', marginBottom: 34 }}>
        <Link to="/sell/new" className="card panel" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="eyebrow">New submission</div>
          <h3>Submit a new project</h3>
          <p className="text-soft" style={{ marginBottom: 0 }}>
            Add project details, evidence documents and credit availability for review by an administrator.
          </p>
        </Link>
        <div className="card panel">
          <div className="eyebrow">Existing projects</div>
          <h3>Manage verified listings</h3>
          <p className="text-soft" style={{ marginBottom: 0 }}>
            Publish or unpublish credits from projects that have already passed verification, from your
            dashboard&rsquo;s project table.
          </p>
        </div>
      </div>

      <div className="section-title">Your project submissions</div>
      <div className="card" style={{ overflowX: 'auto' }}>
        {projects.length === 0 ? (
          <div className="empty-state">No submissions yet.</div>
        ) : (
          <table className="ledger-table">
            <thead><tr><th>Project</th><th>Type</th><th>Status</th><th>Submitted</th></tr></thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td className="text-soft">{p.project_type}</td>
                  <td><StatusBadge status={p.review_status} /></td>
                  <td className="text-soft mono">{p.created_at.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {verifiedProjects.length > 0 ? (
        <p className="text-soft" style={{ marginTop: 14 }}>
          Manage listing status for verified projects from your <Link to="/seller" style={{ color: 'var(--verified)', fontWeight: 600 }}>dashboard</Link>.
        </p>
      ) : null}
    </DashboardLayout>
  );
}
