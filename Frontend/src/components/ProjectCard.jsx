import StatusBadge from './StatusBadge';
import { useI18n } from '../i18n/I18nContext';

export default function ProjectCard({ project, onOpen }) {
  const { t, num, money } = useI18n();
  const listing = project.listing;
  const availability = listing?.availability;
  const imageUrl = listing?.cover_image_url;
  const state = project.locations?.find((l) => l.state_or_territory)?.state_or_territory;
  return (
    <article className="card project-card" onClick={() => onOpen(project)} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onOpen(project); }}>
      <div className="project-card-media" style={imageUrl ? { backgroundImage: `linear-gradient(rgba(19,27,41,.45), rgba(19,27,41,.75)), url("${imageUrl}")` } : undefined}>
        <span className="project-card-type">{t(project.project_type || 'Project')}</span>
        {listing ? <StatusBadge status="verified" /> : <span className="badge" style={{ background: 'rgba(255,255,255,.12)', color: 'var(--text-on-ink)', borderColor: 'rgba(255,255,255,.2)' }}>{t('Unclaimed')}</span>}
      </div>
      <div className="project-card-body">
        <h3 className="project-card-title">{listing?.title || project.name}</h3>
        <div className="project-card-loc">{project.project_reference}{state ? ` · ${t(state)}` : ''}</div>
        <div className="small text-soft" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.project_proponent || t('Proponent not listed')}</div>
        <div className="project-card-foot">
          <div>
            <div className="price-figure">{availability?.indicative_price != null ? money(availability.indicative_price) : listing ? t('Price on request') : '—'}</div>
            <div className="price-unit">{availability ? t('{n} ACCUs available', { n: num(availability.quantity_available) }) : t('{n} ACCUs issued (CER)', { n: num(project.total_accus_issued) })}</div>
          </div>
          <div className="credits-figure">{t(project.project_status === 'revoked' ? 'Revoked' : 'Registered')}</div>
        </div>
      </div>
    </article>
  );
}
