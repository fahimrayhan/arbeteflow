import { useState, useRef, useEffect } from 'react';
import { Send, Trash2, AlertCircle, Bot, User, ArrowRight, Lightbulb, ChevronDown, Database } from 'lucide-react';
import { useApp } from '../App';
import { callModel, buildJobMemory, CHAT_SYSTEMS } from '../lib/api';
import type { ChatMode, Message, Provider } from '../lib/types';
import { PROVIDER_META, PROVIDER_MODELS } from '../lib/types';
import { loadJobs } from '../lib/storage';

const MODES: { id: ChatMode; label: string; emoji: string; placeholder: string }[] = [
  {
    id: 'resume',
    label: 'Resume Coach',
    emoji: '📄',
    placeholder: 'Paste your resume or ask for feedback on a specific section...',
  },
  {
    id: 'career',
    label: 'Career Advisor',
    emoji: '🧭',
    placeholder: 'Ask about career pivots, skill gaps, salary negotiation, or your next move...',
  },
  {
    id: 'jobcritic',
    label: 'Job Critic',
    emoji: '🔍',
    placeholder: "Paste a job description and I'll give you an honest breakdown...",
  },
];

const SUGGESTIONS: Record<ChatMode, string[]> = {
  resume: [
    'Review my resume for a software engineering role',
    'What are the biggest red flags in my CV?',
    'How can I quantify my achievements better?',
    'Is my resume ATS-optimized?',
    'How should I handle a gap in employment?',
  ],
  career: [
    'I want to transition from engineering to product management',
    'Should I take a startup role or a big-tech job?',
    'How do I negotiate a higher salary offer?',
    'What skills should I build for a data science career?',
    'How do I build a personal brand in my industry?',
  ],
  jobcritic: [
    'Analyze this job description for red flags',
    'Is "competitive salary" actually competitive for this role?',
    'What questions should I ask about company culture?',
    'This job requires 5 years for an "entry level" role — should I apply?',
    'Is this startup worth the equity risk?',
  ],
};

function uid() {
  return Math.random().toString(36).slice(2);
}

