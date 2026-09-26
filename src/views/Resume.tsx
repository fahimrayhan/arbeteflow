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
  Save,
  Sparkles,
  Upload,
  Wand2,
} from 'lucide-react';
import {
  deletePrimaryResume,
  getPrimaryResume,
  savePrimaryResume,
  streamResumeEnhancement,
} from '../lib/api';
import { exportResumePDF } from '../lib/pdf';
import {
  extractTextFromPdf,
  PdfTextExtractionError,
} from '../lib/pdfText';

const SAMPLE_RESUME = `ALEX CHEN
alex.chen@email.com | (555) 012-3456 | linkedin.com/in/alexchen | github.com/alexchen

EXPERIENCE

Software Engineer — TechCorp Inc. (Jan 2024 – Present)
- Worked on backend systems
- Fixed bugs in the payment service
- Did code reviews for team members
- Helped with database stuff

Junior Developer — StartupXYZ (Jun 2022 – Dec 2023)
- Made features for the mobile app
- Did testing
- Worked with the design team

EDUCATION

B.S. Computer Science — State University (2022)
GPA: 3.4

SKILLS
JavaScript, Python, React, Node.js, SQL, Git`;

const INDUSTRIES = [
  'Technology',
  'Finance',
  'Healthcare',
  'Marketing',
  'Design',
  'Data Science',
  'Product Management',
  'Consulting',
  'Education',
  'Other',
];

function getResumeTitle(targetRole: string): string {
  return targetRole.trim()
    ? `${targetRole.trim()} resume`
    : 'Primary resume';
}

