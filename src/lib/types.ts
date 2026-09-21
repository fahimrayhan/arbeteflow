export type View = 'resume' | 'coverletter' | 'chat' | 'tracker' | 'settings';

export type ChatMode = 'resume' | 'career' | 'jobcritic';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export type JobStatus =
  | 'bookmarked'
  | 'applied'
  | 'screening'
  | 'interview'
  | 'offer'
  | 'rejected';

export interface JobApplication {
  id: string;
  company: string;
  role: string;
  location: string;
  status: JobStatus;
  salary?: string;
  appliedDate: string;
  deadline?: string;
  notes: string;
  url?: string;
  jobDescription?: string;
}

/* ─── Multi-provider AI ─────────────────────────────────────────────────── */

export type Provider = 'anthropic' | 'openai' | 'gemini' | 'ollama';

export interface ProviderConfigs {
  anthropic: { apiKey: string };
  openai: { apiKey: string };
  gemini: { apiKey: string };
  ollama: { baseUrl: string; customModel: string };
}

export interface AppSettings {
  providers: ProviderConfigs;
  activeProvider: Provider;
  activeModel: string;
}

export interface ModelOption {
  id: string;
  name: string;
  desc: string;
  badge?: string;
}

export const PROVIDER_MODELS: Record<Provider, ModelOption[]> = {
  anthropic: [
    { id: 'claude-fable-5-1',           name: 'Claude Fable 5.1',  desc: 'Demanding reasoning and long-horizon work', badge: 'Most Powerful' },
    { id: 'claude-opus-5',              name: 'Claude Opus 5',     desc: 'Complex agentic work and enterprise tasks', badge: 'Recommended' },
    { id: 'claude-sonnet-5',            name: 'Claude Sonnet 5',   desc: 'Best balance of speed and intelligence',    badge: 'Balanced' },
    { id: 'claude-haiku-4-5',           name: 'Claude Haiku 4.5',  desc: 'Fast, lightweight, great for chat',          badge: 'Fastest' },
  ],
  openai: [
    { id: 'gpt-6-astra',    name: 'GPT-6 Astra',  desc: 'Most capable for complex reasoning and coding', badge: 'Most Powerful' },
    { id: 'gpt-5.6-sol',    name: 'GPT-5.6 Sol',   desc: 'Flagship model for complex professional work', badge: 'Recommended' },
    { id: 'gpt-5.6-terra',  name: 'GPT-5.6 Terra', desc: 'Strong intelligence at a lower cost',          badge: 'Balanced' },
    { id: 'gpt-5.6-luna',   name: 'GPT-5.6 Luna',  desc: 'Fast and cost-efficient for high-volume tasks', badge: 'Fastest' },
  ],
  gemini: [
    { id: 'gemini-3.8-flash',       name: 'Gemini 3.8 Flash',       desc: 'Latest stable model for complex agentic work', badge: 'Most Capable' },
    { id: 'gemini-3.7-flash',       name: 'Gemini 3.7 Flash',       desc: 'Strong reasoning with fast responses',         badge: 'Recommended' },
    { id: 'gemini-3.6-flash',       name: 'Gemini 3.6 Flash',       desc: 'Fast, capable multimodal model',               badge: 'Fast' },
    { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro',          desc: 'Advanced preview model for complex problems',  badge: 'Preview' },
  ],
  ollama: [
    { id: 'qwen3.8',   name: 'Qwen 3.8',   desc: 'Latest general-purpose open model',       badge: 'Recommended' },
    { id: 'qwen3.5',   name: 'Qwen 3.5',   desc: 'Multimodal model with strong tool use',  badge: '' },
    { id: 'gemma4',    name: 'Gemma 4',    desc: 'Frontier-level local reasoning and coding', badge: '' },
    { id: 'gpt-oss',   name: 'GPT-OSS',    desc: 'Open-weight reasoning and agentic model', badge: '' },
    { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash', desc: 'Fast reasoning with a long context window', badge: '' },
    { id: 'custom',    name: 'Custom model', desc: 'Enter any Ollama model name',             badge: '' },
  ],
};

export const PROVIDER_META: Record<Provider, { label: string; color: string; bg: string; border: string; logo: string }> = {
  anthropic: {
    label: 'Claude',
    color: '#D97757',
    bg: 'rgba(217,119,87,0.1)',
    border: 'rgba(217,119,87,0.25)',
    logo: '◆',
  },
  openai: {
    label: 'ChatGPT',
    color: '#10A37F',
    bg: 'rgba(16,163,127,0.1)',
    border: 'rgba(16,163,127,0.25)',
    logo: '⬡',
  },
  gemini: {
    label: 'Gemini',
    color: '#4F8EF7',
    bg: 'rgba(79,142,247,0.1)',
    border: 'rgba(79,142,247,0.25)',
    logo: '✦',
  },
  ollama: {
    label: 'Local',
    color: '#34D399',
    bg: 'rgba(52,211,153,0.1)',
    border: 'rgba(52,211,153,0.25)',
    logo: '⬢',
  },
};

/* ─── Job status display ─────────────────────────────────────────────────── */

export const JOB_STATUS_META: Record<
  JobStatus,
  { label: string; color: string; bg: string; border: string }
> = {
  bookmarked: { label: 'Bookmarked', color: '#909090', bg: '#1A1A1A', border: '#282828' },
  applied:    { label: 'Applied',    color: '#A3E635', bg: '#141900', border: '#2A3300' },
  screening:  { label: 'Screening',  color: '#FBBF24', bg: '#1A1200', border: '#352400' },
  interview:  { label: 'Interview',  color: '#60A5FA', bg: '#091420', border: '#0A2040' },
  offer:      { label: 'Offer',      color: '#4ADE80', bg: '#061410', border: '#0A2A1A' },
  rejected:   { label: 'Rejected',   color: '#F87171', bg: '#1A0808', border: '#330E0E' },
};
