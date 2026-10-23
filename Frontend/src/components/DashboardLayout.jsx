import { NavLink } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar, { useRoleLinks } from './Sidebar';

export default function DashboardLayout({ children }) {
  const links = useRoleLinks();
  return (
    <>
      <Navbar />
      <nav className="mobile-subnav">
        {links.map((l) => <NavLink key={l.to + l.label} to={l.to} end>{l.label}</NavLink>)}
      </nav>
      <div className="app-shell">
        <Sidebar />
        <main className="main-content">{children}</main>
      </div>
    </>
  );
}
