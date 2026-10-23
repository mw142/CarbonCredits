import { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import Navbar, { dashboardPathFor } from '../components/Navbar';
import AuthSide from '../components/AuthSide';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';

export default function Login() {
  const [role, setRole] = useState('buyer');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const roleNames = { buyer: t('Buyer'), seller: t('Seller'), admin: t('Admin') };

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const user = await login(email, password, role);
      navigate(location.state?.from || dashboardPathFor(user), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Navbar />
      <div className="auth-shell">
        <AuthSide />
        <div className="auth-main">
          <div className="card auth-card">
            <div className="eyebrow">{t('Welcome back')}</div>
            <h2>{t('Log in to renewCo.')}</h2>
            <p className="text-soft" style={{ marginBottom: 22 }}>{t('Access your buyer, seller or administrator workspace.')}</p>

            <div className="role-toggle">
              {['buyer', 'seller', 'admin'].map((r) => (
                <button key={r} type="button" className={role === r ? 'active' : ''} onClick={() => setRole(r)}>{roleNames[r]}</button>
              ))}
            </div>

            {error ? <div className="form-error">{error}</div> : null}

            <form onSubmit={handleSubmit}>
              <div className="field">
                <label htmlFor="email">{t('Email address')}</label>
                <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="password">{t('Password')}</label>
                <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
                {busy ? t('Signing in…') : t('Log in as {role}', { role: roleNames[role].toLowerCase() })}
              </button>
            </form>

            <hr className="hairline" />
            <p className="text-soft" style={{ fontSize: 14, margin: 0 }}>
              {t('New to renewCo.?')} <Link to="/register" style={{ color: 'var(--mint-ink)', fontWeight: 700 }}>{t('Create an account')}</Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
