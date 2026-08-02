import { useEffect, useMemo, useState, useCallback } from 'react';
import Navbar from '../components/Navbar';
import ProjectCard from '../components/ProjectCard';
import ProjectModal from '../components/ProjectModal';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Marketplace() {
  const { user, token } = useAuth();
  const [projects, setProjects] = useState([]);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [savedIds, setSavedIds] = useState(new Set());

  const [filters, setFilters] = useState({ search: '', type: '', state: '', verifiedOnly: false, sort: 'newest' });

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filters.search) params.set('search', filters.search);
      if (filters.type) params.set('type', filters.type);
      if (filters.state) params.set('state', filters.state);
      if (filters.verifiedOnly) params.set('verifiedOnly', 'true');
      if (filters.sort) params.set('sort', filters.sort);
      const data = await api.get(`/projects?${params.toString()}`);
      setProjects(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  useEffect(() => {
    api.get('/project-types').then(setTypes).catch(() => {});
  }, []);

  useEffect(() => {
    if (user?.role === 'buyer' && token) {
      api.get('/buyer/dashboard', token)
        .then((d) => setSavedIds(new Set(d.saved_projects.map((p) => p.id))))
        .catch(() => {});
    }
  }, [user, token]);

  const locations = useMemo(() => {
    const set = new Set(projects.map((p) => p.location.split(',').pop().trim()));
    return Array.from(set);
  }, [projects]);

  async function toggleSave(project) {
    if (!user || user.role !== 'buyer') return;
    const isSaved = savedIds.has(project.id);
    try {
      if (isSaved) {
        await api.del(`/buyer/save/${project.id}`, token);
        setSavedIds((s) => { const next = new Set(s); next.delete(project.id); return next; });
      } else {
        await api.post(`/buyer/save/${project.id}`, {}, token);
        setSavedIds((s) => new Set(s).add(project.id));
      }
    } catch { /* no-op for prototype */ }
  }

  async function handleOpen(project) {
    setSelected(project); // show immediately, then enrich with documents
    try {
      const full = await api.get(`/projects/${project.id}`, token);
      setSelected(full);
    } catch { /* keep the summary version if detail fetch fails */ }
  }

  function handlePurchased(updatedProject) {
    setProjects((prev) => prev.map((p) => (p.id === updatedProject.id ? updatedProject : p)));
    setSelected(updatedProject);
  }

  return (
    <>
      <Navbar />
      <div className="container" style={{ paddingTop: 32, paddingBottom: 60 }}>
        <div className="page-header">
          <div>
            <div className="eyebrow">Carbon credit marketplace</div>
            <h1>Verified ACCU projects</h1>
            <p className="text-soft" style={{ maxWidth: 560 }}>
              Browse project listings with ACCU-verified evidence. Filter by type, location, price and
              verification status to find credits that match your offset goals.
            </p>
          </div>
        </div>

        <div className="filter-bar">
          <input
            type="text" placeholder="Search projects…" value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          />
          <select value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}>
            <option value="">All project types</option>
            {types.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={filters.state} onChange={(e) => setFilters((f) => ({ ...f, state: e.target.value }))}>
            <option value="">All locations</option>
            {locations.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <select value={filters.sort} onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value }))}>
            <option value="newest">Newest</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
            <option value="credits_desc">Most credits available</option>
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5 }}>
            <input
              type="checkbox" checked={filters.verifiedOnly}
              onChange={(e) => setFilters((f) => ({ ...f, verifiedOnly: e.target.checked }))}
              style={{ width: 'auto' }}
            />
            Verified only
          </label>
        </div>

        {error ? <div className="form-error">{error}</div> : null}

        {loading ? (
          <div className="loading-row"><span className="spinner" /> Loading listings…</div>
        ) : projects.length === 0 ? (
          <div className="empty-state">No listings match those filters yet.</div>
        ) : (
          <div className="project-grid">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} onOpen={handleOpen} />
            ))}
          </div>
        )}
      </div>

      {selected ? (
        <ProjectModal
          project={selected}
          onClose={() => setSelected(null)}
          onPurchased={handlePurchased}
          onToggleSave={toggleSave}
          saved={savedIds.has(selected.id)}
        />
      ) : null}
    </>
  );
}
