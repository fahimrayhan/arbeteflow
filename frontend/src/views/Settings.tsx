import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Eye, EyeOff, Laptop, RefreshCw, Save, Server, ShieldCheck } from 'lucide-react';
import { Alert } from '../components/ui/Alert';
import { OptionCard } from '../components/ui/OptionCard';
import { PageHeader } from '../components/ui/PageHeader';
import {
  cardStyle,
  fieldStyle,
  foregroundText,
  iconTileStyle,
  mutedText,
  primaryButtonStyle,
  secondaryButtonStyle,
} from '../components/ui/styles';
import { TextField } from '../components/ui/TextField';
import { getModelSettings, saveModelSettings } from '../lib/api';
import { API_BASE_URL } from '../lib/config';
import { getErrorMessage } from '../lib/errors';
import type { ModelProvider, PublicModelConfig } from '../lib/types';

const OLLAMA_CLOUD_URL = 'https://ollama.com';

type ProviderInfo = {
  id: ModelProvider;
  label: string;
  description: string;
  defaultBaseUrl: string;
  defaultModel: string;
  requiresApiKey: boolean;
  baseUrlHint: ReactNode;
  modelHint: ReactNode;
  apiKeyPlaceholder: string;
};

const PROVIDERS: ProviderInfo[] = [
  {
    id: 'vllm',
    label: 'Local vLLM',
    description: 'OpenAI-compatible server running on your computer',
    defaultBaseUrl: 'http://host.docker.internal:8000',
    defaultModel: 'Qwen/Qwen2-VL-2B-Instruct',
    requiresApiKey: true,
    baseUrlHint: (
      <>
        In Docker use <code>http://host.docker.internal:8000</code> for vLLM. Do not append
        <code> /v1</code>.
      </>
    ),
    modelHint: (
      <>
        Use the exact model ID returned by
        <code> /v1/models</code>.
      </>
    ),
    apiKeyPlaceholder: 'Enter the provider API key',
  },
  {
    id: 'ollama',
    label: 'Ollama (local or cloud)',
    description: 'Ollama on your computer, or Ollama cloud with an API key',
    defaultBaseUrl: 'http://host.docker.internal:11434',
    defaultModel: 'qwen2.5:7b-instruct',
    requiresApiKey: false,
    baseUrlHint: (
      <>
        Local: <code>http://host.docker.internal:11434</code>. Ollama cloud:{' '}
        <code>{OLLAMA_CLOUD_URL}</code> (needs an API key).
      </>
    ),
    modelHint: (
      <>
        Any model you have pulled locally, or a cloud model such as <code>gpt-oss:120b</code>.
      </>
    ),
    apiKeyPlaceholder: 'Only needed for Ollama cloud',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    description: 'OpenAI or another OpenAI-compatible server',
    defaultBaseUrl: 'https://api.openai.com',
    defaultModel: 'gpt-4o-mini',
    requiresApiKey: true,
    baseUrlHint: (
      <>
        The OpenAI API address. Do not append <code>/v1</code>. For a local server in Docker
        (such as LM Studio), use <code>http://host.docker.internal:1234</code>.
      </>
    ),
    modelHint: <>A model ID from your OpenAI account, e.g. <code>gpt-4o-mini</code>.</>,
    apiKeyPlaceholder: 'Enter the provider API key',
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    description: 'Anthropic API through your local backend',
    defaultBaseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-3-5-haiku-latest',
    requiresApiKey: true,
    baseUrlHint: <>The Anthropic API address.</>,
    modelHint: <>A Claude model ID from your Anthropic account.</>,
    apiKeyPlaceholder: 'Enter the provider API key',
  },
];

/** Ollama's hosted API rejects requests without a key. */
function isOllamaCloud(provider: ModelProvider, baseUrl: string): boolean {
  if (provider !== 'ollama') return false;

  try {
    return new URL(baseUrl).hostname === 'ollama.com';
  } catch {
    return false;
  }
}

type FormState = {
  provider: ModelProvider;
  baseUrl: string;
  model: string;
  apiKey: string;
};

function providerInfo(provider: ModelProvider) {
  return PROVIDERS.find((item) => item.id === provider) ?? PROVIDERS[0];
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--color-muted)', border: '1px solid var(--color-border)' }}>
      <div className="text-xs uppercase tracking-wide font-semibold" style={mutedText}>
        {label}
      </div>

      <div className="mt-2 text-sm font-semibold" style={foregroundText}>
        {value}
      </div>
    </div>
  );
}

