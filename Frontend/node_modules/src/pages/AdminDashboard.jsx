import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function AdminDashboard() {
  const { token } = useAuth();
  const [stats, setStats] = useState(null);
  const [queue, setQueue] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [s, q] = await Promise.all([
        api.get('/admin/stats', token),
        api.get('/admin/projects?status=waiting_review', token),
      ]);
      setStats(s);
      setQueue(q);
    } catch (err) {
      setError(err.message);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function review(projectId, decision) {
    setBusy(true);
    setError('');
    try {
      await api.post(`/admin/projects/${projectId}/review`, { decision, notes: notes || null }, token);
      setNotes('');
      setExpandedId(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!stats) return <DashboardLayout><div className="loading-row"><span className="spinner" /> Loading queue…</div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="page-header">
        <div>
          <div className="eyebrow">Administrator</div>
          <h1>Verification queue</h1>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard label="Registered users" value={stats.total_users} />
        <StatCard label="Active listings" value={stats.active_listings} />
        <StatCard label="Pending verifications" value={stats.pending_verifications} />
        <StatCard label="Completed transactions" value={stats.completed_transactions} sub={`${Math.round(stats.total_credits_traded).toLocaleString()} credits traded`} />
      </div>

      {error ? <div className="form-error">{error}</div> : null}

      <div className="section-title">Awaiting review</div>
      {queue.length === 0 ? (
        <div className="card empty-state">Nothing waiting on review right now.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {queue.map((p) => {
            const open = expandedId === p.id;
            return (
              <div className="card panel" key={p.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                  <div>
                    <div className="eyebrow">{p.project_type} · {p.location}</div>
                    <h3 style={{ marginBottom: 4 }}>{p.name}</h3>
                    <div className="text-soft" style={{ fontSize: 13 }}>
                      Submitted by {p.seller?.organisation_name || p.seller?.name} on {p.created_at.slice(0, 10)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'start' }}>
                    <StatusBadge status={p.review_status} />
                    <button className="btn btn-outline btn-sm" onClick={() => setExpandedId(open ? null : p.id)}>
                      {open ? 'Hide details' : 'Review'}
                    </button>
                  </div>
                </div>

                {open ? (
                  <>
                    <hr className="hairline" />
                    <p>{p.description}</p>
                    <div className="field-row">
                      <div>
                        <div className="section-title">Methodology</div>
                        <p style={{ fontSize: 13.5 }}>{p.methodology || '—'}</p>
                      </div>
                      <div>
                        <div className="section-title">Estimated emission reductions</div>
                        <p className="mono" style={{ fontSize: 13.5 }}>
                          {p.estimated_emission_reductions ? `${p.estimated_emission_reductions.toLocaleString()} tCO₂-e` : '—'}
                        </p>
                      </div>
                    </div>
                    <div className="field-row">
                      <div>
                        <div className="section-title">Price / total credits</div>
                        <p className="mono" style={{ fontSize: 13.5 }}>${p.price_per_credit.toFixed(2)} · {p.total_credits.toLocaleString()} credits</p>
                      </div>
                      <div>
                        <div className="section-title">ACCU category / vintage</div>
                        <p className="mono" style={{ fontSize: 13.5 }}>{p.accu_category || '—'} · {p.vintage || '—'}</p>
                      </div>
                    </div>

                    {p.documents?.length ? (
                      <>
                        <div className="section-title">Evidence on file</div>
                        {p.documents.map((d) => (
                          <div className="doc-row" key={d.id}>
                            <span aria-hidden="true">📄</span>
                            <span>{d.file_name}</span>
                            <span className="text-soft mono" style={{ marginLeft: 'auto', fontSize: 11.5 }}>{d.document_type}</span>
                          </div>
                        ))}
                      </>
                    ) : (
                      <p className="text-soft" style={{ fontSize: 13 }}>No evidence documents attached.</p>
                    )}

                    <div className="field" style={{ marginTop: 16 }}>
                      <label htmlFor={`notes-${p.id}`}>Review notes</label>
                      <textarea id={`notes-${p.id}`} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
                    </div>

                    <div style={{ display: 'flex', gap: 10 }}>
                      <button className="btn btn-verified" disabled={busy} onClick={() => review(p.id, 'approved')}>Approve</button>
                      <button className="btn btn-outline" disabled={busy} onClick={() => review(p.id, 'needs_changes')}>Request changes</button>
                      <button className="btn btn-danger" disabled={busy} onClick={() => review(p.id, 'rejected')}>Reject</button>
                    </div>
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}
