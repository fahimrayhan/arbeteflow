import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Bookmark,
  Briefcase,
  Check,
  ChevronDown,
  ChevronUp,
  Compass,
  ExternalLink,
  FileText,
  MapPin,
  RefreshCw,
  Search,
  Sparkles,
  Zap,
} from 'lucide-react';
import {
  createJob,
  getJobMarketHealth,
  getPrimaryResume,
  recommendJobMarket,
  searchJobMarket,
  syncJobMarket,
} from '../lib/api';
import type { ApiResume, JobMarketMatch, View } from '../lib/types';

interface JobFinderProps {
  onNavigate?: (view: View) => void;
  onSelectJobForCoverLetter?: (job: { company: string; role: string; description: string }) => void;
  onSelectJobForInterview?: (job: { company: string; role: string; description: string }) => void;
}

const QUICK_TAGS = [
  'Fullstack Utvecklare',
  'Frontend React',
  'Backend Python',
  'Data Scientist',
  'DevOps Cloud',
  'Software Engineer Stockholm',
  'Systemutvecklare',
];

export default function JobFinder({
  onNavigate,
  onSelectJobForCoverLetter,
  onSelectJobForInterview,
}: JobFinderProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [matchingResume, setMatchingResume] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<JobMarketMatch[]>([]);
  const [activeQueryTitle, setActiveQueryTitle] = useState('');
  const [savedJobIds, setSavedJobIds] = useState<Record<string, boolean>>({});
  const [savingJobId, setSavingJobId] = useState<string | null>(null);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);

  // Health and CV state
  const [serviceHealth, setServiceHealth] = useState<{
    available: boolean;
    total_jobs_indexed?: number;
    model?: string;
    error?: string;
  } | null>(null);
  const [primaryResume, setPrimaryResume] = useState<ApiResume | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  useEffect(() => {
    async function init() {
      try {
        const [health, resume] = await Promise.allSettled([
          getJobMarketHealth(),
          getPrimaryResume(),
        ]);

        if (health.status === 'fulfilled') {
          setServiceHealth(health.value);
        } else {
          setServiceHealth({ available: false, error: 'Vector service offline' });
        }

        if (resume.status === 'fulfilled') {
          setPrimaryResume(resume.value);
        }
      } finally {
        setLoadingInitial(false);
      }
    }

    void init();
  }, []);

  async function handleSearch(term?: string) {
    const searchTerm = (term ?? query).trim();
    if (!searchTerm || loading) return;

    setError('');
    setLoading(true);
    setActiveQueryTitle(`Results for "${searchTerm}"`);

    try {
      const response = await searchJobMarket(searchTerm, 15);
      setResults(response.jobs);
      if (response.jobs.length === 0) {
        setError(`No jobs found for "${searchTerm}". Try a different keyword or sync more listings.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Job search failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleMatchWithResume() {
    if (matchingResume) return;

    setError('');
    setMatchingResume(true);
    setActiveQueryTitle('Semantic Matches based on your Saved Resume');

    try {
      const response = await recommendJobMarket({ limit: 15 });
      setResults(response.jobs);
      if (response.jobs.length === 0) {
        setError('No direct semantic matches found. Try broadening your CV skills or syncing listings.');
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not recommend jobs. Ensure you have saved a resume in the Resume tab.'
      );
    } finally {
      setMatchingResume(false);
    }
  }

  async function handleSaveToTracker(job: JobMarketMatch) {
    const jobId = job.metadata.id || job.metadata.url;
    setSavingJobId(jobId);

    try {
      await createJob({
        company: job.metadata.company || 'Unknown Employer',
        role: job.metadata.title || 'Untitled Position',
        location: job.metadata.location || 'Sweden',
        status: 'bookmarked',
        salary: '',
        appliedDate: new Date().toISOString().slice(0, 10),
        deadline: '',
        notes: `Matched via Job Finder (${job.similarity_score}% semantic score). Source: Arbetsförmedlingen Platsbanken.`,
        url: job.metadata.url,
        jobDescription: job.document,
      });

      setSavedJobIds((prev) => ({ ...prev, [jobId]: true }));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save job to tracker.');
    } finally {
      setSavingJobId(null);
    }
  }

  async function handleTriggerSync() {
    setSyncing(true);
    setSyncMessage('');
    try {
      const res = await syncJobMarket(undefined, 30);
      setSyncMessage(res.message || 'Job listings synchronization started.');
      setTimeout(async () => {
        const health = await getJobMarketHealth().catch(() => null);
        if (health) setServiceHealth(health);
        setSyncing(false);
      }, 3000);
    } catch (err) {
      setSyncMessage(err instanceof Error ? err.message : 'Sync failed to start.');
      setSyncing(false);
    }
  }

  function getScoreBadge(score: number) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
        style={{
          background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
          color: 'var(--color-primary)',
          border: '1px solid color-mix(in srgb, var(--color-primary) 28%, transparent)',
        }}
      >
        <Sparkles size={11} />
        {score}% Match
      </span>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top Header & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <div>
          <h1
            className="text-2xl font-bold tracking-tight flex items-center gap-2.5"
            style={{ color: 'var(--color-foreground)' }}
          >
            <Compass style={{ color: 'var(--color-primary)' }} size={26} />
            Job Finder & Semantic Matcher
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-muted-foreground)' }}>
            Discover Swedish job market opportunities from Arbetsförmedlingen matched to your CV profile
          </p>
        </div>

        {/* Vector Engine Health Indicator */}
        <div className="flex items-center gap-2">
          {serviceHealth?.available ? (
            <div
              className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg"
              style={{
                background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)',
                color: 'var(--color-accent)',
                border: '1px solid color-mix(in srgb, var(--color-accent) 25%, transparent)',
              }}
            >
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--color-accent)' }} />
              <span>
                Vector Engine Online ({serviceHealth.total_jobs_indexed ?? 0} jobs indexed)
              </span>
            </div>
          ) : (
            <div
              className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg"
              style={{
                background: 'color-mix(in srgb, var(--color-destructive) 10%, transparent)',
                color: 'var(--color-destructive)',
                border: '1px solid color-mix(in srgb, var(--color-destructive) 25%, transparent)',
              }}
            >
              <AlertCircle size={13} />
              <span>Vector Engine Disconnected</span>
            </div>
          )}

          <button
            onClick={handleTriggerSync}
            disabled={syncing}
            title="Sync latest job postings from Arbetsförmedlingen"
            className="p-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-all disabled:opacity-50"
            style={{
              background: 'var(--color-muted)',
              color: 'var(--color-foreground)',
              border: '1px solid var(--color-border)',
            }}
          >
            <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
            <span className="hidden md:inline">Sync Ads</span>
          </button>
        </div>
      </div>

      {syncMessage && (
        <div
          className="text-xs p-3 rounded-lg flex items-center justify-between"
          style={{
            background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
            color: 'var(--color-primary)',
            border: '1px solid color-mix(in srgb, var(--color-primary) 25%, transparent)',
          }}
        >
          <span>{syncMessage}</span>
          <button onClick={() => setSyncMessage('')} className="underline text-xs">
            Dismiss
          </button>
        </div>
      )}

      {/* AI Resume Match Hero Card */}
      <div
        className="rounded-xl p-5 relative overflow-hidden"
        style={{
          background: 'var(--color-card)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1 max-w-xl">
            <div className="flex items-center gap-2">
              <span
                className="px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider"
                style={{
                  background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
                  color: 'var(--color-primary)',
                }}
              >
                1-Click Semantic Match
              </span>
              {primaryResume ? (
                <span className="text-xs flex items-center gap-1" style={{ color: 'var(--color-accent)' }}>
                  <Check size={12} /> Using Saved Resume: <strong>{primaryResume.title}</strong>
                </span>
              ) : (
                <span className="text-xs text-amber-500 dark:text-amber-400">
                  No primary resume saved yet
                </span>
              )}
            </div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--color-foreground)' }}>
              Find Jobs Tailored to Your Profile
            </h2>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-muted-foreground)' }}>
              Matches your skills, experience, and background directly against live Swedish job listings using dense vector embeddings.
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            {primaryResume ? (
              <button
                onClick={handleMatchWithResume}
                disabled={matchingResume || loading}
                className="px-4 py-2.5 rounded-xl font-medium text-xs flex items-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-50"
                style={{
                  background: 'var(--color-primary)',
                  color: 'var(--color-primary-foreground)',
                }}
              >
                <Sparkles size={14} className={matchingResume ? 'animate-spin' : ''} />
                {matchingResume ? 'Computing Vector Matches...' : 'Match My Saved Resume'}
              </button>
            ) : (
              <button
                onClick={() => onNavigate?.('resume')}
                className="px-4 py-2.5 rounded-lg font-medium text-xs flex items-center gap-2 transition-all"
                style={{
                  background: 'var(--color-muted)',
                  color: 'var(--color-primary)',
                  border: '1px solid color-mix(in srgb, var(--color-primary) 35%, var(--color-border))',
                }}
              >
                <FileText size={14} />
                Go to Resume Tab to Save CV First
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Manual Search & Quick Tags */}
      <div className="space-y-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSearch();
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--color-muted-foreground)' }}
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by role, skills, tech stack (e.g. Senior Frontend, Rust, Göteborg, Solna)..."
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg transition-all focus:outline-none focus:ring-1 focus:ring-[var(--color-ring)]"
              style={{
                background: 'var(--color-muted)',
                color: 'var(--color-foreground)',
                border: '1px solid var(--color-border)',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all disabled:opacity-50"
            style={{
              background: 'var(--color-primary)',
              color: 'var(--color-primary-foreground)',
            }}
          >
            <Search size={14} />
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>

        {/* Quick Tag suggestions */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] font-medium mr-1" style={{ color: 'var(--color-muted-foreground)' }}>
            Suggested:
          </span>
          {QUICK_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => {
                setQuery(tag);
                void handleSearch(tag);
              }}
              className="text-xs px-2.5 py-1 rounded-lg transition-colors"
              style={{
                background: 'var(--color-muted)',
                color: 'var(--color-muted-foreground)',
                border: '1px solid var(--color-border)',
              }}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div
          className="p-4 rounded-xl flex items-start gap-3 text-xs"
          style={{
            background: 'color-mix(in srgb, var(--color-destructive) 10%, transparent)',
            color: 'var(--color-destructive)',
            border: '1px solid color-mix(in srgb, var(--color-destructive) 25%, transparent)',
          }}
        >
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Search Notice</p>
            <p className="mt-0.5 text-xs opacity-90">{error}</p>
          </div>
        </div>
      )}

      {/* Results Header */}
      {activeQueryTitle && !loading && !matchingResume && (
        <div className="flex items-center justify-between text-xs pt-2">
          <span className="font-medium" style={{ color: 'var(--color-foreground)' }}>
            {activeQueryTitle}
          </span>
          <span style={{ color: 'var(--color-muted-foreground)' }}>
            {results.length} listings found
          </span>
        </div>
      )}

      {/* Loading Skeleton */}
      {(loading || matchingResume) && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-5 rounded-xl animate-pulse space-y-3"
              style={{
                background: 'var(--color-card)',
                border: '1px solid var(--color-border)',
              }}
            >
              <div className="h-5 w-1/3 rounded" style={{ background: 'var(--color-muted)' }} />
              <div className="h-4 w-1/4 rounded" style={{ background: 'var(--color-muted)' }} />
              <div className="h-12 w-full rounded" style={{ background: 'var(--color-muted)' }} />
            </div>
          ))}
        </div>
      )}

      {/* Results List */}
      {!loading && !matchingResume && results.length > 0 && (
        <div className="space-y-4">
          {results.map((match, idx) => {
            const jobId = match.metadata.id || `${match.metadata.title}-${idx}`;
            const isSaved = Boolean(savedJobIds[jobId]);
            const isSaving = savingJobId === jobId;
            const isExpanded = expandedJobId === jobId;

            return (
              <div
                key={jobId}
                className="rounded-xl p-5 transition-all group"
                style={{
                  background: 'var(--color-card)',
                  border: '1px solid var(--color-border)',
                }}
              >
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3
                        className="text-base font-bold truncate"
                        style={{ color: 'var(--color-foreground)' }}
                      >
                        {match.metadata.title || 'Untitled Job'}
                      </h3>
                      {getScoreBadge(match.similarity_score)}
                    </div>

                    <div className="flex items-center gap-3 text-xs flex-wrap" style={{ color: 'var(--color-secondary-foreground)' }}>
                      <span className="font-medium flex items-center gap-1" style={{ color: 'var(--color-primary)' }}>
                        <Briefcase size={12} />
                        {match.metadata.company || 'Unknown Employer'}
                      </span>

                      {match.metadata.location && (
                        <span className="flex items-center gap-1" style={{ color: 'var(--color-muted-foreground)' }}>
                          <MapPin size={12} />
                          {match.metadata.location}
                        </span>
                      )}

                      <span className="text-[11px] opacity-60">
                        Source: Arbetsförmedlingen
                      </span>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center gap-2 shrink-0 pt-1 sm:pt-0">
                    <button
                      onClick={() => handleSaveToTracker(match)}
                      disabled={isSaved || isSaving}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all disabled:opacity-80"
                      style={
                        isSaved
                          ? {
                              background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)',
                              color: 'var(--color-accent)',
                              border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)',
                            }
                          : {
                              background: 'var(--color-muted)',
                              color: 'var(--color-foreground)',
                              border: '1px solid var(--color-border)',
                            }
                      }
                      title="Save this job to your Arbeteflow Kanban tracker"
                    >
                      {isSaved ? (
                        <>
                          <Check size={13} />
                          <span>Tracked</span>
                        </>
                      ) : isSaving ? (
                        <span>Saving...</span>
                      ) : (
                        <>
                          <Bookmark size={13} />
                          <span>Track Job</span>
                        </>
                      )}
                    </button>

                    {match.metadata.url && (
                      <a
                        href={match.metadata.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                        style={{
                          background: 'var(--color-muted)',
                          color: 'var(--color-foreground)',
                          border: '1px solid var(--color-border)',
                        }}
                      >
                        <span>Apply</span>
                        <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                </div>

                {/* Description Snippet */}
                <div className="mt-3 text-xs leading-relaxed" style={{ color: 'var(--color-muted-foreground)' }}>
                  <p className={isExpanded ? '' : 'line-clamp-3'}>
                    {match.metadata.description_snippet || match.document}
                  </p>

                  <button
                    onClick={() => setExpandedJobId(isExpanded ? null : jobId)}
                    className="mt-1.5 text-xs hover:underline flex items-center gap-1"
                    style={{ color: 'var(--color-primary)' }}
                  >
                    {isExpanded ? (
                      <>
                        <span>Show less</span>
                        <ChevronUp size={12} />
                      </>
                    ) : (
                      <>
                        <span>Read full posting details</span>
                        <ChevronDown size={12} />
                      </>
                    )}
                  </button>
                </div>

                {/* Cross-feature shortcuts: Cover letter & Interview */}
                <div
                  className="mt-4 pt-3 flex flex-wrap items-center justify-between gap-2 text-[11px]"
                  style={{ color: 'var(--color-muted-foreground)', borderTop: '1px solid var(--color-border)' }}
                >
                  <span className="flex items-center gap-1">
                    <Zap size={11} className="text-amber-400" />
                    Speed up your preparation:
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        onSelectJobForCoverLetter?.({
                          company: match.metadata.company,
                          role: match.metadata.title,
                          description: match.document,
                        });
                        onNavigate?.('coverletter');
                      }}
                      className="px-2.5 py-1 rounded-md transition-colors hover:text-[var(--color-primary)]"
                      style={{ border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}
                    >
                      Draft Cover Letter
                    </button>

                    <button
                      onClick={() => {
                        onSelectJobForInterview?.({
                          company: match.metadata.company,
                          role: match.metadata.title,
                          description: match.document,
                        });
                        onNavigate?.('interview');
                      }}
                      className="px-2.5 py-1 rounded-md transition-colors hover:text-[var(--color-primary)]"
                      style={{ border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}
                    >
                      Practice AI Interview
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Initial Empty State */}
      {!loading && !matchingResume && results.length === 0 && !error && (
        <div
          className="text-center py-16 px-4 rounded-xl space-y-4"
          style={{
            background: 'var(--color-card)',
            border: '1px dashed var(--color-border)',
          }}
        >
          <div
            className="w-12 h-12 rounded-xl mx-auto flex items-center justify-center"
            style={{
              background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
              color: 'var(--color-primary)',
            }}
          >
            <Compass size={24} />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold" style={{ color: 'var(--color-foreground)' }}>
              Ready to Explore Swedish Tech Positions
            </h3>
            <p className="text-xs max-w-md mx-auto" style={{ color: 'var(--color-muted-foreground)' }}>
              Type a search query above, pick a suggested tag, or use{' '}
              <strong>"Match My Saved Resume"</strong> to rank listings by semantic relevance.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}