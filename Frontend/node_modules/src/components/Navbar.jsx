import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import irongateIcon from '../assets/irongate-icon.png';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/');
  }

  const dashboardPath = user?.role === 'admin' ? '/admin' : user?.role === 'seller' ? '/seller' : '/buyer';

  return (
    <header className="topnav">
      <div className="container topnav-inner">
        <NavLink to="/" className="brand">
          <span className="brand-mark-chip">
            <img src={irongateIcon} alt="Irongate IT" className="brand-mark" />
          </span>
          Irongate IT
        </NavLink>
        <nav className="nav-links">
          <NavLink to="/marketplace">Marketplace</NavLink>
          {user ? <NavLink to={dashboardPath}>Dashboard</NavLink> : null}
          {user?.role === 'seller' ? <NavLink to="/sell">Sell credits</NavLink> : null}
        </nav>
        <div className="nav-actions">
          {user ? (
            <>
              <span className="text-soft" style={{ fontSize: 13, color: 'var(--text-on-ink-soft)' }}>
                {user.name} · {user.role}
              </span>
              <button className="btn btn-outline-ink btn-sm" onClick={handleLogout}>Log out</button>
            </>
          ) : (
            <>
              <NavLink to="/login" className="btn btn-outline-ink btn-sm">Log in</NavLink>
              <NavLink to="/register" className="btn btn-verified btn-sm">Register</NavLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
