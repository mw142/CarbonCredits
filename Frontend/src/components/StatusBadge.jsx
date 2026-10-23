import { useI18n } from '../i18n/I18nContext';

const MAP = {
  approved: ['badge-verified', 'Approved'],
  published: ['badge-verified', 'Published'],
  verified: ['badge-verified', 'Verified'],
  completed: ['badge-verified', 'Completed'],
  introduced: ['badge-verified', 'Introduced'],
  responded: ['badge-verified', 'Responded'],
  active: ['badge-verified', 'Active'],
  contacted: ['badge-verified', 'Contacted'],
  pending: ['badge-pending', 'Pending'],
  under_review: ['badge-pending', 'Under review'],
  additional_information_required: ['badge-pending', 'More information'],
  completed_with_errors: ['badge-pending', 'Completed with errors'],
  running: ['badge-pending', 'Running'],
  matching: ['badge-pending', 'Matching'],
  new: ['badge-pending', 'New'],
  viewed: ['badge-neutral', 'Viewed'],
  paused: ['badge-pending', 'Paused'],
  rejected: ['badge-rejected', 'Rejected'],
  failed: ['badge-rejected', 'Failed'],
  revoked: ['badge-rejected', 'Revoked'],
  expired: ['badge-neutral', 'Expired'],
  withdrawn: ['badge-neutral', 'Withdrawn'],
  archived: ['badge-neutral', 'Archived'],
  draft: ['badge-neutral', 'Draft'],
  closed: ['badge-neutral', 'Closed'],
  unclaimed: ['badge-neutral', 'Unclaimed'],
};

export default function StatusBadge({ status, label }) {
  const { t } = useI18n();
  const [cls, text] = MAP[status] || ['badge-neutral', String(status || '').replaceAll('_', ' ')];
  return <span className={`badge ${cls}`}>{label || t(text)}</span>;
}