/* ─── Inline model picker ────────────────────────────────────────────────── */
function ModelPicker() {
  const { settings, updateSettings } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const activeMeta = PROVIDER_META[settings.activeProvider];
  const activeModelName =
    PROVIDER_MODELS[settings.activeProvider].find((m) => m.id === settings.activeModel)?.name
    ?? settings.activeModel;

  const select = (provider: Provider, modelId: string) => {
    updateSettings({ ...settings, activeProvider: provider, activeModel: modelId });
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
        style={{
          background: activeMeta.bg,
          border: `1px solid ${activeMeta.border}`,
          color: activeMeta.color,
        }}
      >
        <span style={{ fontSize: 13 }}>{activeMeta.logo}</span>
        <span style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {activeModelName}
        </span>
        <ChevronDown size={11} />
      </button>

      {open && (
        <div
          className="absolute bottom-full mb-2 left-0 rounded-2xl overflow-hidden z-30"
          style={{
            background: 'var(--color-card)',
            border: '1px solid var(--color-border)',
            boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
            width: 320,
          }}
        >
          {(Object.entries(PROVIDER_MODELS) as [Provider, typeof PROVIDER_MODELS[Provider]][]).map(([provider, models]) => {
            const meta = PROVIDER_META[provider];
            return (
              <div key={provider} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <div
                  className="flex items-center gap-2 px-4 py-2"
                  style={{ background: meta.bg }}
                >
                  <span style={{ color: meta.color, fontSize: 13, fontWeight: 700 }}>{meta.logo}</span>
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: meta.color }}>
                    {meta.label}
                  </span>
                </div>
                {models.map((m) => {
                  const isActive = settings.activeProvider === provider && settings.activeModel === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => select(provider, m.id)}
                      className="w-full text-left px-4 py-2.5 flex items-center gap-2 transition-colors"
                      style={{
                        background: isActive ? 'rgba(163,230,53,0.07)' : 'transparent',
                        borderLeft: isActive ? '2px solid var(--color-primary)' : '2px solid transparent',
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm" style={{ color: 'var(--color-foreground)', fontWeight: isActive ? 600 : 400 }}>
                          {m.name}
                        </div>
                        <div className="text-xs truncate" style={{ color: 'var(--color-muted-foreground)' }}>
                          {m.desc}
                        </div>
                      </div>
                      {m.badge && (
                        <span
                          className="text-xs px-2 py-0.5 rounded-full shrink-0"
                          style={{ background: `${meta.color}18`, color: meta.color, border: `1px solid ${meta.color}30` }}
                        >
                          {m.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Memory badge ───────────────────────────────────────────────────────── */
function MemoryBadge({ useMemory, onToggle }: { useMemory: boolean; onToggle: () => void }) {
  const jobs = loadJobs();
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
      style={{
        background: useMemory ? 'rgba(163,230,53,0.08)' : 'var(--color-muted)',
        border: useMemory ? '1px solid rgba(163,230,53,0.22)' : '1px solid var(--color-border)',
        color: useMemory ? 'var(--color-primary)' : 'var(--color-muted-foreground)',
      }}
      title={useMemory ? 'Job tracker memory is ON — AI knows your applications' : 'Enable job tracker memory'}
    >
      <Database size={11} />
      {useMemory ? `Memory: ${jobs.length} jobs` : 'Memory off'}
    </button>
  );
}

/* ─── Main Chat view ─────────────────────────────────────────────────────── */
export default function Chat() {
  const { settings, navigate } = useApp();
  const [mode, setMode] = useState<ChatMode>('resume');
  const [conversations, setConversations] = useState<Record<ChatMode, Message[]>>({
    resume: [],
    career: [],
    jobcritic: [],
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [useMemory, setUseMemory] = useState(true);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const messages = conversations[mode];

  /* Scroll to bottom whenever messages update or mode switches */
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    // instant scroll when loading (streaming), smooth otherwise
    el.scrollTo({ top: el.scrollHeight, behavior: loading ? 'instant' : 'smooth' });
  }, [conversations, mode, loading]);

  const setMessages = (msgs: Message[] | ((prev: Message[]) => Message[])) => {
    setConversations((prev) => ({
      ...prev,
      [mode]: typeof msgs === 'function' ? msgs(prev[mode]) : msgs,
    }));
  };

  const handleSend = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || loading) return;

    const hasKey = (() => {
      if (settings.activeProvider === 'ollama') return !!settings.providers.ollama.baseUrl;
      return !!(settings.providers[settings.activeProvider] as { apiKey: string }).apiKey;
    })();
    if (!hasKey) { navigate('settings'); return; }

    const userMsg: Message = { id: uid(), role: 'user', content: text, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setLoading(true);
    setError('');

    const assistantId = uid();
    const assistantMsg: Message = { id: assistantId, role: 'assistant', content: '', timestamp: new Date() };
    setMessages((prev) => [...prev, assistantMsg]);

    const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));

    // Build system prompt — optionally inject job tracker memory
    const memory = useMemory ? buildJobMemory(loadJobs()) : '';
    const system = CHAT_SYSTEMS[mode] + memory;

    await callModel(settings, history, system, {
      onToken: (t) =>
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + t } : m)),
        ),
      onDone: () => setLoading(false),
      onError: (e) => {
        setError(e);
        setLoading(false);
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      },
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => setMessages([]);

  const currentMode = MODES.find((m) => m.id === mode)!;
  const activeMeta = PROVIDER_META[settings.activeProvider];

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--color-background)' }}>
      {/* Mode tabs */}
      <div
        className="flex items-center gap-1 px-4 py-3 shrink-0"
        style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-card)' }}
      >
        {MODES.map(({ id, label, emoji }) => (
          <button
            key={id}
            onClick={() => { setMode(id); setError(''); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              background: mode === id ? 'rgba(163,230,53,0.1)' : 'transparent',
              border: mode === id ? '1px solid rgba(163,230,53,0.22)' : '1px solid transparent',
              color: mode === id ? 'var(--color-foreground)' : 'var(--color-muted-foreground)',
              fontFamily: 'var(--font-display)',
              fontWeight: mode === id ? 600 : 400,
            }}
          >
            <span>{emoji}</span>
            {label}
            {conversations[id].length > 0 && (
              <span
                className="text-xs px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(163,230,53,0.1)', color: 'var(--color-primary)' }}
              >
                {conversations[id].filter((m) => m.role === 'user').length}
              </span>
            )}
          </button>
        ))}
        <div className="flex-1" />
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--color-muted-foreground)', background: 'var(--color-muted)' }}
          >
            <Trash2 size={12} />
            Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto min-h-0 px-4 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 text-3xl"
              style={{ background: 'rgba(163,230,53,0.08)', border: '1px solid rgba(163,230,53,0.18)' }}
            >
              {currentMode.emoji}
            </div>
            <h3 className="text-lg font-bold mb-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-foreground)' }}>
              {currentMode.label}
            </h3>
            <p className="text-sm mb-1 max-w-sm" style={{ color: 'var(--color-muted-foreground)' }}>
              {mode === 'resume' && 'Paste your resume or CV and get detailed, honest feedback on how to improve it.'}
              {mode === 'career' && 'Get practical career advice — no fluff, no generic tips. Just honest, actionable guidance.'}
              {mode === 'jobcritic' && 'Paste a job description and get an unfiltered breakdown of what the role is really like.'}
            </p>
            {useMemory && (
              <div
                className="flex items-center gap-1.5 text-xs mt-2 mb-5 px-3 py-1.5 rounded-full"
                style={{ background: 'rgba(163,230,53,0.07)', color: 'var(--color-primary)', border: '1px solid rgba(163,230,53,0.18)' }}
              >
                <Database size={11} />
                AI has access to your job tracker ({loadJobs().length} applications)
              </div>
            )}

            <div className="w-full max-w-lg">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb size={13} style={{ color: 'var(--color-muted-foreground)' }} />
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-muted-foreground)' }}>
                  Try asking
                </span>
              </div>
              <div className="grid gap-2">
                {SUGGESTIONS[mode].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => handleSend(suggestion)}
                    className="text-left text-sm px-4 py-3 rounded-xl transition-all flex items-center justify-between group"
                    style={{
                      background: 'var(--color-card)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-secondary-foreground)',
                    }}
                  >
                    <span>{suggestion}</span>
                    <ArrowRight
                      size={14}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: 'var(--color-primary)' }}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Avatar */}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-sm font-bold"
                  style={
                    msg.role === 'user'
                      ? { background: 'linear-gradient(135deg, #84CC16, #A3E635)', color: 'var(--color-primary-foreground)' }
                      : { background: activeMeta.bg, border: `1px solid ${activeMeta.border}`, color: activeMeta.color }
                  }
                >
                  {msg.role === 'user'
                    ? <User size={14} style={{ color: 'var(--color-primary-foreground)' }} />
                    : <span style={{ fontSize: 14 }}>{activeMeta.logo}</span>
                  }
                </div>

                {/* Bubble */}
                <div
                  className={`max-w-[78%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${msg.role === 'user' ? 'rounded-tr-sm' : 'rounded-tl-sm'
                    }`}
                  style={{
                    background: msg.role === 'user' ? 'rgba(163,230,53,0.1)' : 'var(--color-card)',
                    border: msg.role === 'user'
                      ? '1px solid rgba(163,230,53,0.18)'
                      : '1px solid var(--color-border)',
                    color: 'var(--color-foreground)',
                  }}
                >
                  {msg.content === '' && loading ? (
                    <span className="flex gap-1 py-1">
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="w-1.5 h-1.5 rounded-full animate-bounce"
                          style={{ background: activeMeta.color, animationDelay: `${i * 0.15}s` }}
                        />
                      ))}
                    </span>
                  ) : (
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  )}
                </div>
              </div>
            ))}

            {error && (
              <div
                className="flex items-start gap-3 p-4 rounded-xl"
                style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)' }}
              >
                <AlertCircle size={16} style={{ color: 'var(--color-destructive)', marginTop: 2 }} />
                <div>
                  <div className="text-sm font-semibold" style={{ color: 'var(--color-destructive)' }}>Error</div>
                  <div className="text-xs mt-1" style={{ color: '#FDA4A4' }}>{error}</div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Input area */}
      <div
        className="px-4 py-3 shrink-0 space-y-2"
        style={{ borderTop: '1px solid var(--color-border)', background: 'var(--color-card)' }}
      >
        {/* Toolbar: model picker + memory toggle */}
        <div className="flex items-center gap-2">
          <ModelPicker />
          <MemoryBadge useMemory={useMemory} onToggle={() => setUseMemory((v) => !v)} />
          <div className="flex-1" />
          <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
            Enter to send · Shift+Enter for new line
          </span>
        </div>

        {/* Textarea + send */}
        <div
          className="flex items-end gap-3 rounded-2xl px-4 py-3"
          style={{ background: 'var(--color-muted)', border: '1px solid var(--color-border)' }}
        >
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
            }}
            onKeyDown={handleKeyDown}
            placeholder={currentMode.placeholder}
            className="flex-1 resize-none outline-none text-sm leading-relaxed bg-transparent"
            style={{ color: 'var(--color-foreground)', maxHeight: 160 }}
          />
          <button
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all shrink-0"
            style={{
              background: input.trim()
                ? 'linear-gradient(135deg, #84CC16, #A3E635)'
                : 'var(--color-secondary)',
              boxShadow: input.trim() ? '0 2px 10px rgba(163,230,53,0.28)' : 'none',
              cursor: input.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            <Send size={15} style={{ color: input.trim() ? 'var(--color-primary-foreground)' : 'var(--color-muted-foreground)' }} />
          </button>
        </div>
      </div>
    </div>
  );
}
