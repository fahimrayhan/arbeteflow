import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronDown,
  Copy,
  Download,
  FileDown,
  FileText,
  RotateCcw,
  Sparkles,
  Wand2,
} from 'lucide-react';
import {
  getPrimaryResume,
  streamCoverLetterGeneration,
} from '../lib/api';
import { exportCoverLetterPDF } from '../lib/pdf';

const TONES = [
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

type Tone = (typeof TONES)[number]['id'];

function filenamePart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export default function CoverLetter() {
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [tone, setTone] = useState<Tone>('professional');

  const [resumeText, setResumeText] = useState('');
  const [coverLetter, setCoverLetter] = useState('');

  const [loadingResume, setLoadingResume] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadResume() {
      try {
        const resume = await getPrimaryResume();

        setResumeText(resume?.rawText ?? '');

        if (resume?.rawText) {
          setNotice('Using your saved resume as candidate context.');
        }
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Could not load your saved resume.',
        );
      } finally {
        setLoadingResume(false);
      }
    }

    void loadResume();
  }, []);

  useEffect(() => {
    if (generating && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [coverLetter, generating]);

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

    setGenerating(true);
    setError('');
    setNotice('');
    setCoverLetter('');

    try {
      await streamCoverLetterGeneration(
        {
          company: company.trim(),
          role: role.trim(),
          jobDescription: jobDescription.trim() || undefined,
          resumeText: resumeText.trim() || undefined,
          tone,
        },
        (token) => {
          setCoverLetter((current) => current + token);
        },
      );

      setNotice('Cover letter generated using your local Qwen model.');
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : 'Could not generate the cover letter.',
      );
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopy() {
    if (!coverLetter) {
      return;
    }

    try {
      await navigator.clipboard.writeText(coverLetter);
      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      setError('Could not copy the cover letter to the clipboard.');
    }
  }

  function handleDownloadTxt() {
    if (!coverLetter) {
      return;
    }

    const blob = new Blob([coverLetter], {
      type: 'text/plain;charset=utf-8',
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    const rolePart = filenamePart(role) || 'role';
    const companyPart = filenamePart(company) || 'company';

    anchor.href = url;
    anchor.download = `cover-letter-${rolePart}-${companyPart}.txt`;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(url);
  }

  function handleDownloadPdf() {
    if (!coverLetter) {
      return;
    }

    const rolePart = filenamePart(role) || 'role';
    const companyPart = filenamePart(company) || 'company';

    exportCoverLetterPDF(
      coverLetter,
      role || 'Position',
      company || 'Company',
      `cover-letter-${rolePart}-${companyPart}`,
    );
  }

  function handleClear() {
    setCompany('');
    setRole('');
    setJobDescription('');
    setCoverLetter('');
    setError('');
    setNotice('');
  }

  const isBusy = generating || loadingResume;

  return (
    <div className="view-content h-full min-h-0 flex flex-col">
      <div className="mb-6">
        <div
          className="flex items-center gap-2 text-xs font-semibold tracking-widest mb-2"
          style={{ color: 'var(--color-primary)' }}
        >
          <Sparkles size={14} />
          AI WRITING TOOLS
        </div>

        <h1
          className="text-3xl font-bold tracking-tight"
          style={{ color: 'var(--color-foreground)' }}
        >
          Cover Letter Generator
        </h1>

        <p
          className="mt-2"
          style={{ color: 'var(--color-muted-foreground)' }}
        >
          Create a tailored cover letter using your resume and the job details.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 flex-1 min-h-0">
        <section
          className="rounded-2xl p-5 min-h-[560px] flex flex-col"
          style={{
            background: 'var(--color-card)',
            border: '1px solid var(--color-border)',
          }}
        >
          <div className="flex items-center gap-2 mb-5">
            <FileText
              size={18}
              style={{ color: 'var(--color-primary)' }}
            />

            <h2
              className="font-semibold"
              style={{ color: 'var(--color-foreground)' }}
            >
              Job Details
            </h2>
          </div>

          <div className="flex flex-col gap-4 flex-1">
            <label
              className="flex flex-col gap-2 text-sm font-medium"
              style={{ color: 'var(--color-foreground)' }}
            >
              Company
              <input
                value={company}
                onChange={(event) => setCompany(event.target.value)}
                placeholder="e.g. Spotify"
                disabled={isBusy}
                className="w-full text-sm px-3 py-2.5 rounded-lg outline-none disabled:opacity-60"
                style={{
                  background: 'var(--color-muted)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-foreground)',
                }}
              />
            </label>

            <label
              className="flex flex-col gap-2 text-sm font-medium"
              style={{ color: 'var(--color-foreground)' }}
            >
              Target role
              <input
                value={role}
                onChange={(event) => setRole(event.target.value)}
                placeholder="e.g. Machine Learning Engineer"
                disabled={isBusy}
                className="w-full text-sm px-3 py-2.5 rounded-lg outline-none disabled:opacity-60"
                style={{
                  background: 'var(--color-muted)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-foreground)',
                }}
              />
            </label>

            <label
              className="flex flex-col gap-2 text-sm font-medium flex-1"
              style={{ color: 'var(--color-foreground)' }}
            >
              Job description, optional
              <textarea
                value={jobDescription}
                onChange={(event) => setJobDescription(event.target.value)}
                placeholder="Paste the job description here to tailor the letter."
                disabled={isBusy}
                className="flex-1 min-h-[170px] w-full resize-none text-sm leading-6 p-3 rounded-lg outline-none disabled:opacity-60"
                style={{
                  background: 'var(--color-muted)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-foreground)',
                }}
              />
            </label>

            <div>
              <p
                className="text-sm font-medium mb-2"
                style={{ color: 'var(--color-foreground)' }}
              >
                Tone
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {TONES.map((option) => {
                  const active = option.id === tone;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      disabled={isBusy}
                      onClick={() => setTone(option.id)}
                      className="rounded-lg px-3 py-2.5 text-left disabled:opacity-60"
                      style={{
                        background: active
                          ? 'rgba(163,230,53,0.1)'
                          : 'var(--color-muted)',
                        border: active
                          ? '1px solid rgba(163,230,53,0.45)'
                          : '1px solid var(--color-border)',
                        color: active
                          ? 'var(--color-primary)'
                          : 'var(--color-foreground)',
                      }}
                    >
                      <div className="text-sm font-semibold">
                        {option.label}
                      </div>

                      <div
                        className="text-xs mt-1"
                        style={{
                          color: active
                            ? 'var(--color-primary)'
                            : 'var(--color-muted-foreground)',
                        }}
                      >
                        {option.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {notice && (
              <p
                className="rounded-lg px-3 py-2 text-xs"
                style={{
                  color: 'var(--color-primary)',
                  background: 'rgba(163,230,53,0.08)',
                  border: '1px solid rgba(163,230,53,0.18)',
                }}
              >
                {notice}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <span
                className="text-xs"
                style={{ color: 'var(--color-muted-foreground)' }}
              >
                {resumeText
                  ? 'Saved resume included as context'
                  : 'No saved resume found'}
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
                  onClick={handleGenerate}
                  disabled={isBusy}
                  className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg font-semibold disabled:opacity-60"
                  style={{
                    background: 'linear-gradient(135deg, #84CC16, #A3E635)',
                    color: 'var(--color-primary-foreground)',
                    boxShadow: 'var(--shadow-btn-glow)',
                  }}
                >
                  {generating ? (
                    <>
                      <span>Writing</span>
                      <span className="flex gap-1">
                        {[0, 1, 2].map((index) => (
                          <span
                            key={index}
                            className="w-1 h-1 rounded-full animate-pulse"
                            style={{
                              background: 'currentColor',
                              animationDelay: `${index * 150}ms`,
                            }}
                          />
                        ))}
                      </span>
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

        <section
          className="rounded-2xl p-5 min-h-[560px] flex flex-col"
          style={{
            background: 'var(--color-card)',
            border: '1px solid var(--color-border)',
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Sparkles
                size={18}
                style={{ color: 'var(--color-primary)' }}
              />

              <h2
                className="font-semibold"
                style={{ color: 'var(--color-foreground)' }}
              >
                Generated Letter
              </h2>

              {coverLetter && (
                <span
                  className="text-[11px] rounded-full px-2 py-0.5 font-semibold"
                  style={{
                    color: 'var(--color-primary)',
                    background: 'rgba(163,230,53,0.1)',
                  }}
                >
                  AI generated
                </span>
              )}

              {generating && (
                <span
                  className="text-xs"
                  style={{ color: 'var(--color-muted-foreground)' }}
                >
                  Streaming…
                </span>
              )}
            </div>

            {coverLetter && !generating && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg"
                  style={{
                    color: 'var(--color-foreground)',
                    background: 'var(--color-muted)',
                  }}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>

                <button
                  type="button"
                  onClick={handleDownloadTxt}
                  className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg"
                  style={{
                    color: 'var(--color-foreground)',
                    background: 'var(--color-muted)',
                  }}
                >
                  <Download size={14} />
                  .txt
                </button>

                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg"
                  style={{
                    color: 'var(--color-foreground)',
                    background: 'var(--color-muted)',
                  }}
                >
                  <FileDown size={14} />
                  Export PDF
                </button>
              </div>
            )}
          </div>

          <div
            ref={outputRef}
            className="flex-1 min-h-[420px] overflow-y-auto rounded-xl p-4 text-sm leading-6"
            style={{
              background: 'var(--color-muted)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-foreground)',
            }}
          >
            {error && (
              <div
                className="flex gap-2 rounded-lg px-3 py-3 text-sm"
                style={{
                  color: '#F87171',
                  background: 'rgba(248,113,113,0.08)',
                  border: '1px solid rgba(248,113,113,0.22)',
                }}
              >
                <AlertCircle size={17} className="shrink-0 mt-0.5" />

                <div>
                  <div className="font-semibold">Error</div>
                  <div>{error}</div>
                </div>
              </div>
            )}

            {coverLetter ? (
              <pre
                className="m-0 whitespace-pre-wrap font-sans"
                style={{ color: 'var(--color-foreground)' }}
              >
                {coverLetter}
                {generating && (
                  <span
                    className="inline-block w-2 h-4 ml-1 align-middle animate-pulse"
                    style={{ background: 'var(--color-primary)' }}
                  />
                )}
              </pre>
            ) : !generating && !error ? (
              <div className="h-full min-h-[380px] flex flex-col items-center justify-center text-center px-8">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
                  style={{
                    background: 'rgba(163,230,53,0.1)',
                    color: 'var(--color-primary)',
                  }}
                >
                  <Sparkles size={22} />
                </div>

                <h3
                  className="font-semibold"
                  style={{ color: 'var(--color-foreground)' }}
                >
                  Your tailored cover letter will appear here
                </h3>

                <p
                  className="mt-2 text-sm max-w-sm"
                  style={{ color: 'var(--color-muted-foreground)' }}
                >
                  Add the company and role, optionally paste the job
                  description, then generate a tailored letter.
                </p>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
