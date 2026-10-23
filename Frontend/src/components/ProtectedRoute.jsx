import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';

export default function ProtectedRoute({ role, children }) {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const location = useLocation();

  if (loading) return <div className="loading-row"><span className="spinner" /> {t('Loading…')}</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (role && user.role !== role) {
    const home = user.role === 'admin' ? '/admin' : user.role === 'seller' ? '/seller' : '/buyer';
    return <Navigate to={home} replace />;
  }
  return children;
}