export default function SettingsView() {
  const [form, setForm] = useState<FormState>({
    provider: 'vllm',
    baseUrl: 'http://127.0.0.1:8000',
    model: 'Qwen/Qwen2-VL-2B-Instruct',
    apiKey: '',
  });

  const [storedConfig, setStoredConfig] = useState<PublicModelConfig | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const activeProvider = providerInfo(form.provider);
  const isBusy = loading || saving;
  const keyRequired =
    activeProvider.requiresApiKey || isOllamaCloud(form.provider, form.baseUrl);

  function updateField(field: keyof Omit<FormState, 'provider'>, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

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
      setError(getErrorMessage(loadError, 'Could not load model settings.'));
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
    // A stored key only carries over if it belongs to the selected provider.
    setStoredConfig((current) =>
      current
        ? { ...current, provider, hasApiKey: current.provider === provider && current.hasApiKey }
        : current,
    );

    setNotice('');
    setError('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (keyRequired && !form.apiKey && !storedConfig?.hasApiKey) {
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
      setForm((current) => ({ ...current, apiKey: '' }));
      setNotice('Model configuration saved. New AI requests will use this configuration.');
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'Could not save model settings.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="view-content max-w-5xl">
      <PageHeader
        className="mb-8"
        eyebrow="LOCAL WORKSPACE"
        title="Settings"
        description="Configure the provider used by AI requests. Credentials are stored in MongoDB and are never returned to the browser after saving."
        descriptionClassName="mt-2 max-w-2xl"
      />

      <form onSubmit={handleSubmit} className="rounded-2xl p-5 sm:p-6" style={cardStyle}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={iconTileStyle}>
            <Laptop size={20} />
          </div>

          <div>
            <h2 className="font-semibold" style={foregroundText}>
              AI model connection
            </h2>

            <p className="text-sm mt-1" style={mutedText}>
              Select the provider and model used for resume, chat, interview,
              and cover letter requests.
            </p>
          </div>
        </div>

        <div className="mt-6">
          <p className="block text-sm font-medium mb-2" style={foregroundText}>
            Provider
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PROVIDERS.map((provider) => (
              <OptionCard
                key={provider.id}
                label={provider.label}
                description={provider.description}
                active={form.provider === provider.id}
                disabled={isBusy}
                onSelect={() => changeProvider(provider.id)}
                className="rounded-xl p-4 text-left disabled:opacity-60"
                descriptionClassName="mt-1 text-xs leading-5"
              />
            ))}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <TextField
            label="Base URL"
            type="url"
            value={form.baseUrl}
            onChange={(event) => updateField('baseUrl', event.target.value)}
            disabled={isBusy}
            placeholder={activeProvider.defaultBaseUrl}
            maxLength={500}
            hint={activeProvider.baseUrlHint}
          />

          <TextField
            label="Model name"
            value={form.model}
            onChange={(event) => updateField('model', event.target.value)}
            disabled={isBusy}
            placeholder={activeProvider.defaultModel}
            maxLength={300}
            hint={activeProvider.modelHint}
          />
        </div>

        <label className="mt-5 flex flex-col gap-2 text-sm font-medium" style={foregroundText}>
          API key
          <div className="relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={form.apiKey}
              onChange={(event) => updateField('apiKey', event.target.value)}
              disabled={isBusy}
              autoComplete="off"
              maxLength={1000}
              placeholder={
                storedConfig?.hasApiKey
                  ? 'A key is already stored. Enter a new key only to replace it.'
                  : keyRequired
                    ? 'Enter the provider API key'
                    : activeProvider.apiKeyPlaceholder === 'Enter the provider API key'
                      ? 'Optional for this provider'
                      : activeProvider.apiKeyPlaceholder
              }
              className="w-full rounded-lg px-3 py-2.5 pr-12 text-sm outline-none disabled:opacity-60"
              style={fieldStyle}
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

          <span className="text-xs font-normal" style={mutedText}>
            {storedConfig?.hasApiKey
              ? 'A key is stored server-side. Leave this empty to retain it.'
              : 'The key is sent to the local backend when saved and is not returned to the browser.'}
          </span>
        </label>

        {error && <Alert className="mt-5">{error}</Alert>}

        {notice && (
          <Alert tone="success" className="mt-5">
            {notice}
          </Alert>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={isBusy || !form.baseUrl.trim() || !form.model.trim()}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
            style={primaryButtonStyle}
          >
            <Save size={16} />
            {saving ? 'Saving…' : 'Save model settings'}
          </button>

          <button
            type="button"
            onClick={() => void loadSettings()}
            disabled={isBusy}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
            style={secondaryButtonStyle}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Reload
          </button>
        </div>
      </form>

      <section className="mt-5 rounded-2xl p-5 sm:p-6" style={cardStyle}>
        <div className="flex gap-3">
          <div
            className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center"
            style={{
              background: 'rgba(96,165,250,0.10)',
              color: 'var(--info-text)',
            }}
          >
            <Server size={20} />
          </div>

          <div>
            <h2 className="font-semibold" style={foregroundText}>
              Backend connection
            </h2>

            <p className="text-sm mt-1" style={mutedText}>
              Frontend API endpoint: <code>{API_BASE_URL}</code>
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
          <InfoTile
            label="Active provider"
            value={storedConfig ? providerInfo(storedConfig.provider).label : 'Loading…'}
          />
          <InfoTile
            label="Stored API key"
            value={storedConfig?.hasApiKey ? 'Configured' : 'Not configured'}
          />
        </div>
      </section>

      <section className="mt-5 rounded-2xl p-5 sm:p-6" style={cardStyle}>
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center" style={iconTileStyle}>
            <ShieldCheck size={20} />
          </div>

          <div>
            <h2 className="font-semibold" style={foregroundText}>
              Security note
            </h2>

            <p className="text-sm mt-1" style={mutedText}>
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
