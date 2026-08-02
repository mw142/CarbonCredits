import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import VerifiedStamp from '../components/VerifiedStamp';
import { useAuth } from '../context/AuthContext';
import irongateIcon from '../assets/irongate-icon.png';

export default function Landing() {
  const { user } = useAuth();
  const dashboardPath = user?.role === 'admin' ? '/admin' : user?.role === 'seller' ? '/seller' : '/buyer';

  return (
    <>
      <Navbar />
      <div className="container" style={{ paddingTop: 64, paddingBottom: 70 }}>
        <div style={{ display: 'flex', gap: 48, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 460px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 30 }}>
              <img src={irongateIcon} alt="" style={{ height: 56, width: 56 }} />
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, lineHeight: 1 }}>IRONGATE IT</div>
                <div className="eyebrow" style={{ marginBottom: 0, fontSize: 11 }}>Carbon Credit Platform</div>
              </div>
            </div>
            <div className="eyebrow">Concept prototype · ACCU carbon credit registry</div>
            <h1 style={{ fontSize: 44, lineHeight: 1.08, marginBottom: 18 }}>
              A registry for carbon credits that only lists what&rsquo;s verified.
            </h1>
            <p className="text-soft" style={{ fontSize: 16.5, maxWidth: 520 }}>
              Sellers submit projects with supporting ACCU evidence. An administrator reviews the evidence
              before a listing goes live. Buyers browse only verified, currently-available credits — every
              price and quantity comes straight from the marketplace database.
            </p>
            <div style={{ display: 'flex', gap: 12, marginTop: 26, flexWrap: 'wrap' }}>
              <Link to="/marketplace" className="btn btn-primary">Browse the marketplace</Link>
              {user ? (
                <Link to={dashboardPath} className="btn btn-outline">Go to dashboard</Link>
              ) : (
                <Link to="/register" className="btn btn-outline">Register as buyer or seller</Link>
              )}
            </div>
          </div>
          <div className="card panel" style={{ flex: '0 0 300px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, background: 'var(--ink)', color: 'var(--text-on-ink)' }}>
            <VerifiedStamp size={110} tone="brass" />
            <p style={{ textAlign: 'center', color: 'var(--text-on-ink-soft)', fontSize: 13.5, marginBottom: 0 }}>
              Every verified listing carries this registry seal, tied to reviewed ACCU evidence on file.
            </p>
          </div>
        </div>

        <hr className="hairline" style={{ margin: '52px 0' }} />

        <div className="field-row" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 22 }}>
          <div>
            <div className="eyebrow">For sellers</div>
            <h3>List with evidence</h3>
            <p className="text-soft">Submit a project, attach ACCU certificates and holdings evidence, then publish once verified.</p>
          </div>
          <div>
            <div className="eyebrow">For administrators</div>
            <h3>Review before it&rsquo;s live</h3>
            <p className="text-soft">Approve, reject, or request changes — every decision is written to the project&rsquo;s audit trail.</p>
          </div>
          <div>
            <div className="eyebrow">For buyers</div>
            <h3>Buy with confidence</h3>
            <p className="text-soft">Filter by type, price and verification status, then buy credits directly from the listing.</p>
          </div>
        </div>
      </div>
    </>
  );
}
