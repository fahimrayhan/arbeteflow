import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, Compass, FileText, MapPin, RefreshCw, Search, Sparkles } from 'lucide-react';
import { useApp } from '../app/AppContext';
import { JobResultCard } from '../components/finder/JobResultCard';
import { cardStyle } from '../components/ui/styles';
import { usePrimaryResume } from '../hooks/usePrimaryResume';
import {
  createJob,
  getJobMarketHealth,
  recommendJobMarket,
  searchJobMarket,
  syncJobMarket,
} from '../lib/api';
import { getErrorMessage } from '../lib/errors';
import { safeExternalUrl } from '../lib/url';
import type { JobDraft, JobMarketHealth, JobMarketMatch, JobSearchFilters, View } from '../lib/types';

const QUICK_TAGS = [
  'Fullstack Utvecklare',
  'Frontend React',
  'Backend Python',
  'Data Scientist',
  'DevOps Cloud',
  'Software Engineer Stockholm',
  'Systemutvecklare',
];

const RECENCY_OPTIONS: Array<{ label: string; days: number | undefined }> = [
  { label: 'Any date', days: undefined },
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 14 days', days: 14 },
  { label: 'Last 30 days', days: 30 },
];

const RESULT_LIMIT = 15;
/** A full sync covers every sector and takes minutes: poll its progress until it finishes. */
const SYNC_POLL_INTERVAL_MS = 4000;
const SYNC_POLL_MAX_ATTEMPTS = 150;

function jobKey(match: JobMarketMatch, index: number): string {
  return match.metadata.id || match.metadata.url || `${match.metadata.title}-${index}`;
}

function toJobDraft(match: JobMarketMatch): JobDraft {
  return {
    company: match.metadata.company ?? '',
    role: match.metadata.title ?? '',
    description: match.document,
  };
}

