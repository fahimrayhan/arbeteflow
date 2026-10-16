export type View =
  | 'resume'
  | 'coverletter'
  | 'chat'
  | 'interview'
  | 'finder'
  | 'tracker'
  | 'settings';

export type ChatMode = 'resume' | 'career' | 'jobcritic';

export type InterviewType = 'behavioral' | 'technical' | 'mixed' | 'case';

export type InterviewDifficulty = 'junior' | 'mid' | 'senior';

export type CoverLetterTone = 'professional' | 'confident' | 'warm';

export type ModelProvider = 'vllm' | 'ollama' | 'openai' | 'anthropic';

export type JobStatus =
  | 'bookmarked'
  | 'applied'
  | 'screening'
  | 'interview'
  | 'offer'
  | 'rejected';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

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

export type JobApplicationInput = Omit<JobApplication, 'id'>;

/** Job details handed from Job Finder to the cover letter or interview view. */
export interface JobDraft {
  company: string;
  role: string;
  description: string;
}

export interface JobMarketMatch {
  similarity_distance: number;
  similarity_score: number;
  metadata: {
    id?: string;
    title?: string;
    company?: string;
    location?: string;
    url?: string;
    description_snippet?: string;
    /** ISO timestamp of when the employer published the ad. */
    published_at?: string;
    [key: string]: unknown;
  };
  document: string;
}

export interface ResearchSource {
  title: string;
  url: string;
}

/** Progress of the optional web research step in cover letter generation. */
export type ResearchEvent =
  | { status: 'searching' }
  | { status: 'used'; sources: ResearchSource[] }
  | { status: 'skipped'; reason: string };

export interface JobSearchFilters {
  /** Only ads whose location contains this text. */
  location?: string;
  /** Only ads published within this many days. */
  maxAgeDays?: number;
}

export interface JobMarketHealth {
  available: boolean;
  total_jobs_indexed?: number;
  seeding?: boolean;
  syncing?: boolean;
  model?: string;
  error?: string;
}

export interface JobMarketResults {
  jobs: JobMarketMatch[];
  count: number;
  query: string;
}

/* ─── API payloads ─────────────────────────────────────────────────────────── */

export interface ApiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface ApiResume {
  id: string;
  title: string;
  rawText: string;
  enhancedText?: string;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ApiCoachSession {
  id: string;
  mode: ChatMode;
  messages: ApiMessage[];
}

export interface ApiInterview {
  id: string;
  role: string;
  company: string;
  jobDescription: string;
  interviewType: InterviewType;
  difficulty: InterviewDifficulty;
  resumeId?: string;
  status: 'active' | 'completed';
  messages: ApiMessage[];
  feedback?: {
    overallScore: number;
    strengths: string[];
    improvements: string[];
    suggestedAnswers: string[];
    preparationPlan: string[];
  };
  createdAt: string;
  updatedAt: string;
}

export interface PublicModelConfig {
  provider: ModelProvider;
  baseUrl: string;
  model: string;
  hasApiKey: boolean;
  updatedAt: string;
}
