import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { Logo } from './Brand';
import LanguageSwitcher from './LanguageSwitcher';

export function dashboardPathFor(user) {
  return user?.role === 'admin' ? '/admin' : user?.role === 'seller' ? '/seller' : '/buyer';
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate('/');
  }

  const links = [
    { to: '/marketplace', label: t('Marketplace') },
    { to: '/market', label: t('Market data') },
    { to: '/buyers', label: t('For buyers') },
    ...(user ? [{ to: dashboardPathFor(user), label: t('Dashboard') }] : []),
  ];

  return (
    <header className="topnav">
      <div className="container topnav-inner">
        <Logo />
        <nav className="nav-links" aria-label={t('Main')}>
          {links.map((l) => <NavLink key={l.to} to={l.to}>{l.label}</NavLink>)}
        </nav>
        <div className="nav-actions">
          <LanguageSwitcher />
          {user ? (
            <>
              <span className="nav-user hide-sm" title={user.email}>{user.name}</span>
              <button className="btn btn-outline btn-sm hide-sm" onClick={handleLogout}>{t('Log out')}</button>
            </>
          ) : (
            <>
              <NavLink to="/login" className="btn btn-ghost btn-sm hide-sm">{t('Log in')}</NavLink>
              <NavLink to="/register" className="btn btn-primary btn-sm hide-sm">{t('Get started')}</NavLink>
            </>
          )}
          <button className="nav-burger" aria-expanded={open} onClick={() => setOpen((v) => !v)}>{open ? '✕' : t('Menu')}</button>
        </div>
      </div>
      <div className="nav-mobile" data-open={open ? 'true' : 'false'} onClick={() => setOpen(false)}>
        {links.map((l) => <NavLink key={l.to} to={l.to}>{l.label}</NavLink>)}
        {user ? <a href="/" onClick={(e) => { e.preventDefault(); handleLogout(); }}>{t('Log out')}</a>
          : <><NavLink to="/login">{t('Log in')}</NavLink><NavLink to="/register">{t('Get started')}</NavLink></>}
      </div>
    </header>
  );
}
