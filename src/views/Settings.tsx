import { FormEvent, useEffect, useState } from 'react';
import {
  CheckCircle2,
  CircleAlert,
  Database,
  Eye,
  EyeOff,
  Laptop,
  RefreshCw,
  Save,
  Server,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  getModelSettings,
  saveModelSettings,
  type ModelProvider,
  type PublicModelConfig,
} from '../lib/api';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8787';

const PROVIDERS: Array<{
  id: ModelProvider;
  label: string;
  description: string;
  defaultBaseUrl: string;
  defaultModel: string;
  requiresApiKey: boolean;
}> = [
  {
    id: 'vllm',
    label: 'Local vLLM',
    description: 'OpenAI-compatible server running on your computer',
    defaultBaseUrl: 'http://host.docker.internal:8000',
    defaultModel: 'Qwen/Qwen2-VL-2B-Instruct',
    requiresApiKey: true,
  },
  {
    id: 'ollama',
    label: 'Local Ollama',
    description: 'Ollama local model server',
    defaultBaseUrl: 'http://host.docker.internal:11434',
    defaultModel: 'qwen2.5:7b-instruct',
    requiresApiKey: false,
  },
  {
    id: 'openai',
    label: 'OpenAI',
    description: 'OpenAI API through your local backend',
    defaultBaseUrl: 'https://api.openai.com',
    defaultModel: 'gpt-4o-mini',
    requiresApiKey: true,
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    description: 'Anthropic API through your local backend',
    defaultBaseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-3-5-haiku-latest',
    requiresApiKey: true,
  },
];

type FormState = {
  provider: ModelProvider;
  baseUrl: string;
  model: string;
  apiKey: string;
};

function providerInfo(provider: ModelProvider) {
  return PROVIDERS.find((item) => item.id === provider) ?? PROVIDERS[0];
}

