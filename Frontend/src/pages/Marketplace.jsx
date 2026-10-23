import { useEffect, useMemo, useState } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import ProjectCard from '../components/ProjectCard';
import ProjectModal from '../components/ProjectModal';
import ExportButton from '../components/ExportButton';
import { api } from '../api/client';
import { useI18n } from '../i18n/I18nContext';
import { PROJECT_TYPES, STATES } from '../constants';

const PAGE = 24;

export default function Marketplace() {
  const { t, num } = useI18n();
  const [projects, setProjects] = useState([]);
  const [filters, setFilters] = useState({ search: '', type: '', state: '', status: '' });
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const query = useMemo(() => new URLSearchParams(Object.entries(filters).filter(([, value]) => value)).toString(), [filters]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const list = await api.get(`/projects?${query}`);
        if (!cancelled) { setProjects(list); setError(''); setShown(PAGE); }
      } catch (err) { if (!cancelled) setError(err.message); }
      finally { if (!cancelled) setLoading(false); }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query]);

  const visible = useMemo(() => {
    const list = verifiedOnly ? projects.filter((p) => p.listing) : projects;
    // Verified listings first, then by name.
    return [...list].sort((a, b) => Number(Boolean(b.listing)) - Number(Boolean(a.listing)));
  }, [projects, verifiedOnly]);

  async function openProject(project) {
    try { setSelected(await api.get(`/projects/${project.id}`)); }
    catch (err) { setError(err.message); }
  }

  const set = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }));

  return (
    <>
      <Navbar />
      <div className="container" style={{ paddingTop: 40, paddingBottom: 80 }}>
        <div className="page-header">
          <div>
            <div className="eyebrow">{t('Marketplace')}</div>
            <h1>{t('Projects and verified listings')}</h1>
            <p className="text-soft">{t('Browse every project on the Clean Energy Regulator register. Verified listings show seller-supplied availability and pricing, kept separate from official CER data.')}</p>
          </div>
          <ExportButton path={`/export/projects${query ? `?${query}` : ''}`} label={t('Export results')} />
        </div>
        <div className="filter-bar">
          <input className="grow" type="search" placeholder={t('Search project, proponent or methodology')} value={filters.search} onChange={set('search')} aria-label={t('Search')} />
          <select value={filters.type} onChange={set('type')} aria-label={t('Project type')}>
            <option value="">{t('All project types')}</option>
            {PROJECT_TYPES.map((v) => <option key={v} value={v}>{t(v)}</option>)}
          </select>
          <select value={filters.state} onChange={set('state')} aria-label={t('State or territory')}>
            <option value="">{t('All states')}</option>
            {STATES.map((v) => <option key={v} value={v}>{t(v)}</option>)}
          </select>
          <select value={filters.status} onChange={set('status')} aria-label={t('Project status')}>
            <option value="">{t('Any status')}</option>
            <option value="registered">{t('Registered')}</option>
            <option value="revoked">{t('Revoked')}</option>
          </select>
          <label className="check"><input type="checkbox" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} /> {t('Verified listings only')}</label>
        </div>
        {error ? <div className="form-error">{error}</div> : null}
        {loading ? <div className="loading-row"><span className="spinner" /> {t('Loading projects…')}</div> : visible.length ? (
          <>
            <p className="small text-soft">{t('{n} projects', { n: num(visible.length) })}</p>
            <div className="project-grid">{visible.slice(0, shown).map((project) => <ProjectCard key={project.id} project={project} onOpen={openProject} />)}</div>
            {shown < visible.length ? (
              <div className="pager">
                <span>{t('Showing {a} of {b}', { a: num(Math.min(shown, visible.length)), b: num(visible.length) })}</span>
                <button className="btn btn-outline btn-sm" onClick={() => setShown((s) => s + PAGE * 2)}>{t('Show more')}</button>
              </div>
            ) : null}
          </>
        ) : <div className="empty-state">{t('No projects match the current filters.')}</div>}
      </div>
      {selected ? <ProjectModal project={selected} onClose={() => setSelected(null)} /> : null}
      <Footer />
    </>
  );
}