export default function JobFinder() {
  const { navigate, openWithJob } = useApp();

  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [maxAgeDays, setMaxAgeDays] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [matchingResume, setMatchingResume] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<JobMarketMatch[]>([]);
  const [activeQueryTitle, setActiveQueryTitle] = useState('');
  const [savedJobIds, setSavedJobIds] = useState<Record<string, boolean>>({});
  const [savingJobId, setSavingJobId] = useState<string | null>(null);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);

  const [serviceHealth, setServiceHealth] = useState<JobMarketHealth | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const syncTimerRef = useRef<number | undefined>(undefined);

  const { resume: primaryResume } = usePrimaryResume();

  useEffect(() => {
    let active = true;

    getJobMarketHealth()
      .then((health) => active && setServiceHealth(health))
      .catch(() => active && setServiceHealth({ available: false, error: 'Vector service offline' }));

    return () => {
      active = false;
      window.clearTimeout(syncTimerRef.current);
    };
  }, []);

  const isSearching = loading || matchingResume;
  const filters: JobSearchFilters = { location: location.trim() || undefined, maxAgeDays };
  const hasFilters = Boolean(filters.location || filters.maxAgeDays);
  const filterNote = hasFilters ? ' with your filters' : '';

  async function runQuery(title: string, fetchResults: () => Promise<{ jobs: JobMarketMatch[] }>, emptyMessage: string, failureMessage: string) {
    setError('');
    setActiveQueryTitle(title);
    setExpandedJobId(null);

    try {
      const response = await fetchResults();
      setResults(response.jobs);
      if (response.jobs.length === 0) {
        setError(emptyMessage);
      }
    } catch (queryError) {
      setError(getErrorMessage(queryError, failureMessage));
    }
  }

  async function handleSearch(term?: string) {
    const searchTerm = (term ?? query).trim();
    if (!searchTerm || isSearching) return;

    setLoading(true);
    await runQuery(
      `Results for "${searchTerm}"`,
      () => searchJobMarket(searchTerm, RESULT_LIMIT, filters),
      `No jobs found for "${searchTerm}"${filterNote}. Try a different keyword${hasFilters ? ', loosen the filters' : ''} or sync more listings.`,
      'Job search failed.',
    );
    setLoading(false);
  }

  async function handleMatchWithResume() {
    if (isSearching) return;

    setMatchingResume(true);
    await runQuery(
      'Semantic Matches based on your Saved Resume',
      () => recommendJobMarket({ limit: RESULT_LIMIT, ...filters }),
      `No direct semantic matches found${filterNote}. Try ${hasFilters ? 'loosening the filters, ' : ''}broadening your CV or syncing listings.`,
      'Could not recommend jobs. Ensure you have saved a resume in the Resume tab.',
    );
    setMatchingResume(false);
  }

  async function handleSaveToTracker(job: JobMarketMatch, key: string) {
    setSavingJobId(key);

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
        url: safeExternalUrl(job.metadata.url) ?? '',
        jobDescription: job.document,
      });

      setSavedJobIds((prev) => ({ ...prev, [key]: true }));
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'Failed to save job to tracker.'));
    } finally {
      setSavingJobId(null);
    }
  }

  /** Refresh the "jobs indexed" counter until the background sync reports it has finished. */
  function pollSyncProgress(attempt: number) {
    window.clearTimeout(syncTimerRef.current);
    syncTimerRef.current = window.setTimeout(async () => {
      const health = await getJobMarketHealth().catch(() => null);
      if (health) setServiceHealth(health);

      if (health?.syncing && attempt < SYNC_POLL_MAX_ATTEMPTS) {
        pollSyncProgress(attempt + 1);
      } else {
        setSyncing(false);
        setSyncMessage('Sync finished.');
      }
    }, SYNC_POLL_INTERVAL_MS);
  }

  async function handleTriggerSync() {
    setSyncing(true);
    setSyncMessage('');

    try {
      const response = await syncJobMarket(undefined, 30);
      setSyncMessage(response.message || 'Job listings synchronization started.');
      pollSyncProgress(0);
    } catch (syncError) {
      setSyncMessage(getErrorMessage(syncError, 'Sync failed to start.'));
      setSyncing(false);
    }
  }

  function openJobIn(view: View, match: JobMarketMatch) {
    openWithJob(view, toJobDraft(match));
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
                {serviceHealth.seeding || serviceHealth.syncing
                  ? `Vector Engine Online (${serviceHealth.syncing ? 'syncing' : 'building index'}… ${serviceHealth.total_jobs_indexed ?? 0} jobs)`
                  : `Vector Engine Online (${serviceHealth.total_jobs_indexed ?? 0} jobs indexed)`}
              </span>
            </div>
          ) : (
            <div
              className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg"
              title={serviceHealth?.error}
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
            type="button"
            onClick={() => void handleTriggerSync()}
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
          role="status"
          className="text-xs p-3 rounded-lg flex items-center justify-between"
          style={{
            background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
            color: 'var(--color-primary)',
            border: '1px solid color-mix(in srgb, var(--color-primary) 25%, transparent)',
          }}
        >
          <span>{syncMessage}</span>
          <button type="button" onClick={() => setSyncMessage('')} className="underline text-xs">
            Dismiss
          </button>
        </div>
      )}

      {/* AI Resume Match Hero Card */}
      <div className="rounded-xl p-5 relative overflow-hidden" style={cardStyle}>
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
                <span className="text-xs" style={{ color: 'var(--warning-text)' }}>
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
                type="button"
                onClick={() => void handleMatchWithResume()}
                disabled={isSearching}
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
                type="button"
                onClick={() => navigate('resume')}
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
          onSubmit={(event) => {
            event.preventDefault();
            void handleSearch();
          }}
          className="flex gap-2"
          role="search"
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
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by role, skills, tech stack (e.g. Senior Frontend, Rust, Göteborg, Solna)..."
              aria-label="Search job listings"
              maxLength={1000}
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
            disabled={isSearching || !query.trim()}
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

        {/* Filters (apply to both search and resume matching) */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <MapPin
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--color-muted-foreground)' }}
            />
            <input
              type="text"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Location (e.g. Göteborg)"
              aria-label="Filter by location"
              maxLength={100}
              className="pl-9 pr-3 py-2 text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--color-ring)]"
              style={{
                background: 'var(--color-muted)',
                color: 'var(--color-foreground)',
                border: '1px solid var(--color-border)',
                width: 220,
              }}
            />
          </div>

          <select
            value={maxAgeDays ?? ''}
            onChange={(event) => setMaxAgeDays(event.target.value ? Number(event.target.value) : undefined)}
            aria-label="Filter by posting date"
            className="px-3 py-2 text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--color-ring)]"
            style={{
              background: 'var(--color-muted)',
              color: 'var(--color-foreground)',
              border: '1px solid var(--color-border)',
            }}
          >
            {RECENCY_OPTIONS.map((option) => (
              <option key={option.label} value={option.days ?? ''}>
                {option.label}
              </option>
            ))}
          </select>

          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setLocation('');
                setMaxAgeDays(undefined);
              }}
              className="text-xs underline"
              style={{ color: 'var(--color-muted-foreground)' }}
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Quick Tag suggestions */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] font-medium mr-1" style={{ color: 'var(--color-muted-foreground)' }}>
            Suggested:
          </span>
          {QUICK_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
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
          role="alert"
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
      {activeQueryTitle && !isSearching && (
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
      {isSearching && (
        <div className="space-y-4" aria-busy="true">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-5 rounded-xl animate-pulse space-y-3" style={cardStyle}>
              <div className="h-5 w-1/3 rounded" style={{ background: 'var(--color-muted)' }} />
              <div className="h-4 w-1/4 rounded" style={{ background: 'var(--color-muted)' }} />
              <div className="h-12 w-full rounded" style={{ background: 'var(--color-muted)' }} />
            </div>
          ))}
        </div>
      )}

      {/* Results List */}
      {!isSearching && results.length > 0 && (
        <div className="space-y-4">
          {results.map((match, index) => {
            const key = jobKey(match, index);

            return (
              <JobResultCard
                key={key}
                match={match}
                isSaved={Boolean(savedJobIds[key])}
                isSaving={savingJobId === key}
                isExpanded={expandedJobId === key}
                onToggleExpanded={() => setExpandedJobId(expandedJobId === key ? null : key)}
                onSave={() => void handleSaveToTracker(match, key)}
                onDraftCoverLetter={() => openJobIn('coverletter', match)}
                onPracticeInterview={() => openJobIn('interview', match)}
              />
            );
          })}
        </div>
      )}

      {/* Initial Empty State */}
      {!isSearching && results.length === 0 && !error && (
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
