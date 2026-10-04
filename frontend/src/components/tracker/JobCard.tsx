import { useCallback, useRef, useState } from 'react';
import { Calendar, ChevronDown, DollarSign, ExternalLink, MapPin, Pencil, Trash2 } from 'lucide-react';
import { useDismiss } from '../../hooks/useDismiss';
import { JOB_STATUSES, JOB_STATUS_META } from '../../lib/jobStatus';
import type { JobApplication, JobStatus } from '../../lib/types';
import { safeExternalUrl } from '../../lib/url';
import { StatusBadge } from './StatusBadge';

/** Formats a `YYYY-MM-DD` date in local time (avoids the UTC off-by-one-day shift). */
function formatShortDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  const date = year && month && day ? new Date(year, month - 1, day) : new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface JobCardProps {
  job: JobApplication;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: JobStatus) => void;
}

export function JobCard({ job, onEdit, onDelete, onStatusChange }: JobCardProps) {
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const statusMenuRef = useRef<HTMLDivElement>(null);
  const closeStatusMenu = useCallback(() => setShowStatusMenu(false), []);
  useDismiss(statusMenuRef, showStatusMenu, closeStatusMenu);

  const jobUrl = safeExternalUrl(job.url);
  const metaStyle = { color: 'var(--color-muted-foreground)' };

  return (
    <div
      className="rounded-xl p-4 transition-all group"
      style={{
        background: 'var(--color-card)',
        border: '1px solid var(--color-border)',
      }}
    >
      {/* Company + actions */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-foreground)' }}>
            {job.company}
          </div>
          <div className="text-xs truncate mt-0.5" style={{ color: 'var(--color-secondary-foreground)' }}>
            {job.role}
          </div>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity shrink-0">
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${job.company} application`}
            className="w-6 h-6 rounded-md flex items-center justify-center transition-colors"
            style={{ background: 'var(--color-muted)' }}
          >
            <Pencil size={11} style={{ color: 'var(--color-muted-foreground)' }} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete ${job.company} application`}
            className="w-6 h-6 rounded-md flex items-center justify-center transition-colors"
            style={{ background: 'rgba(248,113,113,0.1)' }}
          >
            <Trash2 size={11} style={{ color: 'var(--color-destructive)' }} />
          </button>
        </div>
      </div>

      {/* Meta */}
      <div className="space-y-1 mb-3">
        {job.location && (
          <div className="flex items-center gap-1.5 text-xs" style={metaStyle}>
            <MapPin size={10} />
            {job.location}
          </div>
        )}
        {job.salary && (
          <div className="flex items-center gap-1.5 text-xs" style={metaStyle}>
            <DollarSign size={10} />
            {job.salary}
          </div>
        )}
        {job.appliedDate && (
          <div className="flex items-center gap-1.5 text-xs" style={metaStyle}>
            <Calendar size={10} />
            {formatShortDate(job.appliedDate)}
          </div>
        )}
      </div>

      {job.notes && (
        <p className="text-xs line-clamp-2 mb-3" style={metaStyle}>
          {job.notes}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="relative" ref={statusMenuRef}>
          <button
            type="button"
            onClick={() => setShowStatusMenu((visible) => !visible)}
            aria-haspopup="menu"
            aria-expanded={showStatusMenu}
            className="flex items-center gap-1"
          >
            <StatusBadge status={job.status} />
            <ChevronDown size={10} style={metaStyle} />
          </button>
          {showStatusMenu && (
            <div
              role="menu"
              className="absolute left-0 bottom-full mb-1 rounded-xl py-1 z-10 min-w-36"
              style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-lg)' }}
            >
              {JOB_STATUSES.map((status) => (
                <button
                  key={status}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onStatusChange(status);
                    setShowStatusMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs transition-colors"
                  style={{
                    color: status === job.status ? 'var(--color-primary)' : 'var(--color-foreground)',
                    background: status === job.status ? 'rgba(163,230,53,0.08)' : 'transparent',
                  }}
                >
                  {JOB_STATUS_META[status].label}
                </button>
              ))}
            </div>
          )}
        </div>
        {jobUrl && (
          <a
            href={jobUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${job.company} job posting`}
            className="transition-opacity"
            style={metaStyle}
          >
            <ExternalLink size={13} />
          </a>
        )}
      </div>
    </div>
  );
}
