import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ICONS = {
  dashboard: '◆',
  marketplace: '▤',
  sell: '＋',
  verify: '✓',
  users: '☰',
};

export default function Sidebar() {
  const { user } = useAuth();

  const buyerLinks = [
    { to: '/buyer', label: 'Overview', icon: ICONS.dashboard },
    { to: '/marketplace', label: 'Marketplace', icon: ICONS.marketplace },
  ];
  const sellerLinks = [
    { to: '/seller', label: 'Overview', icon: ICONS.dashboard },
    { to: '/sell', label: 'Sell credits', icon: ICONS.sell },
    { to: '/marketplace', label: 'Marketplace', icon: ICONS.marketplace },
  ];
  const adminLinks = [
    { to: '/admin', label: 'Verification queue', icon: ICONS.verify },
    { to: '/admin/users', label: 'Users', icon: ICONS.users },
    { to: '/marketplace', label: 'Marketplace', icon: ICONS.marketplace },
  ];

  const links = user?.role === 'admin' ? adminLinks : user?.role === 'seller' ? sellerLinks : buyerLinks;

  return (
    <aside className="sidebar">
      <div className="sidebar-section">
        <div className="sidebar-label">{user?.role} account</div>
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} end className="sidebar-link">
            <span aria-hidden="true">{l.icon}</span> {l.label}
          </NavLink>
        ))}
      </div>
    </aside>
  );
}
