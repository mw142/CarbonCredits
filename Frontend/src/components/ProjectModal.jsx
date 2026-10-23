import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import StatusBadge from './StatusBadge';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';

function Src({ children }) {
  return <span className="source-tag">{children}</span>;
}

export default function ProjectModal({ project, onClose }) {
  const { user, token } = useAuth();
  const { t, num, money, date } = useI18n();
  const [message, setMessage] = useState('');
  const [quantity, setQuantity] = useState('');
  const [status, setStatus] = useState(null);
  const listing = project?.listing;
  const imageUrl = listing?.images?.[0]?.url;

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function submitEnquiry(e) {
    e.preventDefault();
    setStatus(null);
    try {
      await api.post('/contact-requests', {
        listing_id: listing.id,
        requested_quantity: quantity ? Number(quantity) : null,
        message: message || null,
      }, token);
      setStatus({ ok: true, text: t('Enquiry sent to the project representative.') });
      setMessage('');
      setQuantity('');
    } catch (error) { setStatus({ ok: false, text: error.message }); }
  }

  if (!project) return null;
  const d = project.project_details;
  const state = project.locations?.find((l) => l.state_or_territory)?.state_or_territory;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={project.name} onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label={t('Close')}>×</button>
        <div className="modal-hero" style={imageUrl ? { backgroundImage: `linear-gradient(rgba(19,27,41,.55), rgba(19,27,41,.82)), url("${imageUrl}")` } : undefined}>
          <div>
            <div className="eyebrow">{project.project_reference} · {t(project.project_type || 'Project')}</div>
            <h2>{listing?.title || project.name}</h2>
            <div style={{ color: 'var(--text-on-ink-soft)', fontSize: 13.5 }}>{project.project_proponent || t('Proponent not listed')}</div>
          </div>
          {listing ? <StatusBadge status="verified" label={t('Verified representative')} /> : null}
        </div>
        <div className="modal-body">
          <div className="section-title" style={{ marginTop: 0 }}><span>{t('Official project information')} <Src>CER</Src></span></div>
          <div className="kv-grid">
            <div><div className="k">{t('Status')}</div><div className="v">{t(project.project_status === 'revoked' ? 'Revoked' : 'Registered')}</div></div>
            <div><div className="k">{t('Location')}</div><div className="v">{state ? t(state) : '—'}{d?.location_postcode ? ` ${d.location_postcode}` : ''}</div></div>
            <div><div className="k">{t('Registered')}</div><div className="v">{date(project.project_registered_at)}</div></div>
            <div><div className="k">{t('Crediting period')}</div><div className="v">{date(project.crediting_period_start)} – {date(project.crediting_period_end)}</div></div>
            <div><div className="k">{t('ACCUs issued')}</div><div className="v mono">{num(project.total_accus_issued)}</div></div>
            <div><div className="k">{t('ACCUs relinquished')}</div><div className="v mono">{num(project.total_accus_relinquished)}</div></div>
          </div>
          <div className="section-title">{t('Description')}</div>
          <p>{project.description || t('No project description has been uploaded.')}</p>
          <div className="section-title">{t('Method')}</div>
          <p className="small">{project.methodology || '—'}</p>
          {d?.project_activities ? <><div className="section-title">{t('Project activities')}</div><p className="small">{d.project_activities}</p></> : null}
          {project.project_links?.length ? <div className="doc-row">{project.project_links.map((link) => <a key={`${link.link_type}-${link.url}`} href={link.url} target="_blank" rel="noreferrer">{t(link.link_type.replaceAll('_', ' '))} ↗</a>)}</div> : null}

          {listing ? (
            <>
              <hr className="hairline" />
              <div className="section-title" style={{ marginTop: 0 }}><span>{t('Listing')} <Src>{t('Project representative')}</Src></span></div>
              <p>{listing.description || t('The representative has not added a listing description.')}</p>
              <p className="small text-soft">{t('Representative')}: <strong>{listing.seller.organisation_name || listing.seller.name}</strong></p>
              {listing.availability ? (
                <div className="kv-grid">
                  <div><div className="k">{t('Available ACCUs')}</div><div className="v mono">{num(listing.availability.quantity_available)}</div></div>
                  <div><div className="k">{t('Indicative price')}</div><div className="v price-figure">{listing.availability.indicative_price == null ? t('Not provided') : money(listing.availability.indicative_price)}</div></div>
                  <div><div className="k">{t('Vintage / category')}</div><div className="v">{[listing.availability.vintage, listing.availability.category].filter(Boolean).join(' · ') || '—'}</div></div>
                  <div><div className="k">{t('Confirmed by seller')}</div><div className="v">{date(listing.availability.seller_confirmed_at)}</div></div>
                </div>
              ) : <p className="form-note">{t('Availability requires reconfirmation.')}</p>}
              {listing.accu_evidence?.length ? (
                <>
                  <div className="section-title"><span>{t('Verified ACCU evidence')} <Src>{t('Platform review')}</Src></span></div>
                  {listing.accu_evidence.map((ev) => <div className="doc-row" key={ev.id}><StatusBadge status="verified" /> {ev.verified_quantity != null ? t('{n} ACCUs', { n: num(ev.verified_quantity) }) : t('Quantity not stated')} · {ev.vintage || '—'} · {ev.category || '—'}{ev.masked_reference ? ` · ${ev.masked_reference}` : ''} <span className="text-soft small">{date(ev.verified_at)}</span></div>)}
                </>
              ) : null}
              {listing.images?.length ? <div className="image-strip">{listing.images.map((image) => <img key={image.id} src={image.url} alt={image.alt_text || image.caption || project.name} />)}</div> : null}
              {user?.role === 'buyer' && listing.contact_available ? (
                <form onSubmit={submitEnquiry} className="card panel" style={{ marginTop: 18, background: 'var(--paper)' }}>
                  <div className="section-title" style={{ marginTop: 0 }}>{t('Contact the representative')}</div>
                  <div className="field-row">
                    <div className="field"><label htmlFor="quantity">{t('Requested quantity')}</label><input id="quantity" type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></div>
                    <div className="field"><label htmlFor="message">{t('Message')}</label><input id="message" value={message} onChange={(e) => setMessage(e.target.value)} /></div>
                  </div>
                  <button className="btn btn-primary" type="submit">{t('Send enquiry')}</button>
                  {status ? <div className={status.ok ? 'form-success' : 'form-error'} style={{ marginTop: 12, marginBottom: 0 }}>{status.text}</div> : null}
                </form>
              ) : null}
              {!user && listing.contact_available ? <p className="form-note" style={{ marginTop: 14 }}><Link to="/register?role=buyer" style={{ fontWeight: 700 }}>{t('Create a buyer account')}</Link> {t('to contact this representative.')}</p> : null}
            </>
          ) : (
            <>
              <hr className="hairline" />
              <p className="form-note">{t('This project has not been claimed by a verified project representative.')}</p>
              {user?.role === 'seller' ? <Link className="btn btn-primary" to={`/seller/claims/new?project=${project.id}`} onClick={onClose}>{t('Request to claim this project')}</Link> : null}
            </>
          )}
          <p className="disclaimer">{t('Official project information is sourced from public Clean Energy Regulator data. Listing descriptions, images, pricing and availability are supplied by the verified project representative. Platform verification is based on documents submitted by users and does not replace confirmation through the official CER registry. Purchases, payments and ACCU transfers occur outside this platform.')}</p>
        </div>
      </div>
    </div>
  );
}
