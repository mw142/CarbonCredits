import { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function AdminUsers() {
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/admin/users', token).then(setUsers).catch((err) => setError(err.message));
  }, [token]);

  return (
    <DashboardLayout>
      <div className="page-header">
        <div>
          <div className="eyebrow">Administrator</div>
          <h1>Registered users</h1>
        </div>
      </div>

      {error ? <div className="form-error">{error}</div> : null}

      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="ledger-table">
          <thead>
            <tr><th>Name</th><th>Role</th><th>Organisation</th><th>Country</th><th>Status</th><th>Joined</th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}<div className="text-soft mono" style={{ fontSize: 11.5 }}>{u.email}</div></td>
                <td className="text-soft">{u.role}</td>
                <td className="text-soft">{u.organisation_name || '—'}</td>
                <td className="text-soft">{u.country}</td>
                <td><span className={`badge ${u.account_status === 'active' ? 'badge-verified' : 'badge-pending'}`}>{u.account_status}</span></td>
                <td className="text-soft mono">{u.created_at.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  );
}