export default function SettingsView() {
  const [form, setForm] = useState<FormState>({
    provider: 'vllm',
    baseUrl: 'http://127.0.0.1:8000',
    model: 'Qwen/Qwen2-VL-2B-Instruct',
    apiKey: '',
  });

  const [storedConfig, setStoredConfig] =
    useState<PublicModelConfig | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function loadSettings() {
    setLoading(true);
    setError('');

    try {
      const config = await getModelSettings();

      setStoredConfig(config);
      setForm({
        provider: config.provider,
        baseUrl: config.baseUrl,
        model: config.model,
        apiKey: '',
      });
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Could not load model settings.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSettings();
  }, []);

  function changeProvider(provider: ModelProvider) {
    const nextProvider = providerInfo(provider);

    setForm((current) => ({
      ...current,
      provider,
      baseUrl: nextProvider.defaultBaseUrl,
      model: nextProvider.defaultModel,
      apiKey: '',
    }));
    setStoredConfig((current) => current
      ? { ...current, provider, hasApiKey: current.provider === provider && current.hasApiKey }
      : current);

    setNotice('');
    setError('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (activeProvider.requiresApiKey && !form.apiKey && !storedConfig?.hasApiKey) {
      setError('Enter an API key for this provider before saving.');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');

    try {
      const config = await saveModelSettings({
        provider: form.provider,
        baseUrl: form.baseUrl,
        model: form.model,
        apiKey: form.apiKey || undefined,
      });

      setStoredConfig(config);
      setForm((current) => ({
        ...current,
        apiKey: '',
      }));

      setNotice(
        'Model configuration saved. New AI requests will use this configuration.',
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Could not save model settings.',
      );
    } finally {
      setSaving(false);
    }
  }

  const activeProvider = providerInfo(form.provider);

  return (
    <div className="view-content max-w-5xl">
      <div className="mb-8">
        <div
          className="flex items-center gap-2 text-xs font-semibold tracking-widest mb-2"
          style={{ color: 'var(--color-primary)' }}
        >
          <Sparkles size={14} />
          LOCAL WORKSPACE
        </div>

        <h1
          className="text-3xl font-bold tracking-tight"
          style={{ color: 'var(--color-foreground)' }}
        >
          Settings
        </h1>

        <p
          className="mt-2 max-w-2xl"
          style={{ color: 'var(--color-muted-foreground)' }}
        >
          Configure the provider used by AI requests. Credentials are stored in
          MongoDB and are never returned to the browser after saving.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl p-5 sm:p-6"
        style={{
          background: 'var(--color-card)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              background: 'rgba(163,230,53,0.10)',
              color: 'var(--color-primary)',
            }}
          >
            <Laptop size={20} />
          </div>

          <div>
            <h2
              className="font-semibold"
              style={{ color: 'var(--color-foreground)' }}
            >
              AI model connection
            </h2>

            <p
              className="text-sm mt-1"
              style={{ color: 'var(--color-muted-foreground)' }}
            >
              Select the provider and model used for resume, chat, interview,
              and cover letter requests.
            </p>
          </div>
        </div>

        <div className="mt-6">
          <label
            className="block text-sm font-medium mb-2"
            style={{ color: 'var(--color-foreground)' }}
          >
            Provider
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PROVIDERS.map((provider) => {
              const active = form.provider === provider.id;

              return (
                <button
                  key={provider.id}
                  type="button"
                  disabled={loading || saving}
                  onClick={() => changeProvider(provider.id)}
                  className="rounded-xl p-4 text-left disabled:opacity-60"
                  style={{
                    background: active
                      ? 'rgba(163,230,53,0.10)'
                      : 'var(--color-muted)',
                    border: active
                      ? '1px solid rgba(163,230,53,0.45)'
                      : '1px solid var(--color-border)',
                    color: active
                      ? 'var(--color-primary)'
                      : 'var(--color-foreground)',
                  }}
                >
                  <div className="font-semibold text-sm">
                    {provider.label}
                  </div>

                  <div
                    className="mt-1 text-xs leading-5"
                    style={{
                      color: active
                        ? 'var(--color-primary)'
                        : 'var(--color-muted-foreground)',
                    }}
                  >
                    {provider.description}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <label
            className="flex flex-col gap-2 text-sm font-medium"
            style={{ color: 'var(--color-foreground)' }}
          >
            Base URL
            <input
              value={form.baseUrl}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  baseUrl: event.target.value,
                }))
              }
              disabled={loading || saving}
              placeholder={activeProvider.defaultBaseUrl}
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none disabled:opacity-60"
              style={{
                background: 'var(--color-muted)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-foreground)',
              }}
            />

            <span
              className="text-xs font-normal"
              style={{ color: 'var(--color-muted-foreground)' }}
            >
              In Docker use <code>http://host.docker.internal:8000</code> for vLLM. Do not append
              <code> /v1</code>.
            </span>
          </label>

          <label
            className="flex flex-col gap-2 text-sm font-medium"
            style={{ color: 'var(--color-foreground)' }}
          >
            Model name
            <input
              value={form.model}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  model: event.target.value,
                }))
              }
              disabled={loading || saving}
              placeholder={activeProvider.defaultModel}
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none disabled:opacity-60"
              style={{
                background: 'var(--color-muted)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-foreground)',
              }}
            />

            <span
              className="text-xs font-normal"
              style={{ color: 'var(--color-muted-foreground)' }}
            >
              For vLLM, use the exact model ID returned by
              <code> /v1/models</code>.
            </span>
          </label>
        </div>

        <label
          className="mt-5 flex flex-col gap-2 text-sm font-medium"
          style={{ color: 'var(--color-foreground)' }}
        >
          API key
          <div className="relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={form.apiKey}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  apiKey: event.target.value,
                }))
              }
              disabled={loading || saving}
              placeholder={
                storedConfig?.hasApiKey
                  ? 'A key is already stored. Enter a new key only to replace it.'
                  : activeProvider.requiresApiKey
                    ? 'Enter the provider API key'
                    : 'Optional for this provider'
              }
              className="w-full rounded-lg px-3 py-2.5 pr-12 text-sm outline-none disabled:opacity-60"
              style={{
                background: 'var(--color-muted)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-foreground)',
              }}
            />

            <button
              type="button"
              onClick={() => setShowApiKey((current) => !current)}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-md flex items-center justify-center"
              style={{
                color: 'var(--color-muted-foreground)',
                background: 'transparent',
              }}
              aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
            >
              {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <span
            className="text-xs font-normal"
            style={{ color: 'var(--color-muted-foreground)' }}
          >
            {storedConfig?.hasApiKey
              ? 'A key is stored server-side. Leave this empty to retain it.'
              : 'The key is sent to the local backend when saved and is not returned to the browser.'}
          </span>
        </label>

        {error && (
          <div
            className="mt-5 flex gap-2 rounded-xl px-4 py-3 text-sm"
            style={{
              color: '#F87171',
              background: 'rgba(248,113,113,0.08)',
              border: '1px solid rgba(248,113,113,0.22)',
            }}
          >
            <CircleAlert size={18} className="shrink-0 mt-0.5" />
            <div>{error}</div>
          </div>
        )}

        {notice && (
          <div
            className="mt-5 flex gap-2 rounded-xl px-4 py-3 text-sm"
            style={{
              color: '#A3E635',
              background: 'rgba(163,230,53,0.08)',
              border: '1px solid rgba(163,230,53,0.22)',
            }}
          >
            <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
            <div>{notice}</div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={loading || saving || !form.baseUrl.trim() || !form.model.trim()}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
            style={{
              background: 'linear-gradient(135deg, #84CC16, #A3E635)',
              color: 'var(--color-primary-foreground)',
              boxShadow: 'var(--shadow-btn-glow)',
            }}
          >
            <Save size={16} />
            {saving ? 'Saving…' : 'Save model settings'}
          </button>

          <button
            type="button"
            onClick={() => void loadSettings()}
            disabled={loading || saving}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
            style={{
              background: 'var(--color-muted)',
              color: 'var(--color-foreground)',
              border: '1px solid var(--color-border)',
            }}
          >
            <RefreshCw
              size={16}
              className={loading ? 'animate-spin' : ''}
            />
            Reload
          </button>
        </div>
      </form>

      <section
        className="mt-5 rounded-2xl p-5 sm:p-6"
        style={{
          background: 'var(--color-card)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div className="flex gap-3">
          <div
            className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center"
            style={{
              background: 'rgba(96,165,250,0.10)',
              color: '#60A5FA',
            }}
          >
            <Server size={20} />
          </div>

          <div>
            <h2
              className="font-semibold"
              style={{ color: 'var(--color-foreground)' }}
            >
              Backend connection
            </h2>

            <p
              className="text-sm mt-1"
              style={{ color: 'var(--color-muted-foreground)' }}
            >
              Frontend API endpoint: <code>{API_BASE_URL}</code>
            </p>
          </div>
        </div>

        <div
          className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3"
        >
          <div
            className="rounded-xl p-4"
            style={{
              background: 'var(--color-muted)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div
              className="text-xs uppercase tracking-wide font-semibold"
              style={{ color: 'var(--color-muted-foreground)' }}
            >
              Active provider
            </div>

            <div
              className="mt-2 text-sm font-semibold"
              style={{ color: 'var(--color-foreground)' }}
            >
              {storedConfig
                ? providerInfo(storedConfig.provider).label
                : 'Loading…'}
            </div>
          </div>

          <div
            className="rounded-xl p-4"
            style={{
              background: 'var(--color-muted)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div
              className="text-xs uppercase tracking-wide font-semibold"
              style={{ color: 'var(--color-muted-foreground)' }}
            >
              Stored API key
            </div>

            <div
              className="mt-2 text-sm font-semibold"
              style={{ color: 'var(--color-foreground)' }}
            >
              {storedConfig?.hasApiKey ? 'Configured' : 'Not configured'}
            </div>
          </div>
        </div>
      </section>

      <section
        className="mt-5 rounded-2xl p-5 sm:p-6"
        style={{
          background: 'var(--color-card)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div className="flex gap-3">
          <div
            className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center"
            style={{
              background: 'rgba(163,230,53,0.10)',
              color: 'var(--color-primary)',
            }}
          >
            <ShieldCheck size={20} />
          </div>

          <div>
            <h2
              className="font-semibold"
              style={{ color: 'var(--color-foreground)' }}
            >
              Security note
            </h2>

            <p
              className="text-sm mt-1"
              style={{ color: 'var(--color-muted-foreground)' }}
            >
              This local-development interface sends a key to your local
              backend only when you save it. The backend never sends the saved
              key back to the browser. Before deploying or sharing the app,
              add authentication and encrypt stored provider keys.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
