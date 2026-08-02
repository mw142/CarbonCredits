import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

const initialForm = {
  name: '', location: '', project_type: '', description: '', methodology: '',
  estimated_emission_reductions: '', accu_category: '', vintage: '',
  price_per_credit: '', total_credits: '',
};

export default function ProjectSubmission() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [types, setTypes] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [docName, setDocName] = useState('');
  const [documents, setDocuments] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get('/project-types').then(setTypes).catch(() => {}); }, []);

  function update(field, value) { setForm((f) => ({ ...f, [field]: value })); }

  function addDocument() {
    if (!docName.trim()) return;
    setDocuments((d) => [...d, { document_type: 'other', file_name: docName.trim() }]);
    setDocName('');
  }

  function removeDocument(name) {
    setDocuments((d) => d.filter((doc) => doc.file_name !== name));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const payload = {
        ...form,
        estimated_emission_reductions: form.estimated_emission_reductions ? Number(form.estimated_emission_reductions) : null,
        price_per_credit: Number(form.price_per_credit),
        total_credits: Number(form.total_credits),
        documents,
      };
      const created = await api.post('/projects', payload, token);
      navigate('/seller', { state: { submitted: created.id } });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="page-header">
        <div>
          <div className="eyebrow">Project submission</div>
          <h1>Submit a new project</h1>
          <p className="text-soft" style={{ maxWidth: 560 }}>
            This information is used by an administrator to verify your project before it can be listed on
            the marketplace. Once submitted, the project is not visible to buyers until it&rsquo;s approved
            and you publish the listing.
          </p>
        </div>
      </div>

      {error ? <div className="form-error">{error}</div> : null}

      <form onSubmit={handleSubmit} className="card panel" style={{ maxWidth: 720 }}>
        <div className="field">
          <label htmlFor="name">Project name</label>
          <input id="name" required value={form.name} onChange={(e) => update('name', e.target.value)} />
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="location">Location</label>
            <input id="location" required placeholder="e.g. Riverina, New South Wales" value={form.location} onChange={(e) => update('location', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="project_type">Project type</label>
            <select id="project_type" required value={form.project_type} onChange={(e) => update('project_type', e.target.value)}>
              <option value="" disabled>Select type</option>
              {types.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div className="field">
          <label htmlFor="description">Project description</label>
          <textarea id="description" rows={4} value={form.description} onChange={(e) => update('description', e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="methodology">Methodology</label>
          <input id="methodology" placeholder="e.g. Human-Induced Regeneration" value={form.methodology} onChange={(e) => update('methodology', e.target.value)} />
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="eer">Estimated emission reductions (tCO₂-e)</label>
            <input id="eer" type="number" min="0" value={form.estimated_emission_reductions} onChange={(e) => update('estimated_emission_reductions', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="vintage">Vintage year</label>
            <input id="vintage" placeholder="2026" value={form.vintage} onChange={(e) => update('vintage', e.target.value)} />
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="category">ACCU category</label>
            <select id="category" value={form.accu_category} onChange={(e) => update('accu_category', e.target.value)}>
              <option value="">Not specified</option>
              <option value="KACCU">Kyoto ACCU (KACCU)</option>
              <option value="NKACCU">Non-Kyoto ACCU (NKACCU)</option>
            </select>
          </div>
          <div />
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="price">Price per credit (AUD)</label>
            <input id="price" type="number" min="0" step="0.01" required value={form.price_per_credit} onChange={(e) => update('price_per_credit', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="total">Total credits to list</label>
            <input id="total" type="number" min="1" required value={form.total_credits} onChange={(e) => update('total_credits', e.target.value)} />
          </div>
        </div>

        <div className="field">
          <label>Supporting evidence (file names)</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              placeholder="e.g. accu_certificate_2026.pdf" value={docName}
              onChange={(e) => setDocName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addDocument(); } }}
            />
            <button type="button" className="btn btn-outline btn-sm" onClick={addDocument}>Add</button>
          </div>
          <p className="field-hint">
            This prototype records evidence file names only — a production build would upload the actual
            certificates and registry exports for an administrator to review privately.
          </p>
          {documents.map((d) => (
            <div className="doc-row" key={d.file_name}>
              <span aria-hidden="true">📄</span>
              <span>{d.file_name}</span>
              <button type="button" className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => removeDocument(d.file_name)}>Remove</button>
            </div>
          ))}
        </div>

        <button className="btn btn-verified" type="submit" disabled={busy} style={{ marginTop: 8 }}>
          {busy ? 'Submitting…' : 'Submit for verification'}
        </button>
      </form>
    </DashboardLayout>
  );
}
