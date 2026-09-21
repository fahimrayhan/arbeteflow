import { useState, useRef, useEffect } from 'react';
import {
  Wand2,
  Copy,
  Check,
  Download,
  ChevronDown,
  AlertCircle,
  Sparkles,
  FileText,
  RotateCcw,
  ArrowRight,
  FileDown,
} from 'lucide-react';
import { useApp } from '../App';
import { callModel, RESUME_SYSTEM } from '../lib/api';
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
  'Technology', 'Finance', 'Healthcare', 'Marketing', 'Design',
  'Data Science', 'Product Management', 'Consulting', 'Education', 'Other',
];

export default function Resume() {
  const { settings, navigate } = useApp();
  const [input, setInput] = useState('');
  const [enhanced, setEnhanced] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [industry, setIndustry] = useState('Technology');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [showIndustry, setShowIndustry] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);

  const hasKey = settings.activeProvider === 'ollama'
    ? !!settings.providers.ollama.baseUrl
    : !!(settings.providers[settings.activeProvider] as { apiKey: string }).apiKey;

  /* Auto-scroll output to bottom as tokens stream in */
  useEffect(() => {
    if (loading && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [enhanced, loading]);

  const handleEnhance = async () => {
    if (!input.trim()) return;
    if (!hasKey) { navigate('settings'); return; }

    setLoading(true);
    setError('');
    setEnhanced('');

    const prompt = `Please enhance the following resume${targetRole ? ` for a ${targetRole} role` : ''} in the ${industry} industry.

Target Role: ${targetRole || 'Not specified'}
Industry: ${industry}

Resume to enhance:
${input}

Return only the enhanced resume text, fully formatted.`;

    await callModel(
      settings,
      [{ role: 'user', content: prompt }],
      RESUME_SYSTEM,
      {
        onToken: (t) => setEnhanced((prev) => prev + t),
        onDone: () => setLoading(false),
        onError: (e) => { setError(e); setLoading(false); },
      },
    );
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(enhanced);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTxt = () => {
    const blob = new Blob([enhanced], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = targetRole
      ? `resume-${targetRole.toLowerCase().replace(/\s+/g, '-')}.txt`
      : 'enhanced-resume.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPDF = () => {
    const filename = targetRole
      ? `resume-${targetRole.toLowerCase().replace(/\s+/g, '-')}`
      : 'enhanced-resume';
    exportResumePDF(enhanced, filename);
  };

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--color-background)' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4 shrink-0"
        style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-card)' }}
      >
        <div>
          <h1 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-foreground)' }}>
            Resume Enhancer
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-muted-foreground)' }}>
            Paste your resume and let AI transform it into a standout document
          </p>
        </div>

        {/* Options row */}
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Target role (e.g. Senior Engineer)"
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
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
              onClick={() => setShowIndustry((v) => !v)}
              className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg"
              style={{
                background: 'var(--color-muted)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-foreground)',
              }}
            >
              {industry}
              <ChevronDown size={14} />
            </button>
            {showIndustry && (
              <div
                className="absolute right-0 top-full mt-1 rounded-xl py-1 z-10 min-w-40"
                style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
              >
                {INDUSTRIES.map((ind) => (
                  <button
                    key={ind}
                    onClick={() => { setIndustry(ind); setShowIndustry(false); }}
                    className="w-full text-left px-4 py-2 text-sm transition-colors"
                    style={{
                      color: ind === industry ? 'var(--color-primary)' : 'var(--color-foreground)',
                      background: ind === industry ? 'rgba(163,230,53,0.08)' : 'transparent',
                    }}
                  >
                    {ind}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main two-column area — min-h-0 is critical for scroll to work in grid */}
      <div className="flex-1 overflow-hidden grid grid-cols-2 gap-0" style={{ minHeight: 0 }}>
        {/* Left: Input */}
        <div
          className="flex flex-col min-h-0"
          style={{ borderRight: '1px solid var(--color-border)' }}
        >
          <div
            className="flex items-center justify-between px-4 py-2.5 shrink-0"
            style={{ borderBottom: '1px solid var(--color-border)' }}
          >
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-muted-foreground)' }}>
              Your Resume
            </span>
            <button
              onClick={() => setInput(SAMPLE_RESUME)}
              className="text-xs px-2.5 py-1 rounded-md transition-colors"
              style={{ color: 'var(--color-primary)', background: 'rgba(163,230,53,0.08)' }}
            >
              Load sample
            </button>
          </div>

          <textarea
            className="flex-1 p-4 resize-none outline-none text-sm leading-relaxed min-h-0"
            style={{
              background: 'var(--color-background)',
              color: 'var(--color-foreground)',
              fontFamily: 'var(--font-mono)',
              fontSize: 12.5,
            }}
            placeholder={`Paste your resume or CV here...\n\nName, contact info, work experience, education, skills — paste it all in as-is and AI will enhance it.`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />

          <div
            className="flex items-center justify-between px-4 py-3 shrink-0"
            style={{ borderTop: '1px solid var(--color-border)' }}
          >
            <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
              {input.split(/\s+/).filter(Boolean).length} words
            </span>
            <div className="flex gap-2">
              {input && (
                <button
                  onClick={() => { setInput(''); setEnhanced(''); setError(''); }}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors"
                  style={{ color: 'var(--color-muted-foreground)', background: 'var(--color-muted)' }}
                >
                  <RotateCcw size={12} />
                  Clear
                </button>
              )}
              <button
                onClick={handleEnhance}
                disabled={loading || !input.trim()}
                className="flex items-center gap-2 text-sm px-4 py-1.5 rounded-lg font-semibold transition-all"
                style={{
                  background: input.trim() ? 'linear-gradient(135deg, #84CC16, #A3E635)' : 'var(--color-muted)',
                  color: input.trim() ? 'var(--color-primary-foreground)' : 'var(--color-muted-foreground)',
                  cursor: !input.trim() ? 'not-allowed' : loading ? 'wait' : 'pointer',
                  opacity: loading ? 0.8 : 1,
                }}
              >
                {loading ? (
                  <>
                    <span className="animate-pulse">Enhancing</span>
                    <span className="flex gap-0.5">
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="w-1 h-1 rounded-full animate-bounce"
                          style={{ background: 'var(--color-primary-foreground)', animationDelay: `${i * 0.15}s` }}
                        />
                      ))}
                    </span>
                  </>
                ) : (
                  <>
                    <Wand2 size={14} />
                    {hasKey ? 'Enhance' : 'Connect API →'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Output */}
        <div className="flex flex-col min-h-0">
          <div
            className="flex items-center justify-between px-4 py-2.5 shrink-0"
            style={{ borderBottom: '1px solid var(--color-border)' }}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-muted-foreground)' }}>
                Enhanced Version
              </span>
              {enhanced && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(74,222,128,0.15)', color: 'var(--color-accent)' }}
                >
                  <Sparkles size={10} className="inline mr-1" />
                  AI Enhanced
                </span>
              )}
              {loading && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full animate-pulse"
                  style={{ background: 'rgba(163,230,53,0.1)', color: 'var(--color-primary)' }}
                >
                  Streaming…
                </span>
              )}
            </div>
            {enhanced && (
              <div className="flex gap-1.5">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors"
                  style={{ color: 'var(--color-foreground)', background: 'var(--color-muted)', border: '1px solid var(--color-border)' }}
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <button
                  onClick={handleDownloadTxt}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors"
                  style={{ color: 'var(--color-foreground)', background: 'var(--color-muted)', border: '1px solid var(--color-border)' }}
                >
                  <Download size={12} />
                  .txt
                </button>
                <button
                  onClick={handleDownloadPDF}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg font-semibold transition-all"
                  style={{
                    color: 'var(--color-primary-foreground)',
                    background: 'linear-gradient(135deg, #84CC16, #A3E635)',
                    boxShadow: 'var(--shadow-btn-glow)',
                  }}
                >
                  <FileDown size={12} />
                  Export PDF
                </button>
              </div>
            )}
          </div>

          {/* Scrollable output area */}
          <div
            ref={outputRef}
            className="flex-1 overflow-y-auto p-4 min-h-0"
            style={{ background: 'var(--color-background)' }}
          >
            {error && (
              <div
                className="flex items-start gap-3 p-4 rounded-xl mb-4"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}
              >
                <AlertCircle size={16} style={{ color: 'var(--color-destructive)', marginTop: 2 }} className="shrink-0" />
                <div>
                  <div className="text-sm font-semibold" style={{ color: 'var(--color-destructive)' }}>Error</div>
                  <div className="text-xs mt-1" style={{ color: 'var(--color-destructive)', opacity: 0.8 }}>{error}</div>
                </div>
              </div>
            )}

            {enhanced ? (
              <pre
                className="whitespace-pre-wrap text-sm leading-relaxed"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12.5,
                  color: 'var(--color-foreground)',
                }}
              >
                {enhanced}
                {loading && (
                  <span
                    className="inline-block w-2 h-4 ml-0.5 animate-pulse rounded-sm"
                    style={{ background: 'var(--color-primary)', verticalAlign: 'text-bottom' }}
                  />
                )}
              </pre>
            ) : !loading ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-16">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: 'rgba(163,230,53,0.08)', border: '1px solid rgba(163,230,53,0.18)' }}
                >
                  <FileText size={28} style={{ color: 'var(--color-primary)' }} />
                </div>
                <h3 className="text-base font-semibold mb-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-foreground)' }}>
                  Your enhanced resume will appear here
                </h3>
                <p className="text-sm max-w-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                  Paste your resume on the left, set your target role, and hit Enhance.
                </p>
                {!hasKey && (
                  <button
                    onClick={() => navigate('settings')}
                    className="flex items-center gap-2 mt-6 text-sm px-4 py-2 rounded-lg font-semibold"
                    style={{ background: 'linear-gradient(135deg, #84CC16, #A3E635)', color: 'var(--color-primary-foreground)', boxShadow: 'var(--shadow-btn-glow)' }}
                  >
                    Add API Key to get started
                    <ArrowRight size={14} />
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
