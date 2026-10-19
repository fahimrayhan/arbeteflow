import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { ChevronDown, FileText, RotateCcw, Save, Upload, Wand2 } from 'lucide-react';
import { InlineNotice } from '../components/ui/Alert';
import { GeneratedDocumentPanel } from '../components/ui/GeneratedDocumentPanel';
import { PageHeader } from '../components/ui/PageHeader';
import {
  cardStyle,
  fieldStyle,
  mutedText,
  primaryButtonStyle,
  secondaryButtonStyle,
} from '../components/ui/styles';
import { TypingDots } from '../components/ui/TypingDots';
import { useClipboard } from '../hooks/useClipboard';
import { useDismiss } from '../hooks/useDismiss';
import { usePrimaryResume } from '../hooks/usePrimaryResume';
import { deletePrimaryResume, savePrimaryResume, streamResumeEnhancement } from '../lib/api';
import { downloadTextFile, slugify } from '../lib/download';
import { getErrorMessage } from '../lib/errors';
import { exportResumePDF } from '../lib/pdf';

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

/** Matches the server-side limit for stored resume text. */
const MAX_RESUME_CHARS = 50_000;

function getResumeTitle(targetRole: string): string {
  return targetRole.trim() ? `${targetRole.trim()} resume` : 'Primary resume';
}

function exportBaseName(targetRole: string): string {
  const role = slugify(targetRole);
  return role ? `resume-${role}` : 'enhanced-resume';
}

