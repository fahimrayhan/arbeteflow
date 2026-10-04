import {
  Bookmark,
  Briefcase,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  MapPin,
  Sparkles,
  Zap,
} from 'lucide-react';
import { safeExternalUrl } from '../../lib/url';
import type { JobMarketMatch } from '../../lib/types';
import { cardStyle } from '../ui/styles';

interface JobResultCardProps {
  match: JobMarketMatch;
  isSaved: boolean;
  isSaving: boolean;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onSave: () => void;
  onDraftCoverLetter: () => void;
  onPracticeInterview: () => void;
}

/** "Posted today", "Posted 3 days ago", … — empty when the date is unknown. */
function formatPosted(iso: string | undefined): string {
  if (!iso) return '';

  const published = new Date(iso).getTime();
  if (Number.isNaN(published)) return '';

  const days = Math.floor((Date.now() - published) / 86_400_000);
  if (days <= 0) return 'Posted today';
  if (days === 1) return 'Posted yesterday';
  if (days < 60) return `Posted ${days} days ago`;
  return `Posted ${new Date(published).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`;
}

function ScoreBadge({ score }: { score: number }) {
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

const neutralButtonStyle = {
  background: 'var(--color-muted)',
  color: 'var(--color-foreground)',
  border: '1px solid var(--color-border)',
};

export function JobResultCard({
  match,
  isSaved,
  isSaving,
  isExpanded,
  onToggleExpanded,
  onSave,
  onDraftCoverLetter,
  onPracticeInterview,
}: JobResultCardProps) {
  const { metadata } = match;
  const applyUrl = safeExternalUrl(metadata.url);
  const postedLabel = formatPosted(metadata.published_at);
  // The indexed document is "Title/Company/Location/Description" lines; show just the description.
  const descriptionStart = match.document.indexOf('Description: ');
  const fullDescription =
    descriptionStart >= 0 ? match.document.slice(descriptionStart + 'Description: '.length) : match.document;

  return (
    <div className="rounded-xl p-5 transition-all group" style={cardStyle}>
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="space-y-1 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-bold truncate" style={{ color: 'var(--color-foreground)' }}>
              {metadata.title || 'Untitled Job'}
            </h3>
            <ScoreBadge score={match.similarity_score} />
          </div>

          <div
            className="flex items-center gap-3 text-xs flex-wrap"
            style={{ color: 'var(--color-secondary-foreground)' }}
          >
            <span className="font-medium flex items-center gap-1" style={{ color: 'var(--color-primary)' }}>
              <Briefcase size={12} />
              {metadata.company || 'Unknown Employer'}
            </span>

            {metadata.location && (
              <span className="flex items-center gap-1" style={{ color: 'var(--color-muted-foreground)' }}>
                <MapPin size={12} />
                {metadata.location}
              </span>
            )}

            <span className="text-[11px] opacity-60">
              Source: Arbetsförmedlingen
              {postedLabel && ` · ${postedLabel}`}
            </span>
          </div>
        </div>

        {/* Actions Bar */}
        <div className="flex items-center gap-2 shrink-0 pt-1 sm:pt-0">
          <button
            type="button"
            onClick={onSave}
            disabled={isSaved || isSaving}
            className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all disabled:opacity-80"
            style={
              isSaved
                ? {
                    background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)',
                    color: 'var(--color-accent)',
                    border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)',
                  }
                : neutralButtonStyle
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

          {applyUrl && (
            <a
              href={applyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
              style={neutralButtonStyle}
            >
              <span>Apply</span>
              <ExternalLink size={11} />
            </a>
          )}
        </div>
      </div>

      {/* Description Snippet */}
      <div className="mt-3 text-xs leading-relaxed" style={{ color: 'var(--color-muted-foreground)' }}>
        <p className={isExpanded ? 'whitespace-pre-line' : 'line-clamp-3'}>
          {isExpanded ? fullDescription : metadata.description_snippet || fullDescription}
        </p>

        <button
          type="button"
          onClick={onToggleExpanded}
          aria-expanded={isExpanded}
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
          <Zap size={11} style={{ color: 'var(--warning-text)' }} />
          Speed up your preparation:
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onDraftCoverLetter}
            className="px-2.5 py-1 rounded-md transition-colors hover:text-[var(--color-primary)]"
            style={{ border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}
          >
            Draft Cover Letter
          </button>

          <button
            type="button"
            onClick={onPracticeInterview}
            className="px-2.5 py-1 rounded-md transition-colors hover:text-[var(--color-primary)]"
            style={{ border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}
          >
            Practice AI Interview
          </button>
        </div>
      </div>
    </div>
  );
}
