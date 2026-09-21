import { useState, useRef, useEffect } from 'react';
import {
  Wand2,
  Copy,
  Check,
  Download,
  AlertCircle,
  Sparkles,
  Mail,
  ArrowRight,
  FileDown,
} from 'lucide-react';
import { useApp } from '../App';
import { callModel } from '../lib/api';
import { exportCoverLetterPDF } from '../lib/pdf';

type Tone = 'professional' | 'enthusiastic' | 'creative' | 'concise';

const TONES: { id: Tone; label: string; desc: string }[] = [
  { id: 'professional', label: 'Professional', desc: 'Formal & authoritative' },
  { id: 'enthusiastic', label: 'Enthusiastic', desc: 'Warm & energetic' },
  { id: 'creative', label: 'Creative', desc: 'Bold & distinctive' },
  { id: 'concise', label: 'Concise', desc: 'Direct & efficient' },
];

const SYSTEM = `You are an expert cover letter writer who crafts compelling, personalized cover letters.
When writing cover letters:
- Open with a strong hook that shows genuine interest in this specific company
- Connect the candidate's specific experience to the role requirements
- Highlight 2-3 key achievements with measurable impact where possible
- Show personality while maintaining professionalism
- Close with a clear call to action
- Keep it to one page (300-400 words max)
- Do NOT use generic phrases like "I am writing to apply for..." or "I would be a great fit"
- Be specific to the job description provided
Return the complete cover letter including date, recipient placeholder, and signature block.`;