export default function Resume() {
  const [input, setInput] = useState('');
  const [enhanced, setEnhanced] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [industry, setIndustry] = useState('Technology');

  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showIndustry, setShowIndustry] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const industryMenuRef = useRef<HTMLDivElement>(null);

  const { copied, copy } = useClipboard();

  const { loading: loadingResume, error: loadError } = usePrimaryResume((storedResume) => {
    if (storedResume) {
      setInput(storedResume.rawText);
      setEnhanced(storedResume.enhancedText ?? '');
      setNotice('Loaded your saved resume.');
    }
  });

  const closeIndustryMenu = useCallback(() => setShowIndustry(false), []);
  useDismiss(industryMenuRef, showIndustry, closeIndustryMenu);

  const isBusy = loading || extracting || saving;

  async function persistResume(rawText: string, enhancedText?: string): Promise<void> {
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
    if (!input.trim() || isBusy) {
      return;
    }

    setError('');
    setNotice('');
    setSaving(true);

    try {
      await persistResume(input, enhanced);
      setNotice('Your resume was saved to the backend.');
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'Could not save your resume.'));
    } finally {
      setSaving(false);
    }
  }

  async function handlePdfUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setError('');
    setNotice('');
    setExtracting(true);

    try {
      // pdf.js is large; load it only when a PDF is actually uploaded.
      const { extractTextFromPdf, PdfTextExtractionError } = await import('../lib/pdfText');

      let extractedText: string;
      try {
        extractedText = await extractTextFromPdf(file);
      } catch (uploadError) {
        setError(
          uploadError instanceof PdfTextExtractionError
            ? uploadError.message
            : 'Could not extract text from this PDF.',
        );
        return;
      }

      setInput(extractedText);
      setEnhanced('');
      setSaving(true);

      try {
        await persistResume(extractedText);
        setNotice(
          `Extracted text from ${file.name} and saved it to the backend. The PDF itself was not saved.`,
        );
      } catch (saveError) {
        setNotice(`Extracted text from ${file.name}. The source PDF was not saved.`);
        setError(getErrorMessage(saveError, 'Could not save the extracted resume text.'));
      } finally {
        setSaving(false);
      }
    } catch (importError) {
      setError(getErrorMessage(importError, 'Could not load the PDF reader.'));
    } finally {
      setExtracting(false);
      event.target.value = '';
    }
  }

  async function handleEnhance() {
    if (!input.trim() || isBusy) {
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
      setError(getErrorMessage(enhanceError, 'Could not enhance the resume.'));
    } finally {
      setSaving(false);
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!enhanced) return;

    try {
      await copy(enhanced);
    } catch {
      setError('Could not copy the enhanced resume to the clipboard.');
    }
  }

  async function handleExportPdf() {
    if (!enhanced) return;

    setError('');

    try {
      const { replacedCharacters } = await exportResumePDF(enhanced, exportBaseName(targetRole));

      setNotice(
        replacedCharacters > 0
          ? `PDF saved. ${replacedCharacters} character(s) outside the PDF font (e.g. non-Latin letters or emoji) were replaced with "?". The .txt export keeps them.`
          : 'PDF saved to your downloads.',
      );
    } catch (exportError) {
      setError(getErrorMessage(exportError, 'Could not create the PDF.'));
    }
  }

  async function handleClear() {
    if (isBusy) return;

    if (!window.confirm('Clear your saved resume? This removes it from the backend.')) {
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');

    try {
      await deletePrimaryResume();
      setInput('');
      setEnhanced('');
      setNotice('Saved resume cleared.');
    } catch (clearError) {
      setError(getErrorMessage(clearError, 'Could not clear your saved resume.'));
    } finally {
      setSaving(false);
    }
  }

  function handleLoadSample() {
    setInput(SAMPLE_RESUME);
    setEnhanced('');
    setError('');
    setNotice('Sample resume loaded. Press Save to store it locally.');
  }

  useEffect(() => {
    function handleKeyboardShortcuts(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setShowIndustry(false);
        return;
      }

      const modifier = event.metaKey || event.ctrlKey;
      if (!modifier || event.altKey) return;

      if (event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (input.trim() && !isBusy) void handleSave();
      } else if (event.key === 'Enter') {
        event.preventDefault();
        if (input.trim() && !isBusy) void handleEnhance();
      }
    }

    window.addEventListener('keydown', handleKeyboardShortcuts);
    return () => window.removeEventListener('keydown', handleKeyboardShortcuts);
  }, [input, isBusy, handleSave, handleEnhance]);

  const wordCount = input.trim() ? input.trim().split(/\s+/).length : 0;

  return (
    <div className="view-content h-full min-h-0 flex flex-col">
      <div className="flex flex-col gap-5 mb-6">
        <PageHeader
          eyebrow="AI RESUME TOOLS"
          title="Resume Enhancer"
          description="Upload a PDF or paste your resume, then tailor it to a role."
        />
        <p className="text-xs" style={mutedText}>
          Shortcuts: <kbd>Cmd/Ctrl+S</kbd> save · <kbd>Cmd/Ctrl+Enter</kbd> enhance ·{' '}
          <kbd>Esc</kbd> close menus
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <input
            value={targetRole}
            onChange={(event) => setTargetRole(event.target.value)}
            placeholder="Target role (optional)"
            aria-label="Target role"
            maxLength={200}
            className="text-sm px-3 py-2 rounded-lg outline-none"
            style={{ ...fieldStyle, width: 220 }}
          />

          <div className="relative" ref={industryMenuRef}>
            <button
              type="button"
              onClick={() => setShowIndustry((current) => !current)}
              aria-haspopup="listbox"
              aria-expanded={showIndustry}
              className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg"
              style={fieldStyle}
            >
              {industry}
              <ChevronDown size={15} />
            </button>

            {showIndustry && (
              <div
                role="listbox"
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
                    role="option"
                    aria-selected={item === industry}
                    onClick={() => {
                      setIndustry(item);
                      setShowIndustry(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm transition-colors"
                    style={{
                      color: item === industry ? 'var(--color-primary)' : 'var(--color-foreground)',
                      background: item === industry ? 'rgba(163,230,53,0.08)' : 'transparent',
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
        <section className="rounded-2xl p-5 min-h-[560px] flex flex-col" style={cardStyle}>
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <FileText size={18} style={{ color: 'var(--color-primary)' }} />

              <h2 className="font-semibold" style={{ color: 'var(--color-foreground)' }}>
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
              style={secondaryButtonStyle}
            >
              <Upload size={16} />
              {extracting ? 'Extracting PDF…' : 'Upload PDF'}
            </button>

            <span className="text-xs" style={mutedText}>
              PDF text only · max 10 MB · source file is not stored
            </span>
          </div>

          {notice && <InlineNotice className="mb-3">{notice}</InlineNotice>}

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
            aria-label="Resume text"
            disabled={loadingResume}
            maxLength={MAX_RESUME_CHARS}
            className="flex-1 min-h-[330px] w-full resize-none rounded-xl p-4 text-sm leading-6 outline-none disabled:opacity-60"
            style={fieldStyle}
          />

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
            <span className="text-xs" style={mutedText}>
              {wordCount.toLocaleString()} words
            </span>

            <div className="flex items-center gap-2">
              {input && (
                <button
                  type="button"
                  onClick={() => void handleClear()}
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
                onClick={() => void handleSave()}
                disabled={!input.trim() || isBusy || loadingResume}
                className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg disabled:opacity-60"
                style={secondaryButtonStyle}
              >
                <Save size={14} />
                {saving ? 'Saving…' : 'Save'}
              </button>

              <button
                type="button"
                onClick={() => void handleEnhance()}
                disabled={!input.trim() || isBusy || loadingResume}
                className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg font-semibold disabled:opacity-60"
                style={primaryButtonStyle}
              >
                {loading ? (
                  <>
                    <span>Enhancing</span>
                    <TypingDots size="sm" />
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

        <GeneratedDocumentPanel
          title="Enhanced Version"
          badge="AI enhanced"
          text={enhanced}
          streaming={loading}
          error={error || loadError}
          emptyTitle="Your enhanced resume will appear here"
          emptyDescription="Upload a PDF or paste your resume, select a target role, and choose Enhance."
          copied={copied}
          onCopy={() => void handleCopy()}
          onDownloadTxt={() => downloadTextFile(enhanced, `${exportBaseName(targetRole)}.txt`)}
          onExportPdf={() => void handleExportPdf()}
          onTextChange={(text) => {
            setEnhanced(text);
            setNotice('Edited enhanced resume. Save to keep your changes.');
          }}
        />
      </div>
    </div>
  );
}
