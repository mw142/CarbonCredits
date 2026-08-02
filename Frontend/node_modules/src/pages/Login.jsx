import { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [role, setRole] = useState('buyer');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const user = await login(email, password, role);
      const dest = location.state?.from || (user.role === 'admin' ? '/admin' : user.role === 'seller' ? '/seller' : '/buyer');
      navigate(dest, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function fillDemo(demoRole) {
    setRole(demoRole);
    if (demoRole === 'buyer') { setEmail('buyer1@carboncredit.local'); setPassword('Buyer123!'); }
    if (demoRole === 'seller') { setEmail('seller1@carboncredit.local'); setPassword('Seller123!'); }
    if (demoRole === 'admin') { setEmail('admin@carboncredit.local'); setPassword('Admin123!'); }
  }

  return (
    <>
      <Navbar />
      <div className="auth-shell">
        <div className="card auth-card">
          <div className="eyebrow">Registry sign-in</div>
          <h2>Log in to Irongate IT</h2>
          <p className="text-soft" style={{ marginBottom: 22 }}>Access your buyer or seller account.</p>

          <div className="role-toggle">
            {['buyer', 'seller', 'admin'].map((r) => (
              <button key={r} type="button" className={role === r ? 'active' : ''} onClick={() => setRole(r)}>
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>

          {error ? <div className="form-error">{error}</div> : null}

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="email">Email address</label>
              <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <button className="btn btn-verified btn-block" type="submit" disabled={busy}>
              {busy ? 'Signing in…' : `Log in as ${role}`}
            </button>
          </form>

          <hr className="hairline" />
          <div className="field-hint" style={{ marginBottom: 8 }}>Prototype demo accounts — click to fill:</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-outline btn-sm" type="button" onClick={() => fillDemo('buyer')}>Demo buyer</button>
            <button className="btn btn-outline btn-sm" type="button" onClick={() => fillDemo('seller')}>Demo seller</button>
            <button className="btn btn-outline btn-sm" type="button" onClick={() => fillDemo('admin')}>Demo admin</button>
          </div>

          <p className="text-soft" style={{ marginTop: 20, fontSize: 13.5 }}>
            New to Irongate IT? <Link to="/register" style={{ color: 'var(--verified)', fontWeight: 600 }}>Create an account</Link>
          </p>
        </div>
      </div>
    </>
  );
}
