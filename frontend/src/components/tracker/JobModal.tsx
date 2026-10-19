import { useEffect, useState, type InputHTMLAttributes } from 'react';
import { X } from 'lucide-react';
import { JOB_STATUSES, JOB_STATUS_META } from '../../lib/jobStatus';
import type { JobApplication, JobApplicationInput, JobStatus } from '../../lib/types';

export type JobModalInitial = Partial<JobApplication> & { status: JobStatus };

function todayIso(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function emptyJob(): JobApplicationInput {
  return {
    company: '',
    role: '',
    location: '',
    status: 'applied',
    salary: '',
    appliedDate: todayIso(),
    deadline: '',
    notes: '',
    url: '',
    jobDescription: '',
  };
}

const inputStyle = {
  background: 'var(--color-muted)',
  border: '1px solid var(--color-border)',
  color: 'var(--color-foreground)',
};

function Field({
  label,
  ...inputProps
}: { label: string } & Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'style'>) {
  return (
    <label className="block">
      <span className="text-xs mb-1 block" style={{ color: 'var(--color-secondary-foreground)' }}>
        {label}
      </span>
      <input {...inputProps} className="w-full text-sm px-3 py-2.5 rounded-lg outline-none" style={inputStyle} />
    </label>
  );
}

interface JobModalProps {
  job: JobModalInitial;
  saving: boolean;
  onSave: (input: JobApplicationInput, id?: string) => void;
  onClose: () => void;
}

export function JobModal({ job, saving, onSave, onClose }: JobModalProps) {
  const { id, ...initial } = job;
  const [form, setForm] = useState<JobApplicationInput>({ ...emptyJob(), ...initial });

  const update = <K extends keyof JobApplicationInput>(key: K, value: JobApplicationInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const canSave = Boolean(form.company.trim() && form.role.trim()) && !saving;

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleSave = () => {
    if (canSave) onSave(form, id);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="job-modal-title"
        className="w-full max-w-lg rounded-2xl overflow-hidden"
        style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}
      >
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid var(--color-border)' }}
        >
          <h2 id="job-modal-title" className="font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-foreground)' }}>
            {id ? 'Edit Application' : 'Add Application'}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close">
            <X size={20} style={{ color: 'var(--color-muted-foreground)' }} />
          </button>
        </div>

        <form
          id="job-modal-form"
          className="p-6 overflow-y-auto max-h-[70vh] space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            handleSave();
          }}
        >
          <div className="grid grid-cols-2 gap-4">
            <Field label="Company *" type="text" value={form.company} onChange={(e) => update('company', e.target.value)} placeholder="e.g. Google" maxLength={200} autoFocus />
            <Field label="Role *" type="text" value={form.role} onChange={(e) => update('role', e.target.value)} placeholder="e.g. Software Engineer" maxLength={200} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Location" type="text" value={form.location} onChange={(e) => update('location', e.target.value)} placeholder="e.g. Remote" maxLength={200} />
            <Field label="Salary Range" type="text" value={form.salary} onChange={(e) => update('salary', e.target.value)} placeholder="e.g. $120k–$160k" maxLength={100} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Applied Date" type="date" value={form.appliedDate} onChange={(e) => update('appliedDate', e.target.value)} />
            <Field label="Deadline" type="date" value={form.deadline} onChange={(e) => update('deadline', e.target.value)} />
          </div>

          <div>
            <span className="text-xs mb-1 block" style={{ color: 'var(--color-secondary-foreground)' }}>Status</span>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Status">
              {JOB_STATUSES.map((status) => {
                const meta = JOB_STATUS_META[status];
                const active = form.status === status;
                return (
                  <button
                    key={status}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => update('status', status)}
                    className="px-3 py-2 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: active ? meta.bg : 'var(--color-muted)',
                      border: active ? `1px solid ${meta.border}` : '1px solid var(--color-border)',
                      color: active ? meta.color : 'var(--color-muted-foreground)',
                    }}
                  >
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          <Field label="Job URL" type="url" value={form.url} onChange={(e) => update('url', e.target.value)} placeholder="https://..." maxLength={2000} />

          <label className="block">
            <span className="text-xs mb-1 block" style={{ color: 'var(--color-secondary-foreground)' }}>Notes</span>
            <textarea
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              rows={3}
              maxLength={10_000}
              className="w-full text-sm px-3 py-2.5 rounded-lg outline-none resize-none"
              style={inputStyle}
              placeholder="Recruiter contact, interview notes, anything relevant..."
            />
          </label>
        </form>

        <div
          className="flex items-center justify-end gap-3 px-6 py-4"
          style={{ borderTop: '1px solid var(--color-border)' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="text-sm px-4 py-2 rounded-lg"
            style={{ color: 'var(--color-muted-foreground)', background: 'var(--color-muted)' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="job-modal-form"
            disabled={!canSave}
            className="text-sm px-5 py-2 rounded-lg font-semibold"
            style={{
              background: canSave ? 'var(--color-primary)' : 'var(--color-muted)',
              color: canSave ? 'var(--color-primary-foreground)' : 'var(--color-muted-foreground)',
            }}
          >
            {saving ? 'Saving…' : 'Save Application'}
          </button>
        </div>
      </div>
    </div>
  );
}
