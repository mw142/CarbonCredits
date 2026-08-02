import VerifiedStamp from './VerifiedStamp';

export default function ProjectCard({ project, onOpen }) {
  return (
    <article className="card project-card" onClick={() => onOpen(project)} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(project); }}>
      <div className="project-card-media">
        <span className="project-card-type">{project.project_type}</span>
        {project.is_verified ? <VerifiedStamp size={44} tone="brass" /> : null}
      </div>
      <div className="project-card-body">
        <h3 className="project-card-title">{project.name}</h3>
        <div className="project-card-loc">{project.location}</div>
        {project.seller ? (
          <div className="text-soft" style={{ fontSize: 12.5 }}>
            {project.seller.organisation_name || project.seller.name}
          </div>
        ) : null}
        <div className="project-card-foot">
          <div>
            <div className="price-figure">${project.price_per_credit.toFixed(2)}</div>
            <div className="price-unit">per ACCU credit</div>
          </div>
          <div className="credits-figure">
            {Math.round(project.available_credits).toLocaleString()} available
          </div>
        </div>
      </div>
    </article>
  );
}