export default function CoverLetter() {
  const { settings, navigate } = useApp();
  const [form, setForm] = useState({
    role: '',
    company: '',
    recruiterName: '',
    jobDescription: '',
    yourBackground: '',
    keyAchievements: '',
    tone: 'professional' as Tone,
  });
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);

  const update = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const hasKey = settings.activeProvider === 'ollama'
    ? !!settings.providers.ollama.baseUrl
    : !!(settings.providers[settings.activeProvider] as { apiKey: string }).apiKey;

  /* Auto-scroll as content streams in */
  useEffect(() => {
    if (loading && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output, loading]);

  const handleGenerate = async () => {
    if (!form.role || !form.company) return;
    if (!hasKey) { navigate('settings'); return; }

    setLoading(true);
    setError('');
    setOutput('');
    setEditing(false);

    const prompt = `Write a ${form.tone} cover letter for the following:

Role: ${form.role}
Company: ${form.company}
Hiring Manager: ${form.recruiterName || 'Hiring Manager'}
Tone: ${form.tone}

Job Description:
${form.jobDescription || '(not provided — write a general but compelling letter)'}

Candidate Background:
${form.yourBackground || '(not provided — write generally)'}

Key Achievements to Highlight:
${form.keyAchievements || '(not provided)'}

Write the complete cover letter now.`;

    await callModel(
      settings,
      [{ role: 'user', content: prompt }],
      SYSTEM,
      {
        onToken: (t) => setOutput((prev) => prev + t),
        onDone: () => setLoading(false),
        onError: (e) => { setError(e); setLoading(false); },
      },
    );
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTxt = () => {
    const blob = new Blob([output], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cover-letter-${form.company.toLowerCase().replace(/\s+/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPDF = () => exportCoverLetterPDF(output, form.role, form.company);

  const canGenerate = form.role.trim() && form.company.trim();

  const inputStyle = {
    background: 'var(--color-muted)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-foreground)',
  } as const;

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--color-background)' }}>
      {/* Header */}
      <div
        className="px-6 py-4 shrink-0"
        style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-card)' }}
      >
        <h1 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-foreground)' }}>
          Cover Letter Generator
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--color-muted-foreground)' }}>
          Generate personalized, compelling cover letters tailored to any job
        </p>
      </div>

      {/* Two-column layout */}
      <div className="flex-1 overflow-hidden grid grid-cols-2 gap-0" style={{ minHeight: 0 }}>

        {/* Left: Form — its own scroll */}
        <div
          className="flex flex-col min-h-0 overflow-y-auto"
          style={{ borderRight: '1px solid var(--color-border)' }}
        >
          <div className="p-5 space-y-4">
            {/* Required */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: 'var(--color-muted-foreground)' }}>
                Required
              </label>
              <div className="space-y-3">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--color-secondary-foreground)' }}>Job Title *</label>
                  <input
                    type="text"
                    placeholder="e.g. Senior Frontend Engineer"
                    value={form.role}
                    onChange={(e) => update('role', e.target.value)}
                    className="w-full text-sm px-3 py-2.5 rounded-lg outline-none"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--color-secondary-foreground)' }}>Company *</label>
                  <input
                    type="text"
                    placeholder="e.g. Stripe"
                    value={form.company}
                    onChange={(e) => update('company', e.target.value)}
                    className="w-full text-sm px-3 py-2.5 rounded-lg outline-none"
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>

            {/* Tone */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: 'var(--color-muted-foreground)' }}>
                Tone
              </label>
              <div className="grid grid-cols-2 gap-2">
                {TONES.map(({ id, label, desc }) => (
                  <button
                    key={id}
                    onClick={() => update('tone', id)}
                    className="text-left px-3 py-2.5 rounded-lg transition-all"
                    style={{
                      background: form.tone === id ? 'rgba(163,230,53,0.12)' : 'var(--color-muted)',
                      border: form.tone === id ? '1px solid rgba(163,230,53,0.28)' : '1px solid var(--color-border)',
                    }}
                  >
                    <div className="text-xs font-semibold" style={{ color: form.tone === id ? 'var(--color-primary)' : 'var(--color-foreground)' }}>
                      {label}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--color-muted-foreground)' }}>{desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Optional */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: 'var(--color-muted-foreground)' }}>
                Optional — improves quality
              </label>
              <div className="space-y-3">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--color-secondary-foreground)' }}>Hiring Manager Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Sarah Kim"
                    value={form.recruiterName}
                    onChange={(e) => update('recruiterName', e.target.value)}
                    className="w-full text-sm px-3 py-2.5 rounded-lg outline-none"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--color-secondary-foreground)' }}>Job Description</label>
                  <textarea
                    placeholder="Paste the job description for a tailored letter..."
                    value={form.jobDescription}
                    onChange={(e) => update('jobDescription', e.target.value)}
                    rows={4}
                    className="w-full text-sm px-3 py-2.5 rounded-lg outline-none resize-none"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--color-secondary-foreground)' }}>Your Background Summary</label>
                  <textarea
                    placeholder="Brief summary of your experience and skills..."
                    value={form.yourBackground}
                    onChange={(e) => update('yourBackground', e.target.value)}
                    rows={3}
                    className="w-full text-sm px-3 py-2.5 rounded-lg outline-none resize-none"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--color-secondary-foreground)' }}>Key Achievements to Highlight</label>
                  <textarea
                    placeholder="e.g. Increased revenue by 40%, Led team of 8 engineers..."
                    value={form.keyAchievements}
                    onChange={(e) => update('keyAchievements', e.target.value)}
                    rows={3}
                    className="w-full text-sm px-3 py-2.5 rounded-lg outline-none resize-none"
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={loading || !canGenerate}
              className="w-full flex items-center justify-center gap-2 text-sm py-3 rounded-xl font-semibold transition-all"
              style={{
                background: canGenerate ? 'linear-gradient(135deg, #84CC16, #A3E635)' : 'var(--color-muted)',
                color: canGenerate ? 'var(--color-primary-foreground)' : 'var(--color-muted-foreground)',
                cursor: !canGenerate ? 'not-allowed' : loading ? 'wait' : 'pointer',
                opacity: loading ? 0.8 : 1,
                boxShadow: canGenerate ? 'var(--shadow-btn-glow)' : 'none',
              }}
            >
              {loading ? (
                <>
                  <span className="animate-pulse">Generating</span>
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
                  <Wand2 size={15} />
                  {hasKey ? 'Generate Cover Letter' : 'Connect API → Generate'}
                </>
              )}
            </button>
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
                Cover Letter
              </span>
              {output && !loading && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(74,222,128,0.15)', color: 'var(--color-accent)' }}
                >
                  <Sparkles size={10} className="inline mr-1" />
                  Generated
                </span>
              )}
              {loading && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full animate-pulse"
                  style={{ background: 'rgba(163,230,53,0.1)', color: 'var(--color-primary)' }}
                >
                  Writing…
                </span>
              )}
            </div>
            {output && (
              <div className="flex gap-1.5">
                <button
                  onClick={() => setEditing((v) => !v)}
                  className="text-xs px-2.5 py-1.5 rounded-lg transition-colors"
                  style={{
                    color: editing ? 'var(--color-primary)' : 'var(--color-foreground)',
                    background: 'var(--color-muted)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  {editing ? 'Done' : 'Edit'}
                </button>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg"
                  style={{ color: 'var(--color-foreground)', background: 'var(--color-muted)', border: '1px solid var(--color-border)' }}
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <button
                  onClick={handleDownloadTxt}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg"
                  style={{ color: 'var(--color-foreground)', background: 'var(--color-muted)', border: '1px solid var(--color-border)' }}
                >
                  <Download size={12} />
                  .txt
                </button>
                <button
                  onClick={handleDownloadPDF}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg font-semibold"
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

          {/* Scrollable output */}
          <div
            ref={outputRef}
            className="flex-1 overflow-y-auto p-5 min-h-0"
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

            {output ? (
              editing ? (
                <textarea
                  value={output}
                  onChange={(e) => setOutput(e.target.value)}
                  className="w-full resize-none text-sm leading-7 outline-none rounded-xl p-4"
                  style={{
                    background: 'var(--color-muted)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-foreground)',
                    fontFamily: 'var(--font-body)',
                    minHeight: 400,
                    height: '100%',
                  }}
                />
              ) : (
                <div className="relative">
                  <div
                    className="text-sm leading-7 whitespace-pre-wrap"
                    style={{ color: 'var(--color-foreground)', fontFamily: 'var(--font-body)' }}
                  >
                    {output}
                    {loading && (
                      <span
                        className="inline-block w-2 h-4 ml-0.5 animate-pulse rounded-sm"
                        style={{ background: 'var(--color-primary)', verticalAlign: 'text-bottom' }}
                      />
                    )}
                  </div>
                </div>
              )
            ) : !loading ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-16">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: 'rgba(163,230,53,0.08)', border: '1px solid rgba(163,230,53,0.18)' }}
                >
                  <Mail size={28} style={{ color: 'var(--color-primary)' }} />
                </div>
                <h3 className="text-base font-semibold mb-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-foreground)' }}>
                  Your cover letter will appear here
                </h3>
                <p className="text-sm max-w-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                  Fill in the job details on the left and click Generate.
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
