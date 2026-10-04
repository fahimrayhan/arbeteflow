import type { JobStatus } from './types';

/** Kanban column order. */
export const JOB_STATUSES: JobStatus[] = [
  'bookmarked',
  'applied',
  'screening',
  'interview',
  'offer',
  'rejected',
];

/** Colours are CSS variables (defined per theme in index.css), so badges follow light/dark. */
function statusColors(status: JobStatus) {
  return {
    color: `var(--status-${status}-color)`,
    bg: `var(--status-${status}-bg)`,
    border: `var(--status-${status}-border)`,
  };
}

const LABELS: Record<JobStatus, string> = {
  bookmarked: 'Bookmarked',
  applied: 'Applied',
  screening: 'Screening',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
};

export const JOB_STATUS_META = Object.fromEntries(
  JOB_STATUSES.map((status) => [status, { label: LABELS[status], ...statusColors(status) }]),
) as Record<JobStatus, { label: string; color: string; bg: string; border: string }>;
