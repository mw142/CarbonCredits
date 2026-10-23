import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import Icon from './Icons';
import { PoweredBy } from './Brand';

export function useRoleLinks() {
  const { user } = useAuth();
  const { t } = useI18n();
  const buyer = [
    { to: '/buyer', label: t('Overview'), icon: 'overview' },
    { to: '/buyer/emissions', label: t('Emissions tracking'), icon: 'leaf' },
    { to: '/buyer/introductions', label: t('Buyer introductions'), icon: 'handshake' },
    { to: '/marketplace', label: t('Marketplace'), icon: 'grid' },
    { to: '/market', label: t('Market data'), icon: 'market' },
    { to: '/reports', label: t('Reports & exports'), icon: 'report' },
  ];
  const seller = [
    { to: '/seller', label: t('Overview'), icon: 'overview' },
    { to: '/marketplace', label: t('Find & claim projects'), icon: 'plus' },
    { to: '/market', label: t('Market data'), icon: 'market' },
    { to: '/reports', label: t('Reports & exports'), icon: 'report' },
  ];
  const admin = [
    { to: '/admin', label: t('Review queue'), icon: 'check' },
    { to: '/admin/integrations', label: t('Data & integrations'), icon: 'plug' },
    { to: '/admin/inbox', label: t('Introductions & enquiries'), icon: 'inbox' },
    { to: '/admin/users', label: t('Users'), icon: 'users' },
    { to: '/market', label: t('Market data'), icon: 'market' },
    { to: '/reports', label: t('Reports & exports'), icon: 'report' },
  ];
  return user?.role === 'admin' ? admin : user?.role === 'seller' ? seller : buyer;
}

export default function Sidebar() {
  const { user } = useAuth();
  const { t } = useI18n();
  const links = useRoleLinks();
  const roleLabel = { buyer: t('Buyer account'), seller: t('Seller account'), admin: t('Administrator') }[user?.role] || '';

  return (
    <aside className="sidebar">
      <div className="sidebar-section">
        <div className="sidebar-label">{roleLabel}</div>
        {links.map((l) => (
          <NavLink key={l.to + l.label} to={l.to} end className="sidebar-link">
            <Icon name={l.icon} /> {l.label}
          </NavLink>
        ))}
      </div>
      <div style={{ padding: '0 12px', marginTop: 40 }}><PoweredBy /></div>
    </aside>
  );
}
