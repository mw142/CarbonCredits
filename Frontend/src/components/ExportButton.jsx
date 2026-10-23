import { useState } from 'react';
import { downloadFile } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import Icon from './Icons';

/** CSV / JSON download for an /api/export/* endpoint. */
export default function ExportButton({ path, label, formats = ['csv', 'json'], className = 'btn btn-outline btn-sm' }) {
  const { token } = useAuth();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run(format) {
    setBusy(true); setError('');
    try {
      const sep = path.includes('?') ? '&' : '?';
      await downloadFile(`${path}${sep}format=${format}`, token);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return (
    <span className="btn-row" title={error || undefined}>
      <button type="button" className={className} disabled={busy} onClick={() => run(formats[0])}>
        <Icon name="download" size={15} /> {label || t('Export CSV')}
      </button>
      {formats.slice(1).map((f) => (
        <button key={f} type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => run(f)}>{f.toUpperCase()}</button>
      ))}
      {error ? <span className="small" style={{ color: 'var(--rust)' }}>{error}</span> : null}
    </span>
  );
}
