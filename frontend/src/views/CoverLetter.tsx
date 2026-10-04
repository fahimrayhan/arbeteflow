import { useEffect, useState } from 'react';
import { ExternalLink, FileText, Globe, RotateCcw, Wand2 } from 'lucide-react';
import { useConsumeJobDraft } from '../app/AppContext';
import { InlineNotice } from '../components/ui/Alert';
import { GeneratedDocumentPanel } from '../components/ui/GeneratedDocumentPanel';
import { OptionCard } from '../components/ui/OptionCard';
import { PageHeader } from '../components/ui/PageHeader';
import { cardStyle, fieldStyle, foregroundText, mutedText, primaryButtonStyle } from '../components/ui/styles';
import { TextField } from '../components/ui/TextField';
import { TypingDots } from '../components/ui/TypingDots';
import { useClipboard } from '../hooks/useClipboard';
import { usePrimaryResume } from '../hooks/usePrimaryResume';
import { getCoverLetterCapabilities, streamCoverLetterGeneration } from '../lib/api';
import { downloadTextFile, slugify } from '../lib/download';
import { getErrorMessage } from '../lib/errors';
import { exportCoverLetterPDF } from '../lib/pdf';
import type { CoverLetterTone, ResearchEvent } from '../lib/types';
import { safeExternalUrl } from '../lib/url';

const TONES: Array<{ id: CoverLetterTone; label: string; description: string }> = [
  {
    id: 'professional',
    label: 'Professional',
    description: 'Polished, concise, and formal',
  },
  {
    id: 'confident',
    label: 'Confident',
    description: 'Direct, energetic, and achievement-led',
  },
  {
    id: 'warm',
    label: 'Warm',
    description: 'Personable, enthusiastic, and collaborative',
  },
];

