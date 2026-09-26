import { useState, useEffect } from 'react';
import { Plus, X, ExternalLink, Calendar, DollarSign, MapPin, ChevronDown, Briefcase, Pencil, Trash2 } from 'lucide-react';
import { createJob, deleteJob, getJobs, updateJob } from '../lib/api';
import type { JobApplication, JobStatus } from '../lib/types';
import { JOB_STATUS_META } from '../lib/types';

const COLUMNS: JobStatus[] = ['bookmarked', 'applied', 'screening', 'interview', 'offer', 'rejected'];

function uid() {
  return Math.random().toString(36).slice(2);
}

const EMPTY_JOB: Omit<JobApplication, 'id'> = {
  company: '',
  role: '',
  location: '',
  status: 'applied',
  salary: '',
  appliedDate: new Date().toISOString().slice(0, 10),
  deadline: '',
  notes: '',
  url: '',
  jobDescription: '',
};

function StatusBadge({ status }: { status: JobStatus }) {
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

function JobCard({
  job,
  onEdit,
  onDelete,
  onStatusChange,
}: {
  job: JobApplication;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: JobStatus) => void;
}) {
  const [showStatusMenu, setShowStatusMenu] = useState(false);

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
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={onEdit}
            className="w-6 h-6 rounded-md flex items-center justify-center transition-colors"
            style={{ background: 'var(--color-muted)' }}
          >
            <Pencil size={11} style={{ color: 'var(--color-muted-foreground)' }} />
          </button>
          <button
            onClick={onDelete}
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
          <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
            <MapPin size={10} />
            {job.location}
          </div>
        )}
        {job.salary && (
          <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
            <DollarSign size={10} />
            {job.salary}
          </div>
        )}
        {job.appliedDate && (
          <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
            <Calendar size={10} />
            {new Date(job.appliedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </div>
        )}
      </div>

      {job.notes && (
        <p className="text-xs line-clamp-2 mb-3" style={{ color: 'var(--color-muted-foreground)' }}>
          {job.notes}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="relative">
          <button
            onClick={() => setShowStatusMenu((v) => !v)}
            className="flex items-center gap-1"
          >
            <StatusBadge status={job.status} />
            <ChevronDown size={10} style={{ color: 'var(--color-muted-foreground)' }} />
          </button>
          {showStatusMenu && (
            <div
              className="absolute left-0 bottom-full mb-1 rounded-xl py-1 z-10 min-w-36"
              style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
            >
              {COLUMNS.map((s) => (
                <button
                  key={s}
                  onClick={() => { onStatusChange(s); setShowStatusMenu(false); }}
                  className="w-full text-left px-3 py-2 text-xs transition-colors"
                  style={{
                    color: s === job.status ? 'var(--color-primary)' : 'var(--color-foreground)',
                    background: s === job.status ? 'rgba(163,230,53,0.08)' : 'transparent',
                  }}
                >
                  {JOB_STATUS_META[s].label}
                </button>
              ))}
            </div>
          )}
        </div>
        {job.url && (
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-opacity"
            style={{ color: 'var(--color-muted-foreground)' }}
          >
            <ExternalLink size={13} />
          </a>
        )}
      </div>
    </div>
  );
}

function JobModal({
  job,
  onSave,
  onClose,
}: {
  job: Partial<JobApplication> & { status: JobStatus };
  onSave: (j: JobApplication) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Omit<JobApplication, 'id'>>({
    ...EMPTY_JOB,
    ...job,
  });

  const update = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (!form.company.trim() || !form.role.trim()) return;
    onSave({ id: (job as JobApplication).id ?? uid(), ...form });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden"
        style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}
      >
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid var(--color-border)' }}
        >
          <h2 className="font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-foreground)' }}>
            {(job as JobApplication).id ? 'Edit Application' : 'Add Application'}
          </h2>
          <button onClick={onClose}>
            <X size={20} style={{ color: 'var(--color-muted-foreground)' }} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[70vh] space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--color-secondary-foreground)' }}>Company *</label>
              <input
                type="text"
                value={form.company}
                onChange={(e) => update('company', e.target.value)}
                className="w-full text-sm px-3 py-2.5 rounded-lg outline-none"
                style={{ background: 'var(--color-muted)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}
                placeholder="e.g. Google"
              />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--color-secondary-foreground)' }}>Role *</label>
              <input
                type="text"
                value={form.role}
                onChange={(e) => update('role', e.target.value)}
                className="w-full text-sm px-3 py-2.5 rounded-lg outline-none"
                style={{ background: 'var(--color-muted)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}
                placeholder="e.g. Software Engineer"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--color-secondary-foreground)' }}>Location</label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => update('location', e.target.value)}
                className="w-full text-sm px-3 py-2.5 rounded-lg outline-none"
                style={{ background: 'var(--color-muted)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}
                placeholder="e.g. Remote"
              />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--color-secondary-foreground)' }}>Salary Range</label>
              <input
                type="text"
                value={form.salary}
                onChange={(e) => update('salary', e.target.value)}
                className="w-full text-sm px-3 py-2.5 rounded-lg outline-none"
                style={{ background: 'var(--color-muted)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}
                placeholder="e.g. $120k–$160k"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--color-secondary-foreground)' }}>Applied Date</label>
              <input
                type="date"
                value={form.appliedDate}
                onChange={(e) => update('appliedDate', e.target.value)}
                className="w-full text-sm px-3 py-2.5 rounded-lg outline-none"
                style={{ background: 'var(--color-muted)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}
              />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--color-secondary-foreground)' }}>Deadline</label>
              <input
                type="date"
                value={form.deadline}
                onChange={(e) => update('deadline', e.target.value)}
                className="w-full text-sm px-3 py-2.5 rounded-lg outline-none"
                style={{ background: 'var(--color-muted)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}
              />
            </div>
          </div>

          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--color-secondary-foreground)' }}>Status</label>
            <div className="grid grid-cols-3 gap-2">
              {COLUMNS.map((s) => {
                const meta = JOB_STATUS_META[s];
                return (
                  <button
                    key={s}
                    onClick={() => update('status', s)}
                    className="px-3 py-2 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: form.status === s ? meta.bg : 'var(--color-muted)',
                      border: form.status === s ? `1px solid ${meta.border}` : '1px solid var(--color-border)',
                      color: form.status === s ? meta.color : 'var(--color-muted-foreground)',
                    }}
                  >
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--color-secondary-foreground)' }}>Job URL</label>
            <input
              type="url"
              value={form.url}
              onChange={(e) => update('url', e.target.value)}
              className="w-full text-sm px-3 py-2.5 rounded-lg outline-none"
              style={{ background: 'var(--color-muted)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--color-secondary-foreground)' }}>Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              rows={3}
              className="w-full text-sm px-3 py-2.5 rounded-lg outline-none resize-none"
              style={{ background: 'var(--color-muted)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}
              placeholder="Recruiter contact, interview notes, anything relevant..."
            />
          </div>
        </div>

        <div
          className="flex items-center justify-end gap-3 px-6 py-4"
          style={{ borderTop: '1px solid var(--color-border)' }}
        >
          <button
            onClick={onClose}
            className="text-sm px-4 py-2 rounded-lg"
            style={{ color: 'var(--color-muted-foreground)', background: 'var(--color-muted)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!form.company.trim() || !form.role.trim()}
            className="text-sm px-5 py-2 rounded-lg font-semibold"
            style={{
              background: form.company.trim() && form.role.trim() ? 'var(--color-primary)' : 'var(--color-muted)',
              color: form.company.trim() && form.role.trim() ? 'white' : 'var(--color-muted-foreground)',
            }}
          >
            Save Application
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Tracker() {
  const [jobs, setJobs] = useState<JobApplication[]>([]);
  const [error, setError] = useState('');
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; job: Partial<JobApplication> & { status: JobStatus } } | null>(null);

  useEffect(() => {
    getJobs().then(setJobs).catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : 'Could not load saved applications.');
    }).finally(() => setLoadingJobs(false));
  }, []);

  const openAdd = (status: JobStatus = 'applied') =>
    setModal({ open: true, job: { status } });

  const openEdit = (job: JobApplication) =>
    setModal({ open: true, job });

  const handleSave = async (job: JobApplication) => {
    setError('');
    try {
      const saved = jobs.some((existing) => existing.id === job.id)
        ? await updateJob(job.id, job)
        : await createJob(job);
      setJobs((prev) => {
        const exists = prev.some((item) => item.id === saved.id);
        return exists ? prev.map((item) => item.id === saved.id ? saved : item) : [...prev, saved];
      });
      setModal(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save the application.');
    }
  };

  const handleDelete = async (id: string) => {
    setError('');
    try {
      await deleteJob(id);
      setJobs((prev) => prev.filter((job) => job.id !== id));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete the application.');
    }
  };

  const handleStatusChange = async (id: string, status: JobStatus) => {
    try {
      const updated = await updateJob(id, { status });
      setJobs((prev) => prev.map((job) => job.id === id ? updated : job));
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Could not update the application.');
    }
  };

  const stats = {
    total: jobs.length,
    active: jobs.filter((j) => !['rejected', 'bookmarked'].includes(j.status)).length,
    interviews: jobs.filter((j) => j.status === 'interview').length,
    offers: jobs.filter((j) => j.status === 'offer').length,
  };

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--color-background)' }}>
      {error && <div role="alert" className="mx-6 mt-4 rounded-lg px-3 py-2 text-sm" style={{ color: '#F87171', background: 'rgba(248,113,113,0.08)' }}>{error}</div>}
      {loadingJobs && <div className="px-6 py-3 text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Loading saved applications…</div>}
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4 shrink-0"
        style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-card)' }}
      >
        <div>
          <h1 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--color-foreground)' }}>
            Job Tracker
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-muted-foreground)' }}>
            {stats.active} active · {stats.interviews} in interview · {stats.offers} offer{stats.offers !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4">
          {[
            { label: 'Total', value: stats.total },
            { label: 'Active', value: stats.active },
            { label: 'Interviews', value: stats.interviews },
            { label: 'Offers', value: stats.offers, accent: true },
          ].map(({ label, value, accent }) => (
            <div key={label} className="text-right">
              <div
                className="text-xl font-bold"
                style={{ fontFamily: 'var(--font-display)', color: accent ? 'var(--color-accent)' : 'var(--color-foreground)' }}
              >
                {value}
              </div>
              <div className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{label}</div>
            </div>
          ))}
          <button
            onClick={() => openAdd()}
            className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl font-semibold ml-2"
            style={{ background: 'linear-gradient(135deg, #84CC16, #A3E635)', color: 'var(--color-primary-foreground)', boxShadow: '0 2px 12px rgba(163,230,53,0.25)' }}
          >
            <Plus size={16} />
            Add Job
          </button>
        </div>
      </div>

      {/* Kanban board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex h-full gap-0" style={{ minWidth: COLUMNS.length * 280 }}>
          {COLUMNS.map((status, colIndex) => {
            const meta = JOB_STATUS_META[status];
            const colJobs = jobs.filter((j) => j.status === status);
            return (
              <div
                key={status}
                className="flex flex-col h-full"
                style={{
                  width: 280,
                  minWidth: 280,
                  borderRight: colIndex < COLUMNS.length - 1 ? '1px solid var(--color-border)' : 'none',
                }}
              >
                {/* Column header */}
                <div
                  className="flex items-center justify-between px-4 py-3 shrink-0"
                  style={{ borderBottom: '1px solid var(--color-border)' }}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: meta.color }} />
                    <span className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-foreground)' }}>
                      {meta.label}
                    </span>
                    <span
                      className="text-xs px-1.5 py-0.5 rounded-full"
                      style={{ background: meta.bg, color: meta.color }}
                    >
                      {colJobs.length}
                    </span>
                  </div>
                  <button
                    onClick={() => openAdd(status)}
                    className="w-6 h-6 rounded-md flex items-center justify-center transition-colors"
                    style={{ background: 'var(--color-muted)' }}
                    title="Add to this column"
                  >
                    <Plus size={13} style={{ color: 'var(--color-muted-foreground)' }} />
                  </button>
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {colJobs.length === 0 ? (
                    <div
                      className="flex flex-col items-center justify-center py-8 rounded-xl text-center cursor-pointer transition-all"
                      style={{ border: '1px dashed var(--color-border)' }}
                      onClick={() => openAdd(status)}
                    >
                      <Briefcase size={20} style={{ color: 'var(--color-muted-foreground)', marginBottom: 8 }} />
                      <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                        No applications
                      </p>
                      <p className="text-xs mt-1" style={{ color: 'var(--color-primary)', opacity: 0.8 }}>
                        + Add one
                      </p>
                    </div>
                  ) : (
                    colJobs.map((job) => (
                      <JobCard
                        key={job.id}
                        job={job}
                        onEdit={() => openEdit(job)}
                        onDelete={() => handleDelete(job.id)}
                        onStatusChange={(s) => handleStatusChange(job.id, s)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <JobModal
          job={modal.job}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
