import { useState } from 'react';
import {
  Eye,
  EyeOff,
  Check,
  Sparkles,
  BookOpen,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useApp } from '../App';
import type { Provider } from '../lib/types';
import { PROVIDER_META, PROVIDER_MODELS } from '../lib/types';

const PROVIDERS: Provider[] = ['anthropic', 'openai', 'gemini', 'ollama'];

const PROVIDER_DOCS: Record<Provider, { url: string; label: string; hint: string }> = {
  anthropic: {
    url: 'https://console.anthropic.com/settings/keys',
    label: 'Get Claude API key',
    hint: 'Your key starts with sk-ant-api03-...',
  },
  openai: {
    url: 'https://platform.openai.com/api-keys',
    label: 'Get OpenAI API key',
    hint: 'Your key starts with sk-proj-... or sk-...',
  },
  gemini: {
    url: 'https://aistudio.google.com/app/apikey',
    label: 'Get Gemini API key',
    hint: 'Obtain from Google AI Studio — free tier available',
  },
  ollama: {
    url: 'https://ollama.ai',
    label: 'Install Ollama',
    hint: 'Run models locally: brew install ollama, then ollama run qwen3.8',
  },
};

const TIPS = [
  { icon: '📄', title: 'Enhance your resume', desc: 'Paste your CV, set a target role, hit Enhance. Instant ATS-optimized version.' },
  { icon: '✉️', title: 'Generate cover letters', desc: 'Add the job description for a 3× more personalized letter in 30 seconds.' },
  { icon: '🔍', title: 'Critique job postings', desc: 'Use Job Critic mode to spot red flags before you spend hours applying.' },
  { icon: '📊', title: 'Track with memory', desc: 'Job Tracker feeds the AI chat — it knows your full application pipeline.' },
];

