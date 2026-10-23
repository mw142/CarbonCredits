import { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import AuthSide from '../components/AuthSide';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';

const BUYER_ORG_TYPES = [['investor', 'Investor'], ['business', 'Business'], ['non-profit', 'Non-profit'], ['government', 'Government']];
const SELLER_ORG_TYPES = [['project developer', 'Project developer'], ['land owner', 'Land owner'], ['co-operative', 'Co-operative'], ['business', 'Business']];

const initialForm = {
  name: '', email: '', password: '', phone_number: '',
  organisation_name: '', organisation_type: '', country: 'Australia', annual_offset_goal: '',
};

export default function Register() {
  const [params] = useSearchParams();
  const [role, setRole] = useState(params.get('role') === 'seller' ? 'seller' : 'buyer');
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { register } = useAuth();
  const { t } = useI18n();
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
        <AuthSide />
        <div className="auth-main">
          <div className="card auth-card" style={{ maxWidth: 560 }}>
            <div className="eyebrow">{t('Create account')}</div>
            <h2>{t('Join renewCo.')}</h2>
            <p className="text-soft" style={{ marginBottom: 22 }}>
              {t('Register as a buyer to source credits, track emissions and request introductions — or as a seller to represent your CER projects.')}
            </p>

            <div className="role-toggle">
              <button type="button" className={role === 'buyer' ? 'active' : ''} onClick={() => { setRole('buyer'); update('organisation_type', ''); }}>{t('Buyer')}</button>
              <button type="button" className={role === 'seller' ? 'active' : ''} onClick={() => { setRole('seller'); update('organisation_type', ''); }}>{t('Seller')}</button>
            </div>

            {error ? <div className="form-error">{error}</div> : null}

            <form onSubmit={handleSubmit}>
              <div className="field-row">
                <div className="field"><label htmlFor="name">{t('Full name')}</label><input id="name" required value={form.name} onChange={(e) => update('name', e.target.value)} /></div>
                <div className="field"><label htmlFor="email">{t('Email address')}</label><input id="email" type="email" required value={form.email} onChange={(e) => update('email', e.target.value)} /></div>
              </div>
              <div className="field-row">
                <div className="field"><label htmlFor="password">{t('Password')}</label><input id="password" type="password" required minLength={8} value={form.password} onChange={(e) => update('password', e.target.value)} /><span className="field-hint">{t('At least 8 characters.')}</span></div>
                <div className="field"><label htmlFor="phone">{t('Phone number')}</label><input id="phone" value={form.phone_number} onChange={(e) => update('phone_number', e.target.value)} /></div>
              </div>
              <div className="field-row">
                <div className="field"><label htmlFor="org_name">{t('Organisation name')}</label><input id="org_name" value={form.organisation_name} onChange={(e) => update('organisation_name', e.target.value)} /></div>
                <div className="field">
                  <label htmlFor="org_type">{t('Organisation type')}</label>
                  <select id="org_type" required value={form.organisation_type} onChange={(e) => update('organisation_type', e.target.value)}>
                    <option value="" disabled>{t('Select type')}</option>
                    {orgTypes.map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}
                  </select>
                </div>
              </div>
              <div className="field-row">
                <div className="field"><label htmlFor="country">{t('Country')}</label><input id="country" required value={form.country} onChange={(e) => update('country', e.target.value)} /></div>
                {role === 'buyer' ? (
                  <div className="field"><label htmlFor="goal">{t('Annual offset goal (ACCUs)')}</label><input id="goal" type="number" min="0" value={form.annual_offset_goal} onChange={(e) => update('annual_offset_goal', e.target.value)} /></div>
                ) : <div />}
              </div>
              <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
                {busy ? t('Creating account…') : role === 'buyer' ? t('Create buyer account') : t('Create seller account')}
              </button>
            </form>

            <p className="text-soft" style={{ marginTop: 20, fontSize: 14, marginBottom: 0 }}>
              {t('Already registered?')} <Link to="/login" style={{ color: 'var(--mint-ink)', fontWeight: 700 }}>{t('Log in')}</Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