export default function CoverLetter() {
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [tone, setTone] = useState<CoverLetterTone>('professional');

  const [coverLetter, setCoverLetter] = useState('');
  const [generating, setGenerating] = useState(false);

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Optional web research about the company (server needs TAVILY_API_KEY).
  const [researchAvailable, setResearchAvailable] = useState(false);
  const [researchEnabled, setResearchEnabled] = useState(true);
  const [research, setResearch] = useState<ResearchEvent | null>(null);

  const { copied, copy } = useClipboard();

  useEffect(() => {
    let active = true;

    getCoverLetterCapabilities()
      .then((capabilities) => active && setResearchAvailable(capabilities.companyResearch))
      .catch(() => active && setResearchAvailable(false));

    return () => {
      active = false;
    };
  }, []);

  const {
    resume,
    loading: loadingResume,
    error: loadError,
  } = usePrimaryResume((loaded) => {
    if (loaded?.rawText) {
      setNotice('Using your saved resume as candidate context.');
    }
  });
  const resumeText = resume?.rawText ?? '';

  // Prefill from "Draft Cover Letter" in Job Finder.
  useConsumeJobDraft((jobDraft) => {
    setCompany(jobDraft.company);
    setRole(jobDraft.role);
    setJobDescription(jobDraft.description);
  });

  const exportBaseName = `cover-letter-${slugify(role) || 'role'}-${slugify(company) || 'company'}`;
  const isBusy = generating || loadingResume;

  async function handleGenerate() {
    if (generating) {
      return;
    }

    if (!company.trim()) {
      setError('Enter the company name.');
      return;
    }

    if (!role.trim()) {
      setError('Enter the target role.');
      return;
    }

    const withResearch = researchAvailable && researchEnabled;
    let researchResult: ResearchEvent | null = null;

    setGenerating(true);
    setError('');
    setNotice('');
    setCoverLetter('');
    setResearch(null);

    try {
      await streamCoverLetterGeneration(
        {
          company: company.trim(),
          role: role.trim(),
          jobDescription: jobDescription.trim() || undefined,
          resumeText: resumeText.trim() || undefined,
          tone,
          researchCompany: withResearch,
        },
        (token) => setCoverLetter((current) => current + token),
        (event) => {
          researchResult = event;
          setResearch(event);
          if (event.status === 'searching') setNotice(`Researching ${company.trim()} on the web…`);
          if (event.status === 'used') setNotice('Research done. Writing your letter…');
          if (event.status === 'skipped') setNotice(`Writing without company research: ${event.reason}`);
        },
      );

      const finished = researchResult as ResearchEvent | null;
      setNotice(
        finished?.status === 'used'
          ? `Cover letter generated using ${finished.sources.length} web source(s) about ${company.trim()}. Check any company details against the sources below.`
          : finished?.status === 'skipped'
            ? `Cover letter generated without company research (${finished.reason})`
            : 'Cover letter generated with your configured model.',
      );
    } catch (generationError) {
      setError(getErrorMessage(generationError, 'Could not generate the cover letter.'));
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopy() {
    if (!coverLetter) return;

    try {
      await copy(coverLetter);
    } catch {
      setError('Could not copy the cover letter to the clipboard.');
    }
  }

  async function handleExportPdf() {
    if (!coverLetter) return;

    setError('');

    try {
      const { replacedCharacters } = await exportCoverLetterPDF(
        coverLetter,
        role || 'Position',
        company || 'Company',
        exportBaseName,
      );

      setNotice(
        replacedCharacters > 0
          ? `PDF saved. ${replacedCharacters} character(s) outside the PDF font (e.g. non-Latin letters or emoji) were replaced with "?". The .txt export keeps them.`
          : 'PDF saved to your downloads.',
      );
    } catch (exportError) {
      setError(getErrorMessage(exportError, 'Could not create the PDF.'));
    }
  }

  function handleClear() {
    setResearch(null);
    setCompany('');
    setRole('');
    setJobDescription('');
    setCoverLetter('');
    setError('');
    setNotice('');
  }

  return (
    <div className="view-content h-full min-h-0 flex flex-col">
      <PageHeader
        className="mb-6"
        eyebrow="AI WRITING TOOLS"
        title="Cover Letter Generator"
        description="Create a tailored cover letter using your resume and the job details."
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 flex-1 min-h-0">
        <section className="rounded-2xl p-5 min-h-[560px] flex flex-col" style={cardStyle}>
          <div className="flex items-center gap-2 mb-5">
            <FileText size={18} style={{ color: 'var(--color-primary)' }} />

            <h2 className="font-semibold" style={foregroundText}>
              Job Details
            </h2>
          </div>

          <div className="flex flex-col gap-4 flex-1">
            <TextField
              label="Company"
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              placeholder="e.g. Spotify"
              disabled={isBusy}
              maxLength={200}
            />

            <TextField
              label="Target role"
              value={role}
              onChange={(event) => setRole(event.target.value)}
              placeholder="e.g. Machine Learning Engineer"
              disabled={isBusy}
              maxLength={200}
            />

            <label className="flex flex-col gap-2 text-sm font-medium flex-1" style={foregroundText}>
              Job description, optional
              <textarea
                value={jobDescription}
                onChange={(event) => setJobDescription(event.target.value)}
                placeholder="Paste the job description here to tailor the letter."
                disabled={isBusy}
                maxLength={50_000}
                className="flex-1 min-h-[170px] w-full resize-none text-sm leading-6 p-3 rounded-lg outline-none disabled:opacity-60"
                style={fieldStyle}
              />
            </label>

            <div>
              <p className="text-sm font-medium mb-2" style={foregroundText}>
                Tone
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {TONES.map((option) => (
                  <OptionCard
                    key={option.id}
                    label={option.label}
                    description={option.description}
                    active={option.id === tone}
                    disabled={isBusy}
                    onSelect={() => setTone(option.id)}
                    className="rounded-lg px-3 py-2.5 text-left disabled:opacity-60"
                    descriptionClassName="text-xs mt-1"
                  />
                ))}
              </div>
            </div>

            <label
              className="flex items-start gap-2.5 text-sm"
              style={{ color: researchAvailable ? 'var(--color-foreground)' : 'var(--color-muted-foreground)' }}
            >
              <input
                type="checkbox"
                checked={researchAvailable && researchEnabled}
                onChange={(event) => setResearchEnabled(event.target.checked)}
                disabled={isBusy || !researchAvailable}
                className="mt-0.5 h-4 w-4 shrink-0 disabled:opacity-60"
                style={{ accentColor: 'var(--color-primary)' }}
              />
              <span>
                <span className="flex items-center gap-1.5 font-medium">
                  <Globe size={14} style={{ color: 'var(--color-primary)' }} />
                  Research the company on the web
                </span>
                <span className="block text-xs mt-0.5" style={mutedText}>
                  {researchAvailable
                    ? 'Searches the web (Tavily) for what the company does, its mission and recent news. Only the company name is sent.'
                    : 'Not configured. Set TAVILY_API_KEY for the API server to enable it.'}
                </span>
              </span>
            </label>

            {notice && <InlineNotice>{notice}</InlineNotice>}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <span className="text-xs" style={mutedText}>
                {resumeText ? 'Saved resume included as context' : 'No saved resume found'}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClear}
                  disabled={isBusy}
                  className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg disabled:opacity-60"
                  style={{
                    color: 'var(--color-muted-foreground)',
                    background: 'var(--color-muted)',
                  }}
                >
                  <RotateCcw size={14} />
                  Clear
                </button>

                <button
                  type="button"
                  onClick={() => void handleGenerate()}
                  disabled={isBusy}
                  className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg font-semibold disabled:opacity-60"
                  style={primaryButtonStyle}
                >
                  {generating ? (
                    <>
                      <span>Writing</span>
                      <TypingDots size="sm" />
                    </>
                  ) : (
                    <>
                      <Wand2 size={16} />
                      Generate letter
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </section>

        <GeneratedDocumentPanel
          title="Generated Letter"
          badge="AI generated"
          text={coverLetter}
          streaming={generating}
          error={error || loadError}
          emptyTitle="Your tailored cover letter will appear here"
          emptyDescription="Add the company and role, optionally paste the job description, then generate a tailored letter."
          copied={copied}
          onCopy={() => void handleCopy()}
          onDownloadTxt={() => downloadTextFile(coverLetter, `${exportBaseName}.txt`)}
          onExportPdf={() => void handleExportPdf()}
          footer={
            research?.status === 'used' && research.sources.length > 0 && !generating ? (
              <div className="mt-3">
                <p className="text-xs font-semibold mb-1.5" style={mutedText}>
                  Company research sources
                </p>
                <ul className="space-y-1">
                  {research.sources.map((source) => {
                    const href = safeExternalUrl(source.url);
                    return (
                      <li key={source.url} className="text-xs truncate">
                        {href ? (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 hover:underline"
                            style={{ color: 'var(--color-primary)' }}
                            title={href}
                          >
                            <ExternalLink size={11} className="shrink-0" />
                            <span className="truncate">{source.title}</span>
                          </a>
                        ) : (
                          <span style={mutedText}>{source.title}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null
          }
        />
      </div>
    </div>
  );
}
