import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { api, fileToDataUrl } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';

const TYPES = [
  ['owner', 'Project owner'],
  ['proponent', 'Project proponent'],
  ['authorised_representative', 'Authorised representative'],
  ['project_manager', 'Project manager'],
  ['contributor', 'Project contributor'],
];
const DOC_TYPES = [
  ['ownership_evidence', 'Ownership evidence'],
  ['authority_document', 'Authority to represent'],
  ['project_agreement', 'Project agreement'],
  ['registry_export', 'Registry export'],
  ['other', 'Other'],
];

export default function ProjectSubmission() {
  const { token } = useAuth();
  const { t } = useI18n();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [relationship, setRelationship] = useState('authorised_representative');
  const [docType, setDocType] = useState('authority_document');
  const [documents, setDocuments] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (params.get('project')) api.get(`/projects/${params.get('project')}`).then(setProject).catch(() => {});
  }, [params]);

  async function addDocument(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error(t('Maximum 10 MB per file.'));
      const file_data = await fileToDataUrl(file);
      setDocuments((current) => [...current, { original_file_name: file.name, mime_type: file.type, file_size_bytes: file.size, file_data, document_type: docType }]);
    } catch (err) { setError(err.message); }
    event.target.value = '';
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.post(`/projects/${params.get('project')}/claims`, { relationship_type: relationship, documents }, token);
      navigate('/seller');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return (
    <DashboardLayout>
      <div className="page-header">
        <div>
          <div className="eyebrow">{t('Project claim')}</div>
          <h1>{t('Request permission to represent this project')}</h1>
          <p className="text-soft">{t('Submit your relationship and supporting evidence. An administrator must approve the claim before you can publish a listing.')}</p>
        </div>
      </div>
      {project ? <div className="card panel" style={{ maxWidth: 760, marginBottom: 16 }}><div className="eyebrow">{project.project_reference}</div><strong>{project.name}</strong><div className="small text-soft">{project.project_proponent}</div></div> : null}
      {error ? <div className="form-error">{error}</div> : null}
      <form className="card panel" style={{ maxWidth: 760 }} onSubmit={submit}>
        <div className="field"><label htmlFor="relationship">{t('Your relationship to the project')}</label><select id="relationship" value={relationship} onChange={(e) => setRelationship(e.target.value)}>{TYPES.map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}</select></div>
        <div className="field-row">
          <div className="field"><label htmlFor="doc-type">{t('Document type')}</label><select id="doc-type" value={docType} onChange={(e) => setDocType(e.target.value)}>{DOC_TYPES.map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}</select></div>
          <div className="field"><label htmlFor="claim-documents">{t('Add a supporting document')}</label><input id="claim-documents" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={addDocument} /></div>
        </div>
        <p className="field-hint">{t('Files are stored privately and are only available to you and authorised administrators. Maximum 10 MB per file.')}</p>
        {documents.map((document, index) => (
          <div className="doc-row" key={`${document.original_file_name}-${index}`}>
            <span className="chip">{t(DOC_TYPES.find(([v]) => v === document.document_type)?.[1] || '')}</span>
            <span>{document.original_file_name}</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDocuments((current) => current.filter((_, i) => i !== index))}>{t('Remove')}</button>
          </div>
        ))}
        <button className="btn btn-primary" style={{ marginTop: 14 }} disabled={busy}>{busy ? t('Submitting…') : t('Submit claim request')}</button>
      </form>
    </DashboardLayout>
  );
}