export default function Resume() {
  const [input, setInput] = useState('');
  const [enhanced, setEnhanced] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [industry, setIndustry] = useState('Technology');

  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingResume, setLoadingResume] = useState(true);

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState(false);
  const [showIndustry, setShowIndustry] = useState(false);

  const outputRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadResume() {
      try {
        const storedResume = await getPrimaryResume();

        if (storedResume) {
          setInput(storedResume.rawText);
          setEnhanced(storedResume.enhancedText ?? '');
          setNotice('Loaded your saved resume.');
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
    if (loading && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [enhanced, loading]);

  async function persistResume(
    rawText: string,
    enhancedText?: string,
  ): Promise<void> {
    if (!rawText.trim()) {
      return;
    }

    await savePrimaryResume({
      title: getResumeTitle(targetRole),
      rawText,
      enhancedText: enhancedText?.trim() || undefined,
    });
  }

  async function handleSave() {
    if (!input.trim() || loading || extracting || saving) {
      return;
    }

    setError('');
    setNotice('');
    setSaving(true);

    try {
      await persistResume(input, enhanced);
      setNotice('Your resume was saved to the backend.');
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Could not save your resume.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function handlePdfUpload(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setError('');
    setNotice('');
    setExtracting(true);

    try {
      const extractedText = await extractTextFromPdf(file);

      setInput(extractedText);
      setEnhanced('');

      try {
        setSaving(true);

        await persistResume(extractedText);

        setNotice(
          `Extracted text from ${file.name} and saved it to the backend. The PDF itself was not saved.`,
        );
      } catch (saveError) {
        setNotice(
          `Extracted text from ${file.name}. The source PDF was not saved.`,
        );

        setError(
          saveError instanceof Error
            ? saveError.message
            : 'Could not save the extracted resume text.',
        );
      } finally {
        setSaving(false);
      }
    } catch (uploadError) {
      setError(
        uploadError instanceof PdfTextExtractionError
          ? uploadError.message
          : 'Could not extract text from this PDF.',
      );
    } finally {
      setExtracting(false);
      event.target.value = '';
    }
  }

  async function handleEnhance() {
    if (!input.trim() || loading || extracting || saving) {
      return;
    }

    setLoading(true);
    setError('');
    setNotice('');
    setEnhanced('');

    let fullEnhancedResume = '';

    try {
      await streamResumeEnhancement(
        {
          resumeText: input,
          targetRole: targetRole.trim() || undefined,
          industry,
        },
        (token) => {
          fullEnhancedResume += token;

          setEnhanced((current) => current + token);
        },
      );

      setSaving(true);

      await persistResume(input, fullEnhancedResume);

      setNotice('Enhanced resume generated and saved to the backend.');
    } catch (enhanceError) {
      setError(
        enhanceError instanceof Error
          ? enhanceError.message
          : 'Could not enhance the resume.',
      );
    } finally {
      setSaving(false);
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!enhanced) {
      return;
    }

    try {
      await navigator.clipboard.writeText(enhanced);
      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      setError('Could not copy the enhanced resume to the clipboard.');
    }
  }

  function handleDownloadTxt() {
    if (!enhanced) {
      return;
    }

    const blob = new Blob([enhanced], {
      type: 'text/plain;charset=utf-8',
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = targetRole.trim()
      ? `resume-${targetRole.trim().toLowerCase().replace(/\s+/g, '-')}.txt`
      : 'enhanced-resume.txt';

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(url);
  }

  function handleDownloadPdf() {
    if (!enhanced) {
      return;
    }

    const filename = targetRole.trim()
      ? `resume-${targetRole.trim().toLowerCase().replace(/\s+/g, '-')}`
      : 'enhanced-resume';

    exportResumePDF(enhanced, filename);
  }

  async function handleClear() {
    if (loading || saving || extracting) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await deletePrimaryResume();
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : 'Could not clear your saved resume.');
      setSaving(false);
      return;
    }
    setInput('');
    setEnhanced('');
    setNotice('Saved resume cleared.');
    setSaving(false);
  }

  function handleLoadSample() {
    setInput(SAMPLE_RESUME);
    setEnhanced('');
    setError('');
    setNotice('Sample resume loaded. Press Save to store it locally.');
  }

  const wordCount = input.trim()
    ? input.trim().split(/\s+/).length
    : 0;

  const isBusy = loading || extracting || saving;

  return (
    <div className="view-content h-full min-h-0 flex flex-col">
      <div className="flex flex-col gap-5 mb-6">
        <div>
          <div
            className="flex items-center gap-2 text-xs font-semibold tracking-widest mb-2"
            style={{ color: 'var(--color-primary)' }}
          >
            <Sparkles size={14} />
            AI RESUME TOOLS
          </div>

          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ color: 'var(--color-foreground)' }}
          >
            Resume Enhancer
          </h1>

          <p
            className="mt-2"
            style={{ color: 'var(--color-muted-foreground)' }}
          >
            Upload a PDF or paste your resume, then tailor it to a role.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            value={targetRole}
            onChange={(event) => setTargetRole(event.target.value)}
            placeholder="Target role (optional)"
            className="text-sm px-3 py-2 rounded-lg outline-none"
            style={{
              background: 'var(--color-muted)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-foreground)',
              width: 220,
            }}
          />

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowIndustry((current) => !current)}
              className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg"
              style={{
                background: 'var(--color-muted)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-foreground)',
              }}
            >
              {industry}
              <ChevronDown size={15} />
            </button>

            {showIndustry && (
              <div
                className="absolute top-full left-0 mt-2 z-20 min-w-52 overflow-hidden rounded-xl py-1"
                style={{
                  background: 'var(--color-card)',
                  border: '1px solid var(--color-border)',
                  boxShadow: 'var(--shadow-lg)',
                }}
              >
                {INDUSTRIES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      setIndustry(item);
                      setShowIndustry(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm transition-colors"
                    style={{
                      color:
                        item === industry
                          ? 'var(--color-primary)'
                          : 'var(--color-foreground)',
                      background:
                        item === industry
                          ? 'rgba(163,230,53,0.08)'
                          : 'transparent',
                    }}
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 flex-1 min-h-0">
        <section
          className="rounded-2xl p-5 min-h-[560px] flex flex-col"
          style={{
            background: 'var(--color-card)',
            border: '1px solid var(--color-border)',
          }}
        >
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <FileText
                size={18}
                style={{ color: 'var(--color-primary)' }}
              />

              <h2
                className="font-semibold"
                style={{ color: 'var(--color-foreground)' }}
              >
                Your Resume
              </h2>
            </div>

            <button
              type="button"
              onClick={handleLoadSample}
              disabled={isBusy}
              className="text-xs px-2.5 py-1 rounded-md transition-colors disabled:opacity-60"
              style={{
                color: 'var(--color-primary)',
                background: 'rgba(163,230,53,0.08)',
              }}
            >
              Load sample
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            hidden
            onChange={handlePdfUpload}
          />

          <div className="flex flex-wrap items-center gap-2 mb-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isBusy || loadingResume}
              className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg font-medium transition-opacity disabled:opacity-60"
              style={{
                color: 'var(--color-foreground)',
                background: 'var(--color-muted)',
                border: '1px solid var(--color-border)',
              }}
            >
              <Upload size={16} />
              {extracting ? 'Extracting PDF…' : 'Upload PDF'}
            </button>

            <span
              className="text-xs"
              style={{ color: 'var(--color-muted-foreground)' }}
            >
              PDF text only · max 10 MB · source file is not stored
            </span>
          </div>

          {notice && (
            <p
              className="mb-3 rounded-lg px-3 py-2 text-xs"
              style={{
                color: 'var(--color-primary)',
                background: 'rgba(163,230,53,0.08)',
                border: '1px solid rgba(163,230,53,0.18)',
              }}
            >
              {notice}
            </p>
          )}

          <textarea
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
              setNotice('');
            }}
            placeholder={
              loadingResume
                ? 'Loading your saved resume…'
                : 'Upload your CV as a PDF or paste your resume text here…'
            }
            disabled={loadingResume}
            className="flex-1 min-h-[330px] w-full resize-none rounded-xl p-4 text-sm leading-6 outline-none disabled:opacity-60"
            style={{
              background: 'var(--color-muted)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-foreground)',
            }}
          />

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
            <span
              className="text-xs"
              style={{ color: 'var(--color-muted-foreground)' }}
            >
              {wordCount.toLocaleString()} words
            </span>

            <div className="flex items-center gap-2">
              {input && (
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
              )}

              <button
                type="button"
                onClick={handleSave}
                disabled={!input.trim() || isBusy || loadingResume}
                className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg disabled:opacity-60"
                style={{
                  color: 'var(--color-foreground)',
                  background: 'var(--color-muted)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <Save size={14} />
                {saving ? 'Saving…' : 'Save'}
              </button>

              <button
                type="button"
                onClick={handleEnhance}
                disabled={!input.trim() || isBusy || loadingResume}
                className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg font-semibold disabled:opacity-60"
                style={{
                  background: 'linear-gradient(135deg, #84CC16, #A3E635)',
                  color: 'var(--color-primary-foreground)',
                  boxShadow: 'var(--shadow-btn-glow)',
                }}
              >
                {loading ? (
                  <>
                    <span>Enhancing</span>
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
                    Enhance
                  </>
                )}
              </button>
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
                Enhanced Version
              </h2>

              {enhanced && (
                <span
                  className="text-[11px] rounded-full px-2 py-0.5 font-semibold"
                  style={{
                    color: 'var(--color-primary)',
                    background: 'rgba(163,230,53,0.1)',
                  }}
                >
                  AI enhanced
                </span>
              )}

              {loading && (
                <span
                  className="text-xs"
                  style={{ color: 'var(--color-muted-foreground)' }}
                >
                  Streaming…
                </span>
              )}
            </div>

            {enhanced && !loading && (
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

            {enhanced ? (
              <pre
                className="m-0 whitespace-pre-wrap font-sans"
                style={{ color: 'var(--color-foreground)' }}
              >
                {enhanced}
                {loading && (
                  <span
                    className="inline-block w-2 h-4 ml-1 align-middle animate-pulse"
                    style={{ background: 'var(--color-primary)' }}
                  />
                )}
              </pre>
            ) : !loading && !error ? (
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
                  Your enhanced resume will appear here
                </h3>

                <p
                  className="mt-2 text-sm max-w-sm"
                  style={{ color: 'var(--color-muted-foreground)' }}
                >
                  Upload a PDF or paste your resume, select a target role, and
                  choose Enhance.
                </p>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