function MaskedInput({
  value,
  onChange,
  placeholder,
  mono = true,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  mono?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div
      className="flex items-center rounded-xl overflow-hidden"
      style={{ background: 'var(--color-muted)', border: '1px solid var(--color-border)' }}
    >
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 text-sm px-4 py-3 outline-none bg-transparent"
        style={{
          color: 'var(--color-foreground)',
          fontFamily: mono && value ? 'var(--font-mono)' : 'var(--font-body)',
        }}
        autoComplete="off"
        spellCheck={false}
      />
      <button
        onClick={() => setShow((v) => !v)}
        className="px-4 py-3 transition-colors"
        style={{ color: 'var(--color-muted-foreground)' }}
      >
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}

export default function SettingsView() {
  const { settings, updateSettings } = useApp();
  const [draft, setDraft] = useState(settings);
  const [saved, setSaved] = useState(false);
  const [expanded, setExpanded] = useState<Provider>(settings.activeProvider);

  const updateProvider = (provider: Provider, key: string, value: string) =>
    setDraft((d) => ({
      ...d,
      providers: {
        ...d.providers,
        [provider]: { ...d.providers[provider], [key]: value },
      },
    }));

  const setActiveProvider = (p: Provider) => {
    const defaultModel = PROVIDER_MODELS[p][0]?.id ?? '';
    setDraft((d) => ({ ...d, activeProvider: p, activeModel: defaultModel }));
  };

  const setActiveModel = (m: string) => setDraft((d) => ({ ...d, activeModel: m }));

  const handleSave = () => {
    updateSettings(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const hasChanges = JSON.stringify(draft) !== JSON.stringify(settings);

  const providerHasKey = (p: Provider): boolean => {
    if (p === 'ollama') return !!(draft.providers.ollama.baseUrl);
    return !!(draft.providers[p] as { apiKey: string }).apiKey;
  };

  const activeModels = PROVIDER_MODELS[draft.activeProvider];

  return (
    <div className="h-full overflow-y-auto" style={{ background: 'var(--color-background)' }}>
      {/* Header */}
      <div
        className="px-6 py-4"
        style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-card)' }}
      >
        <h1 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--color-foreground)' }}>
          Settings
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--color-muted-foreground)' }}>
          Connect AI providers and choose your active model
        </p>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">

        {/* Active model selector summary */}
        <div
          className="rounded-2xl p-4"
          style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-muted-foreground)' }}>
              Currently Active
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold"
              style={{
                background: PROVIDER_META[draft.activeProvider].bg,
                border: `1px solid ${PROVIDER_META[draft.activeProvider].border}`,
                color: PROVIDER_META[draft.activeProvider].color,
              }}
            >
              {PROVIDER_META[draft.activeProvider].logo}
            </div>
            <div>
              <div className="font-semibold text-sm" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-foreground)' }}>
                {PROVIDER_META[draft.activeProvider].label}
              </div>
              <div className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                {PROVIDER_MODELS[draft.activeProvider].find((m) => m.id === draft.activeModel)?.name ?? draft.activeModel}
              </div>
            </div>
            <div className="flex-1" />
            {providerHasKey(draft.activeProvider) ? (
              <div
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full"
                style={{ background: 'rgba(163,230,53,0.08)', color: 'var(--color-primary)', border: '1px solid rgba(163,230,53,0.18)' }}
              >
                <Wifi size={12} />
                Connected
              </div>
            ) : (
              <div
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full"
                style={{ background: 'rgba(248,113,113,0.1)', color: 'var(--color-destructive)', border: '1px solid rgba(248,113,113,0.2)' }}
              >
                <WifiOff size={12} />
                No key
              </div>
            )}
          </div>

          {/* Model picker for active provider */}
          <div className="mt-4">
            <label className="text-xs mb-2 block" style={{ color: 'var(--color-muted-foreground)' }}>
              Active model
            </label>
            <div className="grid gap-1.5">
              {activeModels.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setActiveModel(m.id)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
                  style={{
                    background: draft.activeModel === m.id ? 'rgba(163,230,53,0.08)' : 'var(--color-muted)',
                    border: draft.activeModel === m.id ? '1px solid rgba(163,230,53,0.22)' : '1px solid var(--color-border)',
                  }}
                >
                  <div
                    className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0"
                    style={{
                      borderColor: draft.activeModel === m.id ? 'var(--color-primary)' : 'var(--color-border)',
                      background: draft.activeModel === m.id ? 'var(--color-primary)' : 'transparent',
                    }}
                  >
                    {draft.activeModel === m.id && <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-primary-foreground)' }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>{m.name}</span>
                    <span className="text-xs ml-2" style={{ color: 'var(--color-muted-foreground)' }}>{m.desc}</span>
                  </div>
                  {m.badge && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full shrink-0"
                      style={{ background: 'rgba(163,230,53,0.1)', color: 'var(--color-primary)', border: '1px solid rgba(163,230,53,0.18)' }}
                    >
                      {m.badge}
                    </span>
                  )}
                </button>
              ))}
              {draft.activeProvider === 'ollama' && draft.activeModel === 'custom' && (
                <input
                  type="text"
                  placeholder="Enter Ollama model name (e.g. qwen3.8)"
                  value={draft.providers.ollama.customModel}
                  onChange={(e) => updateProvider('ollama', 'customModel', e.target.value)}
                  className="w-full text-sm px-3 py-2.5 rounded-xl outline-none"
                  style={{
                    background: 'var(--color-muted)',
                    border: '1px solid var(--color-primary)',
                    color: 'var(--color-foreground)',
                    fontFamily: 'var(--font-mono)',
                  }}
                />
              )}
            </div>
          </div>
        </div>

        {/* Provider cards */}
        <section>
          <h2
            className="font-bold mb-4"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--color-foreground)' }}
          >
            AI Providers
          </h2>
          <div className="space-y-3">
            {PROVIDERS.map((p) => {
              const meta = PROVIDER_META[p];
              const docs = PROVIDER_DOCS[p];
              const isActive = draft.activeProvider === p;
              const hasKey = providerHasKey(p);
              const isOpen = expanded === p;

              return (
                <div
                  key={p}
                  className="rounded-2xl overflow-hidden transition-all"
                  style={{
                    background: 'var(--color-card)',
                    border: isActive
                      ? `1px solid ${meta.color}50`
                      : '1px solid var(--color-border)',
                    boxShadow: isActive ? `0 0 0 1px ${meta.color}20` : 'none',
                  }}
                >
                  {/* Header row */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-base font-bold shrink-0"
                      style={{ background: meta.bg, border: `1px solid ${meta.border}`, color: meta.color }}
                    >
                      {meta.logo}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-foreground)' }}>
                          {meta.label}
                        </span>
                        {hasKey && (
                          <span className="text-xs" style={{ color: 'var(--color-primary)' }}>●</span>
                        )}
                      </div>
                      <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                        {p === 'ollama'
                          ? draft.providers.ollama.baseUrl || 'localhost:11434'
                          : hasKey ? 'API key configured' : 'No key added'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {!isActive && (
                        <button
                          onClick={() => { setActiveProvider(p); setExpanded(p); }}
                          className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
                          style={{
                            background: meta.bg,
                            color: meta.color,
                            border: `1px solid ${meta.border}`,
                          }}
                        >
                          Use this
                        </button>
                      )}
                      {isActive && (
                        <span
                          className="text-xs px-3 py-1.5 rounded-lg font-medium"
                          style={{ background: 'rgba(163,230,53,0.1)', color: 'var(--color-primary)', border: '1px solid rgba(163,230,53,0.18)' }}
                        >
                          Active
                        </span>
                      )}
                      <button
                        onClick={() => setExpanded(isOpen ? ('' as Provider) : p)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ background: 'var(--color-muted)' }}
                      >
                        {isOpen
                          ? <ChevronUp size={14} style={{ color: 'var(--color-muted-foreground)' }} />
                          : <ChevronDown size={14} style={{ color: 'var(--color-muted-foreground)' }} />
                        }
                      </button>
                    </div>
                  </div>

                  {/* Expanded config */}
                  {isOpen && (
                    <div
                      className="px-4 pb-4 pt-1 space-y-3"
                      style={{ borderTop: '1px solid var(--color-border)' }}
                    >
                      {p === 'ollama' ? (
                        <>
                          <div>
                            <label className="text-xs mb-1.5 block" style={{ color: 'var(--color-muted-foreground)' }}>
                              Ollama base URL
                            </label>
                            <input
                              type="text"
                              value={draft.providers.ollama.baseUrl}
                              onChange={(e) => updateProvider('ollama', 'baseUrl', e.target.value)}
                              placeholder="http://localhost:11434"
                              className="w-full text-sm px-4 py-2.5 rounded-xl outline-none"
                              style={{
                                background: 'var(--color-muted)',
                                border: '1px solid var(--color-border)',
                                color: 'var(--color-foreground)',
                                fontFamily: 'var(--font-mono)',
                              }}
                            />
                          </div>
                          <div>
                            <label className="text-xs mb-1.5 block" style={{ color: 'var(--color-muted-foreground)' }}>
                              Default model name
                            </label>
                            <input
                              type="text"
                              value={draft.providers.ollama.customModel}
                              onChange={(e) => updateProvider('ollama', 'customModel', e.target.value)}
                              placeholder="qwen3.8"
                              className="w-full text-sm px-4 py-2.5 rounded-xl outline-none"
                              style={{
                                background: 'var(--color-muted)',
                                border: '1px solid var(--color-border)',
                                color: 'var(--color-foreground)',
                                fontFamily: 'var(--font-mono)',
                              }}
                            />
                          </div>
                          <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                            Ollama uses an OpenAI-compatible API. Make sure Ollama is running with CORS enabled:{' '}
                            <code
                              className="px-1.5 py-0.5 rounded"
                              style={{ background: 'var(--color-secondary)', color: 'var(--color-secondary-foreground)', fontSize: 11 }}
                            >
                              OLLAMA_ORIGINS=* ollama serve
                            </code>
                          </p>
                        </>
                      ) : (
                        <div>
                          <label className="text-xs mb-1.5 block" style={{ color: 'var(--color-muted-foreground)' }}>
                            API Key
                          </label>
                          <MaskedInput
                            value={(draft.providers[p] as { apiKey: string }).apiKey}
                            onChange={(v) => updateProvider(p, 'apiKey', v)}
                            placeholder={docs.hint}
                          />
                        </div>
                      )}
                      <a
                        href={docs.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs"
                        style={{ color: meta.color }}
                      >
                        {docs.label}
                        <ExternalLink size={11} />
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Save */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: saved
                ? 'rgba(163,230,53,0.1)'
                : hasChanges
                  ? 'linear-gradient(135deg, #84CC16, #A3E635)'
                  : 'var(--color-muted)',
              boxShadow: hasChanges && !saved ? '0 2px 12px rgba(163,230,53,0.25)' : 'none',
              color: saved
                ? 'var(--color-primary)'
                : hasChanges
                  ? 'var(--color-primary-foreground)'
                  : 'var(--color-muted-foreground)',
              border: saved ? '1px solid rgba(163,230,53,0.22)' : 'none',
              cursor: hasChanges || saved ? 'pointer' : 'default',
            }}
          >
            {saved ? (
              <><Check size={15} /> Saved!</>
            ) : (
              <><Sparkles size={15} /> Save Settings</>
            )}
          </button>
          {hasChanges && (
            <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
              Unsaved changes
            </span>
          )}
        </div>

        {/* Quick start */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <BookOpen size={15} style={{ color: 'var(--color-primary)' }} />
            <h2 className="font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-foreground)' }}>
              Quick Start
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {TIPS.map(({ icon, title, desc }) => (
              <div
                key={title}
                className="rounded-2xl p-4"
                style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}
              >
                <div className="text-2xl mb-2">{icon}</div>
                <div className="text-sm font-semibold mb-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-foreground)' }}>
                  {title}
                </div>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--color-muted-foreground)' }}>{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Privacy */}
        <div
          className="rounded-2xl p-4 text-xs"
          style={{ background: 'rgba(163,230,53,0.04)', border: '1px solid rgba(163,230,53,0.1)', color: 'var(--color-muted-foreground)' }}
        >
          <span className="font-semibold" style={{ color: 'var(--color-primary)' }}>Privacy: </span>
          CareerAI runs entirely in your browser. API keys are stored only in localStorage and API requests go directly to the respective provider — nothing passes through any third-party server.
        </div>
      </div>
    </div>
  );
}
