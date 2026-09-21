import type { JobApplication, AppSettings } from './types';
import { PROVIDER_MODELS } from './types';

const JOBS_KEY     = 'careerai_jobs';
const SETTINGS_KEY = 'careerai_settings_v2';

const DEFAULT_SETTINGS: AppSettings = {
  providers: {
    anthropic: { apiKey: '' },
    openai:    { apiKey: '' },
    gemini:    { apiKey: '' },
    ollama:    { baseUrl: 'http://localhost:11434', customModel: 'qwen3.8' },
  },
  activeProvider: 'anthropic',
  activeModel:    'claude-fable-5-1',
};

/** Returns the first valid model ID for a given provider. */
function defaultModelFor(provider: keyof typeof PROVIDER_MODELS): string {
  return PROVIDER_MODELS[provider][0]?.id ?? '';
}

/** Ensures the stored activeModel is still in the current model list. */
function validateModel(settings: AppSettings): AppSettings {
  const validIds = PROVIDER_MODELS[settings.activeProvider].map((m) => m.id);
  if (!validIds.includes(settings.activeModel)) {
    return { ...settings, activeModel: defaultModelFor(settings.activeProvider) };
  }
  return settings;
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppSettings>;
      const merged: AppSettings = {
        ...DEFAULT_SETTINGS,
        ...parsed,
        providers: { ...DEFAULT_SETTINGS.providers, ...(parsed.providers ?? {}) },
      };
      return validateModel(merged);
    }

    // Migrate from old single-key format
    const oldRaw = localStorage.getItem('careerai_settings');
    if (oldRaw) {
      const old = JSON.parse(oldRaw);
      const migrated: AppSettings = {
        ...DEFAULT_SETTINGS,
        providers: {
          ...DEFAULT_SETTINGS.providers,
          anthropic: { apiKey: old.apiKey ?? '' },
        },
      };
      saveSettings(migrated);
      return migrated;
    }
  } catch {}
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function loadJobs(): JobApplication[] {
  try {
    const raw = localStorage.getItem(JOBS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return SAMPLE_JOBS;
}

export function saveJobs(jobs: JobApplication[]): void {
  localStorage.setItem(JOBS_KEY, JSON.stringify(jobs));
}

const SAMPLE_JOBS: JobApplication[] = [
  {
    id: '1',
    company: 'Stripe',
    role: 'Software Engineer II',
    location: 'San Francisco, CA (Hybrid)',
    status: 'interview',
    salary: '$160,000–$210,000',
    appliedDate: '2026-09-08',
    notes: 'Passed phone screen. Technical round scheduled for Sep 28.',
    url: 'https://stripe.com/jobs',
  },
  {
    id: '2',
    company: 'Notion',
    role: 'Product Manager',
    location: 'New York, NY (Remote OK)',
    status: 'screening',
    salary: '$130,000–$170,000',
    appliedDate: '2026-09-12',
    notes: 'Recruiter reached out via LinkedIn. First call went well.',
    url: '',
  },
  {
    id: '3',
    company: 'Figma',
    role: 'Frontend Engineer',
    location: 'Remote',
    status: 'applied',
    salary: '$150,000–$195,000',
    appliedDate: '2026-09-15',
    notes: 'Applied through company website. Great match for my React experience.',
    url: '',
  },
  {
    id: '4',
    company: 'Vercel',
    role: 'Developer Advocate',
    location: 'Remote (US)',
    status: 'bookmarked',
    salary: '$120,000–$155,000',
    appliedDate: '',
    notes: 'Interesting role. Need to tailor resume before applying.',
    url: '',
  },
  {
    id: '5',
    company: 'Linear',
    role: 'Senior Software Engineer',
    location: 'Remote',
    status: 'rejected',
    salary: '$170,000–$220,000',
    appliedDate: '2026-08-28',
    notes: 'Got a generic rejection email after two rounds. Will try again next year.',
    url: '',
  },
  {
    id: '6',
    company: 'Loom',
    role: 'Full Stack Engineer',
    location: 'San Francisco, CA',
    status: 'offer',
    salary: '$145,000–$185,000',
    appliedDate: '2026-09-01',
    notes: 'Offer received! Negotiating equity. Need to decide by Oct 1.',
    url: '',
  },
];
