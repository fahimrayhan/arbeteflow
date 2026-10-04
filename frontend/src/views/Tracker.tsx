import { useCallback, useEffect, useMemo, useState } from 'react';
import { Briefcase, Plus } from 'lucide-react';
import { JobCard } from '../components/tracker/JobCard';
import { JobModal, type JobModalInitial } from '../components/tracker/JobModal';
import { createJob, deleteJob, getJobs, updateJob } from '../lib/api';
import { getErrorMessage } from '../lib/errors';
import { JOB_STATUSES, JOB_STATUS_META } from '../lib/jobStatus';
import type { JobApplication, JobApplicationInput, JobStatus } from '../lib/types';

const COLUMN_WIDTH = 280;

export default function Tracker() {
  const [jobs, setJobs] = useState<JobApplication[]>([]);
  const [error, setError] = useState('');
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [modalJob, setModalJob] = useState<JobModalInitial | null>(null);
  const [savingModal, setSavingModal] = useState(false);

  useEffect(() => {
    let active = true;

    getJobs()
      .then((loaded) => active && setJobs(loaded))
      .catch((loadError: unknown) => {
        if (active) setError(getErrorMessage(loadError, 'Could not load saved applications.'));
      })
      .finally(() => active && setLoadingJobs(false));

    return () => {
      active = false;
    };
  }, []);

  const openAdd = (status: JobStatus = 'applied') => setModalJob({ status });
  const openEdit = (job: JobApplication) => setModalJob(job);
  const closeModal = useCallback(() => setModalJob(null), []);

  const replaceJob = (saved: JobApplication) =>
    setJobs((current) => current.map((item) => (item.id === saved.id ? saved : item)));

  const handleSave = async (input: JobApplicationInput, id?: string) => {
    setError('');
    setSavingModal(true);

    try {
      if (id) {
        replaceJob(await updateJob(id, input));
      } else {
        const created = await createJob(input);
        setJobs((current) => [...current, created]);
      }
      setModalJob(null);
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'Could not save the application.'));
    } finally {
      setSavingModal(false);
    }
  };

  const handleDelete = async (job: JobApplication) => {
    if (!window.confirm(`Delete the ${job.role} application at ${job.company}?`)) {
      return;
    }

    setError('');
    try {
      await deleteJob(job.id);
      setJobs((current) => current.filter((item) => item.id !== job.id));
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, 'Could not delete the application.'));
    }
  };

  const handleStatusChange = async (id: string, status: JobStatus) => {
    setError('');
    try {
      replaceJob(await updateJob(id, { status }));
    } catch (statusError) {
      setError(getErrorMessage(statusError, 'Could not update the application.'));
    }
  };

  const jobsByStatus = useMemo(() => {
    const grouped = Object.fromEntries(
      JOB_STATUSES.map((status) => [status, [] as JobApplication[]]),
    ) as Record<JobStatus, JobApplication[]>;

    for (const job of jobs) {
      grouped[job.status]?.push(job);
    }
    return grouped;
  }, [jobs]);

  const stats = {
    total: jobs.length,
    active: jobs.filter((j) => j.status !== 'rejected' && j.status !== 'bookmarked').length,
    interviews: jobsByStatus.interview.length,
    offers: jobsByStatus.offer.length,
  };

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--color-background)' }}>
      {error && <div role="alert" className="mx-6 mt-4 rounded-lg px-3 py-2 text-sm" style={{ color: 'var(--danger-text)', background: 'var(--danger-bg)' }}>{error}</div>}
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
            type="button"
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
        <div className="flex h-full gap-0" style={{ minWidth: JOB_STATUSES.length * COLUMN_WIDTH }}>
          {JOB_STATUSES.map((status, colIndex) => {
            const meta = JOB_STATUS_META[status];
            const colJobs = jobsByStatus[status];
            return (
              <div
                key={status}
                className="flex flex-col h-full"
                style={{
                  width: COLUMN_WIDTH,
                  minWidth: COLUMN_WIDTH,
                  borderRight: colIndex < JOB_STATUSES.length - 1 ? '1px solid var(--color-border)' : 'none',
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
                    type="button"
                    onClick={() => openAdd(status)}
                    className="w-6 h-6 rounded-md flex items-center justify-center transition-colors"
                    style={{ background: 'var(--color-muted)' }}
                    title="Add to this column"
                    aria-label={`Add application to ${meta.label}`}
                  >
                    <Plus size={13} style={{ color: 'var(--color-muted-foreground)' }} />
                  </button>
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {colJobs.length === 0 ? (
                    <button
                      type="button"
                      className="w-full flex flex-col items-center justify-center py-8 rounded-xl text-center cursor-pointer transition-all"
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
                    </button>
                  ) : (
                    colJobs.map((job) => (
                      <JobCard
                        key={job.id}
                        job={job}
                        onEdit={() => openEdit(job)}
                        onDelete={() => void handleDelete(job)}
                        onStatusChange={(nextStatus) => void handleStatusChange(job.id, nextStatus)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {modalJob && (
        <JobModal
          job={modalJob}
          saving={savingModal}
          onSave={(input, id) => void handleSave(input, id)}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
