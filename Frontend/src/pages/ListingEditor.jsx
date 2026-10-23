import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import StatusBadge from '../components/StatusBadge';
import { api, fileToDataUrl } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';

const in90Days = () => new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);

export default function ListingEditor() {
  const { token } = useAuth();
  const { t, num, money, date } = useI18n();
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [listing, setListing] = useState(null);
  const [form, setForm] = useState({ listing_title: '', seller_description: '', contact_available: true });
  const [availability, setAvailability] = useState({ quantity_available: '', vintage: '', category: '', indicative_price: '', expires_at: in90Days(), notes: '' });
  const [evidence, setEvidence] = useState({ document_type: 'accu_certificate', vintage: '', category: '' });
  const [image, setImage] = useState({ file: null, alt_text: '', caption: '' });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    if (!id) return;
    try {
      const data = await api.get(`/seller/listings/${id}`, token);
      setListing(data);
      setForm({ listing_title: data.listing_title || '', seller_description: data.seller_description || '', contact_available: Boolean(data.contact_available) });
    } catch (err) { setError(err.message); }
  }
  useEffect(() => { load(); }, [id, token]);

  const done = (text) => { setError(''); setMessage(text); };

  async function saveListing(event) {
    event.preventDefault();
    setError('');
    try {
      const data = id ? await api.patch(`/seller/listings/${id}`, form, token) : await api.post(`/projects/${params.get('project')}/listings`, form, token);
      setListing(data);
      if (!id) navigate(`/seller/listings/${data.id}`, { replace: true });
      done(t('Listing saved.'));
    } catch (err) { setError(err.message); }
  }

  async function addAvailability(event) {
    event.preventDefault();
    try {
      await api.post(`/seller/listings/${listing.id}/availability`, { ...availability, expires_at: availability.expires_at ? `${availability.expires_at} 23:59:59` : null }, token);
      setAvailability({ ...availability, quantity_available: '', indicative_price: '', notes: '' });
      done(t('Availability added — it now appears in the live market feed.'));
      await load();
    } catch (err) { setError(err.message); }
  }

  async function reconfirm(row) {
    try {
      await api.patch(`/seller/availability/${row.id}`, { seller_confirmed_at: new Date().toISOString().slice(0, 19).replace('T', ' '), expires_at: `${in90Days()} 23:59:59`, status: 'active' }, token);
      done(t('Availability reconfirmed for 90 days.'));
      await load();
    } catch (err) { setError(err.message); }
  }

  async function setAvailabilityStatus(row, status) {
    try { await api.patch(`/seller/availability/${row.id}`, { status }, token); await load(); } catch (err) { setError(err.message); }
  }

  async function addEvidence(event) {
    event.preventDefault();
    if (!evidence.file) return setError(t('Select an evidence file first.'));
    try {
      const file_data = await fileToDataUrl(evidence.file);
      await api.post(`/seller/listings/${listing.id}/evidence`, { ...evidence, file: undefined, file_data, original_file_name: evidence.file.name, mime_type: evidence.file.type, file_size_bytes: evidence.file.size, category: evidence.category || null }, token);
      setEvidence({ document_type: 'accu_certificate', vintage: '', category: '' });
      done(t('Evidence uploaded for review.'));
      await load();
    } catch (err) { setError(err.message); }
    return null;
  }

  async function addImage(event) {
    event.preventDefault();
    if (!image.file) return setError(t('Select an image first.'));
    try {
      const file_data = await fileToDataUrl(image.file);
      await api.post(`/seller/listings/${listing.id}/images`, { file_data, original_file_name: image.file.name, mime_type: image.file.type, file_size_bytes: image.file.size, alt_text: image.alt_text, caption: image.caption }, token);
      setImage({ file: null, alt_text: '', caption: '' });
      done(t('Image uploaded for review.'));
      await load();
    } catch (err) { setError(err.message); }
    return null;
  }

  async function updateStatus(listing_status) {
    try { await api.patch(`/seller/listings/${listing.id}`, { listing_status }, token); done(t('Listing status updated.')); await load(); }
    catch (err) { setError(err.message); }
  }

  return (
    <DashboardLayout>
      <div className="page-header">
        <div>
          <div className="eyebrow">{t('Seller listing')}</div>
          <h1>{listing?.listing_title || t('Create project listing')}</h1>
          <p className="text-soft">{t('Your listing content is shown separately from the official CER project record.')}</p>
        </div>
        {listing ? <StatusBadge status={listing.listing_status} /> : null}
      </div>
      {error ? <div className="form-error">{error}</div> : null}
      {message ? <div className="form-success">{message}</div> : null}

      <form className="card panel" onSubmit={saveListing}>
        <div className="field"><label htmlFor="listing-title">{t('Listing title')}</label><input id="listing-title" value={form.listing_title} onChange={(e) => setForm({ ...form, listing_title: e.target.value })} /></div>
        <div className="field"><label htmlFor="listing-description">{t('Representative description')}</label><textarea id="listing-description" rows="5" value={form.seller_description} onChange={(e) => setForm({ ...form, seller_description: e.target.value })} /></div>
        <label className="check"><input type="checkbox" checked={form.contact_available} onChange={(e) => setForm({ ...form, contact_available: e.target.checked })} /> {t('Accept buyer enquiries and introductions')}</label>
        <div className="btn-row" style={{ marginTop: 18 }}>
          <button className="btn btn-primary">{t('Save listing')}</button>
          {listing ? <button type="button" className="btn btn-outline" onClick={() => updateStatus(listing.listing_status === 'published' ? 'paused' : 'published')}>{listing.listing_status === 'published' ? t('Pause listing') : t('Publish listing')}</button> : null}
        </div>
      </form>

      {listing ? (
        <>
          <div className="section-title">{t('Current ACCU availability')}</div>
          <form className="card panel" onSubmit={addAvailability}>
            <div className="field-row field-row-4">
              <div className="field"><label>{t('Quantity')}</label><input type="number" min="0" required value={availability.quantity_available} onChange={(e) => setAvailability({ ...availability, quantity_available: e.target.value })} /></div>
              <div className="field"><label>{t('Indicative price (AUD)')}</label><input type="number" min="0" step="0.01" value={availability.indicative_price} onChange={(e) => setAvailability({ ...availability, indicative_price: e.target.value })} /></div>
              <div className="field"><label>{t('Vintage')}</label><input value={availability.vintage} onChange={(e) => setAvailability({ ...availability, vintage: e.target.value })} /></div>
              <div className="field"><label>{t('Category')}</label><select value={availability.category} onChange={(e) => setAvailability({ ...availability, category: e.target.value })}><option value="">—</option><option>KACCU</option><option>NKACCU</option></select></div>
            </div>
            <div className="field-row">
              <div className="field"><label>{t('Offer expires')}</label><input type="date" value={availability.expires_at} onChange={(e) => setAvailability({ ...availability, expires_at: e.target.value })} /><span className="field-hint">{t('Availability is hidden after this date unless you reconfirm it.')}</span></div>
              <div className="field"><label>{t('Notes')}</label><input value={availability.notes} onChange={(e) => setAvailability({ ...availability, notes: e.target.value })} /></div>
            </div>
            <button className="btn btn-primary">{t('Add availability')}</button>
          </form>
          {listing.availability?.length ? (
            <div className="card table-wrap" style={{ marginTop: 14 }}>
              <table className="ledger-table">
                <thead><tr><th className="num">{t('Quantity')}</th><th className="num">{t('Price')}</th><th>{t('Vintage')}</th><th>{t('Status')}</th><th>{t('Confirmed')}</th><th>{t('Expires')}</th><th /></tr></thead>
                <tbody>{listing.availability.map((a) => (
                  <tr key={a.id}>
                    <td className="num">{num(a.quantity_available)}</td><td className="num">{money(a.indicative_price)}</td><td>{[a.vintage, a.category].filter(Boolean).join(' · ') || '—'}</td>
                    <td><StatusBadge status={a.status} /></td><td className="small">{date(a.seller_confirmed_at)}</td><td className="small">{date(a.expires_at)}</td>
                    <td><div className="btn-row"><button className="btn btn-outline btn-sm" onClick={() => reconfirm(a)}>{t('Reconfirm')}</button>{a.status === 'active' ? <button className="btn btn-ghost btn-sm" onClick={() => setAvailabilityStatus(a, 'sold_elsewhere')}>{t('Mark sold')}</button> : null}</div></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : null}

          <div className="grid-2" style={{ marginTop: 22 }}>
            <form className="card panel" onSubmit={addEvidence}>
              <div className="section-title" style={{ marginTop: 0 }}>{t('ACCU evidence')}</div>
              <div className="field"><label>{t('Document')}</label><input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => setEvidence({ ...evidence, file: e.target.files?.[0] })} /></div>
              <div className="field-row">
                <div className="field"><label>{t('Document type')}</label><select value={evidence.document_type} onChange={(e) => setEvidence({ ...evidence, document_type: e.target.value })}><option value="accu_certificate">{t('ACCU certificate')}</option><option value="holdings_export">{t('Holdings export')}</option><option value="registry_statement">{t('Registry statement')}</option><option value="account_evidence">{t('Account evidence')}</option><option value="other">{t('Other')}</option></select></div>
                <div className="field"><label>{t('Vintage')}</label><input value={evidence.vintage} onChange={(e) => setEvidence({ ...evidence, vintage: e.target.value })} /></div>
              </div>
              <div className="field"><label>{t('Category')}</label><select value={evidence.category} onChange={(e) => setEvidence({ ...evidence, category: e.target.value })}><option value="">—</option><option>KACCU</option><option>NKACCU</option></select></div>
              <button className="btn btn-outline">{t('Upload evidence')}</button>
            </form>
            <form className="card panel" onSubmit={addImage}>
              <div className="section-title" style={{ marginTop: 0 }}>{t('Project image')}</div>
              <div className="field"><label>{t('Image')}</label><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setImage({ ...image, file: e.target.files?.[0] })} /></div>
              <div className="field"><label>{t('Alt text')}</label><input value={image.alt_text} onChange={(e) => setImage({ ...image, alt_text: e.target.value })} /></div>
              <div className="field"><label>{t('Caption')}</label><input value={image.caption} onChange={(e) => setImage({ ...image, caption: e.target.value })} /></div>
              <p className="field-hint">{t('Only upload images you have permission to use.')}</p>
              <button className="btn btn-outline">{t('Upload image')}</button>
            </form>
          </div>
          <div className="card panel" style={{ marginTop: 18 }}>
            <div className="section-title" style={{ marginTop: 0 }}>{t('Submitted evidence and images')}</div>
            {[...(listing.evidence || []), ...(listing.images || [])].map((item) => <div className="doc-row" key={`${item.id}-${item.original_file_name}`}><StatusBadge status={item.review_status} /> {item.original_file_name} {item.review_notes ? <span className="small text-soft">· {item.review_notes}</span> : null}</div>)}
            {!listing.evidence?.length && !listing.images?.length ? <p className="text-soft" style={{ margin: 0 }}>{t('Nothing submitted yet.')}</p> : null}
          </div>
        </>
      ) : null}
    </DashboardLayout>
  );
}
