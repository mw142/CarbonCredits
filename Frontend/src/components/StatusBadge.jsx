const MAP = {
  approved: { cls: 'badge-verified', label: 'Verified' },
  waiting_review: { cls: 'badge-pending', label: 'Pending review' },
  needs_changes: { cls: 'badge-pending', label: 'Needs changes' },
  rejected: { cls: 'badge-rejected', label: 'Rejected' },
  listed: { cls: 'badge-verified', label: 'Listed' },
  unlisted: { cls: 'badge-neutral', label: 'Unlisted' },
};

export default function StatusBadge({ status }) {
  const entry = MAP[status] || { cls: 'badge-neutral', label: status };
  return <span className={`badge ${entry.cls}`}>{entry.label}</span>;
}
