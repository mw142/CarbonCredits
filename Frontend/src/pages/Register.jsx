import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';

const BUYER_ORG_TYPES = ['investor', 'business', 'non-profit', 'government'];
const SELLER_ORG_TYPES = ['project developer', 'land owner', 'co-operative', 'business'];

const initialForm = {
  name: '', email: '', password: '', phone_number: '',
  organisation_name: '', organisation_type: '', country: 'Australia', annual_offset_goal: '',
};

export default function Register() {
  const [role, setRole] = useState('buyer');
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const payload = { role, ...form };
      if (role === 'buyer') payload.annual_offset_goal = form.annual_offset_goal ? Number(form.annual_offset_goal) : null;
      else delete payload.annual_offset_goal;

      const user = await register(payload);
      navigate(user.role === 'seller' ? '/seller' : '/buyer', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const orgTypes = role === 'buyer' ? BUYER_ORG_TYPES : SELLER_ORG_TYPES;

  return (
    <>
      <Navbar />
      <div className="auth-shell">
        <div className="card auth-card" style={{ maxWidth: 520 }}>
          <div className="eyebrow">Create account</div>
          <h2>Join the registry</h2>
          <p className="text-soft" style={{ marginBottom: 22 }}>
            Register as a buyer to browse and purchase ACCU-verified carbon credits, or as a seller to list projects.
          </p>

          <div className="role-toggle">
            <button type="button" className={role === 'buyer' ? 'active' : ''} onClick={() => setRole('buyer')}>Buyer</button>
            <button type="button" className={role === 'seller' ? 'active' : ''} onClick={() => setRole('seller')}>Seller</button>
          </div>

          {error ? <div className="form-error">{error}</div> : null}

          <form onSubmit={handleSubmit}>
            <div className="field-row">
              <div className="field">
                <label htmlFor="name">Full name</label>
                <input id="name" required value={form.name} onChange={(e) => update('name', e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="email">Email address</label>
                <input id="email" type="email" required value={form.email} onChange={(e) => update('email', e.target.value)} />
              </div>
            </div>

            <div className="field-row">
              <div className="field">
                <label htmlFor="password">Password</label>
                <input id="password" type="password" required minLength={8} value={form.password} onChange={(e) => update('password', e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="phone">Phone number</label>
                <input id="phone" value={form.phone_number} onChange={(e) => update('phone_number', e.target.value)} />
              </div>
            </div>

            <div className="field-row">
              <div className="field">
                <label htmlFor="org_name">Organisation name</label>
                <input id="org_name" value={form.organisation_name} onChange={(e) => update('organisation_name', e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="org_type">Organisation type</label>
                <select id="org_type" required value={form.organisation_type} onChange={(e) => update('organisation_type', e.target.value)}>
                  <option value="" disabled>Select type</option>
                  {orgTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div className="field-row">
              <div className="field">
                <label htmlFor="country">Country</label>
                <input id="country" required value={form.country} onChange={(e) => update('country', e.target.value)} />
              </div>
              {role === 'buyer' ? (
                <div className="field">
                  <label htmlFor="goal">Annual offset goal (credits)</label>
                  <input id="goal" type="number" min="0" value={form.annual_offset_goal} onChange={(e) => update('annual_offset_goal', e.target.value)} />
                </div>
              ) : <div />}
            </div>

            <button className="btn btn-verified btn-block" type="submit" disabled={busy}>
              {busy ? 'Creating account…' : `Create ${role} account`}
            </button>
          </form>

          <p className="text-soft" style={{ marginTop: 20, fontSize: 13.5 }}>
            Already registered? <Link to="/login" style={{ color: 'var(--verified)', fontWeight: 600 }}>Log in</Link>
          </p>
        </div>
      </div>
    </>
  );
}
