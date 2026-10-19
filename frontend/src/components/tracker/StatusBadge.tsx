import { JOB_STATUS_META } from '../../lib/jobStatus';
import type { JobStatus } from '../../lib/types';

export function StatusBadge({ status }: { status: JobStatus }) {
  const meta = JOB_STATUS_META[status];

  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}
    >
      {meta.label}
    </span>
  );
}
