import { useState } from 'react';
import VerifiedStamp from './VerifiedStamp';
import StatusBadge from './StatusBadge';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

export default function ProjectModal({ project, onClose, onPurchased, onToggleSave, saved }) {
  const { user, token } = useAuth();
  const [credits, setCredits] = useState(50);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!project) return null;

  async function handlePurchase(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setBusy(true);
    try {
      const result = await api.post('/buyer/purchase', { project_id: project.id, credits: Number(credits) }, token);
      setSuccess(`Purchased ${result.credits_purchased} credits for $${result.total_price.toFixed(2)}. ${result.message}`);
      onPurchased?.(result.project);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        <div className="modal-hero">
          <div>
            <div className="eyebrow" style={{ color: 'var(--brass)' }}>{project.project_type} · {project.location}</div>
            <h2 style={{ marginBottom: 6 }}>{project.name}</h2>
            <div style={{ color: 'var(--text-on-ink-soft)', fontSize: 13.5 }}>
              {project.seller?.organisation_name || project.seller?.name}
            </div>
          </div>
          {project.is_verified ? <VerifiedStamp size={64} tone="brass" /> : null}
        </div>

        <div className="modal-body">
          <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
            <StatusBadge status={project.review_status} />
            {project.accu_category ? <span className="chip mono">{project.accu_category}</span> : null}
            {project.vintage ? <span className="chip mono">Vintage {project.vintage}</span> : null}
          </div>

          <p>{project.description}</p>

          <div className="field-row">
            <div>
              <div className="section-title">Methodology</div>
              <p style={{ fontSize: 13.5 }}>{project.methodology || '—'}</p>
            </div>
            <div>
              <div className="section-title">Estimated emission reductions</div>
              <p className="mono" style={{ fontSize: 13.5 }}>
                {project.estimated_emission_reductions ? `${project.estimated_emission_reductions.toLocaleString()} tCO₂-e` : '—'}
              </p>
            </div>
          </div>

          <div className="field-row">
            <div>
              <div className="section-title">Price per credit</div>
              <p className="price-figure" style={{ fontSize: 22 }}>${project.price_per_credit.toFixed(2)}</p>
            </div>
            <div>
              <div className="section-title">Credits available</div>
              <p className="mono" style={{ fontSize: 22 }}>{Math.round(project.available_credits).toLocaleString()}</p>
            </div>
          </div>

          {project.documents?.length ? (
            <>
              <div className="section-title">Supporting evidence on file</div>
              {project.documents.map((d) => (
                <div className="doc-row" key={d.id}>
                  <span aria-hidden="true">📄</span>
                  <span>{d.file_name}</span>
                  <span className="text-soft mono" style={{ marginLeft: 'auto', fontSize: 11.5 }}>{d.document_type}</span>
                </div>
              ))}
            </>
          ) : null}

          <hr className="hairline" />

          {error ? <div className="form-error">{error}</div> : null}
          {success ? <div className="form-success">{success}</div> : null}

          {user?.role === 'buyer' && project.is_listed ? (
            <form onSubmit={handlePurchase}>
              <div className="field-row" style={{ alignItems: 'end' }}>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor="credits">Credits to buy</label>
                  <input
                    id="credits" type="number" min="1" max={project.available_credits}
                    value={credits} onChange={(e) => setCredits(e.target.value)}
                  />
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>Total</label>
                  <div className="price-figure" style={{ padding: '10px 0' }}>
                    ${(Number(credits || 0) * project.price_per_credit).toFixed(2)}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <button className="btn btn-verified" type="submit" disabled={busy}>
                  {busy ? 'Processing…' : 'Buy credits'}
                </button>
                <button type="button" className="btn btn-outline" onClick={() => onToggleSave?.(project)}>
                  {saved ? 'Remove from saved' : 'Save for later'}
                </button>
              </div>
              <p className="field-hint" style={{ marginTop: 10 }}>
                Simulated transaction for this prototype — no real payment is processed. In production, purchases,
                payments and ACCU transfers happen outside the platform after the buyer and seller connect.
              </p>
            </form>
          ) : !user ? (
            <p className="text-soft">Log in as a buyer to purchase credits from this listing.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
