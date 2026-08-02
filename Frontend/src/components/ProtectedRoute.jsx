import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ role, children }) {
  const { user, loading } = useAuth();

  if (loading) return <div className="loading-row"><span className="spinner" /> Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) {
    const home = user.role === 'admin' ? '/admin' : user.role === 'seller' ? '/seller' : '/buyer';
    return <Navigate to={home} replace />;
  }
  return children;
}
