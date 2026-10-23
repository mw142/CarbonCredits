import { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import StatusBadge from '../components/StatusBadge';
import ExportButton from '../components/ExportButton';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';

export default function AdminUsers() {
  const { token } = useAuth();
  const { t, date } = useI18n();
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const roleNames = { buyer: t('Buyer'), seller: t('Seller'), admin: t('Admin') };

  useEffect(() => {
    api.get('/admin/users', token).then(setUsers).catch((err) => setError(err.message));
  }, [token]);

  return (
    <DashboardLayout>
      <div className="page-header">
        <div>
          <div className="eyebrow">{t('Administrator')}</div>
          <h1>{t('Registered users')}</h1>
        </div>
        <ExportButton path="/export/admin/users" />
      </div>
      {error ? <div className="form-error">{error}</div> : null}
      <div className="card table-wrap">
        <table className="ledger-table">
          <thead><tr><th>{t('Name')}</th><th>{t('Role')}</th><th>{t('Organisation')}</th><th>{t('Country')}</th><th>{t('Status')}</th><th>{t('Joined')}</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={`${u.role}-${u.id}`}>
                <td>{u.name}<div className="small text-soft mono">{u.email}</div></td>
                <td>{roleNames[u.role]}</td>
                <td className="text-soft">{u.organisation_name || '—'}</td>
                <td className="text-soft">{u.country || '—'}</td>
                <td><StatusBadge status={u.account_status} /></td>
                <td className="small text-soft">{date(u.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  );
}
